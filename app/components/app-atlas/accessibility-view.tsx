"use client";

import { useEffect, useMemo, useState } from "react";
import { TbAccessible, TbHeartbeat, TbTools } from "react-icons/tb";
import type { AtlasClient } from "@/app/services/appatlas";
import type { Canvas, CanvasSummary } from "@/app/interfaces/appatlas";
import type { CanvasFigma } from "@/app/lib/canvas-figma";
import { DesignValidationView } from "./design-validation-view";
import { HealthPanel } from "./health-panel";
import { PhaseCToolsPanel } from "./phase-c-tools";

type Section = "health" | "wcag" | "tools";

export function AccessibilityView({
  client,
  canvas,
  figma,
  canvases,
  phaseCFlags,
  onConnectApps,
  onChangedNodes,
}: {
  client: AtlasClient;
  canvas: Canvas | null;
  figma: CanvasFigma | null;
  canvases: CanvasSummary[];
  phaseCFlags: { visualDiff: boolean; responsiveSheet: boolean; shareExport: boolean };
  onConnectApps?: () => void;
  onChangedNodes: (ids: string[], releaseLabel: string | null) => void;
}) {
  const [section, setSection] = useState<Section>("health");
  const [nodeId, setNodeId] = useState("");

  const nodes = canvas?.nodes || [];
  const selected = useMemo(() => nodes.find((n) => n.id === nodeId) || null, [nodes, nodeId]);

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

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-[15px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">
            <TbAccessible size={18} className="text-[#8664f2]" />
            Accessibility
          </div>
          <div className="mt-0.5 text-[12px] text-[#7E7E7E]">
            Screen health &amp; axe, Figma WCAG checks, and accessibility tools
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

      {section === "health" ? (
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="min-h-0 overflow-y-auto rounded-[12px] border border-[#E5E7EB] dark:border-[#2a2a2a]">
            <div className="border-b border-[#F0F0F0] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] dark:border-[#1f1f1f]">
              Screens
            </div>
            {nodes.length === 0 ? (
              <div className="p-3 text-[12px] text-[#7E7E7E]">No screens on this canvas.</div>
            ) : (
              nodes.map((n) => {
                const active = n.id === nodeId;
                const level = n.health?.level;
                const dot =
                  level === "ok" ? "bg-[#22C55E]" : level === "warn" ? "bg-[#F59E0B]" : level === "bad" ? "bg-[#EF4444]" : "bg-[#D1D5DB]";
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setNodeId(n.id)}
                    className={`flex w-full items-center gap-2 border-b border-[#F0F0F0] px-3 py-2.5 text-left dark:border-[#1f1f1f] ${
                      active ? "bg-[#F3EEFF] dark:bg-[#1a1428]" : "hover:bg-[#F8F8F8] dark:hover:bg-[#141414]"
                    }`}
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
                    <span className="min-w-0">
                      <span className="block truncate text-[12.5px] font-medium text-[#1F1F1F] dark:text-[#ededed]">
                        {n.path || n.title}
                      </span>
                      <span className="block truncate text-[10px] text-[#7E7E7E]">{n.title}</span>
                    </span>
                  </button>
                );
              })
            )}
          </aside>
          <section className="min-h-0 overflow-y-auto rounded-[12px] border border-[#E5E7EB] dark:border-[#2a2a2a]">
            {selected ? (
              <HealthPanel node={selected} />
            ) : (
              <div className="flex h-full items-center justify-center p-8 text-[13px] text-[#7E7E7E]">
                Select a screen to see health and accessibility findings.
              </div>
            )}
          </section>
        </div>
      ) : null}

      {section === "wcag" ? (
        <div className="min-h-0 flex-1 overflow-hidden rounded-[12px] border border-[#E5E7EB] dark:border-[#2a2a2a]">
          <DesignValidationView
            client={client}
            canvas={canvas}
            figma={figma}
            onConnectApps={onConnectApps}
            panel="accessibility"
          />
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
