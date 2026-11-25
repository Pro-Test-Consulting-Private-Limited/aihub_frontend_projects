/** Map OpenAPI / rule `category` onto the four polish groups used in the Functional tab. */

export type ScenarioGroupId = "happy" | "auth" | "edge" | "negative" | "other";

export const SCENARIO_GROUPS: { id: ScenarioGroupId; label: string }[] = [
  { id: "happy", label: "Happy path" },
  { id: "auth", label: "Auth" },
  { id: "edge", label: "Edge" },
  { id: "negative", label: "Negative" },
  { id: "other", label: "Other" },
];

export function scenarioGroupOf(category?: string | null): ScenarioGroupId {
  const c = (category || "").toLowerCase();
  if (!c || c === "functional") return "happy";
  if (c === "authentication" || c === "authorization" || c === "security") return "auth";
  if (c === "boundary" || c === "format" || c === "headers" || c === "idempotency" || c === "data-consistency") return "edge";
  if (c === "validation" || c === "error-handling" || c === "business-rule") return "negative";
  return "other";
}

export function groupLabel(id: ScenarioGroupId): string {
  return SCENARIO_GROUPS.find((g) => g.id === id)?.label ?? id;
}
