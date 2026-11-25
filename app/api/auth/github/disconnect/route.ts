import { NextRequest, NextResponse } from "next/server";
import { revokeGitHubToken } from "@/lib/github";
import { clearCookies, OAUTH_COOKIES } from "@/lib/oauth";

const GITHUB_COOKIES = [
  OAUTH_COOKIES.githubToken,
  OAUTH_COOKIES.githubUsername,
  OAUTH_COOKIES.githubOrg,
  OAUTH_COOKIES.githubOrgUrl,
  OAUTH_COOKIES.githubState,
];

/** Server-side AppAtlas base; prefer the in-network URL when set. */
const ATLAS_API = (
  process.env.APPATLAS_API_INTERNAL ||
  process.env.NEXT_PUBLIC_APPATLAS_API ||
  "https://ai-hub.protestcorp.com/atlas-api"
).replace(/\/$/, "");

export async function POST(req: NextRequest) {
  const accessToken = req.cookies.get(OAUTH_COOKIES.githubToken)?.value;

  if (accessToken) {
    try {
      await revokeGitHubToken(accessToken);
    } catch (err) {
      console.error("GitHub token revoke failed:", err);
    }
  }

  // Best-effort: remove the encrypted vault row. Never block cookie clear on failure.
  const authorization = req.headers.get("authorization");
  if (authorization) {
    try {
      await fetch(`${ATLAS_API}/integrations/github`, {
        method: "DELETE",
        headers: {
          Authorization: authorization,
          ...(req.headers.get("origin") ? { Origin: req.headers.get("origin")! } : {}),
        },
        cache: "no-store",
      });
    } catch (err) {
      console.error("AppAtlas GitHub identity delete failed:", err);
    }
  }

  const res = NextResponse.json({ disconnected: true });
  return clearCookies(res, GITHUB_COOKIES);
}
