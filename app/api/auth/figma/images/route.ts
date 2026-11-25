import { NextRequest, NextResponse } from "next/server";
import { FigmaApiError, getFigmaImages, isFigmaIntegrationEnabled } from "@/lib/figma";
import { OAUTH_COOKIES } from "@/lib/oauth";

export async function POST(req: NextRequest) {
  if (!isFigmaIntegrationEnabled()) {
    return NextResponse.json({ error: "figma_not_enabled" }, { status: 403 });
  }
  const token = req.cookies.get(OAUTH_COOKIES.figmaToken)?.value;
  if (!token) return NextResponse.json({ error: "figma_not_connected" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const fileKey = typeof body.fileKey === "string" ? body.fileKey.trim() : "";
  const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : [];
  if (!fileKey || ids.length === 0) {
    return NextResponse.json({ error: "fileKey_and_ids_required" }, { status: 400 });
  }

  try {
    // Keep batches small — Figma /images is expensive and rate-limited.
    const images = await getFigmaImages(token, fileKey, ids.slice(0, 6), {
      scale: typeof body.scale === "number" ? body.scale : 1,
      format: body.format === "jpg" ? "jpg" : "png",
    });
    return NextResponse.json({ images });
  } catch (err) {
    const status = err instanceof FigmaApiError ? err.status : 502;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not export Figma images" },
      { status: status === 429 ? 429 : status >= 400 && status < 600 ? status : 502 },
    );
  }
}
