"use client";

/**
 * Which Swagger / OpenAPI spec is connected to which canvas. Independent of Jira.
 * Browser localStorage is a fast mirror; App Atlas (`POST /canvases/:id/swagger`) owns the durable
 * binding and the org-wide API chain cache. Reuse of chains is silent (no FE flag).
 */
export type CanvasSwagger = {
  specUrl: string;
  title: string | null;
  connectedAt: number;
  swaggerKey?: string;
  specHash?: string | null;
};

const key = (canvasId: string) => `appatlas-swagger:${canvasId}`;

export function getCanvasSwagger(canvasId: string): CanvasSwagger | null {
  try {
    const raw = localStorage.getItem(key(canvasId));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<CanvasSwagger>;
    return typeof v.specUrl === "string" && v.specUrl
      ? { specUrl: v.specUrl, title: v.title ?? null, connectedAt: v.connectedAt ?? 0, swaggerKey: v.swaggerKey, specHash: v.specHash ?? null }
      : null;
  } catch {
    return null;
  }
}

export function setCanvasSwagger(canvasId: string, value: Omit<CanvasSwagger, "connectedAt"> & { connectedAt?: number }): CanvasSwagger {
  const stored: CanvasSwagger = { ...value, connectedAt: value.connectedAt ?? Date.now() };
  try {
    localStorage.setItem(key(canvasId), JSON.stringify(stored));
  } catch {
    /* storage unavailable: the connection lasts until reload */
  }
  return stored;
}

export function clearCanvasSwagger(canvasId: string) {
  try {
    localStorage.removeItem(key(canvasId));
  } catch {
    /* ignore */
  }
}
