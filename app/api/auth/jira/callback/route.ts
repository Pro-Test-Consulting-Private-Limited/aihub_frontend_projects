import { NextRequest } from "next/server";
import { exchangeCodeForToken, getAccessibleResources } from "@/lib/jira";
import {
  OAUTH_COOKIES,
  oauthCookieOptions,
  readReturnTo,
  redirectToApp,
} from "@/lib/oauth";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const providerError = url.searchParams.get("error");
  const returnTo = readReturnTo(req);

  if (providerError) {
    const res = redirectToApp(
      req,
      { error: providerError === "access_denied" ? "access_denied" : "token_exchange_failed" },
      returnTo,
    );
    res.cookies.set(OAUTH_COOKIES.jiraState, "", { ...oauthCookieOptions(0), maxAge: 0 });
    return res;
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const savedState = req.cookies.get(OAUTH_COOKIES.jiraState)?.value;

  if (!code || !state || state !== savedState) {
    return redirectToApp(req, { error: "invalid_state" }, returnTo);
  }

  try {
    const tokens = await exchangeCodeForToken(code);
    const sites = await getAccessibleResources(tokens.access_token);
    const site = sites[0];

    const res = redirectToApp(req, { connected: "jira" }, returnTo);

    res.cookies.set(OAUTH_COOKIES.jiraRefresh, tokens.refresh_token, oauthCookieOptions());
    res.cookies.set(OAUTH_COOKIES.jiraState, "", { ...oauthCookieOptions(0), maxAge: 0 });

    if (site) {
      res.cookies.set(OAUTH_COOKIES.jiraCloudId, site.id, oauthCookieOptions());
      res.cookies.set(
        OAUTH_COOKIES.jiraSiteName,
        encodeURIComponent(site.name),
        oauthCookieOptions(),
      );
      res.cookies.set(
        OAUTH_COOKIES.jiraSiteUrl,
        encodeURIComponent(site.url),
        oauthCookieOptions(),
      );
    }

    return res;
  } catch (err) {
    console.error("Jira OAuth callback error:", err);
    return redirectToApp(req, { error: "token_exchange_failed" }, returnTo);
  }
}
