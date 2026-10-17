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
  TbLink,
  TbLock,
  TbPlayerPlay,
  TbNetwork,
  TbPlus,
} from "react-icons/tb";
import { SiJira, SiSwagger } from "react-icons/si";
import type { Canvas, CanvasSummary } from "@/app/interfaces/appatlas";
import type { CanvasSwagger } from "@/app/lib/canvas-swagger";

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
  onConnect: (c: CanvasSummary) => void;
  /** Swagger spec connected to the selected canvas. Independent of Jira. */
  swagger: CanvasSwagger | null;
  view: "screens" | "api";
  /** e.g. "6 Modules, 25 End-Points" */
  apiSummary: string;
  onView: (view: "screens" | "api") => void;
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
                  {active && props.swagger && (
                    <div className="mt-1.5 space-y-0.5 pl-[14px]">
                      <ViewRow
                        active={props.view === "screens"}
                        icon={<TbLayoutGrid size={13} />}
                        label={formatCanvasDate(c.createdAt)}
                        meta={`${c.screens} Screens, ${c.transitions} Events`}
                        onClick={() => props.onView("screens")}
                      />
                      <ViewRow
                        active={props.view === "api"}
                        icon={<TbNetwork size={13} className="text-[#8664F2]" />}
                        label="API Testing"
                        meta={props.apiSummary}
                        onClick={() => props.onView("api")}
                      />
                    </div>
                  )}
                  {active && !props.swagger && (
                    <div className="mt-1.5 flex justify-between pl-[34px] text-[10.5px] text-[#5E6066] dark:text-[#9ca3af]">
                      <span>{formatCanvasDate(c.createdAt)}</span>
                      <span>{c.screens} Screens, {c.transitions} Events</span>
                    </div>
                  )}
                  {active && (c.isMine || c.jiraProjectKey || props.swagger) && (
                    <div className="mt-2.5 flex flex-col gap-1.5">
                      {c.jiraProjectKey && (
                        <ConnectedAppButton
                          canvas={c}
                          label={`Jira · ${c.jiraProjectKey}`}
                          icon={<SiJira size={12} color="#2684FF" />}
                          title="Manage connected apps"
                          onConnect={props.onConnect}
                        />
                      )}
                      {props.swagger && (
                        <ConnectedAppButton
                          canvas={c}
                          label="Swagger"
                          icon={<SiSwagger size={12} color="#85EA2D" />}
                          title={props.swagger.title ? `Swagger: ${props.swagger.title}` : "Manage connected apps"}
                          onConnect={props.onConnect}
                        />
                      )}
                      {!c.jiraProjectKey && !props.swagger && (
                        <ConnectedAppButton
                          canvas={c}
                          label="Connect"
                          icon={<TbLink size={15} />}
                          bare
                          title="Connect apps to this canvas"
                          onConnect={props.onConnect}
                        />
                      )}
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

function ViewRow({ active, icon, label, meta, onClick }: { active: boolean; icon: React.ReactNode; label: string; meta: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[12px] text-[#1F1F1F] dark:text-[#ededed] ${
        active ? "bg-[#F6E3BE] dark:bg-[#3a3050]" : "hover:bg-[#FBEFD9] dark:hover:bg-[#1a1a1a]"
      }`}
    >
      <span className="shrink-0 text-[#5E6066] dark:text-[#9ca3af]">{icon}</span>
      <span className="min-w-0 truncate font-medium">{label}</span>
      <span className="ml-auto shrink-0 text-[10px] text-[#5E6066] dark:text-[#9ca3af]">{meta}</span>
    </button>
  );
}

/** One button per app connected to the canvas (Jira and Swagger are independent); owner-only, opens the connect modal. */
function ConnectedAppButton({
  canvas,
  label,
  icon,
  title,
  bare,
  onConnect,
}: {
  canvas: CanvasSummary;
  label: string;
  icon: React.ReactNode;
  title: string;
  bare?: boolean;
  onConnect: (c: CanvasSummary) => void;
}) {
  return (
    <button
      type="button"
      disabled={!canvas.isMine}
      title={canvas.isMine ? title : "Connected apps"}
      onClick={(e) => {
        e.stopPropagation();
        onConnect(canvas);
      }}
      className="flex min-w-0 items-center justify-center gap-2 rounded-[8px] border border-[#C9B8F7] bg-[#F4EFFE] py-2 text-[12.5px] font-medium text-[#8664F2] hover:bg-[#EDE4FD] disabled:cursor-default disabled:hover:bg-[#F4EFFE] dark:border-[#3a3060] dark:bg-[#1e1a2e]"
    >
      {bare ? (
        icon
      ) : (
        <span className="flex h-[20px] w-[20px] items-center justify-center rounded-[5px] bg-white shadow-sm">{icon}</span>
      )}
      <span>{label}</span>
    </button>
  );
}
