"use client";

/**
 * Which Swagger / OpenAPI spec is connected to which canvas. Independent of Jira: connecting or disconnecting one
 * never touches the other. Kept in this browser for now; move it to the App Atlas backend (next to jiraProjectKey)
 * when that service can store it.
 */
export type CanvasSwagger = { specUrl: string; title: string | null; connectedAt: number };

const key = (canvasId: string) => `appatlas-swagger:${canvasId}`;

export function getCanvasSwagger(canvasId: string): CanvasSwagger | null {
  try {
    const raw = localStorage.getItem(key(canvasId));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<CanvasSwagger>;
    return typeof v.specUrl === "string" && v.specUrl ? { specUrl: v.specUrl, title: v.title ?? null, connectedAt: v.connectedAt ?? 0 } : null;
  } catch {
    return null;
  }
}

export function setCanvasSwagger(canvasId: string, value: Omit<CanvasSwagger, "connectedAt">): CanvasSwagger {
  const stored: CanvasSwagger = { ...value, connectedAt: Date.now() };
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
