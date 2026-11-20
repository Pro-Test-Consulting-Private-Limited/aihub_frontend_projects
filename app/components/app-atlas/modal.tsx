"use client";

import { useEffect } from "react";
import { TbX } from "react-icons/tb";

export function Modal({
  title,
  onClose,
  children,
  width = 560,
  /** Cap body height and scroll; header (title + close) stays sticky. */
  scrollBody = false,
  maxBodyHeight = "min(70vh, 560px)",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
  scrollBody?: boolean;
  maxBodyHeight?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // Bubble phase so InlineConfirm (capture) can cancel first.
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{ width }}
        className="flex max-h-[min(92vh,720px)] max-w-full flex-col rounded-[16px] bg-white shadow-xl dark:bg-[#141414]"
      >
        <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-[#D9D9D9] bg-white px-7 pt-5 pb-3 dark:border-[#2a2a2a] dark:bg-[#141414]">
          <h2 className="pr-3 text-[18px] font-semibold leading-snug text-[#1F1F1F] sm:text-[20px] dark:text-[#ededed]">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="shrink-0 text-[#1F1F1F] dark:text-[#ededed]">
            <TbX size={20} />
          </button>
        </div>
        <div
          className={`px-7 pb-6 ${scrollBody ? "min-h-0 flex-1 overflow-y-auto overscroll-contain" : ""}`}
          style={scrollBody ? { maxHeight: maxBodyHeight } : undefined}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export const fieldLabel = "mt-4 mb-1.5 block text-[14px] font-medium text-[#1F1F1F] dark:text-[#ededed]";
export const fieldInput =
  "w-full rounded-[8px] border border-[#BDBDBD] px-3 py-2 text-[13px] text-[#1F1F1F] placeholder:italic placeholder:text-[#7E7E7E] focus:border-[#8664F2] focus:outline-none dark:border-[#2a2a2a] dark:bg-[#0a0a0a] dark:text-[#ededed]";
export const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-[8px] bg-[#8664F2] px-5 py-2 text-[14px] font-medium text-white hover:bg-[#7451e8] disabled:cursor-not-allowed disabled:opacity-60";
export const outlineButton =
  "inline-flex items-center justify-center gap-2 rounded-[8px] border border-[#8664F2] px-5 py-2 text-[14px] font-medium text-[#8664F2] hover:bg-[#F2EBFB] dark:hover:bg-[#2a2440]";
