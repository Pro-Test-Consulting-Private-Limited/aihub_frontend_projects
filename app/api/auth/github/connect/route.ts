import { NextResponse } from "next/server";
import { getGitHubUser } from "@/lib/github";
import { OAUTH_COOKIES, oauthCookieOptions } from "@/lib/oauth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const token = String(body.token ?? "").trim();

    if (!token) {
      return NextResponse.json(
        { error: "Enter a GitHub personal access token" },
        { status: 400 },
      );
    }

    const user = await getGitHubUser(token);
    const res = NextResponse.json({
      connected: true,
      username: user.login,
    });

    res.cookies.set(OAUTH_COOKIES.githubToken, token, oauthCookieOptions());
    res.cookies.set(OAUTH_COOKIES.githubUsername, user.login, oauthCookieOptions());

    return res;
  } catch {
    return NextResponse.json(
      { error: "GitHub token is invalid or does not have access" },
      { status: 401 },
    );
  }
}
