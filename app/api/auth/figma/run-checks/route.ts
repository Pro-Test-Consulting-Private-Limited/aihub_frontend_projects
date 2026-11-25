import { NextRequest, NextResponse } from "next/server";
import { getFigmaNodes, isFigmaIntegrationEnabled } from "@/lib/figma";
import { runDeterministicChecks, scoreFromFindings } from "@/lib/figma-checks";
import { OAUTH_COOKIES } from "@/lib/oauth";

/**
 * Pull a frame tree from Figma with the user's PAT and run deterministic checks.
 * Optionally forwards the audit to AppAtlas when canvasId + Authorization are present.
 */
export async function POST(req: NextRequest) {
  if (!isFigmaIntegrationEnabled()) {
    return NextResponse.json({ error: "figma_not_enabled" }, { status: 403 });
  }
  const token = req.cookies.get(OAUTH_COOKIES.figmaToken)?.value;
  if (!token) return NextResponse.json({ error: "figma_not_connected" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const fileKey = typeof body.fileKey === "string" ? body.fileKey.trim() : "";
  const frameId = typeof body.frameId === "string" ? body.frameId.trim() : "";
  const frameName = typeof body.frameName === "string" ? body.frameName.trim() : "Frame";
  const pageId = typeof body.pageId === "string" ? body.pageId.trim() : null;
  const pageName = typeof body.pageName === "string" ? body.pageName.trim() : null;
  const canvasId = typeof body.canvasId === "string" ? body.canvasId.trim() : "";
  if (!fileKey || !frameId) {
    return NextResponse.json({ error: "fileKey_and_frameId_required" }, { status: 400 });
  }

  try {
    const nodes = await getFigmaNodes(token, fileKey, [frameId]);
    const tree = nodes[frameId]?.document;
    if (!tree) return NextResponse.json({ error: "Frame not found in Figma file" }, { status: 404 });

    const findings = runDeterministicChecks(tree);
    const scored = scoreFromFindings(findings);
    const auditLocal = {
      fileKey,
      frameId,
      frameName,
      pageId,
      pageName,
      ...scored,
      findings,
      tree,
    };

    // Persist on the canvas when the caller is signed in to AppAtlas.
    if (canvasId) {
      const ATLAS_API = (
        process.env.APPATLAS_API_INTERNAL ||
        process.env.NEXT_PUBLIC_APPATLAS_API ||
        "https://ai-hub.protestcorp.com/atlas-api"
      ).replace(/\/$/, "");
      const auth = req.headers.get("authorization") ?? "";
      if (auth) {
        const res = await fetch(`${ATLAS_API}/figma/canvases/${encodeURIComponent(canvasId)}/audits`, {
          method: "POST",
          headers: { Authorization: auth, "Content-Type": "application/json" },
          body: JSON.stringify({
            fileKey,
            frameId,
            frameName,
            pageId,
            pageName,
            tree,
            screenNodeId: typeof body.screenNodeId === "string" ? body.screenNodeId : null,
          }),
          cache: "no-store",
        });
        const saved = await res.json().catch(() => ({}));
        if (res.ok) {
          return NextResponse.json({ ...auditLocal, saved });
        }
        return NextResponse.json(
          { ...auditLocal, saveError: saved.error || res.statusText },
          { status: 200 },
        );
      }
    }

    return NextResponse.json(auditLocal);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not run Figma checks" },
      { status: 502 },
    );
  }
}
