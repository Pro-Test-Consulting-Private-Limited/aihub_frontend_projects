import { NextRequest, NextResponse } from "next/server";

const ATLAS_API = (
  process.env.APPATLAS_API_INTERNAL ||
  process.env.NEXT_PUBLIC_APPATLAS_API ||
  "https://ai-hub.protestcorp.com/atlas-api"
).replace(/\/$/, "");

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  try {
    const res = await fetch(`${ATLAS_API}/figma/plugin/audits`, {
      method: "POST",
      headers: {
        Authorization: req.headers.get("authorization") ?? "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({ error: res.statusText }));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Could not reach App Atlas" }, { status: 502 });
  }
}
