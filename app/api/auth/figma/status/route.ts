import { NextRequest, NextResponse } from "next/server";
import { getFigmaMe, isFigmaIntegrationEnabled } from "@/lib/figma";
import { OAUTH_COOKIES } from "@/lib/oauth";

export async function GET(req: NextRequest) {
  if (!isFigmaIntegrationEnabled()) {
    return NextResponse.json({
      connected: false,
      health: "disconnected",
      handle: null,
      email: null,
      userId: null,
      detail: "Figma integration is not enabled on this environment.",
      checkedAt: Date.now(),
    });
  }

  const token = req.cookies.get(OAUTH_COOKIES.figmaToken)?.value;
  const handleCookie = req.cookies.get(OAUTH_COOKIES.figmaHandle)?.value ?? null;
  const emailCookie = req.cookies.get(OAUTH_COOKIES.figmaEmail)?.value ?? null;
  const userIdCookie = req.cookies.get(OAUTH_COOKIES.figmaUserId)?.value ?? null;
  const live = req.nextUrl.searchParams.get("live") === "1";

  if (!token) {
    return NextResponse.json({
      connected: false,
      health: "disconnected",
      handle: handleCookie,
      email: emailCookie,
      userId: userIdCookie,
      detail: null,
      checkedAt: Date.now(),
    });
  }

  if (!live) {
    return NextResponse.json({
      connected: true,
      health: "active",
      handle: handleCookie,
      email: emailCookie,
      userId: userIdCookie,
      detail: null,
      checkedAt: Date.now(),
    });
  }

  try {
    const me = await getFigmaMe(token);
    return NextResponse.json({
      connected: true,
      health: "active",
      handle: me.handle || handleCookie,
      email: me.email || emailCookie,
      userId: me.id || userIdCookie,
      detail: null,
      checkedAt: Date.now(),
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Figma token check failed";
    return NextResponse.json({
      connected: true,
      health: /403|401|revoked|invalid/i.test(detail) ? "expired" : "error",
      handle: handleCookie,
      email: emailCookie,
      userId: userIdCookie,
      detail,
      checkedAt: Date.now(),
    });
  }
}
