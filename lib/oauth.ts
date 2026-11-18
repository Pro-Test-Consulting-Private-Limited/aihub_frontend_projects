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
  githubOrg: "github_org",
  githubOrgUrl: "github_org_url",
  swaggerSpecUrl: "swagger_spec_url",
  swaggerTitle: "swagger_title",
  swaggerToken: "swagger_access_token",
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

/** Public site origin for OAuth return redirects (nginx → container is often localhost:3000). */
export function publicOrigin(req: NextRequest): string {
  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwardedHost) {
    const proto = forwardedProto || (forwardedHost.includes("localhost") ? "http" : "https");
    return `${proto}://${forwardedHost}`;
  }

  for (const raw of [
    process.env.OAUTH_PUBLIC_ORIGIN,
    process.env.GITHUB_REDIRECT_URI,
    process.env.NEXT_PUBLIC_MICROSOFT_ENTRA_AD_REDIRECT_URI,
    process.env.NEXT_PUBLIC_API_BASE_URL,
  ]) {
    if (!raw) continue;
    try {
      const u = new URL(raw);
      if (u.hostname && u.hostname !== "localhost" && u.hostname !== "127.0.0.1") {
        return u.origin;
      }
    } catch {
      /* ignore */
    }
  }

  try {
    const u = new URL(req.url);
    if (u.hostname && u.hostname !== "localhost" && u.hostname !== "127.0.0.1") {
      return u.origin;
    }
  } catch {
    /* ignore */
  }

  return "https://ai-hub.protestcorp.com";
}

export function redirectToApp(
  req: NextRequest,
  params: Record<string, string>,
  returnTo?: string,
) {
  const target = isSafeReturnTo(returnTo) ? returnTo : DEFAULT_RETURN_TO;
  const url = new URL(target, `${publicOrigin(req)}/`);
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
