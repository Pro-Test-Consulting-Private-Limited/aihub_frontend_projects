"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TbBolt, TbBookmarkFilled, TbX } from "react-icons/tb";
import type { CanvasClarification, SitEpic, SitTicket, TicketNote } from "@/app/interfaces/appatlas";

function ago(ts: number) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function SitV2Picker({
  epics,
  selected,
  clarifications,
  activeTicketKey,
  liveCounts,
  onChange,
  onClose,
  onActivateTicket,
  onSaveNote,
}: {
  epics: SitEpic[];
  selected: SitTicket[];
  clarifications: CanvasClarification[];
  /** Ticket whose scope pill is active. Null when All is selected. */
  activeTicketKey?: string | null;
  /** Live non-deleted case counts by ticket key (preferred over generation.caseCount). */
  liveCounts?: Record<string, number>;
  onChange: (tickets: SitTicket[]) => void;
  onClose: () => void;
  onActivateTicket?: (key: string) => void;
  onSaveNote?: (issueKey: string, text: string) => Promise<TicketNote>;
}) {
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {};
    epics.forEach((e, i) => {
      o[e.key] = i === 0;
    });
    return o;
  });
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const selectedSet = useMemo(() => new Set(selected.map((t) => t.key)), [selected]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return epics;
    return epics
      .map((e) => ({
        ...e,
        tickets: e.tickets.filter(
          (t) =>
            t.key.toLowerCase().includes(needle) ||
            t.summary.toLowerCase().includes(needle) ||
            e.summary.toLowerCase().includes(needle),
        ),
      }))
      .filter((e) => e.tickets.length || e.summary.toLowerCase().includes(needle) || e.key.toLowerCase().includes(needle));
  }, [epics, q]);

  const epicCount = filtered.length;
  const storyCount = filtered.reduce((n, e) => n + e.tickets.length, 0);

  const allTickets = useMemo(() => epics.flatMap((e) => e.tickets), [epics]);

  const toggleTicket = (t: SitTicket) => {
    if (selectedSet.has(t.key)) onChange(selected.filter((x) => x.key !== t.key));
    else onChange([...selected, t]);
    setFocusKey(t.key);
  };

  const epicState = (e: SitEpic): boolean | "indeterminate" => {
    if (!e.tickets.length) return false;
    const n = e.tickets.filter((t) => selectedSet.has(t.key)).length;
    if (n === 0) return false;
    if (n === e.tickets.length) return true;
    return "indeterminate";
  };

  const toggleEpic = (e: SitEpic) => {
    const st = epicState(e);
    if (st === true) {
      const drop = new Set(e.tickets.map((t) => t.key));
      onChange(selected.filter((t) => !drop.has(t.key)));
    } else {
      const map = new Map(selected.map((t) => [t.key, t]));
      for (const t of e.tickets) map.set(t.key, t);
      onChange([...map.values()]);
    }
  };

  const focusClar = focusKey ? clarifications.find((c) => c.issueKey === focusKey) : null;
  const showSide = Boolean(focusKey);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sit-picker-title"
        className={`relative flex max-h-[min(720px,90vh)] w-full overflow-hidden rounded-[12px] border border-[#e2e6ef] bg-white shadow-2xl dark:border-[#2a2a2a] dark:bg-[#101010] ${
          showSide ? "max-w-4xl" : "max-w-2xl"
        }`}
      >
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-[#eef0f5] px-4 py-3 dark:border-[#1a1a1a]">
            <div>
              <h2 id="sit-picker-title" className="text-[12px] font-semibold uppercase tracking-wide text-[#6b7280]">
                Epic / Ticket Hierarchy
              </h2>
              <p className="mt-0.5 text-[12px] text-[#8a93a8]">
                {epicCount} Epics · {storyCount} Active Stories
              </p>
            </div>
            <button type="button" onClick={onClose} className="rounded p-1 text-[#6b7280] hover:bg-[#f3f4f6]" aria-label="Close picker">
              <TbX size={18} />
            </button>
          </div>
          <div className="border-b border-[#eef0f5] px-4 py-2 dark:border-[#1a1a1a]">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search epics and tickets…"
              className="w-full rounded-[8px] border border-[#e2e6ef] bg-[#fafafa] px-3 py-2 text-[13px] outline-none focus:border-[#8664F2] dark:border-[#2a2a2a] dark:bg-[#141414]"
            />
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {filtered.map((epic) => {
              const st = epicState(epic);
              return (
                <li key={epic.key} className="border-b border-[#f3f4f6] dark:border-[#1a1a1a]">
                  <div className="flex items-center gap-2 px-3 py-2.5 hover:bg-[#fafafa] dark:hover:bg-[#141414]">
                    <input
                      type="checkbox"
                      checked={st === true}
                      ref={(el) => {
                        if (el) el.indeterminate = st === "indeterminate";
                      }}
                      onChange={() => toggleEpic(epic)}
                      className="accent-[#8664F2]"
                      aria-label={`Select all in ${epic.key}`}
                    />
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      onClick={() => setExpanded((e) => ({ ...e, [epic.key]: !e[epic.key] }))}
                    >
                      <span className="w-3 text-[#8664F2]">{expanded[epic.key] ? "▾" : "▸"}</span>
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-[#7C3AED] text-white">
                        <TbBolt size={11} />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#1F1F1F] dark:text-[#ededed]">
                        {epic.summary}
                        <span className="ml-2 text-[11px] font-normal text-[#8a93a8]">
                          {epic.key !== "_unassigned" ? epic.key : ""} · {epic.tickets.length}
                        </span>
                      </span>
                    </button>
                  </div>
                  {expanded[epic.key] && (
                    <ul className="bg-[#fcfcfd] dark:bg-[#0c0c0c]">
                      {epic.tickets.map((t) => {
                        const on = selectedSet.has(t.key);
                        const rcq =
                          t.rcqComplete || (t.rcqCount === 0 && t.rcqCount != null)
                            ? "No RCQs"
                            : t.rcqCount
                              ? `${t.rcqCount} RCQs`
                              : null;
                        const gen = t.generation;
                        return (
                          <li key={t.key}>
                            <label
                              className={`flex cursor-pointer items-start gap-2 border-t border-[#f3f4f6] py-2 pr-3 pl-10 text-[12.5px] dark:border-[#1a1a1a] ${
                                on ? "bg-[#f3f0ff] dark:bg-[#1c1530]" : "hover:bg-[#f9fafb]"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={on}
                                onChange={() => toggleTicket(t)}
                                className="mt-0.5 accent-[#8664F2]"
                              />
                              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#16A34A] text-white">
                                <TbBookmarkFilled size={10} />
                              </span>
                              <button
                                type="button"
                                className="min-w-0 flex-1 text-left"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setFocusKey(t.key);
                                  toggleTicket(t);
                                }}
                              >
                                <span className="font-medium text-[#1F1F1F] dark:text-[#ededed]">{t.key}</span>
                                <span className="text-[#5b647a]">: {t.summary}</span>
                                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                  {rcq && (
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                        rcq === "No RCQs"
                                          ? "bg-[#f0fdf4] text-[#166534]"
                                          : "bg-[#fff7ed] text-[#c2410c]"
                                      }`}
                                    >
                                      {rcq}
                                    </span>
                                  )}
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] ${
                                      t.hasNotes ? "bg-[#ede9fe] text-[#5b21b6]" : "bg-[#f3f4f6] text-[#9ca3af]"
                                    }`}
                                  >
                                    {t.hasNotes ? "Has notes" : "No notes"}
                                  </span>
                                  <span
                                    className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-[12px] text-[#4b5563]"
                                    data-testid={`sit-jira-case-count-${t.key}`}
                                  >
                                    {liveCounts && liveCounts[t.key] != null
                                      ? `${liveCounts[t.key]} cases${
                                          gen
                                            ? ` · ${gen.generator === "huggingface" ? "AI" : "Template"} · ${ago(gen.at)}${
                                                gen.versions > 1 ? ` · v${gen.versions} generated ${gen.caseCount}` : ""
                                              }`
                                            : ""
                                        }`
                                      : gen
                                        ? `${gen.caseCount} cases · ${gen.generator === "huggingface" ? "AI" : "Template"} · ${ago(gen.at)}${
                                            gen.edited ? " · edited" : ""
                                          }${gen.versions > 1 ? ` · v${gen.versions}` : ""}`
                                        : "Not generated"}
                                  </span>
                                  {activeTicketKey && activeTicketKey === t.key && (
                                    <span
                                      className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-[#8664F2] px-2 py-0.5 text-[12px] font-semibold text-white"
                                      data-testid="sit-jira-active-tab-badge"
                                      title="This ticket is the active scope pill in the Cases grid"
                                    >
                                      Active tab
                                    </span>
                                  )}
                                  {onActivateTicket && (
                                    <button
                                      type="button"
                                      className="text-[10px] font-medium text-[#8664F2] underline-offset-2 hover:underline"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setFocusKey(t.key);
                                        onActivateTicket(t.key);
                                      }}
                                    >
                                      View
                                    </button>
                                  )}
                                </div>
                              </button>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-between gap-2 border-t border-[#eef0f5] px-4 py-3 dark:border-[#1a1a1a]">
            <span className="text-[12.5px] text-[#5b647a]">{selected.length} selected</span>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-[8px] border border-[#e2e6ef] px-3 py-1.5 text-[12.5px] dark:border-[#2a2a2a]"
                onClick={() => onChange([])}
              >
                Clear
              </button>
              <button
                type="button"
                className="rounded-[8px] bg-[#8664F2] px-4 py-1.5 text-[12.5px] font-medium text-white"
                onClick={onClose}
              >
                Done
              </button>
            </div>
          </div>
        </div>

        {showSide && (
          <aside className="hidden w-[280px] shrink-0 overflow-y-auto border-l border-[#eef0f5] bg-[#fafafa] p-3 text-[12px] dark:border-[#1a1a1a] dark:bg-[#0c0c0c] sm:block">
            <div className="mb-2 font-semibold text-[#1F1F1F] dark:text-[#ededed]">
              {focusClar?.issueKey || focusKey}
            </div>
            <p className="mb-2 text-[#6b7280]">{focusClar?.summary || ""}</p>
            {focusClar?.questions?.length ? (
              <ol className="list-decimal space-y-2 pl-4 text-[#374151]">
                {focusClar.questions.map((qq) => (
                  <li key={qq.id}>
                    <div className="font-medium">{qq.question}</div>
                    {qq.reason ? <div className="text-[11px] text-[#8a93a8]">{qq.reason}</div> : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-[#16a34a]">No questions ,  ticket reads as complete.</p>
            )}
            <PickerNotes
              issueKey={focusClar?.issueKey || focusKey || ""}
              saved={focusClar?.notes?.text || ""}
              editable={Boolean(onSaveNote)}
              onSaveNote={onSaveNote}
            />
          </aside>
        )}
      </div>
      {/* keep allTickets referenced for future select-all */}
      <span className="hidden">{allTickets.length}</span>
    </div>
  );
}

function PickerNotes({
  issueKey,
  saved,
  editable,
  onSaveNote,
}: {
  issueKey: string;
  saved: string;
  editable: boolean;
  onSaveNote?: (issueKey: string, text: string) => Promise<TicketNote>;
}) {
  const [text, setText] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const textRef = useRef(text);
  const prevSaved = useRef(saved);
  textRef.current = text;

  useEffect(() => {
    if (textRef.current === prevSaved.current) setText(saved);
    prevSaved.current = saved;
  }, [saved, issueKey]);

  const save = async () => {
    if (!editable || !onSaveNote || !issueKey) return;
    const next = text.trim();
    if (next === saved) {
      if (next !== text) setText(next);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSaveNote(issueKey, next);
      setText(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the note.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-[8px] border border-[#e2e6ef] bg-white p-2 dark:border-[#2a2a2a] dark:bg-[#141414]">
      <div className="mb-1 text-[10px] font-semibold uppercase text-[#8a93a8]">Notes</div>
      {editable ? (
        <textarea
          value={text}
          maxLength={4000}
          rows={4}
          placeholder="Answer RCQs here before Generate (canvas-only)"
          onChange={(e) => setText(e.target.value)}
          onBlur={() => void save()}
          className="w-full resize-y rounded-[6px] border border-[#E5E7EB] bg-[#F9FAFB] px-2 py-1.5 text-[11.5px] text-[#1F1F1F] outline-none focus:border-[#8664F2] dark:border-[#2a2a2a] dark:bg-[#1a1a1a] dark:text-[#ededed]"
        />
      ) : (
        <p className="whitespace-pre-wrap text-[#374151]">{saved || "No notes."}</p>
      )}
      {(busy || error) && (
        <div className="mt-0.5 text-[10.5px] text-[#6b7280]">
          {busy ? "Saving…" : <span className="text-[#B91C1C]">{error}</span>}
        </div>
      )}
    </div>
  );
}
