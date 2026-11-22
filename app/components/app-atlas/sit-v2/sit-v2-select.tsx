"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { TbChevronDown } from "react-icons/tb";

export type SitSelectOption = {
  value: string;
  label: string;
  group?: string;
  disabled?: boolean;
};

/**
 * App-styled dropdown for SIT v2 — never a native <select>, so the OS UI font
 * cannot override DM Sans / the app body font.
 */
export function SitV2Select({
  value,
  options,
  onChange,
  placeholder = "Select",
  disabled,
  className,
  buttonClassName,
  pill,
  triggerLabel,
  listClassName,
  "aria-label": ariaLabel,
  "data-testid": testId,
}: {
  value: string;
  options: SitSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  /** Compact pill look (Prio / Sev / Status chips). */
  pill?: boolean;
  /** Override the closed-button label (still uses options for the list). */
  triggerLabel?: ReactNode;
  /** Extra classes for the options popover (e.g. taller status list). */
  listClassName?: string;
  "aria-label"?: string;
  "data-testid"?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().startsWith(query.toLowerCase()) || o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  const groups = new Map<string, SitSelectOption[]>();
  for (const o of filtered) {
    const g = o.group || "";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(o);
  }

  return (
    <div className={`relative inline-block font-[inherit] ${className || ""}`} ref={ref} data-testid={testId}>
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel || placeholder}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-sit-select-trigger="1"
        className={
          buttonClassName ||
          (pill
            ? "inline-flex items-center gap-0.5 rounded-full border-0 px-2 py-0.5 text-[10.5px] font-semibold font-[inherit] disabled:opacity-80"
            : "inline-flex h-[28px] items-center gap-1 rounded-[6px] border border-[#e2e6ef] bg-white px-2 text-[11px] font-medium font-[inherit] text-[#1F1F1F] hover:bg-[#fafafa] disabled:opacity-60 dark:border-[#2a2a2a] dark:bg-[#141414] dark:text-[#ededed]")
        }
        onClick={() => {
          if (!disabled) setOpen((v) => !v);
        }}
        onKeyDown={(e) => {
          if (e.key.length === 1 && /[a-zA-Z0-9 ]/.test(e.key)) {
            setQuery((q) => q + e.key);
            setOpen(true);
          } else if (e.key === "Backspace") {
            setQuery((q) => q.slice(0, -1));
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      >
        <span className="truncate">{triggerLabel ?? selected?.label ?? placeholder}</span>
        <TbChevronDown size={12} className="shrink-0 opacity-60" />
      </button>
      {open && (
        <div
          role="listbox"
          data-sit-select-popover="1"
          className={`absolute left-0 z-30 mt-1 min-w-[140px] rounded-[8px] border border-[#e2e6ef] bg-white py-1 text-[12px] font-[inherit] shadow-lg dark:border-[#2a2a2a] dark:bg-[#151515] ${
            listClassName || "max-h-56 overflow-auto"
          }`}
        >
          {[...groups.entries()].map(([group, opts]) => (
            <div key={group || "_"}>
              {group ? (
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#8a93a8]">
                  {group}
                </div>
              ) : null}
              {opts.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  disabled={o.disabled}
                  data-sit-select-item="1"
                  className={`block w-full px-3 py-1.5 text-left font-[inherit] hover:bg-[#f3f0ff] disabled:opacity-40 ${
                    o.value === value ? "bg-[#f5f3ff] text-[#5b21b6]" : "text-[#1F1F1F] dark:text-[#ededed]"
                  }`}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          ))}
          {!filtered.length && <div className="px-3 py-2 text-[#9ca3af]">No matches</div>}
        </div>
      )}
    </div>
  );
}

export function SitV2SelectPortalNote(): ReactNode {
  return null;
}
