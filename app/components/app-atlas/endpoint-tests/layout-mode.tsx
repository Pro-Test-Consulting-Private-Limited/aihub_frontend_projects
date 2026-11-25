"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

/**
 * Two layouts of the API Testing panel live side by side: "classic" (Details | Contract | Data Driven | Functional, with all the
 * explanations) and "new" (Details | Setup | Testing, short text with a "?" for the long version). A hidden switch changes between
 * them: press Alt+Shift+L, or hover the bottom-right corner of the panel and click the faint dot. The choice is a display
 * preference (no secret in it), so it is remembered in this browser.
 */
export type LayoutMode = "classic" | "new";

const KEY = "api-testing-layout";
const listeners = new Set<() => void>();
let current: LayoutMode | null = null;

function read(): LayoutMode {
  if (current) return current;
  try {
    current = localStorage.getItem(KEY) === "classic" ? "classic" : "new";
  } catch {
    current = "new";
  }
  return current;
}

export function setLayoutMode(mode: LayoutMode) {
  current = mode;
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* a blocked storage only means the choice is not remembered */
  }
  listeners.forEach((fn) => fn());
}
export const toggleLayoutMode = () => setLayoutMode(read() === "new" ? "classic" : "new");

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};

export const useLayoutMode = (): LayoutMode => useSyncExternalStore(subscribe, read, () => current ?? "new");

/** The hotkey and the faint corner dot. Renders nothing visible until hovered; shows a brief label after each switch. */
export function LayoutSwitch() {
  const mode = useLayoutMode();
  const [toast, setToast] = useState<string | null>(null);

  const flip = () => {
    toggleLayoutMode();
    setToast(`Layout: ${read() === "new" ? "new" : "classic"}`);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && e.code === "KeyL") {
        e.preventDefault();
        flip();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <>
      <button
        type="button"
        onClick={flip}
        title={`Switch layout (Alt+Shift+L). Now: ${mode}`}
        aria-label="Switch between the classic and the new layout"
        className="absolute right-1 bottom-1 z-40 h-3 w-3 rounded-full bg-[#8664F2] opacity-0 transition-opacity hover:opacity-50 focus-visible:opacity-60"
      />
      {toast && <div className="pointer-events-none absolute right-3 bottom-6 z-40 rounded-[6px] bg-[#1F1F1F]/90 px-2.5 py-1 text-[11.5px] text-white" role="status">{toast}</div>}
    </>
  );
}

/**
 * An explanation. Classic layout: the full paragraph, as before. New layout: one short line and a "?" that opens the full text.
 */
export function Hint({ short, small, children }: { short: string; small?: boolean; children: ReactNode }) {
  const mode = useLayoutMode();
  const [open, setOpen] = useState(false);
  const cls = small ? "text-[11.5px] text-[#7E7E7E]" : "text-[12px] leading-relaxed text-[#5E6066] dark:text-[#9ca3af]";
  if (mode === "classic") return <p className={`${small ? "mb-1.5 " : ""}${cls}`}>{children}</p>;
  return (
    <div className={small ? "mb-1.5" : ""}>
      <p className={cls}>
        {short}{" "}
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? "Hide the explanation" : "Show the explanation"} className="inline-flex h-[15px] w-[15px] items-center justify-center rounded-full border border-[#D9D9D9] text-[10px] leading-none text-[#7E7E7E] hover:border-[#8664F2] hover:text-[#8664F2] dark:border-[#2a2a2a]">
          ?
        </button>
      </p>
      {open && <p className={`mt-1 rounded-[6px] bg-[#F5F6F6] px-2.5 py-2 dark:bg-[#141414] ${cls}`}>{children}</p>}
    </div>
  );
}
