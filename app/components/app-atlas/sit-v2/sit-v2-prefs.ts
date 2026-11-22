export type SitDensity = "comfortable" | "compact";

export type SitColumnId =
  | "module"
  | "feature"
  | "prioSev"
  | "priority"
  | "severity"
  | "preconditions"
  | "steps"
  | "expected";

/** Orderable columns (checkbox + ID fixed left; Status fixed right). */
export type SitOrderableColumnId =
  | "module"
  | "feature"
  | "prioSev"
  | "priority"
  | "severity"
  | "scenario"
  | "preconditions"
  | "steps"
  | "expected";

export const SIT_OPTIONAL_COLUMNS: { id: SitColumnId; label: string }[] = [
  { id: "module", label: "Module" },
  { id: "feature", label: "Feature" },
  { id: "prioSev", label: "Priority / Severity" },
  { id: "preconditions", label: "Preconditions" },
  { id: "steps", label: "Test Steps" },
  { id: "expected", label: "Expected Result" },
];

export const SIT_DEFAULT_ORDER: SitOrderableColumnId[] = [
  "module",
  "feature",
  "prioSev",
  "scenario",
  "preconditions",
  "steps",
  "expected",
];

export const SIT_MIN_WIDTHS: Record<string, number> = {
  module: 72,
  feature: 72,
  prioSev: 100,
  priority: 72,
  severity: 72,
  scenario: 160,
  preconditions: 120,
  steps: 220,
  expected: 140,
  status: 110,
  id: 120,
};

const DENSITY_KEY = "sit_v2_density";
const COLS_KEY = "sit_v2_hidden_columns";

export type SitColumnLayout = {
  order: SitOrderableColumnId[];
  widths: Record<string, number>;
  splitPrioSev: boolean;
  hidden: SitColumnId[];
};

function layoutKey(canvasId: string | null | undefined, userKey?: string | null) {
  return `sit_v2_layout_${userKey || "anon"}_${canvasId || "default"}`;
}

export function defaultLayout(hidden: SitColumnId[] = []): SitColumnLayout {
  return {
    order: [...SIT_DEFAULT_ORDER],
    widths: {},
    splitPrioSev: false,
    hidden,
  };
}

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

export function loadColumnLayout(
  canvasId: string | null | undefined,
  userKey?: string | null,
): SitColumnLayout {
  if (typeof window === "undefined") return defaultLayout();
  try {
    const raw = localStorage.getItem(layoutKey(canvasId, userKey));
    if (!raw) return defaultLayout(loadHiddenColumns());
    const parsed = JSON.parse(raw) as Partial<SitColumnLayout>;
    const allowed = new Set<string>([...SIT_DEFAULT_ORDER, "priority", "severity"]);
    const order = (parsed.order || SIT_DEFAULT_ORDER).filter((id): id is SitOrderableColumnId =>
      allowed.has(id),
    );
    const base = defaultLayout(parsed.hidden || loadHiddenColumns());
    return {
      ...base,
      order: order.length ? order : base.order,
      widths: parsed.widths && typeof parsed.widths === "object" ? parsed.widths : {},
      splitPrioSev: !!parsed.splitPrioSev,
      hidden: Array.isArray(parsed.hidden) ? (parsed.hidden as SitColumnId[]) : base.hidden,
    };
  } catch {
    return defaultLayout(loadHiddenColumns());
  }
}

export function saveColumnLayout(
  canvasId: string | null | undefined,
  layout: SitColumnLayout,
  userKey?: string | null,
) {
  try {
    localStorage.setItem(layoutKey(canvasId, userKey), JSON.stringify(layout));
    saveHiddenColumns(layout.hidden);
  } catch {
    /* ignore */
  }
}

export function resetColumnLayout(
  canvasId: string | null | undefined,
  userKey?: string | null,
): SitColumnLayout {
  const next = defaultLayout();
  saveColumnLayout(canvasId, next, userKey);
  return next;
}

/** Move an orderable column up/down in the Columns menu (keyboard alternative). */
export function moveColumnInOrder(
  order: SitOrderableColumnId[],
  id: SitOrderableColumnId,
  dir: "up" | "down",
): SitOrderableColumnId[] {
  const i = order.indexOf(id);
  if (i < 0) return order;
  const j = dir === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= order.length) return order;
  const next = [...order];
  const tmp = next[i]!;
  next[i] = next[j]!;
  next[j] = tmp;
  return next;
}
