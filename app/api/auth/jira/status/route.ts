import { NextRequest, NextResponse } from "next/server";
import {
  jiraApiBase,
  jiraAuthHeader,
  persistRotatedToken,
  resolveJiraCredentials,
} from "@/lib/jira-credentials";
import { OAUTH_COOKIES } from "@/lib/oauth";

export type JiraHealth = "disconnected" | "active" | "expired" | "error";

function decodeCookie(value: string | undefined) {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Cookie presence = "connected" (legacy).
 * With ?live=1, probes Jira `/myself` so Integrations can show Active vs token expired.
 */
export async function GET(req: NextRequest) {
  const live = req.nextUrl.searchParams.get("live") === "1";
  const hasCookies =
    req.cookies.has(OAUTH_COOKIES.jiraApiToken) ||
    req.cookies.has(OAUTH_COOKIES.jiraRefresh);
  const siteName = decodeCookie(req.cookies.get(OAUTH_COOKIES.jiraSiteName)?.value);
  const siteUrl = decodeCookie(req.cookies.get(OAUTH_COOKIES.jiraSiteUrl)?.value);

  if (!hasCookies) {
    return NextResponse.json({
      connected: false,
      health: "disconnected" as JiraHealth,
      siteName: null,
      siteUrl: null,
      user: null,
      detail: null,
      checkedAt: live ? Date.now() : null,
    });
  }

  if (!live) {
    return NextResponse.json({
      connected: true,
      health: "active" as JiraHealth,
      siteName,
      siteUrl,
      user: null,
      detail: null,
      checkedAt: null,
    });
  }

  try {
    const resolved = await resolveJiraCredentials(req);
    if (!resolved) {
      return NextResponse.json({
        connected: true,
        health: "expired" as JiraHealth,
        siteName,
        siteUrl,
        user: null,
        detail: "Jira credentials are incomplete or the refresh token is gone. Reconnect Jira.",
        checkedAt: Date.now(),
      });
    }

    const meRes = await fetch(`${jiraApiBase(resolved.credentials)}/myself`, {
      headers: {
        Authorization: jiraAuthHeader(resolved.credentials),
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (meRes.status === 401 || meRes.status === 403) {
      const res = NextResponse.json({
        connected: true,
        health: "expired" as JiraHealth,
        siteName,
        siteUrl,
        user: null,
        detail: "Jira rejected the credentials (expired or revoked). Reconnect Jira.",
        checkedAt: Date.now(),
      });
      return persistRotatedToken(res, resolved);
    }

    if (!meRes.ok) {
      const res = NextResponse.json({
        connected: true,
        health: "error" as JiraHealth,
        siteName,
        siteUrl,
        user: null,
        detail: `Jira responded ${meRes.status} while checking the connection.`,
        checkedAt: Date.now(),
      });
      return persistRotatedToken(res, resolved);
    }

    const myself = (await meRes.json()) as {
      displayName?: string;
      emailAddress?: string;
      accountId?: string;
    };
    const res = NextResponse.json({
      connected: true,
      health: "active" as JiraHealth,
      siteName,
      siteUrl,
      user: myself.displayName || myself.emailAddress || null,
      detail: null,
      checkedAt: Date.now(),
    });
    return persistRotatedToken(res, resolved);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not verify Jira";
    const expired = /refresh|token|invalid|401|403/i.test(msg);
    return NextResponse.json({
      connected: true,
      health: (expired ? "expired" : "error") as JiraHealth,
      siteName,
      siteUrl,
      user: null,
      detail: expired
        ? "Jira token refresh failed. Reconnect Jira."
        : msg,
      checkedAt: Date.now(),
    });
  }
}
