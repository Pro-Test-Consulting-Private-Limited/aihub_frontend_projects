const AUTH_BASE = "https://github.com";
const API_BASE = "https://api.github.com";
const DEFAULT_SCOPES = "repo read:user user:email";

export interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

export interface GitHubUser {
  login: string;
  name: string | null;
  html_url: string;
  avatar_url: string;
}

export function isGitHubConfigured() {
  return Boolean(
    process.env.GITHUB_CLIENT_ID &&
      process.env.GITHUB_CLIENT_SECRET &&
      process.env.GITHUB_REDIRECT_URI,
  );
}

export function getGitHubAuthorizeUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID!,
    redirect_uri: process.env.GITHUB_REDIRECT_URI!,
    scope: process.env.GITHUB_SCOPES || DEFAULT_SCOPES,
    state,
    allow_signup: "true",
  });
  return `${AUTH_BASE}/login/oauth/authorize?${params.toString()}`;
}

export async function exchangeGitHubCodeForToken(
  code: string,
): Promise<GitHubTokenResponse> {
  const res = await fetch(`${AUTH_BASE}/login/oauth/access_token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: process.env.GITHUB_REDIRECT_URI,
    }),
  });

  const data = await res.json();
  if (!res.ok || data.error || !data.access_token) {
    throw new Error(
      `GitHub token exchange failed: ${data.error_description || data.error || (await safeText(res, data))}`,
    );
  }

  return data as GitHubTokenResponse;
}

export async function getGitHubUser(accessToken: string): Promise<GitHubUser> {
  const res = await fetch(`${API_BASE}/user`, {
    headers: githubHeaders(accessToken),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch GitHub user: ${await res.text()}`);
  }

  return res.json();
}

export async function revokeGitHubToken(accessToken: string) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) return;

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  await fetch(`${API_BASE}/applications/${clientId}/grant`, {
    method: "DELETE",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Basic ${credentials}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "aihub-frontend",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ access_token: accessToken }),
  });
}

function githubHeaders(accessToken: string): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${accessToken}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "aihub-frontend",
  };
}

function safeText(res: Response, data: { error?: string }) {
  return data?.error || res.statusText;
}
