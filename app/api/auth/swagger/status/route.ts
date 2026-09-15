import { NextRequest, NextResponse } from "next/server";
import { OAUTH_COOKIES } from "@/lib/oauth";

function decodeCookie(value: string | undefined) {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function GET(req: NextRequest) {
  const connected = req.cookies.has(OAUTH_COOKIES.swaggerSpecUrl);
  return NextResponse.json({
    connected,
    title: decodeCookie(req.cookies.get(OAUTH_COOKIES.swaggerTitle)?.value),
    specUrl: decodeCookie(req.cookies.get(OAUTH_COOKIES.swaggerSpecUrl)?.value),
  });
}
