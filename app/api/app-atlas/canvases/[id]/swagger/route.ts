import { NextRequest, NextResponse } from "next/server";

/** Forwards canvas swagger connect/disconnect to App Atlas (org-wide chain cache lives there). */
const ATLAS_API = (
  process.env.APPATLAS_API_INTERNAL ||
  process.env.NEXT_PUBLIC_APPATLAS_API ||
  "https://ai-hub.protestcorp.com/atlas-api"
).replace(/\/$/, "");

type Context = { params: Promise<{ id: string }> };

async function forward(req: NextRequest, id: string, method: "POST" | "DELETE", body?: unknown) {
  const res = await fetch(`${ATLAS_API}/canvases/${encodeURIComponent(id)}/swagger`, {
    method,
    headers: {
      Authorization: req.headers.get("authorization") ?? "",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({ error: res.statusText }));
  return NextResponse.json(data, { status: res.status });
}

export async function POST(req: NextRequest, context: Context) {
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  if (!body?.specUrl || typeof body.specUrl !== "string") {
    return NextResponse.json({ error: "specUrl is required" }, { status: 400 });
  }
  try {
    return await forward(req, id, "POST", body);
  } catch {
    return NextResponse.json({ error: "Could not reach App Atlas" }, { status: 502 });
  }
}

export async function DELETE(req: NextRequest, context: Context) {
  const { id } = await context.params;
  try {
    return await forward(req, id, "DELETE");
  } catch {
    return NextResponse.json({ error: "Could not reach App Atlas" }, { status: 502 });
  }
}
