"use client";

import { TbX } from "react-icons/tb";
import type { Canvas } from "@/app/interfaces/appatlas";
import { PAGE_OBJECT_STYLES } from "./legend";

export type DrawerView = { kind: "node"; id: string } | { kind: "pageObjects" } | { kind: "testData" };

export function DetailsDrawer({
  canvas,
  view,
  onClose,
  onSelectNode,
}: {
  canvas: Canvas;
  view: DrawerView;
  onClose: () => void;
  onSelectNode: (id: string) => void;
}) {
  const node = view.kind === "node" ? canvas.nodes.find((n) => n.id === view.id) : null;
  const title = node ? node.path : view.kind === "pageObjects" ? "Page Objects" : "Test Data";

  return (
    <div className="absolute top-0 right-0 bottom-0 z-20 flex w-[340px] flex-col border-l border-[#E6E1F5] bg-white shadow-lg dark:border-[#2a2a2a] dark:bg-[#141414]">
      <div className="flex items-center justify-between border-b border-[#EEE] px-4 py-3 dark:border-[#2a2a2a]">
        <div className="truncate text-[14px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">{title}</div>
        <button type="button" onClick={onClose} aria-label="Close details" className="text-[#7E7E7E] hover:text-[#1F1F1F]">
          <TbX size={18} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 text-[12px] text-[#1F1F1F] dark:text-[#ededed]">
        {node && (
          <>
            <div className="mb-1 font-medium">{node.title}</div>
            <a href={node.url} target="_blank" rel="noopener noreferrer" className="mb-2 block truncate text-[11px] text-[#8664F2] underline">
              {node.url}
            </a>
            {node.arrivedVia && <div className="mb-3 text-[11px] text-[#7E7E7E]">{node.arrivedVia.summary}</div>}
            <Section title={`States (${node.stateCount})`}>
              {node.states.map((s) => (
                <div key={s.id} className="mb-3">
                  <div className="mb-1 text-[11px] text-[#7E7E7E]">{s.label} · {s.kind}</div>
                  <a href={s.screenshotUrl} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.screenshotUrl} alt={s.label} loading="lazy" className="w-full rounded-[6px] border border-[#EEE] dark:border-[#2a2a2a]" />
                  </a>
                </div>
              ))}
            </Section>
            <Section title={`Page objects (${node.pageObjectCount})`}>
              <PageObjectList items={node.pageObjects} />
            </Section>
            <Section title="Test data">
              <TestDataList rows={canvas.testData.filter((t) => t.nodeId === node.id)} />
            </Section>
          </>
        )}

        {view.kind === "pageObjects" &&
          canvas.nodes.map((n) => (
            <Section key={n.id} title={n.path} onTitleClick={() => onSelectNode(n.id)}>
              <PageObjectList items={n.pageObjects} />
            </Section>
          ))}

        {view.kind === "testData" && <TestDataList rows={canvas.testData} showPath />}
      </div>
    </div>
  );
}

function Section({ title, children, onTitleClick }: { title: string; children: React.ReactNode; onTitleClick?: () => void }) {
  return (
    <div className="mb-4">
      <div
        onClick={onTitleClick}
        className={`mb-1.5 text-[11px] font-semibold uppercase text-[#5E6066] dark:text-[#9ca3af] ${onTitleClick ? "cursor-pointer hover:text-[#8664F2]" : ""}`}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function PageObjectList({ items }: { items: Canvas["nodes"][number]["pageObjects"] }) {
  if (!items.length) return <div className="text-[11px] text-[#7E7E7E]">None</div>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((po, i) => (
        <span key={i} className={`rounded-[4px] border px-1.5 py-0.5 text-[10.5px] ${PAGE_OBJECT_STYLES[po.type]?.chip ?? PAGE_OBJECT_STYLES.other.chip}`}>
          {po.label}
          {po.value ? ` = ${po.value}` : ""}
        </span>
      ))}
    </div>
  );
}

function TestDataList({ rows, showPath }: { rows: Canvas["testData"]; showPath?: boolean }) {
  if (!rows.length) return <div className="text-[11px] text-[#7E7E7E]">No values were typed.</div>;
  return (
    <table className="w-full text-left text-[11px]">
      <thead>
        <tr className="text-[#7E7E7E]">
          {showPath && <th className="pb-1 font-medium">Page</th>}
          <th className="pb-1 font-medium">Field</th>
          <th className="pb-1 font-medium">Value</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-[#F0F0F0] dark:border-[#2a2a2a]">
            {showPath && <td className="py-1 pr-2">{r.path}</td>}
            <td className="py-1 pr-2">{r.field}</td>
            <td className="py-1 break-all">{r.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
