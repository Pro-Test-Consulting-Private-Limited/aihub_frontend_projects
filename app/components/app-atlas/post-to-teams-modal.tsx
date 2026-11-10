"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TbLoader2, TbUserPlus, TbX } from "react-icons/tb";
import type { CanvasClarification } from "@/app/interfaces/appatlas";
import { Modal, fieldInput, fieldLabel, outlineButton, primaryButton } from "./modal";

export type TeamsMention = { id: string; displayName: string; email?: string | null };

export type PostToTeamsPayload = {
  issueKey: string;
  subject: string;
  text: string;
  mentions: TeamsMention[];
};

function defaultBody(clarification: CanvasClarification): string {
  return clarification.questions.map((q, i) => `${i + 1}. ${q.question}`).join("\n");
}

export function PostToTeamsModal({
  issueKey,
  clarification,
  channelLabel,
  loadMembers,
  onPost,
  onClose,
}: {
  issueKey: string;
  clarification: CanvasClarification;
  channelLabel?: string | null;
  loadMembers: () => Promise<TeamsMention[]>;
  onPost: (payload: PostToTeamsPayload) => Promise<void>;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState(`${issueKey} requirement clarifications`);
  const [text, setText] = useState(() => defaultBody(clarification) || "No open questions.");
  const [members, setMembers] = useState<TeamsMention[] | null>(null);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tagged, setTagged] = useState<TeamsMention[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const items = await loadMembers();
        if (!cancelled) setMembers(items);
      } catch (err) {
        if (!cancelled) {
          setMembers([]);
          setMembersError(err instanceof Error ? err.message : "Could not load team members");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Load once when the compose modal opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only fetch
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = members ?? [];
    const taggedIds = new Set(tagged.map((t) => t.id));
    return list
      .filter((m) => !taggedIds.has(m.id))
      .filter((m) => !q || m.displayName.toLowerCase().includes(q) || (m.email ?? "").toLowerCase().includes(q))
      .slice(0, 8);
  }, [members, query, tagged]);

  const insertMention = (m: TeamsMention) => {
    setTagged((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    const el = textareaRef.current;
    const token = `@${m.displayName}`;
    if (!el) {
      setText((t) => (t.startsWith(token) ? t : `${token} ${t}`));
      setQuery("");
      return;
    }
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const before = text.slice(0, start);
    const after = text.slice(end);
    const needsSpaceBefore = before.length > 0 && !/\s$/.test(before);
    const needsSpaceAfter = after.length > 0 && !/^\s/.test(after);
    const insert = `${needsSpaceBefore ? " " : ""}${token}${needsSpaceAfter ? " " : ""}`;
    const next = `${before}${insert}${after}`;
    setText(next);
    setQuery("");
    requestAnimationFrame(() => {
      const pos = before.length + insert.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const removeTag = (id: string) => {
    setTagged((prev) => prev.filter((t) => t.id !== id));
  };

  const submit = async () => {
    const body = text.trim();
    if (!body) {
      setError("Message cannot be empty");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onPost({
        issueKey,
        subject: subject.trim() || `${issueKey} requirement clarifications`,
        text: body,
        mentions: tagged,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post to Teams");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Post to Teams" onClose={onClose} width={560}>
      {channelLabel && (
        <p className="mt-3 text-[12.5px] text-[#5E6066] dark:text-[#9ca3af]">
          Channel: <span className="font-medium text-[#1F1F1F] dark:text-[#ededed]">{channelLabel}</span>
        </p>
      )}

      <label className={fieldLabel}>Subject</label>
      <input className={fieldInput} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />

      <label className={fieldLabel}>Tag people</label>
      <p className="mb-1.5 text-[11.5px] text-[#6B7280] dark:text-[#9ca3af]">
        The message is posted as you. Search this team to tag someone — people are not added one by one.
      </p>
      <div className="relative">
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {tagged.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 rounded-full border border-[#E6E1F5] bg-[#F4EFFE] px-2 py-0.5 text-[11.5px] text-[#5B3FD1] dark:border-[#2a2a2a] dark:bg-[#1c1530] dark:text-[#c4b5fd]"
            >
              @{t.displayName}
              <button type="button" aria-label={`Remove ${t.displayName}`} onClick={() => removeTag(t.id)} className="opacity-70 hover:opacity-100">
                <TbX size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="relative">
          <TbUserPlus size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#7E7E7E]" />
          <input
            className={`${fieldInput} pl-8`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={members === null ? "Loading people…" : "Search team members…"}
            disabled={members === null}
          />
        </div>
        {query.trim() && filtered.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-[8px] border border-[#E6E1F5] bg-white py-1 shadow-lg dark:border-[#2a2a2a] dark:bg-[#141414]">
            {filtered.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className="flex w-full flex-col px-3 py-1.5 text-left hover:bg-[#F4EFFE] dark:hover:bg-[#1c1530]"
                  onClick={() => insertMention(m)}
                >
                  <span className="text-[13px] text-[#1F1F1F] dark:text-[#ededed]">{m.displayName}</span>
                  {m.email && <span className="text-[11px] text-[#6B7280]">{m.email}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {membersError && (
          <p className="mt-1.5 text-[11.5px] text-[#B45309]">
            People picker unavailable ({membersError}). You can still edit and post the message.
          </p>
        )}
      </div>

      <label className={fieldLabel}>Message</label>
      <textarea
        ref={textareaRef}
        className={`${fieldInput} min-h-[180px] resize-y font-mono text-[12.5px] leading-relaxed`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={4000}
      />
      <div className="mt-1 text-right text-[11px] text-[#9ca3af]">{text.length}/4000</div>

      {error && <p className="mt-2 text-[12.5px] text-[#B91C1C]">{error}</p>}

      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className={outlineButton} onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button type="button" className={primaryButton} onClick={() => void submit()} disabled={busy || !text.trim()}>
          {busy ? (
            <span className="inline-flex items-center gap-1.5">
              <TbLoader2 size={14} className="animate-spin" /> Posting…
            </span>
          ) : (
            "Post to Teams"
          )}
        </button>
      </div>
    </Modal>
  );
}
