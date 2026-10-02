import type { NextRequest, NextResponse } from "next/server";
import { refreshJiraToken } from "@/lib/jira";
import { OAUTH_COOKIES, oauthCookieOptions } from "@/lib/oauth";

/** What App Atlas needs to call Jira as this user, in the shape its backend accepts. */
export type JiraCredentials =
  | { siteUrl: string; email: string; apiToken: string }
  | { siteUrl: string; cloudId: string; accessToken: string };

export type ResolvedJira = {
  credentials: JiraCredentials;
  /** Atlassian rotates refresh tokens, so the new one must be written back on the response. */
  rotatedRefreshToken?: string;
};

const decode = (value: string | undefined) => {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

/** Reads the Jira connection made on the Integrations page (API token or OAuth). Null when not connected. */
export async function resolveJiraCredentials(req: NextRequest): Promise<ResolvedJira | null> {
  const siteUrl = decode(req.cookies.get(OAUTH_COOKIES.jiraSiteUrl)?.value);
  const apiToken = req.cookies.get(OAUTH_COOKIES.jiraApiToken)?.value;
  const email = req.cookies.get(OAUTH_COOKIES.jiraEmail)?.value;
  if (apiToken && email && siteUrl) return { credentials: { siteUrl, email, apiToken } };

  const refresh = req.cookies.get(OAUTH_COOKIES.jiraRefresh)?.value;
  const cloudId = req.cookies.get(OAUTH_COOKIES.jiraCloudId)?.value;
  if (!refresh || !cloudId || !siteUrl) return null;
  const tokens = await refreshJiraToken(refresh);
  return {
    credentials: { siteUrl, cloudId, accessToken: tokens.access_token },
    rotatedRefreshToken: tokens.refresh_token !== refresh ? tokens.refresh_token : undefined,
  };
}

export function persistRotatedToken(res: NextResponse, resolved: ResolvedJira) {
  if (resolved.rotatedRefreshToken) {
    res.cookies.set(OAUTH_COOKIES.jiraRefresh, resolved.rotatedRefreshToken, oauthCookieOptions());
  }
  return res;
}

export function jiraApiBase(credentials: JiraCredentials) {
  return "cloudId" in credentials
    ? `https://api.atlassian.com/ex/jira/${credentials.cloudId}/rest/api/3`
    : `${credentials.siteUrl}/rest/api/3`;
}

export function jiraAuthHeader(credentials: JiraCredentials) {
  return "cloudId" in credentials
    ? `Bearer ${credentials.accessToken}`
    : `Basic ${Buffer.from(`${credentials.email}:${credentials.apiToken}`).toString("base64")}`;
}
