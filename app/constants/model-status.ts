export type ModelState =
  | "running"
  | "scaledToZero"
  | "initializing"
  | "pending"
  | "updating"
  | "paused"
  | "failed"
  | "unknown";

export const MODEL_STARTING_STATES: ModelState[] = [
  "initializing",
  "pending",
  "updating",
];

export const MODEL_STATUS_UI: Record<
  ModelState,
  { label: string; hint?: string; dot: string; badge: string }
> = {
  running: {
    label: "Model ready",
    dot: "bg-[#22C55E]",
    badge: "bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]",
  },
  scaledToZero: {
    label: "Model asleep",
    hint: "Your first request wakes it up and can take about 2 minutes.",
    dot: "bg-[#F59E0B]",
    badge: "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]",
  },
  initializing: {
    label: "Model starting",
    hint: "Usually ready in about 2 minutes.",
    dot: "bg-[#3B82F6] animate-pulse",
    badge: "bg-[#EFF6FF] text-[#1E40AF] border-[#BFDBFE]",
  },
  pending: {
    label: "Model starting",
    hint: "Usually ready in about 2 minutes.",
    dot: "bg-[#3B82F6] animate-pulse",
    badge: "bg-[#EFF6FF] text-[#1E40AF] border-[#BFDBFE]",
  },
  updating: {
    label: "Model updating",
    dot: "bg-[#3B82F6] animate-pulse",
    badge: "bg-[#EFF6FF] text-[#1E40AF] border-[#BFDBFE]",
  },
  paused: {
    label: "Model paused",
    hint: "Requests will fail until the endpoint is resumed in Hugging Face.",
    dot: "bg-[#DC3545]",
    badge: "bg-[#FDF1F1] text-[#991B1B] border-[#FECACA]",
  },
  failed: {
    label: "Model failed",
    hint: "The Hugging Face endpoint reported an error.",
    dot: "bg-[#DC3545]",
    badge: "bg-[#FDF1F1] text-[#991B1B] border-[#FECACA]",
  },
  unknown: {
    label: "Model status unavailable",
    dot: "bg-[#9CA3AF]",
    badge: "bg-[#F3F4F6] text-[#374151] border-[#E5E7EB]",
  },
};

export function toModelState(value: unknown): ModelState {
  return typeof value === "string" && value in MODEL_STATUS_UI
    ? (value as ModelState)
    : "unknown";
}
