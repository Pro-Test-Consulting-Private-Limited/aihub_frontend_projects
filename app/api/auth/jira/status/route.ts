import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const hasToken = req.cookies.has("jira_refresh_token");
  return NextResponse.json({ connected: hasToken });
}
