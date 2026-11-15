import { NextRequest, NextResponse } from "next/server";

const ATLAS_API = (
  process.env.APPATLAS_API_INTERNAL ||
  process.env.NEXT_PUBLIC_APPATLAS_API ||
  "https://ai-hub.protestcorp.com/atlas-api"
).replace(/\/$/, "");

type Context = { params: Promise<{ id: string; jobId: string }> };

/** Poll async Jira map job started by POST /canvases/:id/jira. */
export async function GET(req: NextRequest, context: Context) {
  const { id, jobId } = await context.params;
  try {
    const res = await fetch(
      `${ATLAS_API}/canvases/${encodeURIComponent(id)}/jira/jobs/${encodeURIComponent(jobId)}`,
      {
        method: "GET",
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
