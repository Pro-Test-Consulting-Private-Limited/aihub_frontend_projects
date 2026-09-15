"use client";

import { useCallback, useEffect, useState } from "react";

export type JiraStatus = {
  connected: boolean;
  siteName: string | null;
  siteUrl: string | null;
};

export type GitHubStatus = {
  connected: boolean;
  username: string | null;
};

const EMPTY_JIRA: JiraStatus = {
  connected: false,
  siteName: null,
  siteUrl: null,
};

const EMPTY_GITHUB: GitHubStatus = {
  connected: false,
  username: null,
};

export function useIntegrationStatus() {
  const [jira, setJira] = useState<JiraStatus>(EMPTY_JIRA);
  const [github, setGithub] = useState<GitHubStatus>(EMPTY_GITHUB);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [jiraRes, githubRes] = await Promise.all([
        fetch("/api/auth/jira/status", { cache: "no-store" }),
        fetch("/api/auth/github/status", { cache: "no-store" }),
      ]);
      if (jiraRes.ok) setJira(await jiraRes.json());
      if (githubRes.ok) setGithub(await githubRes.json());
    } catch (err) {
      console.error("Failed to load integration status", err);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  return { jira, github, loading, refresh };
}

export function startOAuth(provider: "jira" | "github", returnTo?: string) {
  const url = new URL(`/api/auth/${provider}/authorize`, window.location.origin);
  if (returnTo) url.searchParams.set("returnTo", returnTo);
  window.location.href = url.toString();
}
