"use client";

export type CanvasFigma = {
  fileKey: string;
  fileName: string | null;
  fileUrl: string;
  connectedAt: number;
};

const key = (canvasId: string) => `appatlas-figma:${canvasId}`;

export function getCanvasFigma(canvasId: string): CanvasFigma | null {
  try {
    const raw = localStorage.getItem(key(canvasId));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<CanvasFigma>;
    return typeof v.fileKey === "string" && v.fileKey
      ? {
          fileKey: v.fileKey,
          fileName: v.fileName ?? null,
          fileUrl: v.fileUrl || `https://www.figma.com/design/${v.fileKey}`,
          connectedAt: v.connectedAt ?? 0,
        }
      : null;
  } catch {
    return null;
  }
}

export function setCanvasFigma(
  canvasId: string,
  value: Omit<CanvasFigma, "connectedAt"> & { connectedAt?: number },
): CanvasFigma {
  const stored: CanvasFigma = { ...value, connectedAt: value.connectedAt ?? Date.now() };
  try {
    localStorage.setItem(key(canvasId), JSON.stringify(stored));
  } catch {
    /* ignore */
  }
  return stored;
}

export function clearCanvasFigma(canvasId: string) {
  try {
    localStorage.removeItem(key(canvasId));
  } catch {
    /* ignore */
  }
}
