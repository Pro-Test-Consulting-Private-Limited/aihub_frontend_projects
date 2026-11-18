const AUTH_BASE = "https://github.com";
const API_BASE = "https://api.github.com";
const DEFAULT_SCOPES = "repo read:user user:email read:org";

/** Accepts org login, github.com/ORG, or github.com/organizations/ORG. */
export function parseGitHubOrgInput(raw: string): { org: string; orgUrl: string } | null {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return null;

  let candidate = trimmed;
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const url = new URL(trimmed);
      if (!/^(www\.)?github\.com$/i.test(url.hostname)) return null;
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0]?.toLowerCase() === "organizations" && parts[1]) {
        candidate = parts[1];
      } else if (parts[0] && !["settings", "orgs", "login", "apps"].includes(parts[0].toLowerCase())) {
        candidate = parts[0];
      } else {
        return null;
      }
    } else {
      candidate = trimmed.replace(/^@/, "").replace(/\/+$/, "");
      if (candidate.includes("/")) {
        const parts = candidate.split("/").filter(Boolean);
        if (parts[0]?.toLowerCase() === "organizations" && parts[1]) candidate = parts[1];
        else candidate = parts[0];
      }
    }
  } catch {
    return null;
  }

  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(candidate)) {
    return null;
  }

  return {
    org: candidate,
    orgUrl: `https://github.com/${candidate}`,
  };
}

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
