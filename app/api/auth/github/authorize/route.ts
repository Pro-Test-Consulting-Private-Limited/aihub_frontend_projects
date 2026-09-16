import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getGitHubAuthorizeUrl, isGitHubConfigured } from "@/lib/github";
import {
  OAUTH_COOKIES,
  oauthStateCookieOptions,
  readReturnTo,
  redirectToApp,
  withReturnTo,
} from "@/lib/oauth";

export async function GET(req: NextRequest) {
  if (!isGitHubConfigured()) {
    return redirectToApp(req, { error: "github_not_configured" }, readReturnTo(req));
  }

  const state = randomBytes(16).toString("hex");
  const res = withReturnTo(
    NextResponse.redirect(getGitHubAuthorizeUrl(state)),
    readReturnTo(req),
  );

  res.cookies.set(OAUTH_COOKIES.githubState, state, oauthStateCookieOptions());

  return res;
}
