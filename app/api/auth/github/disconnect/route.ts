import { NextRequest, NextResponse } from "next/server";
import { revokeGitHubToken } from "@/lib/github";
import { clearCookies, OAUTH_COOKIES } from "@/lib/oauth";

const GITHUB_COOKIES = [
  OAUTH_COOKIES.githubToken,
  OAUTH_COOKIES.githubUsername,
  OAUTH_COOKIES.githubState,
];

export async function POST(req: NextRequest) {
  const accessToken = req.cookies.get(OAUTH_COOKIES.githubToken)?.value;

  if (accessToken) {
    try {
      await revokeGitHubToken(accessToken);
    } catch (err) {
      console.error("GitHub token revoke failed:", err);
    }
  }

  const res = NextResponse.json({ disconnected: true });
  return clearCookies(res, GITHUB_COOKIES);
}
