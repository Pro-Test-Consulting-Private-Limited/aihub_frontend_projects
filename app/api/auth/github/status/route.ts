import { NextRequest, NextResponse } from "next/server";
import { OAUTH_COOKIES } from "@/lib/oauth";

export async function GET(req: NextRequest) {
  const connected = req.cookies.has(OAUTH_COOKIES.githubToken);
  return NextResponse.json({
    connected,
    username: req.cookies.get(OAUTH_COOKIES.githubUsername)?.value ?? null,
  });
}
