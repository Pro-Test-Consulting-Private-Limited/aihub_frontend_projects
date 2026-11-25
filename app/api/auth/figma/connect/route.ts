import { NextRequest, NextResponse } from "next/server";
import { getFigmaMe, isFigmaIntegrationEnabled } from "@/lib/figma";
import { OAUTH_COOKIES, oauthCookieOptions } from "@/lib/oauth";

export async function POST(req: NextRequest) {
  if (!isFigmaIntegrationEnabled()) {
    return NextResponse.json({ error: "figma_not_enabled" }, { status: 403 });
  }

  let body: { accessToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const accessToken = String(body.accessToken || "").trim();
  if (!accessToken) {
    return NextResponse.json({ error: "token_required" }, { status: 400 });
  }

  try {
    const me = await getFigmaMe(accessToken);
    const res = NextResponse.json({
      connected: true,
      handle: me.handle,
      email: me.email,
      userId: me.id,
    });
    res.cookies.set(OAUTH_COOKIES.figmaToken, accessToken, oauthCookieOptions());
    if (me.handle) res.cookies.set(OAUTH_COOKIES.figmaHandle, me.handle, oauthCookieOptions());
    if (me.email) res.cookies.set(OAUTH_COOKIES.figmaEmail, me.email, oauthCookieOptions());
    if (me.id) res.cookies.set(OAUTH_COOKIES.figmaUserId, me.id, oauthCookieOptions());
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not verify Figma token";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
