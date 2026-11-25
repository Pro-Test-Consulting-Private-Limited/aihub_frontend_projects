import { NextResponse } from "next/server";
import { clearCookies, OAUTH_COOKIES } from "@/lib/oauth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearCookies(res, [
    OAUTH_COOKIES.figmaToken,
    OAUTH_COOKIES.figmaHandle,
    OAUTH_COOKIES.figmaEmail,
    OAUTH_COOKIES.figmaUserId,
  ]);
  return res;
}
