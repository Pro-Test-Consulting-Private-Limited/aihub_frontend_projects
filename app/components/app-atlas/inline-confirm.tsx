"use client";

import { useEffect, useId, useRef } from "react";
import { TbLoader2 } from "react-icons/tb";
import { outlineButton } from "./modal";

const dangerButton =
  "inline-flex items-center justify-center gap-2 rounded-[8px] bg-[#DC2626] px-5 py-2 text-[14px] font-medium text-white hover:bg-[#B91C1C] disabled:cursor-not-allowed disabled:opacity-60";

export type InlineConfirmProps = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busyLabel?: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * In-panel confirmation (no native dialog). Esc cancels; Enter does not confirm.
 * Focus lands on Cancel. Use inside a modal so a second Esc can close the modal.
 */
export function InlineConfirm({
  title = "Please confirm",
  message,
  confirmLabel = "Disconnect",
  cancelLabel = "Cancel",
  busyLabel,
  busy = false,
  error = null,
  onConfirm,
  onCancel,
}: InlineConfirmProps) {
  const titleId = useId();
  const descId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!busy) onCancel();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [busy, onCancel]);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="mt-4 rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] p-3 dark:border-[#7f1d1d] dark:bg-[#2a1212]"
    >
      <div id={titleId} className="text-[13px] font-semibold text-[#991B1B] dark:text-[#FCA5A5]">
        {title}
      </div>
      <p id={descId} className="mt-1.5 text-[12.5px] leading-relaxed text-[#7F1D1D] dark:text-[#FECACA]">
        {message}
      </p>
      {error && (
        <p className="mt-2 rounded-[6px] bg-white/70 px-2 py-1.5 text-[12px] text-[#991B1B] dark:bg-black/30 dark:text-[#FCA5A5]" role="alert">
          {error}
        </p>
      )}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button
          ref={cancelRef}
          type="button"
          className={outlineButton}
          onClick={onCancel}
          disabled={busy}
        >
          {cancelLabel}
        </button>
        <button type="button" className={dangerButton} onClick={onConfirm} disabled={busy}>
          {busy ? (
            <>
              <TbLoader2 size={14} className="animate-spin" />
              {busyLabel || `${confirmLabel.replace(/\s+$/, "")}…`}
            </>
          ) : error ? (
            `Retry · ${confirmLabel}`
          ) : (
            confirmLabel
          )}
        </button>
      </div>
    </div>
  );
}
