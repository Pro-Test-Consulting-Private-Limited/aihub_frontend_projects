/** Happy-path response pin (localStorage v0). Hash + top-level keys; body kept for type diffs. */

export type GoldenPin = {
  hash: string;
  shapeKeys: string[];
  status: number;
  pinnedAt: string;
  body?: unknown;
};

const keyOf = (specUrl: string, method: string, path: string) => `api-golden:${specUrl}|${method.toUpperCase()}|${path}`;

const normalize = (value: unknown): unknown => {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(normalize);
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(value as object).sort()) out[k] = normalize((value as Record<string, unknown>)[k]);
  return out;
};

export function topLevelKeys(body: unknown): string[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) return [];
  return Object.keys(body).sort();
}

/** FNV-1a 32-bit hex — good enough for local pin compare without crypto.subtle. */
export function hashBody(body: unknown): string {
  const s = JSON.stringify(normalize(body ?? null));
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function pinFromBody(body: unknown, status: number): GoldenPin {
  return {
    hash: hashBody(body),
    shapeKeys: topLevelKeys(body),
    status,
    pinnedAt: new Date().toISOString(),
    body: body && typeof body === "object" ? normalize(body) : body,
  };
}

export function loadGolden(specUrl: string, method: string, path: string): GoldenPin | null {
  try {
    const raw = localStorage.getItem(keyOf(specUrl, method, path));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GoldenPin;
    if (!parsed?.hash) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveGolden(specUrl: string, method: string, path: string, pin: GoldenPin): void {
  localStorage.setItem(keyOf(specUrl, method, path), JSON.stringify(pin));
}

export function clearGolden(specUrl: string, method: string, path: string): void {
  localStorage.removeItem(keyOf(specUrl, method, path));
}

/** Payload sent to the agent (omit large body if you only want hash/shape). */
export function goldenForRequest(pin: GoldenPin | null | undefined): { hash: string; shapeKeys: string[]; status?: number; pinnedAt?: string; body?: unknown } | undefined {
  if (!pin?.hash) return undefined;
  return { hash: pin.hash, shapeKeys: pin.shapeKeys, status: pin.status, pinnedAt: pin.pinnedAt, body: pin.body };
}
