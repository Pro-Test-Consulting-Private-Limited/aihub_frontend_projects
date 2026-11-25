import { NextRequest, NextResponse } from "next/server";
import { OAUTH_COOKIES } from "@/lib/oauth";

export async function GET(req: NextRequest) {
  const connected = req.cookies.has(OAUTH_COOKIES.githubToken);
  return NextResponse.json({
    connected,
    username: req.cookies.get(OAUTH_COOKIES.githubUsername)?.value ?? null,
    org: req.cookies.get(OAUTH_COOKIES.githubOrg)?.value ?? null,
    orgUrl: req.cookies.get(OAUTH_COOKIES.githubOrgUrl)?.value ?? null,
  });
}
