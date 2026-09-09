import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken } from "@/lib/jira";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const savedState = req.cookies.get("jira_oauth_state")?.value;

  if (!code || !state || state !== savedState) {
    return NextResponse.redirect(
      new URL("/integrations?error=invalid_state", req.url)
    );
  }

  try {
    const tokens = await exchangeCodeForToken(code);

    // TODO: exchange the access token for accessible Jira resources and
    // persist tokens.access_token, tokens.refresh_token, and the Jira
    // cloudId to your database, scoped to the current logged-in user/org.
    // The cookie below is for local testing only — do not ship this
    // as-is to production.
    const res = NextResponse.redirect(
      new URL("/integrations?connected=jira", req.url)
    );

    res.cookies.set("jira_refresh_token", tokens.refresh_token, {
      httpOnly: true,
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 90, // 90 days
    });

    res.cookies.delete("jira_oauth_state");

    return res;
  } catch (err) {
    console.error("Jira OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/integrations?error=token_exchange_failed", req.url)
    );
  }
}