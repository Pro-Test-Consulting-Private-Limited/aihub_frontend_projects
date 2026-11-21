export type SitDensity = "comfortable" | "compact";

export type SitColumnId =
  | "module"
  | "feature"
  | "prioSev"
  | "preconditions"
  | "steps"
  | "expected";

export const SIT_OPTIONAL_COLUMNS: { id: SitColumnId; label: string }[] = [
  { id: "module", label: "Module" },
  { id: "feature", label: "Feature" },
  { id: "prioSev", label: "Prio / Sev" },
  { id: "preconditions", label: "Preconditions" },
  { id: "steps", label: "Test Steps" },
  { id: "expected", label: "Expected Result" },
];

const DENSITY_KEY = "sit_v2_density";
const COLS_KEY = "sit_v2_hidden_columns";

export function loadSitDensity(): SitDensity {
  if (typeof window === "undefined") return "comfortable";
  try {
    const v = localStorage.getItem(DENSITY_KEY);
    return v === "compact" ? "compact" : "comfortable";
  } catch {
    return "comfortable";
  }
}

export function saveSitDensity(d: SitDensity) {
  try {
    localStorage.setItem(DENSITY_KEY, d);
  } catch {
    /* ignore */
  }
}

export function loadHiddenColumns(): SitColumnId[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(COLS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    const allowed = new Set(SIT_OPTIONAL_COLUMNS.map((c) => c.id));
    return parsed.filter((p): p is SitColumnId => allowed.has(p as SitColumnId));
  } catch {
    return [];
  }
}

export function saveHiddenColumns(cols: SitColumnId[]) {
  try {
    localStorage.setItem(COLS_KEY, JSON.stringify(cols));
  } catch {
    /* ignore */
  }
}
