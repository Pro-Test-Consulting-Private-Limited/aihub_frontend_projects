"use client";

import { TbX } from "react-icons/tb";

export function Modal({
  title,
  onClose,
  children,
  width = 560,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ width }} className="max-w-full rounded-[16px] bg-white px-7 pt-5 pb-6 shadow-xl dark:bg-[#141414]">
        <div className="flex items-center justify-between border-b border-[#D9D9D9] pb-3 dark:border-[#2a2a2a]">
          <h2 className="text-[20px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[#1F1F1F] dark:text-[#ededed]">
            <TbX size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const fieldLabel = "mt-4 mb-1.5 block text-[14px] font-medium text-[#1F1F1F] dark:text-[#ededed]";
export const fieldInput =
  "w-full rounded-[8px] border border-[#BDBDBD] px-3 py-2 text-[13px] text-[#1F1F1F] placeholder:italic placeholder:text-[#7E7E7E] focus:border-[#8664F2] focus:outline-none dark:border-[#2a2a2a] dark:bg-[#0a0a0a] dark:text-[#ededed]";
export const primaryButton =
  "rounded-[8px] bg-[#8664F2] px-5 py-2 text-[14px] font-medium text-white hover:bg-[#7451e8] disabled:cursor-not-allowed disabled:opacity-60";
export const outlineButton =
  "rounded-[8px] border border-[#8664F2] px-5 py-2 text-[14px] font-medium text-[#8664F2] hover:bg-[#F2EBFB] dark:hover:bg-[#2a2440]";
