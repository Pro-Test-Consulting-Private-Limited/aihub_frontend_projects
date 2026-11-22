"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { TbChevronDown } from "react-icons/tb";

export type SitSelectOption = {
  value: string;
  label: string;
  group?: string;
  disabled?: boolean;
};

/**
 * App-styled dropdown for SIT v2 — never a native <select>.
 * Round 4: portal popover (never clipped by cell overflow) + mousedown
 * preventDefault so nested editors do not blur before the option click lands.
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
  pill?: boolean;
  triggerLabel?: ReactNode;
  listClassName?: string;
  "aria-label"?: string;
  "data-testid"?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number; minWidth: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((o) => o.value === value);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setPos(null);
      return;
    }
    const r = triggerRef.current.getBoundingClientRect();
    setPos({
      top: r.bottom + 4,
      left: r.left,
      minWidth: Math.max(r.width, 140),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const filtered = query
    ? options.filter(
        (o) =>
          o.label.toLowerCase().startsWith(query.toLowerCase()) ||
          o.label.toLowerCase().includes(query.toLowerCase()),
      )
    : options;

  const groups = new Map<string, SitSelectOption[]>();
  for (const o of filtered) {
    const g = o.group || "";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(o);
  }

  const popover =
    open && pos && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={popRef}
            role="listbox"
            data-sit-select-popover="1"
            data-testid={testId ? `${testId}-popover` : "sit-select-popover"}
            className={`fixed z-[80] rounded-[8px] border border-[#e2e6ef] bg-white py-1 text-[12px] font-[inherit] shadow-lg dark:border-[#2a2a2a] dark:bg-[#151515] ${
              listClassName || "max-h-56 overflow-auto"
            }`}
            style={{ top: pos.top, left: pos.left, minWidth: pos.minWidth }}
            onMouseDown={(e) => {
              // Keep parent editors from blurring before the option click.
              e.preventDefault();
            }}
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
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={`relative inline-block font-[inherit] ${className || ""}`} data-testid={testId}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel || placeholder}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-sit-select-trigger="1"
        className={
          buttonClassName ||
          (pill
            ? "inline-flex items-center gap-0.5 rounded-full border-0 px-2 py-0.5 text-[12px] font-semibold font-[inherit] disabled:opacity-80"
            : "inline-flex h-[28px] items-center gap-1 rounded-[6px] border border-[#e2e6ef] bg-white px-2 text-[12px] font-medium font-[inherit] text-[#1F1F1F] hover:bg-[#fafafa] disabled:opacity-60 dark:border-[#2a2a2a] dark:bg-[#141414] dark:text-[#ededed]")
        }
        onMouseDown={(e) => {
          // Avoid blurring a parent cell editor when opening the menu.
          e.preventDefault();
        }}
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
      {popover}
    </div>
  );
}

export function SitV2SelectPortalNote(): ReactNode {
  return null;
}
