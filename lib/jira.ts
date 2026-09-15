const AUTH_BASE = "https://auth.atlassian.com";
const API_BASE = "https://api.atlassian.com";
const DEFAULT_SCOPES =
  "read:jira-work write:jira-work read:jira-user offline_access";

export interface JiraTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
}

export interface JiraAccessibleResource {
  id: string; // cloudId
  url: string;
  name: string;
  scopes: string[];
}

export function isJiraConfigured() {
  return Boolean(
    process.env.JIRA_CLIENT_ID &&
      process.env.JIRA_CLIENT_SECRET &&
      process.env.JIRA_REDIRECT_URI,
  );
}

export function getJiraAuthorizeUrl(state: string) {
  const params = new URLSearchParams({
    audience: "api.atlassian.com",
    client_id: process.env.JIRA_CLIENT_ID!,
    scope: process.env.JIRA_SCOPES || DEFAULT_SCOPES,
    redirect_uri: process.env.JIRA_REDIRECT_URI!,
    state,
    response_type: "code",
    prompt: "consent",
  });
  return `${AUTH_BASE}/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<JiraTokenResponse> {
  const res = await fetch(`${AUTH_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: process.env.JIRA_CLIENT_ID,
      client_secret: process.env.JIRA_CLIENT_SECRET,
      code,
      redirect_uri: process.env.JIRA_REDIRECT_URI,
    }),
  });

  if (!res.ok) {
    throw new Error(`Token exchange failed: ${await res.text()}`);
  }

  return res.json();
}

export async function refreshJiraToken(refreshToken: string): Promise<JiraTokenResponse> {
  const res = await fetch(`${AUTH_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: process.env.JIRA_CLIENT_ID,
      client_secret: process.env.JIRA_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    throw new Error(`Token refresh failed: ${await res.text()}`);
  }

  return res.json();
}

// Jira Cloud sites are identified by a "cloudId" — fetch it once after auth
export async function getAccessibleResources(
  accessToken: string
): Promise<JiraAccessibleResource[]> {
  const res = await fetch(`${API_BASE}/oauth/token/accessible-resources`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch accessible resources");
  }

  return res.json();
}

export async function jiraApiFetch(
  cloudId: string,
  accessToken: string,
  path: string,
  init?: RequestInit
) {
  return fetch(`${API_BASE}/ex/jira/${cloudId}/rest/api/3${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });
}

export function normalizeJiraSiteUrl(input: string) {
  const trimmed = input.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const parsed = new URL(withProtocol);

  if (parsed.protocol !== "https:") {
    throw new Error("Jira site URL must use https");
  }

  return `${parsed.protocol}//${parsed.host}`;
}

export async function verifyJiraApiToken(siteUrl: string, email: string, apiToken: string) {
  const auth = Buffer.from(`${email}:${apiToken}`).toString("base64");
  const headers = {
    Authorization: `Basic ${auth}`,
    Accept: "application/json",
  };

  const [myselfRes, serverRes] = await Promise.all([
    fetch(`${siteUrl}/rest/api/3/myself`, { headers }),
    fetch(`${siteUrl}/rest/api/3/serverInfo`, { headers }),
  ]);

  if (myselfRes.status === 401 || myselfRes.status === 403) {
    throw new Error("Jira email or API token is invalid");
  }
  if (!myselfRes.ok) {
    throw new Error("Could not reach Jira with those credentials");
  }

  const myself = (await myselfRes.json()) as {
    displayName?: string;
    emailAddress?: string;
  };
  const server = serverRes.ok
    ? ((await serverRes.json()) as { serverTitle?: string })
    : {};

  return {
    siteName: server.serverTitle || myself.displayName || new URL(siteUrl).host,
    email: myself.emailAddress || email,
  };
}