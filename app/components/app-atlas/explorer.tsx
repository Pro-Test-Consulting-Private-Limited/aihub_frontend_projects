"use client";

import { useEffect, useRef, useState } from "react";
import {
  TbChevronDown,
  TbChevronLeft,
  TbChevronRight,
  TbDotsVertical,
  TbFolder,
  TbFolderFilled,
  TbLayoutGrid,
  TbLink,
  TbLock,
  TbPlayerPlay,
  TbNetwork,
  TbListCheck,
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
  canStart: boolean;
  canReplay: boolean;
  onSelect: (id: string) => void;
  onRename: (c: CanvasSummary) => void;
  onDelete: (c: CanvasSummary) => void;
  onNew: () => void;
  onReplay: () => void;
  onCollapse: () => void;
  onExpand?: () => void;
  /** When true, panel animates to a thin rail instead of unmounting. */
  collapsed?: boolean;
  onFocusNode: (id: string) => void;
  onConnect: (c: CanvasSummary) => void;
  /** Swagger spec connected to the selected canvas. Independent of Jira. */
  swagger: CanvasSwagger | null;
  view: "screens" | "api" | "sit";
  /** e.g. "6 Modules, 25 End-Points" */
  apiSummary: string;
  onView: (view: "screens" | "api" | "sit") => void;
};

export function Explorer(props: Props) {
  const { canvases, loading, selectedId, canvas, collapsed = false } = props;
  const [canvasesOpen, setCanvasesOpen] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [panelWidth, setPanelWidth] = useState(270);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = e.clientX - dragRef.current.startX;
      setPanelWidth(Math.min(480, Math.max(200, dragRef.current.startW + delta)));
    };
    const onUp = () => {
      dragRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const displayWidth = collapsed ? 28 : panelWidth;

  return (
    <div
      className="relative flex h-full shrink-0 flex-col overflow-hidden border-r border-[#EEE] bg-white transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] dark:border-[#1a1a1a] dark:bg-[#0a0a0a]"
      style={{ width: displayWidth }}
    >
      {/* Collapsed rail */}
      <button
        type="button"
        onClick={() => props.onExpand?.()}
        aria-hidden={!collapsed}
        tabIndex={collapsed ? 0 : -1}
        className={`absolute inset-0 z-40 flex flex-col items-center gap-1.5 bg-[#F3F4F6] py-3 text-[#5E6066] transition-opacity duration-200 hover:text-[#8664F2] dark:bg-[#161616] dark:text-[#9ca3af] dark:hover:text-[#8664F2] ${
          collapsed ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        title="Show explorer"
      >
        <TbChevronRight size={14} className="shrink-0" />
        {"EXPLORER".split("").map((ch, i) => (
          <span key={`${ch}-${i}`} className="text-[10px] font-semibold leading-none tracking-wide">
            {ch}
          </span>
        ))}
      </button>

      <div
        className={`flex h-full min-w-[200px] flex-col transition-opacity duration-200 ease-out ${
          collapsed ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
        style={{ width: panelWidth }}
      >
      <button
        type="button"
        aria-label="Resize explorer"
        title="Drag to resize"
        className="absolute top-0 right-0 z-30 h-full w-1.5 translate-x-1/2 cursor-ew-resize bg-transparent hover:bg-[#8664F2]/35"
        onMouseDown={(e) => {
          if (collapsed) return;
          e.preventDefault();
          dragRef.current = { startX: e.clientX, startW: panelWidth };
          document.body.style.cursor = "ew-resize";
          document.body.style.userSelect = "none";
        }}
      />
      <div className="flex items-center justify-between border-b border-[#EEE] px-4 py-3 dark:border-[#1a1a1a]">
        <div className="text-[15px] font-medium text-[#1F1F1F] dark:text-[#ededed]">Explorer</div>
        <div className="flex items-center gap-1">
          <button type="button" className={iconButton} title="New canvas: start recording" onClick={props.onNew} disabled={!props.canStart}>
            <TbPlus size={16} />
          </button>
          <button
            type="button"
            className={iconButton}
            title={props.canReplay ? "Replay recording" : "Open a canvas with a recording to replay"}
            onClick={props.onReplay}
            disabled={!props.canReplay}
          >
            <TbPlayerPlay size={15} />
          </button>
          <button type="button" className={iconButton} title="Hide explorer" onClick={props.onCollapse}>
            <TbChevronLeft size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto text-[12px]">
        <SectionHeader open={canvasesOpen} onToggle={() => setCanvasesOpen((o) => !o)} icon={<TbLayoutGrid size={14} className="text-[#8664F2]" />} label="Canvases" />
        <div
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            canvasesOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="min-h-0 overflow-hidden pb-2">
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
                    {active ? <TbChevronDown size={12} className="shrink-0 text-[#7E7E7E] dark:text-[#a3a3a3]" /> : <TbChevronRight size={12} className="shrink-0 text-[#7E7E7E] dark:text-[#a3a3a3]" />}
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
                      <TbLock size={12} className="shrink-0 text-[#c0c0c0] dark:text-[#9ca3af]" title="View only: recorded by someone else" />
                    )}
                  </div>
                  {active && (
                    <div className="mt-1.5 space-y-0.5 pl-[14px]">
                      <ViewRow
                        active={props.view === "screens"}
                        icon={<TbLayoutGrid size={13} />}
                        label={formatCanvasDate(c.createdAt)}
                        meta={`${c.screens} Screens, ${c.transitions} Events`}
                        onClick={() => props.onView("screens")}
                      />
                      {props.swagger && (
                        <ViewRow
                          active={props.view === "api"}
                          icon={<TbNetwork size={13} className="text-[#8664F2]" />}
                          label="API Testing"
                          meta={props.apiSummary}
                          onClick={() => props.onView("api")}
                        />
                      )}
                      <ViewRow
                        active={props.view === "sit"}
                        icon={<TbListCheck size={13} className="text-[#8664F2]" />}
                        label="SIT Testing"
                        meta="Jira → cases + data"
                        onClick={() => props.onView("sit")}
                      />
                    </div>
                  )}
                  {active && (c.isMine || c.jiraProjectKey || props.swagger) && (
                    <div className="mt-2.5">
                      <ConnectedAppsRow
                        canvas={c}
                        jiraKey={c.jiraProjectKey}
                        swaggerTitle={props.swagger?.title ?? null}
                        hasSwagger={!!props.swagger}
                        onConnect={props.onConnect}
                      />
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
        </div>

        <SectionHeader open={detailsOpen} onToggle={() => setDetailsOpen((o) => !o)} icon={<TbFolder size={14} className="text-[#B0359B]" />} label="Canvas Details" />
        <div
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            detailsOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="min-h-0 overflow-hidden pb-4">
            {canvases.map((c) => {
              const open = c.id === selectedId;
              const loaded = open && canvas?.id === c.id ? canvas : null;
              return (
                <div key={c.id}>
                  <div
                    onClick={() => props.onSelect(c.id)}
                    className="flex cursor-pointer items-center gap-2 px-5 py-1.5 hover:bg-[#F9FAFC] dark:hover:bg-[#141414]"
                  >
                    {open ? <TbChevronDown size={12} className="text-[#7E7E7E] dark:text-[#a3a3a3]" /> : <TbChevronRight size={12} className="text-[#7E7E7E] dark:text-[#a3a3a3]" />}
                    <TbFolderFilled size={14} className="text-[#E1962E] dark:text-[#F0B45A]" />
                    <span className="truncate font-medium text-[#1F1F1F] dark:text-[#ededed]">{c.name}</span>
                  </div>
                  <div
                    className={`grid transition-[grid-template-rows,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="min-h-0 overflow-hidden pl-[52px] text-[#5E6066] dark:text-[#9ca3af]">
                      {open && !loaded && <div className="py-1">Loading…</div>}
                      {loaded?.nodes.map((n) => (
                        <TreeLeaf key={n.id} label={n.title || n.path} title={n.path} onClick={() => props.onFocusNode(n.id)} />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

function SectionHeader({ open, onToggle, icon, label }: { open: boolean; onToggle: () => void; icon: React.ReactNode; label: string }) {
  return (
    <div onClick={onToggle} className="flex cursor-pointer items-center gap-2 border-b border-[#F3F3F3] px-4 py-2.5 font-medium text-[#1F1F1F] dark:border-[#1a1a1a] dark:text-[#ededed]">
      <TbChevronDown
        size={13}
        className={`text-[#7E7E7E] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] dark:text-[#a3a3a3] ${
          open ? "rotate-0" : "-rotate-90"
        }`}
      />
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

/**
 * Single Connected control: icons only (name/project live in the tooltip).
 * Opens the connect modal so Jira / Swagger stay independent under one entry point.
 */
function ConnectedAppsRow({
  canvas,
  jiraKey,
  swaggerTitle,
  hasSwagger,
  onConnect,
}: {
  canvas: CanvasSummary;
  jiraKey: string | null | undefined;
  swaggerTitle: string | null;
  hasSwagger: boolean;
  onConnect: (c: CanvasSummary) => void;
}) {
  const chips: { key: string; icon: React.ReactNode; tip: string }[] = [];
  if (jiraKey) {
    chips.push({
      key: "jira",
      icon: <SiJira size={14} color="#2684FF" />,
      tip: `Jira · ${jiraKey}`,
    });
  }
  if (hasSwagger) {
    chips.push({
      key: "swagger",
      icon: <SiSwagger size={14} color="#85EA2D" />,
      tip: swaggerTitle ? `Swagger · ${swaggerTitle}` : "Swagger",
    });
  }

  const title = canvas.isMine
    ? chips.length
      ? `Connected: ${chips.map((c) => c.tip).join(", ")}. Click to manage.`
      : "Connect apps to this canvas"
    : chips.length
      ? `Connected: ${chips.map((c) => c.tip).join(", ")}`
      : "Connected apps";

  return (
    <button
      type="button"
      disabled={!canvas.isMine}
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onConnect(canvas);
      }}
      className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#C9B8F7] bg-[#F4EFFE] px-2 py-1.5 hover:bg-[#EDE4FD] disabled:cursor-default disabled:hover:bg-[#F4EFFE] dark:border-[#3a3060] dark:bg-[#1e1a2e]"
    >
      {chips.length === 0 ? (
        <TbLink size={14} className="text-[#8664F2]" />
      ) : (
        chips.map((chip) => (
          <span
            key={chip.key}
            title={chip.tip}
            className="flex h-[22px] w-[22px] items-center justify-center rounded-[6px] bg-white shadow-sm dark:bg-[#2a2440]"
          >
            {chip.icon}
          </span>
        ))
      )}
    </button>
  );
}
