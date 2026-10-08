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

export function JiraPanel({
  canvas,
  nodeId,
  onClose,
  onConnect,
}: {
  canvas: Canvas;
  nodeId: string;
  onClose: () => void;
  onConnect?: () => void;
}) {
  const node = canvas.nodes.find((n) => n.id === nodeId);
  const mapping = canvas.jira;
  const [filter, setFilter] = useState<Bucket | null>(null);
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
        </div>

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
        ) : (
          <>
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
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function TicketCard({ ticket, clarification }: { ticket: Ticket; clarification?: CanvasClarification }) {
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

      {clarification && <Clarifications item={clarification} />}
    </div>
  );
}

function Clarifications({ item }: { item: CanvasClarification }) {
  const pending = item.status === "queued" || item.status === "running";

  return (
    <div className="mt-3">
      <div className="mb-1.5 text-[10.5px] font-semibold tracking-wide text-[#5E6066] uppercase dark:text-[#9ca3af]">
        Requirement clarification
        {item.status === "ready" && <span className="ml-1 text-[#E1962E]">{item.questions.length}</span>}
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
    </div>
  );
}
