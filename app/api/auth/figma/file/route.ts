import { NextRequest, NextResponse } from "next/server";
import { getFigmaFile, isFigmaIntegrationEnabled } from "@/lib/figma";
import { listFramesFromDocument } from "@/lib/figma-checks";
import { OAUTH_COOKIES } from "@/lib/oauth";

export async function GET(req: NextRequest) {
  if (!isFigmaIntegrationEnabled()) {
    return NextResponse.json({ error: "figma_not_enabled" }, { status: 403 });
  }
  const token = req.cookies.get(OAUTH_COOKIES.figmaToken)?.value;
  if (!token) return NextResponse.json({ error: "figma_not_connected" }, { status: 401 });

  const fileKey = req.nextUrl.searchParams.get("fileKey")?.trim() || "";
  if (!fileKey) return NextResponse.json({ error: "fileKey_required" }, { status: 400 });

  try {
    const file = await getFigmaFile(token, fileKey);
    const frames = listFramesFromDocument(file.document);
    return NextResponse.json({
      fileKey,
      name: file.name,
      lastModified: file.lastModified,
      frames,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not load Figma file" },
      { status: 502 },
    );
  }
}
