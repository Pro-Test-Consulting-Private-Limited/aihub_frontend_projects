import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getJiraAuthorizeUrl, isJiraConfigured } from "@/lib/jira";
import {
  OAUTH_COOKIES,
  oauthStateCookieOptions,
  readReturnTo,
  redirectToApp,
  withReturnTo,
} from "@/lib/oauth";

export async function GET(req: NextRequest) {
  if (!isJiraConfigured()) {
    return redirectToApp(req, { error: "jira_not_configured" }, readReturnTo(req));
  }

  const state = randomBytes(16).toString("hex");
  const res = withReturnTo(
    NextResponse.redirect(getJiraAuthorizeUrl(state)),
    readReturnTo(req),
  );

  res.cookies.set(OAUTH_COOKIES.jiraState, state, oauthStateCookieOptions());

  return res;
}
