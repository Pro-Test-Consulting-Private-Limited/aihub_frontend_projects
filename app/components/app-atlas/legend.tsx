"use client";

import type { PageObjectType } from "@/app/interfaces/appatlas";

export const BUTTON_EDGE_COLOR = "#8664F2";
export const LINK_EDGE_COLOR = "#B0359B";

export const PAGE_OBJECT_STYLES: Record<PageObjectType, { label: string; dot: string; chip: string }> = {
  input: { label: "Input", dot: "bg-[#3B82F6]", chip: "border-[#BFDBFE] bg-[#EFF6FF] text-[#1E40AF]" },
  button: { label: "Button", dot: "bg-[#22C55E]", chip: "border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]" },
  link: { label: "Link", dot: "bg-[#F59E0B]", chip: "border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]" },
  select: { label: "Select", dot: "bg-[#8664F2]", chip: "border-[#DDD6FE] bg-[#F5F3FF] text-[#5B21B6]" },
  other: { label: "Other", dot: "bg-[#9CA3AF]", chip: "border-[#E5E7EB] bg-[#F3F4F6] text-[#374151]" },
};

export type LegendFilter =
  | { kind: "edge"; lineStyle: "solid" | "dotted" }
  | { kind: "pageObject"; type: PageObjectType }
  | null;

const sameFilter = (a: LegendFilter, b: LegendFilter) => JSON.stringify(a) === JSON.stringify(b);

export function Legend({
  filter,
  onChange,
  onClose,
}: {
  filter: LegendFilter;
  onChange: (f: LegendFilter) => void;
  onClose: () => void;
}) {
  const item = (f: NonNullable<LegendFilter>, swatch: React.ReactNode, label: string) => {
    const active = sameFilter(filter, f);
    return (
      <button
        type="button"
        key={label}
        onClick={() => onChange(active ? null : f)}
        className={`flex w-full items-center gap-2.5 rounded-[6px] px-2 py-1.5 text-left text-[12px] transition-colors ${
          active
            ? "bg-[#F2EBFB] text-[#8664F2] dark:bg-[#2a2440]"
            : "text-[#333] hover:bg-[#F9FAFC] dark:text-[#ededed] dark:hover:bg-[#1a1a1a]"
        }`}
      >
        {swatch}
        {label}
      </button>
    );
  };

  const line = (color: string, dashed: boolean) => (
    <svg width="26" height="6" className="shrink-0">
      <line x1="0" y1="3" x2="26" y2="3" stroke={color} strokeWidth="2" strokeDasharray={dashed ? "4 3" : undefined} />
    </svg>
  );

  return (
    <div className="w-[220px] rounded-[10px] border border-[#E6E1F5] bg-white p-3 shadow-lg dark:border-[#2a2a2a] dark:bg-[#141414]">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11px] font-semibold tracking-wide text-[#1F1F1F] dark:text-[#ededed]">LEGEND</div>
        <button type="button" onClick={onClose} className="text-[12px] text-[#7E7E7E] hover:text-[#1F1F1F]" aria-label="Close legend">
          ✕
        </button>
      </div>
      {item({ kind: "edge", lineStyle: "solid" }, line(BUTTON_EDGE_COLOR, false), "Button navigation")}
      {item({ kind: "edge", lineStyle: "dotted" }, line(LINK_EDGE_COLOR, true), "Link navigation")}
      <div className="mt-2 mb-1 px-2 text-[10px] font-medium uppercase text-[#9ca3af]">Page objects</div>
      {(Object.keys(PAGE_OBJECT_STYLES) as PageObjectType[]).map((type) =>
        item(
          { kind: "pageObject", type },
          <span className={`ml-[9px] mr-[9px] h-[8px] w-[8px] shrink-0 rounded-full ${PAGE_OBJECT_STYLES[type].dot}`} />,
          PAGE_OBJECT_STYLES[type].label,
        ),
      )}
      {filter && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="mt-2 w-full rounded-[6px] border border-[#E6E1F5] py-1 text-[11px] text-[#5E6066] hover:text-[#8664F2] dark:border-[#2a2a2a]"
        >
          Clear highlight
        </button>
      )}
    </div>
  );
}
