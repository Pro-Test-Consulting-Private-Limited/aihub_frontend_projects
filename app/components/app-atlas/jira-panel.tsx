"use client";

import { useMemo, useState } from "react";
import { SiJira } from "react-icons/si";
import {
  TbBolt,
  TbBookmarkFilled,
  TbCircleFilled,
  TbExternalLink,
  TbLink,
  TbLoader2,
  TbPencil,
  TbRefresh,
  TbSquareCheckFilled,
  TbUser,
  TbX,
} from "react-icons/tb";
import type { Canvas, CanvasClarification, JiraIssue, JiraNodeMatch } from "@/app/interfaces/appatlas";

type Bucket = "Epic" | "Story" | "Bug" | "Task";

const BUCKETS: { id: Bucket; icon: React.ReactNode; tint: string }[] = [
  { id: "Epic", icon: <TbBolt size={14} />, tint: "bg-[#7C3AED] text-white" },
  { id: "Story", icon: <TbBookmarkFilled size={13} />, tint: "bg-[#16A34A] text-white" },
  { id: "Bug", icon: <TbCircleFilled size={11} />, tint: "bg-[#DC2626] text-white" },
  { id: "Task", icon: <TbSquareCheckFilled size={14} />, tint: "bg-[#2563EB] text-white" },
];

const bucketOf = (issue: JiraIssue): Bucket => {
  if (issue.level >= 1 || /epic/i.test(issue.type)) return "Epic";
  if (/bug/i.test(issue.type)) return "Bug";
  if (/story/i.test(issue.type)) return "Story";
  return "Task";
};

const STATUS_STYLE: Record<string, string> = {
  done: "bg-[#DCFCE7] text-[#15803D]",
  indeterminate: "bg-[#DBEAFE] text-[#1D4ED8]",
  new: "bg-[#F3F4F6] text-[#4B5563]",
};

const PRIORITY_STYLE = (p?: string) =>
  !p ? "" : /highest|high|critical|blocker/i.test(p) ? "text-[#E1962E]" : /low/i.test(p) ? "text-[#6B7280]" : "text-[#2563EB]";

const initials = (name?: string) =>
  (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

type Ticket = { issue: JiraIssue; match?: JiraNodeMatch; epic?: JiraIssue };
type RetryClarification = (issueKey: string, force: boolean) => Promise<void>;

export function JiraPanel({
  canvas,
  nodeId,
  onClose,
  onConnect,
  onRetryClarification,
  onRefresh,
  onSetTickets,
}: {
  canvas: Canvas;
  nodeId: string;
  onClose: () => void;
  onConnect?: () => void;
  /** Owner only; hides the retry / regenerate buttons when absent. */
  onRetryClarification?: RetryClarification;
  /** Owner only: re-map every screen and regenerate every ticket's questions. */
  onRefresh?: () => Promise<void>;
  /** Owner only: set this screen's tickets by hand, or `null` to go back to the automatic mapping. */
  onSetTickets?: (issueKeys: string[] | null) => Promise<void>;
}) {
  const node = canvas.nodes.find((n) => n.id === nodeId);
  const mapping = canvas.jira;
  const manual = mapping?.manual?.[nodeId];
  const [filter, setFilter] = useState<Bucket | null>(null);
  const [editing, setEditing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");

  const refresh = async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    setRefreshError("");
    try {
      await onRefresh();
    } catch (e) {
      setRefreshError(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };
  const clarifications = useMemo(
    () => new Map((canvas.clarifications ?? []).map((c) => [c.issueKey, c])),
    [canvas.clarifications],
  );

  const tickets = useMemo<Ticket[]>(() => {
    if (!mapping) return [];
    const byKey = new Map(mapping.issues.map((i) => [i.key, i]));
    const epicOf = (issue: JiraIssue) => {
      let key = issue.parentKey;
      for (let hops = 0; key && hops < 4; hops++) {
        const parent = byKey.get(key);
        if (!parent) return undefined;
        if (bucketOf(parent) === "Epic") return parent;
        key = parent.parentKey;
      }
      return undefined;
    };
    const list: Ticket[] = [];
    const seen = new Set<string>();
    for (const match of mapping.nodes[nodeId] ?? []) {
      const issue = byKey.get(match.key);
      if (!issue || seen.has(issue.key)) continue;
      seen.add(issue.key);
      list.push({ issue, match, epic: epicOf(issue) });
    }
    for (const t of [...list]) {
      if (t.epic && !seen.has(t.epic.key)) {
        seen.add(t.epic.key);
        list.push({ issue: t.epic });
      }
    }
    return list;
  }, [mapping, nodeId]);

  const counts = useMemo(() => {
    const c: Record<Bucket, number> = { Epic: 0, Story: 0, Bug: 0, Task: 0 };
    for (const t of tickets) c[bucketOf(t.issue)] += 1;
    return c;
  }, [tickets]);

  const shown = filter ? tickets.filter((t) => bucketOf(t.issue) === filter) : tickets;

  return (
    <div className="absolute top-0 right-0 z-20 flex h-full w-[360px] flex-col border-l border-[#E6E1F5] bg-white shadow-[-8px_0_24px_rgba(0,0,0,0.06)] dark:border-[#2a2a2a] dark:bg-[#0f0f0f]">
      <div className="flex items-center justify-between border-b border-[#EEE] px-4 py-2.5 dark:border-[#1a1a1a]">
        <div className="min-w-0">
          <div className="text-[11px] text-[#7E7E7E]">Agile Project Management &amp; Issue Tracking</div>
          <div className="truncate text-[12px] font-medium text-[#1F1F1F] dark:text-[#ededed]" title={node?.url}>
            {node?.path ?? "Screen"}
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close panel" className="text-[#7E7E7E] hover:text-[#1F1F1F] dark:hover:text-white">
          <TbX size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">
          <SiJira size={16} color="#2684FF" /> Jira Tickets
          {mapping && <span className="text-[11px] font-normal text-[#7E7E7E]">· {mapping.projectKey}</span>}
          {mapping && onRefresh && (
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              title="Fetch the Jira tickets again, re-map every screen and regenerate all clarification questions"
              className="ml-auto flex items-center gap-1 rounded-[6px] border border-[#C9B8F7] px-2 py-0.5 text-[11px] font-medium text-[#8664F2] hover:bg-[#F4EFFE] disabled:opacity-60"
            >
              <TbRefresh size={12} className={refreshing ? "animate-spin" : ""} /> {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          )}
        </div>
        {refreshError && <div className="-mt-2 mb-2 text-[11px] text-[#B91C1C]">{refreshError}</div>}

        {!mapping ? (
          <div className="mt-8 text-center text-[13px] text-[#5E6066] dark:text-[#9ca3af]">
            <p>Connect this canvas to Jira to see which epics, stories, tasks and bugs this screen covers.</p>
            {onConnect && (
              <button
                type="button"
                onClick={onConnect}
                className="mx-auto mt-4 flex items-center gap-2 rounded-[8px] border border-[#C9B8F7] bg-[#F4EFFE] px-4 py-2 text-[13px] font-medium text-[#8664F2] hover:bg-[#EDE4FD]"
              >
                <TbLink size={15} /> Connect
              </button>
            )}
          </div>
        ) : editing && onSetTickets ? (
          <MappingEditor
            issues={mapping.issues}
            initial={(mapping.nodes[nodeId] ?? []).map((m) => m.key)}
            isManual={Boolean(manual)}
            onSave={async (keys) => {
              await onSetTickets(keys);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <>
            {(manual || onSetTickets) && (
              <div className="mb-2 flex items-center justify-between text-[11px] text-[#7E7E7E]">
                <span>{manual ? `Mapped manually${manual.by ? ` by ${manual.by}` : ""}` : "Mapped automatically"}</span>
                {onSetTickets && (
                  <button type="button" onClick={() => setEditing(true)} className="flex items-center gap-1 font-medium text-[#8664F2] hover:underline">
                    <TbPencil size={12} /> Edit mapping
                  </button>
                )}
              </div>
            )}
            <div className="mb-3 grid grid-cols-4 gap-2">
              {BUCKETS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setFilter(filter === b.id ? null : b.id)}
                  className={`flex items-center justify-center gap-1.5 rounded-[8px] border px-1 py-1.5 text-[11.5px] ${
                    filter === b.id
                      ? "border-[#8664F2] bg-[#F4EFFE] text-[#5B3FD1]"
                      : "border-[#E5E7EB] text-[#1F1F1F] hover:border-[#C9B8F7] dark:border-[#2a2a2a] dark:text-[#ededed]"
                  }`}
                >
                  <span className={`flex h-[18px] w-[18px] items-center justify-center rounded-[4px] ${b.tint}`}>{b.icon}</span>
                  {b.id} {counts[b.id]}
                </button>
              ))}
            </div>

            {shown.length === 0 && (
              <div className="mt-6 text-center text-[12.5px] text-[#7E7E7E]">
                {tickets.length ? `No ${filter?.toLowerCase()} tickets on this screen.` : "No Jira tickets matched this screen."}
              </div>
            )}
            {shown.map((t) => (
              <TicketCard
                key={t.issue.key}
                ticket={t}
                clarification={t.match ? clarifications.get(t.issue.key) : undefined}
                onRetry={onRetryClarification}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function MappingEditor({
  issues,
  initial,
  isManual,
  onSave,
  onCancel,
}: {
  issues: JiraIssue[];
  initial: string[];
  isManual: boolean;
  onSave: (keys: string[] | null) => Promise<void>;
  onCancel: () => void;
}) {
  const [picked, setPicked] = useState(() => new Set(initial));
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const q = query.trim().toLowerCase();
  const list = issues
    .filter((i) => !q || `${i.key} ${i.summary}`.toLowerCase().includes(q))
    .sort(
      (a, b) =>
        Number(picked.has(b.key)) - Number(picked.has(a.key)) ||
        Number(bucketOf(a) === "Epic") - Number(bucketOf(b) === "Epic") ||
        a.key.localeCompare(b.key, undefined, { numeric: true }),
    );

  const toggle = (key: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const save = async (keys: string[] | null) => {
    setBusy(true);
    setError("");
    try {
      await onSave(keys);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the mapping");
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-2 text-[12px] text-[#5E6066] dark:text-[#9ca3af]">
        Pick the tickets this screen covers. Manual mappings stay when you Refresh; new tickets get clarification questions.
      </div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search tickets…"
        className="mb-2 w-full rounded-[8px] border border-[#E5E7EB] px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[#8664F2] dark:border-[#2a2a2a] dark:bg-transparent"
      />
      <div className="max-h-[420px] overflow-y-auto rounded-[8px] border border-[#EEE] dark:border-[#2a2a2a]">
        {list.map((i) => {
          const bucket = BUCKETS.find((b) => b.id === bucketOf(i))!;
          return (
            <label
              key={i.key}
              className="flex cursor-pointer items-start gap-2 border-b border-[#F3F4F6] px-2.5 py-1.5 text-[12px] last:border-0 hover:bg-[#FAF8FF] dark:border-[#1a1a1a] dark:hover:bg-[#1a1a1a]"
            >
              <input type="checkbox" checked={picked.has(i.key)} onChange={() => toggle(i.key)} className="mt-0.5 accent-[#8664F2]" />
              <span className={`mt-0.5 flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[3px] ${bucket.tint}`}>{bucket.icon}</span>
              <span className="min-w-0">
                <span className="font-semibold text-[#2563EB]">{i.key}</span>{" "}
                <span className="text-[#1F1F1F] dark:text-[#ededed]">{i.summary}</span>
              </span>
            </label>
          );
        })}
        {list.length === 0 && <div className="px-3 py-4 text-center text-[12px] text-[#7E7E7E]">No tickets match.</div>}
      </div>
      {error && <div className="mt-2 text-[11px] text-[#B91C1C]">{error}</div>}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => save([...picked])}
          className="flex items-center gap-1 rounded-[6px] bg-[#8664F2] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#7550E8] disabled:opacity-60"
        >
          {busy && <TbLoader2 size={12} className="animate-spin" />} Save ({picked.size})
        </button>
        <button type="button" disabled={busy} onClick={onCancel} className="rounded-[6px] px-3 py-1.5 text-[12px] text-[#5E6066] hover:bg-[#F3F4F6] dark:hover:bg-[#1a1a1a]">
          Cancel
        </button>
        {isManual && (
          <button
            type="button"
            disabled={busy}
            onClick={() => save(null)}
            title="Forget the manual list and use the automatic mapping for this screen again"
            className="ml-auto text-[11.5px] font-medium text-[#8664F2] hover:underline disabled:opacity-60"
          >
            Reset to automatic
          </button>
        )}
      </div>
    </div>
  );
}

function TicketCard({
  ticket,
  clarification,
  onRetry,
}: {
  ticket: Ticket;
  clarification?: CanvasClarification;
  onRetry?: RetryClarification;
}) {
  const { issue, epic } = ticket;

  return (
    <div className="mb-3 rounded-[12px] border border-[#E6E1F5] p-3 shadow-sm dark:border-[#2a2a2a]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <a href={issue.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[13px] font-semibold text-[#2563EB] hover:underline">
            {issue.key} <TbExternalLink size={12} />
          </a>
          <span className="rounded-[4px] bg-[#EEF2FF] px-1.5 py-0.5 text-[10px] text-[#4F46E5]">{issue.type.toLowerCase()}</span>
        </div>
        {issue.status && (
          <span className={`shrink-0 rounded-[6px] px-2 py-0.5 text-[10.5px] font-medium ${STATUS_STYLE[issue.statusCategory] ?? STATUS_STYLE.new}`}>
            {issue.status}
          </span>
        )}
      </div>
      <div className="mt-1.5 text-[13.5px] font-semibold leading-snug text-[#1F1F1F] dark:text-[#ededed]">{issue.summary}</div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-[#5E6066] dark:text-[#9ca3af]">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex items-center gap-1" title={issue.assignee ?? "Unassigned"}>
            <TbUser size={12} /> {issue.assignee ? initials(issue.assignee) : "—"}
          </span>
          {epic && (
            <span className="truncate" title={epic.summary}>
              <TbBolt size={11} className="inline text-[#7C3AED]" /> {epic.key}
            </span>
          )}
        </div>
        {issue.priority && <span className={`font-semibold uppercase ${PRIORITY_STYLE(issue.priority)}`}>{issue.priority}</span>}
      </div>

      {clarification && <Clarifications item={clarification} onRetry={onRetry} />}
    </div>
  );
}

function Clarifications({ item, onRetry }: { item: CanvasClarification; onRetry?: RetryClarification }) {
  const [busy, setBusy] = useState(false);
  const [retryError, setRetryError] = useState("");
  const pending = item.status === "queued" || item.status === "running";

  const retry = async (force: boolean) => {
    if (!onRetry) return;
    setBusy(true);
    setRetryError("");
    try {
      await onRetry(item.issueKey, force);
    } catch (e) {
      setRetryError(e instanceof Error ? e.message : "Retry failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3">
      <div className="mb-1.5 flex items-center justify-between text-[10.5px] font-semibold tracking-wide text-[#5E6066] uppercase dark:text-[#9ca3af]">
        <span>
          Requirement clarification
          {item.status === "ready" && <span className="ml-1 text-[#E1962E]">{item.questions.length}</span>}
        </span>
        {onRetry && !pending && (
          <button
            type="button"
            disabled={busy}
            onClick={() => retry(item.status !== "failed")}
            title={item.status === "failed" ? "Try again" : "Generate the questions again"}
            className="flex items-center gap-1 font-medium normal-case tracking-normal text-[#8664F2] hover:underline disabled:opacity-50"
          >
            <TbRefresh size={12} className={busy ? "animate-spin" : ""} /> {item.status === "failed" ? "Retry" : "Regenerate"}
          </button>
        )}
      </div>

      {pending && (
        <div className="flex items-center gap-2 rounded-[6px] bg-[#F4EFFE] px-2 py-1.5 text-[11.5px] text-[#5B3FD1] dark:bg-[#1c1530] dark:text-[#c4b5fd]">
          <TbLoader2 size={13} className="shrink-0 animate-spin" />
          {item.note || (item.status === "queued" ? "Waiting to generate questions…" : "Generating questions…")}
        </div>
      )}

      {item.status === "failed" && (
        <div className="rounded-[6px] bg-[#FEF2F2] px-2 py-1.5 text-[11.5px] text-[#B91C1C] dark:bg-[#2a1215] dark:text-[#fca5a5]">
          Could not generate questions{item.error ? `: ${item.error}` : "."}
        </div>
      )}

      {item.status === "ready" && item.questions.length === 0 && (
        <div className="rounded-[6px] bg-[#ECFDF3] px-2 py-1.5 text-[11.5px] text-[#166534] dark:bg-[#0f2a1a] dark:text-[#86efac]">
          No open questions, the ticket reads as complete.
        </div>
      )}

      {item.status === "ready" && item.questions.length > 0 && (
        <ol className="space-y-1.5">
          {item.questions.map((q, i) => (
            <li key={q.id} className="rounded-[6px] bg-[#F9FAFB] px-2 py-1.5 text-[11.5px] dark:bg-[#1a1a1a]">
              <div className="text-[#1F1F1F] dark:text-[#ededed]">
                {i + 1}. {q.question}
              </div>
              {q.reason && <div className="mt-0.5 text-[10.5px] text-[#6B7280] dark:text-[#9ca3af]">{q.reason}</div>}
            </li>
          ))}
        </ol>
      )}

      {retryError && <div className="mt-1 text-[10.5px] text-[#B91C1C]">{retryError}</div>}
    </div>
  );
}
