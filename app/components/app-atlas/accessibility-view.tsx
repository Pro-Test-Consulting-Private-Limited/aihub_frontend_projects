"use client";

import { useEffect, useMemo, useState } from "react";
import { TbAccessible, TbHeartbeat, TbTools } from "react-icons/tb";
import type { AtlasClient } from "@/app/services/appatlas";
import { atlasUrl } from "@/app/services/appatlas";
import type { Canvas, CanvasNode, CanvasSummary } from "@/app/interfaces/appatlas";
import { HealthPanel } from "./health-panel";
import { PhaseCToolsPanel } from "./phase-c-tools";
import { WcagPanel } from "./wcag-panel";

type Section = "health" | "wcag" | "tools";

function ScreenRail({
  nodes,
  nodeId,
  stateId,
  onSelectNode,
  onSelectState,
}: {
  nodes: CanvasNode[];
  nodeId: string;
  stateId: string;
  onSelectNode: (id: string) => void;
  onSelectState: (nodeId: string, stateId: string) => void;
}) {
  if (nodes.length === 0) {
    return <div className="p-3 text-[12px] text-[#7E7E7E]">No screens on this canvas.</div>;
  }

  return (
    <div className="space-y-2 p-2">
      {nodes.map((n) => {
        const active = n.id === nodeId;
        const level = n.health?.level;
        const dot =
          level === "ok"
            ? "bg-[#22C55E]"
            : level === "warn"
              ? "bg-[#F59E0B]"
              : level === "bad"
                ? "bg-[#EF4444]"
                : "bg-[#D1D5DB]";
        const primaryUrl = n.screenshotUrl ? atlasUrl(n.screenshotUrl) : "";
        const a11yCount = n.health?.a11yViolations ?? 0;

        return (
          <div key={n.id} className="space-y-1.5">
            <button
              type="button"
              onClick={() => onSelectNode(n.id)}
              className={`w-full overflow-hidden rounded-[10px] border text-left transition ${
                active && !stateId
                  ? "border-[#8664f2] ring-2 ring-[#8664f2]/30"
                  : active
                    ? "border-[#8664f2]"
                    : "border-[#E5E7EB] hover:border-[#C4B5FD] dark:border-[#2a2a2a]"
              }`}
            >
              <div className="aspect-[4/3] bg-[#F8FAFC] dark:bg-[#0f0f0f]">
                {primaryUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={primaryUrl}
                    alt={n.title || n.path}
                    className="h-full w-full object-cover object-top"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[10px] text-[#9CA3AF]">No shot</div>
                )}
              </div>
              <div className="flex items-start gap-2 p-2">
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${dot}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-medium text-[#1F1F1F] dark:text-[#ededed]">
                    {n.path || n.title}
                  </span>
                  <span className="block truncate text-[10px] text-[#7E7E7E]">
                    {n.title}
                    {n.states.length > 0 ? ` · ${n.states.length} state${n.states.length === 1 ? "" : "s"}` : ""}
                    {a11yCount > 0 ? ` · ${a11yCount} a11y` : ""}
                  </span>
                </span>
              </div>
            </button>

            {active && n.states.length > 0 ? (
              <div className="grid grid-cols-2 gap-1.5 px-0.5">
                {n.states.map((s) => {
                  const stSelected = stateId === s.id;
                  const stUrl = s.screenshotUrl ? atlasUrl(s.screenshotUrl) : "";
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onSelectState(n.id, s.id)}
                      className={`overflow-hidden rounded-[8px] border text-left ${
                        stSelected
                          ? "border-[#8664f2] ring-1 ring-[#8664f2]/40"
                          : "border-[#E5E7EB] dark:border-[#2a2a2a]"
                      }`}
                    >
                      <div className="aspect-[4/3] bg-[#F8FAFC] dark:bg-[#0f0f0f]">
                        {stUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={stUrl}
                            alt={s.label || s.kind}
                            className="h-full w-full object-cover object-top"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-[9px] text-[#9CA3AF]">—</div>
                        )}
                      </div>
                      <div className="truncate px-1.5 py-1 text-[10px] text-[#5E6066]">
                        {s.label || s.kind || "State"}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function AccessibilityView({
  client,
  canvas,
  canvases,
  phaseCFlags,
  onChangedNodes,
}: {
  client: AtlasClient;
  canvas: Canvas | null;
  canvases: CanvasSummary[];
  phaseCFlags: { visualDiff: boolean; responsiveSheet: boolean; shareExport: boolean };
  onChangedNodes: (ids: string[], releaseLabel: string | null) => void;
  /** Kept for call-site compatibility; WCAG here does not use Figma. */
  figma?: unknown;
  onConnectApps?: () => void;
}) {
  const [section, setSection] = useState<Section>("health");
  const [nodeId, setNodeId] = useState("");
  const [stateId, setStateId] = useState("");

  const nodes = canvas?.nodes || [];
  const selected = useMemo(() => nodes.find((n) => n.id === nodeId) || null, [nodes, nodeId]);
  const selectedState = useMemo(
    () => selected?.states.find((s) => s.id === stateId) || null,
    [selected, stateId],
  );

  useEffect(() => {
    if (!nodeId && nodes[0]?.id) setNodeId(nodes[0].id);
  }, [nodes, nodeId]);

  if (!canvas) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-[13px] text-[#7E7E7E]">
        Select a canvas to review Accessibility.
      </div>
    );
  }

  const showRail = section === "health" || section === "wcag";

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-[15px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">
            <TbAccessible size={18} className="text-[#8664f2]" />
            Accessibility
          </div>
          <div className="mt-0.5 text-[12px] text-[#7E7E7E]">
            Health (runtime) · WCAG 2.1 A/AA (axe) · tools — no Figma required
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["health", "Health", TbHeartbeat],
              ["wcag", "WCAG checks", TbAccessible],
              ["tools", "Accessibility tools", TbTools],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium ${
                section === id
                  ? "bg-[#8664f2] text-white"
                  : "border border-[#E5E7EB] text-[#5E6066] dark:border-[#2a2a2a]"
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {showRail ? (
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col overflow-hidden rounded-[12px] border border-[#E5E7EB] dark:border-[#2a2a2a]">
            <div className="shrink-0 border-b border-[#F0F0F0] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] dark:border-[#1f1f1f]">
              Screens &amp; states
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ScreenRail
                nodes={nodes}
                nodeId={nodeId}
                stateId={stateId}
                onSelectNode={(id) => {
                  setNodeId(id);
                  setStateId("");
                }}
                onSelectState={(nid, sid) => {
                  setNodeId(nid);
                  setStateId(sid);
                }}
              />
            </div>
          </aside>

          <section className="min-h-0 overflow-y-auto rounded-[12px] border border-[#E5E7EB] dark:border-[#2a2a2a]">
            {selected ? (
              <div>
                {selectedState?.screenshotUrl ? (
                  <div className="border-b border-[#F0F0F0] p-3 dark:border-[#1f1f1f]">
                    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                      Selected state · {selectedState.label || selectedState.kind}
                    </div>
                    <div className="overflow-hidden rounded-[10px] border border-[#E5E7EB] bg-[#F8FAFC] dark:border-[#2a2a2a] dark:bg-[#0f0f0f]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={atlasUrl(selectedState.screenshotUrl)}
                        alt={selectedState.label || selectedState.kind}
                        className="max-h-[220px] w-full object-contain object-top"
                      />
                    </div>
                  </div>
                ) : null}
                {section === "health" ? <HealthPanel node={selected} /> : <WcagPanel node={selected} />}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center p-8 text-[13px] text-[#7E7E7E]">
                Select a screen to see {section === "health" ? "health" : "WCAG 2.1"} findings.
              </div>
            )}
          </section>
        </div>
      ) : null}

      {section === "tools" ? (
        <div className="min-h-0 flex-1 overflow-y-auto rounded-[12px] border border-[#E5E7EB] p-4 dark:border-[#2a2a2a]">
          <div className="mb-2 text-[13px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">
            Accessibility tools · {canvas.name}
          </div>
          <p className="mb-3 text-[12px] text-[#7E7E7E]">
            Canvas-vs-canvas visual diff, responsive contact sheet, and share / PDF export (formerly on the Canvas
            toolbar).
          </p>
          <PhaseCToolsPanel
            client={client}
            canvasId={canvas.id}
            canvases={canvases}
            flags={phaseCFlags}
            onChangedNodes={onChangedNodes}
          />
        </div>
      ) : null}
    </div>
  );
}
