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

/** Validate a Figma personal access token against /v1/me. */
export async function getFigmaMe(accessToken: string): Promise<FigmaUser> {
  const res = await fetch(`${API_BASE}/me`, {
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
    throw new Error(msg);
  }
  return {
    id: String(data.id || ""),
    email: typeof data.email === "string" ? data.email : null,
    handle: typeof data.handle === "string" ? data.handle : null,
    img_url: typeof data.img_url === "string" ? data.img_url : null,
  };
}
