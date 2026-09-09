import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getJiraAuthorizeUrl } from "@/lib/jira";

export async function GET() {
  const state = randomBytes(16).toString("hex");

  const res = NextResponse.redirect(getJiraAuthorizeUrl(state));

  res.cookies.set("jira_oauth_state", state, {
    httpOnly: true,
    secure: true,
    maxAge: 600,
    path: "/",
  });

  return res;
}