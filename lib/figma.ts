const API_BASE = "https://api.figma.com/v1";

export type FigmaUser = {
  id: string;
  email: string | null;
  handle: string | null;
  img_url: string | null;
};

export function isFigmaIntegrationEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FIGMA_INTEGRATION === "1" || process.env.FIGMA_INTEGRATION === "1";
}

/**
 * Figma personal access tokens (figd_…) must use X-Figma-Token.
 * OAuth bearer tokens use Authorization: Bearer.
 */
function figmaAuthHeaders(accessToken: string): Record<string, string> {
  const token = accessToken.trim();
  if (token.startsWith("figd_") || !token.includes(".")) {
    return { "X-Figma-Token": token, Accept: "application/json" };
  }
  return { Authorization: `Bearer ${token}`, Accept: "application/json" };
}

export class FigmaApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "FigmaApiError";
    this.status = status;
  }
}

async function figmaFetch(accessToken: string, path: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: figmaAuthHeaders(accessToken),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      typeof data.err === "string"
        ? data.err
        : typeof data.message === "string"
          ? data.message
          : `Figma API ${res.status}`;
    if (res.status === 429 || /rate limit/i.test(msg)) {
      throw new FigmaApiError(
        "Figma rate limit exceeded — too many API calls. Wait about a minute, then Refresh. Thumbnails load slowly on purpose to avoid this.",
        429,
      );
    }
    throw new FigmaApiError(msg, res.status);
  }
  return data;
}

/** Validate a Figma personal access token against /v1/me. */
export async function getFigmaMe(accessToken: string): Promise<FigmaUser> {
  const data = await figmaFetch(accessToken, "/me");
  return {
    id: String(data.id || ""),
    email: typeof data.email === "string" ? data.email : null,
    handle: typeof data.handle === "string" ? data.handle : null,
    img_url: typeof data.img_url === "string" ? data.img_url : null,
  };
}

/** Load a Figma file document (structure + geometry). */
export async function getFigmaFile(accessToken: string, fileKey: string) {
  const key = encodeURIComponent(fileKey);
  const data = await figmaFetch(accessToken, `/files/${key}?geometry=paths`);
  return {
    name: typeof data.name === "string" ? data.name : null,
    lastModified: typeof data.lastModified === "string" ? data.lastModified : null,
    document: data.document as import("./figma-checks").FigmaFrameNode,
  };
}

/** Load specific nodes (e.g. one frame subtree). */
export async function getFigmaNodes(accessToken: string, fileKey: string, nodeIds: string[]) {
  const key = encodeURIComponent(fileKey);
  const ids = encodeURIComponent(nodeIds.join(","));
  const data = await figmaFetch(accessToken, `/files/${key}/nodes?ids=${ids}&geometry=paths`);
  return (data.nodes || {}) as Record<string, { document?: import("./figma-checks").FigmaFrameNode }>;
}

/** Export rendered PNGs for node ids. Returns map nodeId → temporary image URL. */
export async function getFigmaImages(
  accessToken: string,
  fileKey: string,
  nodeIds: string[],
  opts?: { scale?: number; format?: "png" | "jpg" },
) {
  const key = encodeURIComponent(fileKey);
  const ids = encodeURIComponent(nodeIds.join(","));
  const scale = opts?.scale ?? 2;
  const format = opts?.format ?? "png";
  const data = await figmaFetch(
    accessToken,
    `/images/${key}?ids=${ids}&format=${format}&scale=${scale}`,
  );
  const images = (data.images || {}) as Record<string, string | null>;
  return images;
}
