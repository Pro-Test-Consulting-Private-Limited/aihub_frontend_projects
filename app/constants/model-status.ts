export type ModelState =
  | "running"
  | "scaledToZero"
  | "initializing"
  | "pending"
  | "updating"
  | "paused"
  | "failed"
  | "unknown";

const MODEL_STATES: ModelState[] = [
  "running",
  "scaledToZero",
  "initializing",
  "pending",
  "updating",
  "paused",
  "failed",
  "unknown",
];

export const MODEL_STARTING_STATES: ModelState[] = [
  "initializing",
  "pending",
  "updating",
];

export function toModelState(value: unknown): ModelState {
  return MODEL_STATES.includes(value as ModelState)
    ? (value as ModelState)
    : "unknown";
}
