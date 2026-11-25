import { NextRequest, NextResponse } from "next/server";
import { verifyRequestUser } from "@/app/lib/auth-server";
import { OAUTH_COOKIES } from "@/lib/oauth";

/** Server-side AppAtlas base; prefer the in-network URL when set. */
const ATLAS_API = (
  process.env.APPATLAS_API_INTERNAL ||
  process.env.NEXT_PUBLIC_APPATLAS_API ||
  "https://ai-hub.protestcorp.com/atlas-api"
).replace(/\/$/, "");

/**
 * Forwards the caller's GitHub OAuth cookie token to AppAtlas PUT /integrations/github
 * so the backend can encrypt and store it. Never returns the token.
 */
export async function POST(req: NextRequest) {
  const user = await verifyRequestUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accessToken = req.cookies.get(OAUTH_COOKIES.githubToken)?.value;
  if (!accessToken) {
    return NextResponse.json({ error: "GitHub is not connected in this browser" }, { status: 400 });
  }

  const login = req.cookies.get(OAUTH_COOKIES.githubUsername)?.value ?? "";
  const org = req.cookies.get(OAUTH_COOKIES.githubOrg)?.value ?? null;

  try {
    const upstream = await fetch(`${ATLAS_API}/integrations/github`, {
      method: "PUT",
      headers: {
        Authorization: req.headers.get("authorization") ?? "",
        "Content-Type": "application/json",
        ...(req.headers.get("origin") ? { Origin: req.headers.get("origin")! } : {}),
      },
      body: JSON.stringify({ accessToken, login, org }),
      cache: "no-store",
    });

    if (!upstream.ok) {
      const data = (await upstream.json().catch(() => ({}))) as { error?: string };
      return NextResponse.json(
        { error: data.error || "Could not link GitHub to AppAtlas" },
        { status: upstream.status },
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not reach App Atlas" }, { status: 502 });
  }
}
