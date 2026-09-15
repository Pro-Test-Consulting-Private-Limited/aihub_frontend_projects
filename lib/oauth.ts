import { NextRequest, NextResponse } from "next/server";

export const OAUTH_COOKIES = {
  jiraState: "jira_oauth_state",
  jiraRefresh: "jira_refresh_token",
  jiraCloudId: "jira_cloud_id",
  jiraSiteName: "jira_site_name",
  jiraSiteUrl: "jira_site_url",
  jiraEmail: "jira_email",
  jiraApiToken: "jira_api_token",
  githubState: "github_oauth_state",
  githubToken: "github_access_token",
  githubUsername: "github_username",
  returnTo: "oauth_return_to",
} as const;

const STATE_MAX_AGE = 600;
const TOKEN_MAX_AGE = 60 * 60 * 24 * 90;
const DEFAULT_RETURN_TO = "/integrations";

export function oauthCookieOptions(maxAge = TOKEN_MAX_AGE) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export function oauthStateCookieOptions() {
  return oauthCookieOptions(STATE_MAX_AGE);
}

export function isSafeReturnTo(value: string | null | undefined): value is string {
  return Boolean(
    value &&
      value.startsWith("/") &&
      !value.startsWith("//") &&
      !value.startsWith("/\\"),
  );
}

export function readReturnTo(req: NextRequest, fallback = DEFAULT_RETURN_TO) {
  const fromQuery = req.nextUrl.searchParams.get("returnTo");
  if (isSafeReturnTo(fromQuery)) return fromQuery;

  const fromCookie = req.cookies.get(OAUTH_COOKIES.returnTo)?.value;
  if (isSafeReturnTo(fromCookie)) return fromCookie;

  return fallback;
}

export function withReturnTo(res: NextResponse, returnTo: string) {
  res.cookies.set(OAUTH_COOKIES.returnTo, returnTo, oauthStateCookieOptions());
  return res;
}

export function redirectToApp(
  req: NextRequest,
  params: Record<string, string>,
  returnTo?: string,
) {
  const target = isSafeReturnTo(returnTo) ? returnTo : DEFAULT_RETURN_TO;
  const url = new URL(target, req.url);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const res = NextResponse.redirect(url);
  res.cookies.set(OAUTH_COOKIES.returnTo, "", { ...oauthCookieOptions(0), maxAge: 0 });
  return res;
}

export function clearCookies(res: NextResponse, names: string[]) {
  for (const name of names) {
    res.cookies.set(name, "", { ...oauthCookieOptions(0), maxAge: 0 });
  }
  return res;
}
