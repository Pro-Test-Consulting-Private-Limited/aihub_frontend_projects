import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getGitHubAuthorizeUrl, isGitHubConfigured, parseGitHubOrgInput } from "@/lib/github";
import {
  OAUTH_COOKIES,
  oauthCookieOptions,
  oauthStateCookieOptions,
  readReturnTo,
  redirectToApp,
  withReturnTo,
} from "@/lib/oauth";

export async function GET(req: NextRequest) {
  if (!isGitHubConfigured()) {
    return redirectToApp(req, { error: "github_not_configured" }, readReturnTo(req));
  }

  const orgRaw =
    req.nextUrl.searchParams.get("org") ||
    req.nextUrl.searchParams.get("orgUrl") ||
    "";
  const parsed = parseGitHubOrgInput(orgRaw);
  if (!parsed) {
    return redirectToApp(req, { error: "github_org_required" }, readReturnTo(req));
  }

  const state = randomBytes(16).toString("hex");
  const res = withReturnTo(
    NextResponse.redirect(getGitHubAuthorizeUrl(state)),
    readReturnTo(req),
  );

  res.cookies.set(OAUTH_COOKIES.githubState, state, oauthStateCookieOptions());
  res.cookies.set(OAUTH_COOKIES.githubOrg, parsed.org, oauthCookieOptions());
  res.cookies.set(OAUTH_COOKIES.githubOrgUrl, parsed.orgUrl, oauthCookieOptions());

  return res;
}
