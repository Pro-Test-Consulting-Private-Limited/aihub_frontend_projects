import { NextRequest, NextResponse } from "next/server";
import { OAUTH_COOKIES } from "@/lib/oauth";

export async function GET(req: NextRequest) {
  const connected =
    req.cookies.has(OAUTH_COOKIES.jiraApiToken) ||
    req.cookies.has(OAUTH_COOKIES.jiraRefresh);
  const rawName = req.cookies.get(OAUTH_COOKIES.jiraSiteName)?.value;
  const rawUrl = req.cookies.get(OAUTH_COOKIES.jiraSiteUrl)?.value;

  return NextResponse.json({
    connected,
    siteName: decodeCookie(rawName),
    siteUrl: decodeCookie(rawUrl),
  });
}

function decodeCookie(value: string | undefined) {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
