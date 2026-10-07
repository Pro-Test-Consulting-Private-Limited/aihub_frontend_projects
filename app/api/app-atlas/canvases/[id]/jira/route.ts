import { NextRequest, NextResponse } from "next/server";
import { persistRotatedToken, resolveJiraCredentials } from "@/lib/jira-credentials";

/** Server-side so the Jira credentials (httpOnly cookies) never reach browser code. Can be an in-network URL. */
const ATLAS_API = (
  process.env.APPATLAS_API_INTERNAL ||
  process.env.NEXT_PUBLIC_APPATLAS_API ||
  "https://ai-hub.protestcorp.com/atlas-api"
).replace(/\/$/, "");

type Context = { params: Promise<{ id: string }> };

async function forward(req: NextRequest, id: string, method: "POST" | "DELETE", body?: unknown) {
  const res = await fetch(`${ATLAS_API}/canvases/${encodeURIComponent(id)}/jira`, {
    method,
    headers: {
      Authorization: req.headers.get("authorization") ?? "",
      // App Atlas picks the clarification agent of the environment (prod / sit / dev) the user is on.
      ...(req.headers.get("origin") ? { Origin: req.headers.get("origin")! } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({ error: res.statusText }));
  return NextResponse.json(data, { status: res.status });
}

/** Connects a canvas to a Jira project and maps its screens to that project's tickets. */
export async function POST(req: NextRequest, context: Context) {
  const { id } = await context.params;
  const { projectKey } = (await req.json().catch(() => ({}))) as { projectKey?: string };
  if (!projectKey) return NextResponse.json({ error: "projectKey is required" }, { status: 400 });

  let resolved;
  try {
    resolved = await resolveJiraCredentials(req);
  } catch {
    return NextResponse.json({ error: "Your Jira session expired. Reconnect Jira in Integrations." }, { status: 401 });
  }
  if (!resolved) return NextResponse.json({ error: "Jira is not connected. Connect it in Integrations." }, { status: 409 });

  try {
    const res = await forward(req, id, "POST", { projectKey, jira: resolved.credentials });
    return persistRotatedToken(res, resolved);
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
