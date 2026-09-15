import { NextResponse } from "next/server";
import { normalizeJiraSiteUrl, verifyJiraApiToken } from "@/lib/jira";
import { OAUTH_COOKIES, oauthCookieOptions } from "@/lib/oauth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email ?? "").trim();
    const apiToken = String(body.apiToken ?? "").trim();
    const siteUrl = normalizeJiraSiteUrl(String(body.siteUrl ?? ""));

    if (!email || !apiToken) {
      return NextResponse.json(
        { error: "Enter your Jira site, email, and API token" },
        { status: 400 },
      );
    }

    const profile = await verifyJiraApiToken(siteUrl, email, apiToken);
    const res = NextResponse.json({
      connected: true,
      siteName: profile.siteName,
      siteUrl,
    });

    res.cookies.set(OAUTH_COOKIES.jiraApiToken, apiToken, oauthCookieOptions());
    res.cookies.set(OAUTH_COOKIES.jiraEmail, email, oauthCookieOptions());
    res.cookies.set(OAUTH_COOKIES.jiraSiteUrl, encodeURIComponent(siteUrl), oauthCookieOptions());
    res.cookies.set(
      OAUTH_COOKIES.jiraSiteName,
      encodeURIComponent(profile.siteName),
      oauthCookieOptions(),
    );

    return res;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not connect to Jira";
    const status = message.includes("invalid") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
