import { NextRequest, NextResponse } from "next/server";

const ATLAS_API = (
  process.env.APPATLAS_API_INTERNAL ||
  process.env.NEXT_PUBLIC_APPATLAS_API ||
  "https://ai-hub.protestcorp.com/atlas-api"
).replace(/\/$/, "");

type Context = { params: Promise<{ id: string; auditId: string }> };

export async function GET(req: NextRequest, context: Context) {
  const { id, auditId } = await context.params;
  try {
    const res = await fetch(
      `${ATLAS_API}/figma/canvases/${encodeURIComponent(id)}/audits/${encodeURIComponent(auditId)}`,
      {
        headers: { Authorization: req.headers.get("authorization") ?? "" },
        cache: "no-store",
      },
    );
    const data = await res.json().catch(() => ({ error: res.statusText }));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Could not reach App Atlas" }, { status: 502 });
  }
}
