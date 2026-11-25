/** Shared Tailwind classes for the endpoint test tabs. Same palette and dark-mode style as endpoint-detail-panel.tsx. */
export const sectionTitle = "flex items-center gap-2 text-[11.5px] font-bold tracking-[0.08em] text-[#1F1F1F] uppercase before:h-[6px] before:w-[6px] before:rounded-full before:bg-[#8664F2] before:content-[''] dark:text-[#ededed]";
export const label = "mb-1.5 text-[10.5px] font-semibold tracking-[0.07em] text-[#5E6066] uppercase dark:text-[#9ca3af]";
export const box = "rounded-[10px] border border-[#E6E8F0] bg-[#F8F9FC] dark:border-[#1a1a1a] dark:bg-[#141414]";
export const input =
  "w-full min-w-0 rounded-[8px] border border-[#D9DCE6] bg-white px-2.5 py-1.5 text-[12.5px] text-[#1F1F1F] outline-none focus:border-[#8664F2] disabled:opacity-50 dark:border-[#2a2a2a] dark:bg-[#0a0a0a] dark:text-[#ededed]";
export const mono = "font-mono";
export const primaryButton =
  "flex items-center justify-center gap-1.5 rounded-[10px] bg-[#8664F2] px-4 py-2 text-[12.5px] font-semibold text-white shadow-[0_2px_8px_rgba(134,100,242,0.35)] hover:bg-[#7451e8] disabled:cursor-not-allowed disabled:opacity-50";
export const outlineButton =
  "flex items-center justify-center gap-1.5 rounded-[8px] border border-[#D9DCE6] bg-white px-3.5 py-1.5 text-[12.5px] text-[#4B5563] hover:bg-[#F5F6F6] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#2a2a2a] dark:bg-[#141414] dark:text-[#9ca3af] dark:hover:bg-[#1a1a1a]";
export const iconButton = "rounded-[6px] p-1 text-[#7E7E7E] hover:bg-[#F0F0F0] hover:text-[#1F1F1F] disabled:opacity-40 dark:hover:bg-[#1f1f1f] dark:hover:text-white";
export const muted = "text-[#7E7E7E]";
export const body = "text-[#5E6066] dark:text-[#9ca3af]";

/** Field names whose values are masked in the UI (password inputs). */
export const SECRET_NAME = /(pass(word|wd)?|secret|token|authorization|api[-_]?key|cookie|credential|bearer)/i;

export const STATUS_STYLE: Record<string, string> = {
  passed: "border-[#16A34A] bg-[#F0FDF4] text-[#16A34A]",
  failed: "border-[#DC2626] bg-[#FEF2F2] text-[#DC2626]",
  blocked: "border-[#D97706] bg-[#FFFBEB] text-[#D97706]",
  skipped: "border-[#E5E7EB] bg-[#F5F6F6] text-[#4B5563] dark:border-[#2a2a2a] dark:bg-[#141414] dark:text-[#9ca3af]",
  inconclusive: "border-[#E5E7EB] bg-[#F5F6F6] text-[#4B5563] dark:border-[#2a2a2a] dark:bg-[#141414] dark:text-[#9ca3af]",
};
