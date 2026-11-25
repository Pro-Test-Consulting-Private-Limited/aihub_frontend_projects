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

/** Validate a Figma personal access token against /v1/me. */
export async function getFigmaMe(accessToken: string): Promise<FigmaUser> {
  const res = await fetch(`${API_BASE}/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
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
