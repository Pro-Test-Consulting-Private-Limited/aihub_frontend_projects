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

export type LegendFilter = { type: PageObjectType } | null;

export function Legend({
  filter,
  onChange,
  onClose,
}: {
  filter: LegendFilter;
  onChange: (f: LegendFilter) => void;
  onClose: () => void;
}) {
  const item = (type: PageObjectType) => {
    const active = filter?.type === type;
    return (
      <button
        type="button"
        key={type}
        onClick={() => onChange(active ? null : { type })}
        className={`flex w-full items-center gap-2.5 rounded-[6px] px-2 py-1.5 text-left text-[12px] transition-colors ${
          active
            ? "bg-[#F2EBFB] text-[#8664F2] dark:bg-[#2a2440]"
            : "text-[#333] hover:bg-[#F9FAFC] dark:text-[#ededed] dark:hover:bg-[#1a1a1a]"
        }`}
      >
        <span className={`h-[8px] w-[8px] shrink-0 rounded-full ${PAGE_OBJECT_STYLES[type].dot}`} />
        {PAGE_OBJECT_STYLES[type].label}
      </button>
    );
  };

  return (
    <div className="w-[220px] rounded-[10px] border border-[#E6E1F5] bg-white p-3 shadow-lg dark:border-[#2a2a2a] dark:bg-[#141414]">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11px] font-semibold tracking-wide text-[#1F1F1F] dark:text-[#ededed]">LEGEND</div>
        <button type="button" onClick={onClose} className="text-[12px] text-[#7E7E7E] hover:text-[#1F1F1F]" aria-label="Close legend">
          ✕
        </button>
      </div>
      <div className="mb-1 px-2 text-[10px] font-medium uppercase text-[#9ca3af]">Page objects</div>
      {(Object.keys(PAGE_OBJECT_STYLES) as PageObjectType[]).map(item)}
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
