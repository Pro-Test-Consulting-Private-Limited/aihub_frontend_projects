import { NextRequest, NextResponse } from "next/server";
import { getGitHubUser } from "@/lib/github";
import { OAUTH_COOKIES } from "@/lib/oauth";

export type GitHubHealth = "disconnected" | "active" | "expired" | "error";

/**
 * Cookie presence = "connected" (legacy).
 * With ?live=1, probes GitHub `/user` so Integrations can show Active vs token expired.
 */
export async function GET(req: NextRequest) {
  const live = req.nextUrl.searchParams.get("live") === "1";
  const token = req.cookies.get(OAUTH_COOKIES.githubToken)?.value;
  const username = req.cookies.get(OAUTH_COOKIES.githubUsername)?.value ?? null;
  const org = req.cookies.get(OAUTH_COOKIES.githubOrg)?.value ?? null;
  const orgUrl = req.cookies.get(OAUTH_COOKIES.githubOrgUrl)?.value ?? null;

  if (!token) {
    return NextResponse.json({
      connected: false,
      health: "disconnected" as GitHubHealth,
      username: null,
      org: null,
      orgUrl: null,
      detail: null,
      checkedAt: live ? Date.now() : null,
    });
  }

  if (!live) {
    return NextResponse.json({
      connected: true,
      health: "active" as GitHubHealth,
      username,
      org,
      orgUrl,
      detail: null,
      checkedAt: null,
    });
  }

  try {
    const user = await getGitHubUser(token);
    return NextResponse.json({
      connected: true,
      health: "active" as GitHubHealth,
      username: user.login || username,
      org,
      orgUrl,
      detail: null,
      checkedAt: Date.now(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not verify GitHub";
    const expired = /401|403|Bad credentials|Failed to fetch GitHub user/i.test(msg);
    return NextResponse.json({
      connected: true,
      health: (expired ? "expired" : "error") as GitHubHealth,
      username,
      org,
      orgUrl,
      detail: expired
        ? "GitHub rejected the token (expired or revoked). Reconnect GitHub."
        : msg,
      checkedAt: Date.now(),
    });
  }
}
