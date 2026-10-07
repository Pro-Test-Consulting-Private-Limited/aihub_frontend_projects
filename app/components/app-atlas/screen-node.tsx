"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { CanvasNode, PageObjectType } from "@/app/interfaces/appatlas";
import { atlasUrl } from "@/app/services/appatlas";
import { PAGE_OBJECT_STYLES } from "./legend";

export type ScreenNodeData = {
  screen: CanvasNode;
  dimmed: boolean;
  selected: boolean;
  onOpenShot: (url: string) => void;
};

export type AtlasScreenNode = Node<ScreenNodeData, "screen">;

export const NODE_WIDTH = 240;
export const NODE_HEIGHT = 250;

const MAX_CHIPS = 5;

export function ScreenNode({ data }: NodeProps<AtlasScreenNode>) {
  const { screen, dimmed, selected, onOpenShot } = data;
  const chips = screen.pageObjects.slice(0, MAX_CHIPS);
  const more = screen.pageObjects.length - chips.length;

  return (
    <div
      style={{ width: NODE_WIDTH }}
      className={`rounded-[10px] border-[1.5px] bg-white dark:bg-[#141414] shadow-sm transition-opacity duration-200 ${
        selected ? "border-[#8664F2] ring-2 ring-[#8664F2]/30" : "border-[#7BC47F]"
      } ${dimmed ? "opacity-25" : "opacity-100"}`}
    >
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <div className="flex items-center justify-between px-3 pt-2 pb-1.5">
        <div className="truncate text-[12px] font-semibold text-[#1F1F1F] dark:text-[#ededed]" title={screen.url}>
          {screen.path}
        </div>
        <div className="ml-2 flex shrink-0 items-center gap-1">
          <span className="rounded-[4px] bg-[#F3F4F6] dark:bg-[#2a2a2a] px-1.5 py-0.5 text-[9px] text-[#5E6066] dark:text-[#9ca3af]">
            States · {screen.stateCount}
          </span>
        </div>
      </div>
      <div className="mx-3 h-[110px] overflow-hidden rounded-[6px] border border-[#EEE] dark:border-[#2a2a2a] bg-[#F9FAFC]">
        {screen.screenshotUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={atlasUrl(screen.screenshotUrl)}
            alt={screen.title}
            loading="lazy"
            title="View screenshot"
            onClick={(e) => {
              e.stopPropagation();
              onOpenShot(atlasUrl(screen.screenshotUrl!));
            }}
            className="nodrag h-full w-full cursor-zoom-in object-cover object-top"
          />
        )}
      </div>
      <div className="flex items-center justify-between px-3 pt-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-[#8664F2]" />
          <span className="truncate text-[10.5px] font-medium text-[#1F1F1F] dark:text-[#ededed]">
            {screen.title || screen.path}
          </span>
        </div>
        <span className="ml-2 shrink-0 text-[9.5px] text-[#7E7E7E]">
          {screen.pageObjectCount} Page objects
        </span>
      </div>
      <div className="flex flex-wrap gap-1 px-3 pt-1.5 pb-2.5">
        {chips.map((po, i) => (
          <span
            key={`${po.type}-${po.label}-${i}`}
            title={po.value ? `${po.label} = ${po.value}` : po.label}
            className={`max-w-[100px] truncate rounded-[4px] border px-1.5 py-0.5 text-[9px] ${chipClass(po.type)}`}
          >
            {po.label}
          </span>
        ))}
        {more > 0 && <span className="px-1 py-0.5 text-[9px] text-[#7E7E7E]">+{more}</span>}
      </div>
      <Handle type="source" position={Position.Right} className="!opacity-0" />
    </div>
  );
}

function chipClass(type: PageObjectType) {
  return PAGE_OBJECT_STYLES[type]?.chip ?? PAGE_OBJECT_STYLES.other.chip;
}
