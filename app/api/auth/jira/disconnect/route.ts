import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ disconnected: true });
  res.cookies.delete("jira_refresh_token");
  return res;
}
