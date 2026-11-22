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

/** Round 4 B1 — weighted defaults at 1440px reference width. */
export const SIT_DEFAULT_WIDTHS: Record<string, number> = {
  id: 150,
  module: 120,
  feature: 120,
  prioSev: 150,
  priority: 100,
  severity: 100,
  scenario: 240,
  preconditions: 320,
  steps: 380,
  expected: 320,
  status: 130,
};

/** Absolute floor used by resize handles (never below these). */
export const SIT_MIN_WIDTHS: Record<string, number> = {
  module: 100,
  feature: 100,
  prioSev: 130,
  priority: 80,
  severity: 80,
  scenario: 200,
  preconditions: 220,
  steps: 260,
  expected: 220,
  status: 110,
  id: 110,
};

/**
 * R8-01 — lower bounds used when auto-fitting to the grid container.
 * Same values as SIT_MIN_WIDTHS for the visible default set.
 */
export const SIT_FIT_MIN_WIDTHS: Record<string, number> = {
  ...SIT_MIN_WIDTHS,
};

/** Sticky checkbox column width subtracted from available container width. */
export const SIT_CHECKBOX_COL_WIDTH = 32;

export function sumColumnWidths(
  widths: Record<string, number>,
  colIds: readonly string[],
): number {
  let n = 0;
  for (const id of colIds) n += widths[id] ?? SIT_DEFAULT_WIDTHS[id] ?? 0;
  return n;
}

/**
 * Fit preferred column widths into `availablePx` (grid container inner width
 * after checkbox). Shrinks proportionally toward SIT_FIT_MIN_WIDTHS when the
 * preferred total exceeds available. Below the sum of fit mins, returns the
 * mins (caller scrolls horizontally). User-resized columns are not auto-shrunk.
 */
export function fitColumnWidthsToContainer(
  preferred: Record<string, number>,
  colIds: readonly string[],
  availablePx: number,
  opts?: { userResized?: Set<string> },
): Record<string, number> {
  const userResized = opts?.userResized ?? new Set<string>();
  const minOf = (id: string) => SIT_FIT_MIN_WIDTHS[id] ?? SIT_MIN_WIDTHS[id] ?? 72;
  const out: Record<string, number> = {};
  for (const id of colIds) {
    out[id] = preferred[id] ?? SIT_DEFAULT_WIDTHS[id] ?? minOf(id);
  }
  const preferredTotal = sumColumnWidths(out, colIds);
  if (!(availablePx > 0) || preferredTotal <= availablePx) return out;

  const minTotal = colIds.reduce((s, id) => s + minOf(id), 0);
  if (availablePx <= minTotal) {
    for (const id of colIds) out[id] = minOf(id);
    return out;
  }

  const locked = new Set<string>();
  let lockedSum = 0;
  for (const id of colIds) {
    if (userResized.has(id)) {
      locked.add(id);
      lockedSum += out[id]!;
    }
  }
  const flexIds = colIds.filter((id) => !locked.has(id));
  const budget = availablePx - lockedSum;
  const flexMin = flexIds.reduce((s, id) => s + minOf(id), 0);
  if (budget < flexMin) {
    for (const id of colIds) out[id] = minOf(id);
    return out;
  }

  let flexSum = flexIds.reduce((s, id) => s + out[id]!, 0);
  if (flexSum <= budget) return out;

  let remainingCut = flexSum - budget;
  for (let pass = 0; pass < 8 && remainingCut > 0.5; pass++) {
    const slackEntries = flexIds.map((id) => ({
      id,
      slack: Math.max(0, out[id]! - minOf(id)),
    }));
    const totalSlack = slackEntries.reduce((s, x) => s + x.slack, 0);
    if (totalSlack <= 0) break;
    for (const { id, slack } of slackEntries) {
      if (slack <= 0) continue;
      out[id] = out[id]! - Math.min(slack, (remainingCut * slack) / totalSlack);
    }
    flexSum = flexIds.reduce((s, id) => s + out[id]!, 0);
    remainingCut = flexSum - budget;
  }

  for (const id of colIds) out[id] = Math.max(minOf(id), Math.floor(out[id]!));
  // Fix rounding residual on the last unlocked column so total <= availablePx.
  const lastFlex = flexIds[flexIds.length - 1];
  if (lastFlex) {
    const others = sumColumnWidths(
      out,
      colIds.filter((c) => c !== lastFlex),
    );
    out[lastFlex] = Math.max(minOf(lastFlex), availablePx - others);
  }
  // Final clamp: if still over (locked columns), leave as-is for horizontal scroll.
  return out;
}

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
    widths: { ...SIT_DEFAULT_WIDTHS },
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
    const widths =
      parsed.widths && typeof parsed.widths === "object" && Object.keys(parsed.widths).length
        ? { ...SIT_DEFAULT_WIDTHS, ...parsed.widths }
        : { ...SIT_DEFAULT_WIDTHS };
    return {
      ...base,
      order: order.length ? order : base.order,
      widths,
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

export function colWidth(layout: SitColumnLayout, colId: string): number {
  return layout.widths[colId] ?? SIT_DEFAULT_WIDTHS[colId] ?? SIT_MIN_WIDTHS[colId] ?? 100;
}
