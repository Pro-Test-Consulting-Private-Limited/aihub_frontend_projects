import { NextRequest } from "next/server";
import { exchangeGitHubCodeForToken, getGitHubUser } from "@/lib/github";
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
    res.cookies.set(OAUTH_COOKIES.githubState, "", { ...oauthCookieOptions(0), maxAge: 0 });
    return res;
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const savedState = req.cookies.get(OAUTH_COOKIES.githubState)?.value;

  if (!code || !state || state !== savedState) {
    return redirectToApp(req, { error: "invalid_state" }, returnTo);
  }

  try {
    const tokens = await exchangeGitHubCodeForToken(code);
    const user = await getGitHubUser(tokens.access_token);

    const res = redirectToApp(req, { connected: "github" }, returnTo);

    res.cookies.set(OAUTH_COOKIES.githubToken, tokens.access_token, oauthCookieOptions());
    res.cookies.set(OAUTH_COOKIES.githubUsername, user.login, oauthCookieOptions());
    res.cookies.set(OAUTH_COOKIES.githubState, "", { ...oauthCookieOptions(0), maxAge: 0 });

    return res;
  } catch (err) {
    console.error("GitHub OAuth callback error:", err);
    return redirectToApp(req, { error: "token_exchange_failed" }, returnTo);
  }
}
