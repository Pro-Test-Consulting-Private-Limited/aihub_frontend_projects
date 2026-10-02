"use client";

import { useState } from "react";
import {
  TbChevronDown,
  TbChevronLeft,
  TbChevronRight,
  TbDeviceFloppy,
  TbDotsVertical,
  TbFolder,
  TbFolderFilled,
  TbLayoutGrid,
  TbLock,
  TbPlayerPlay,
  TbPlus,
} from "react-icons/tb";
import type { Canvas, CanvasSummary } from "@/app/interfaces/appatlas";

const iconButton =
  "flex h-[26px] w-[26px] items-center justify-center rounded-[6px] text-[#5E6066] hover:bg-[#F2EBFB] hover:text-[#8664F2] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#5E6066] dark:text-[#9ca3af] dark:hover:bg-[#2a2440]";

export const formatCanvasDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });

type Props = {
  canvases: CanvasSummary[];
  loading: boolean;
  selectedId: string | null;
  canvas: Canvas | null;
  canSave: boolean;
  canStart: boolean;
  onSelect: (id: string) => void;
  onRename: (c: CanvasSummary) => void;
  onDelete: (c: CanvasSummary) => void;
  onNew: () => void;
  onRun: () => void;
  onSave: () => void;
  onCollapse: () => void;
  onFocusNode: (id: string) => void;
};

export function Explorer(props: Props) {
  const { canvases, loading, selectedId, canvas } = props;
  const [canvasesOpen, setCanvasesOpen] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  return (
    <div className="flex h-full w-[270px] shrink-0 flex-col border-r border-[#EEE] bg-white dark:border-[#1a1a1a] dark:bg-[#0a0a0a]">
      <div className="flex items-center justify-between border-b border-[#EEE] px-4 py-3 dark:border-[#1a1a1a]">
        <div className="text-[15px] font-medium text-[#1F1F1F] dark:text-[#ededed]">Explorer</div>
        <div className="flex items-center gap-1">
          <button type="button" className={iconButton} title="New canvas: start recording" onClick={props.onNew} disabled={!props.canStart}>
            <TbPlus size={16} />
          </button>
          <button type="button" className={iconButton} title={props.canSave ? "Save execution" : "Nothing to save"} onClick={props.onSave} disabled={!props.canSave}>
            <TbDeviceFloppy size={16} />
          </button>
          <button type="button" className={iconButton} title="Run AppAtlas (desktop, no throttling)" onClick={props.onRun} disabled={!props.canStart}>
            <TbPlayerPlay size={15} />
          </button>
          <button type="button" className={iconButton} title="Hide explorer" onClick={props.onCollapse}>
            <TbChevronLeft size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto text-[12px]">
        <SectionHeader open={canvasesOpen} onToggle={() => setCanvasesOpen((o) => !o)} icon={<TbLayoutGrid size={14} className="text-[#8664F2]" />} label="Canvases" />
        {canvasesOpen && (
          <div className="pb-2">
            {loading && <div className="px-5 py-2 text-[#7E7E7E]">Loading…</div>}
            {!loading && canvases.length === 0 && (
              <div className="px-5 py-2 text-[#7E7E7E]">No canvases for this app yet. Click + to record one.</div>
            )}
            {canvases.map((c) => {
              const active = c.id === selectedId;
              return (
                <div
                  key={c.id}
                  onClick={() => props.onSelect(c.id)}
                  className={`group relative mx-2 mb-1 cursor-pointer rounded-[8px] px-3 py-2 ${
                    active ? "bg-[#FFF6EA] dark:bg-[#2a2440]" : "hover:bg-[#F9FAFC] dark:hover:bg-[#141414]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {active ? <TbChevronDown size={12} className="shrink-0 text-[#7E7E7E]" /> : <TbChevronRight size={12} className="shrink-0 text-[#7E7E7E]" />}
                    <span className="h-[10px] w-[10px] shrink-0 rounded-[2px] border-2 border-[#E1962E] bg-[#FFE7C2]" />
                    <span className="min-w-0 flex-1 truncate font-medium text-[#1F1F1F] dark:text-[#ededed]" title={c.description || c.name}>
                      {c.name}
                    </span>
                    <span className="max-w-[70px] shrink-0 truncate text-[10px] text-[#9ca3af]" title={c.owner.email}>
                      {c.owner.name}
                    </span>
                    {c.isMine ? (
                      <button
                        type="button"
                        className="shrink-0 text-[#9ca3af] hover:text-[#1F1F1F]"
                        aria-label="Canvas actions"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuFor(menuFor === c.id ? null : c.id);
                        }}
                      >
                        <TbDotsVertical size={14} />
                      </button>
                    ) : (
                      <TbLock size={12} className="shrink-0 text-[#c0c0c0]" title="View only: recorded by someone else" />
                    )}
                  </div>
                  {active && (
                    <div className="mt-1.5 flex justify-between pl-[34px] text-[10.5px] text-[#5E6066] dark:text-[#9ca3af]">
                      <span>{formatCanvasDate(c.createdAt)}</span>
                      <span>{c.screens} Screens, {c.transitions} Events</span>
                    </div>
                  )}
                  {menuFor === c.id && (
                    <div
                      className="absolute top-8 right-2 z-30 w-[120px] rounded-[8px] border border-[#E6E1F5] bg-white py-1 shadow-lg dark:border-[#2a2a2a] dark:bg-[#141414]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button type="button" className="block w-full px-3 py-1.5 text-left hover:bg-[#F9FAFC] dark:hover:bg-[#1a1a1a]" onClick={() => { setMenuFor(null); props.onRename(c); }}>
                        Rename
                      </button>
                      <button type="button" className="block w-full px-3 py-1.5 text-left text-[#DC3545] hover:bg-[#FDF1F1] dark:hover:bg-[#1a1a1a]" onClick={() => { setMenuFor(null); props.onDelete(c); }}>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <SectionHeader open={detailsOpen} onToggle={() => setDetailsOpen((o) => !o)} icon={<TbFolder size={14} className="text-[#B0359B]" />} label="Canvas Details" />
        {detailsOpen && (
          <div className="pb-4">
            {canvases.map((c) => {
              const open = c.id === selectedId;
              const loaded = open && canvas?.id === c.id ? canvas : null;
              return (
                <div key={c.id}>
                  <div
                    onClick={() => props.onSelect(c.id)}
                    className="flex cursor-pointer items-center gap-2 px-5 py-1.5 hover:bg-[#F9FAFC] dark:hover:bg-[#141414]"
                  >
                    {open ? <TbChevronDown size={12} className="text-[#7E7E7E]" /> : <TbChevronRight size={12} className="text-[#7E7E7E]" />}
                    <TbFolderFilled size={14} className="text-[#E1962E]" />
                    <span className="truncate font-medium text-[#1F1F1F] dark:text-[#ededed]">{c.name}</span>
                  </div>
                  {open && (
                    <div className="pl-[52px] text-[#5E6066] dark:text-[#9ca3af]">
                      {!loaded && <div className="py-1">Loading…</div>}
                      {loaded?.nodes.map((n) => (
                        <TreeLeaf key={n.id} label={n.title || n.path} title={n.path} onClick={() => props.onFocusNode(n.id)} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ open, onToggle, icon, label }: { open: boolean; onToggle: () => void; icon: React.ReactNode; label: string }) {
  return (
    <div onClick={onToggle} className="flex cursor-pointer items-center gap-2 border-b border-[#F3F3F3] px-4 py-2.5 font-medium text-[#1F1F1F] dark:border-[#1a1a1a] dark:text-[#ededed]">
      {open ? <TbChevronDown size={13} className="text-[#7E7E7E]" /> : <TbChevronRight size={13} className="text-[#7E7E7E]" />}
      {icon}
      {label}
    </div>
  );
}

function TreeLeaf({ label, title, onClick }: { label: string; title?: string; onClick: () => void }) {
  return (
    <div onClick={onClick} title={title} className="cursor-pointer truncate py-1 hover:text-[#8664F2]">
      {label}
    </div>
  );
}
