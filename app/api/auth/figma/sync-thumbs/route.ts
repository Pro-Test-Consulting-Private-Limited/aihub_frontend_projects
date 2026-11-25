import { NextRequest, NextResponse } from "next/server";
import { FigmaApiError, getFigmaImages, isFigmaIntegrationEnabled } from "@/lib/figma";
import { OAUTH_COOKIES } from "@/lib/oauth";

type FrameIn = {
  frameId: string;
  frameName?: string;
  pageId?: string;
  pageName?: string;
  width?: number | null;
  height?: number | null;
};

/**
 * Pull a small batch of Figma frame previews with the user's PAT, download bytes,
 * return base64 payloads for the caller to persist on AppAtlas.
 * Deliberately capped to avoid rate limits — the UI loops until done.
 */
export async function POST(req: NextRequest) {
  if (!isFigmaIntegrationEnabled()) {
    return NextResponse.json({ error: "figma_not_enabled" }, { status: 403 });
  }
  const token = req.cookies.get(OAUTH_COOKIES.figmaToken)?.value;
  if (!token) return NextResponse.json({ error: "figma_not_connected" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const fileKey = typeof body.fileKey === "string" ? body.fileKey.trim() : "";
  const frames = (Array.isArray(body.frames) ? body.frames : []) as FrameIn[];
  if (!fileKey || frames.length === 0) {
    return NextResponse.json({ error: "fileKey_and_frames_required" }, { status: 400 });
  }

  const batch = frames.slice(0, 4);
  try {
    const images = await getFigmaImages(
      token,
      fileKey,
      batch.map((f) => f.frameId),
      { scale: 1, format: "jpg" },
    );

    const items: Array<FrameIn & { imageBase64: string }> = [];
    for (const f of batch) {
      const url = images[f.frameId];
      if (!url) continue;
      const imgRes = await fetch(url, { cache: "no-store" });
      if (!imgRes.ok) continue;
      const buf = Buffer.from(await imgRes.arrayBuffer());
      if (buf.length < 32 || buf.length > 1_500_000) continue;
      items.push({
        frameId: f.frameId,
        frameName: f.frameName,
        pageId: f.pageId,
        pageName: f.pageName,
        width: f.width ?? null,
        height: f.height ?? null,
        imageBase64: buf.toString("base64"),
      });
    }

    return NextResponse.json({ items, requested: batch.length, got: items.length });
  } catch (err) {
    const status = err instanceof FigmaApiError ? err.status : 502;
    const retryAfterSec = err instanceof FigmaApiError ? err.retryAfterSec : null;
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Sync failed",
        ...(retryAfterSec != null ? { retryAfterSec } : {}),
      },
      {
        status: status === 429 ? 429 : 502,
        ...(retryAfterSec != null ? { headers: { "Retry-After": String(retryAfterSec) } } : {}),
      },
    );
  }
}
