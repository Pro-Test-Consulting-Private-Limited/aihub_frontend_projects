"use client";

import { useCallback, useEffect, useState } from "react";
import { useMsal } from "@azure/msal-react";
import { getFreshIdToken } from "@/app/lib/auth-client";

export type IntegrationProvider = "jira" | "github" | "swagger" | "teams";

/** Live probe result for tools that hold secrets in cookies. */
export type ConnectionHealth = "disconnected" | "active" | "expired" | "error" | "unknown";

export type StoredIntegration = {
  provider: IntegrationProvider;
  meta: Record<string, unknown>;
  connectedAt?: string;
};

export type JiraStatus = {
  connected: boolean;
  health: ConnectionHealth;
  siteName: string | null;
  siteUrl: string | null;
  user: string | null;
  detail: string | null;
  checkedAt: number | null;
};

export type GitHubStatus = {
  connected: boolean;
  health: ConnectionHealth;
  username: string | null;
  detail: string | null;
  checkedAt: number | null;
};

export type SwaggerStatus = {
  connected: boolean;
  health: ConnectionHealth;
  title: string | null;
  specUrl: string | null;
  detail: string | null;
};

export type TeamsStatus = {
  connected: boolean;
  health: ConnectionHealth;
  label: string | null;
  detail: string | null;
};

const EMPTY_JIRA: JiraStatus = {
  connected: false,
  health: "disconnected",
  siteName: null,
  siteUrl: null,
  user: null,
  detail: null,
  checkedAt: null,
};

const EMPTY_GITHUB: GitHubStatus = {
  connected: false,
  health: "disconnected",
  username: null,
  detail: null,
  checkedAt: null,
};

const EMPTY_SWAGGER: SwaggerStatus = {
  connected: false,
  health: "disconnected",
  title: null,
  specUrl: null,
  detail: null,
};

const EMPTY_TEAMS: TeamsStatus = {
  connected: false,
  health: "disconnected",
  label: null,
  detail: null,
};

export function useIntegrationStatus(opts?: { live?: boolean }) {
  /** Live probe hits Jira/GitHub APIs — only opt in (Integrations hub). Elsewhere cookie/DB presence is enough. */
  const live = opts?.live === true;
  const { instance, accounts } = useMsal();
  const [jira, setJira] = useState<JiraStatus>(EMPTY_JIRA);
  const [github, setGithub] = useState<GitHubStatus>(EMPTY_GITHUB);
  const [swagger, setSwagger] = useState<SwaggerStatus>(EMPTY_SWAGGER);
  const [teams, setTeams] = useState<TeamsStatus>(EMPTY_TEAMS);
  const [stored, setStored] = useState<StoredIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [probing, setProbing] = useState(false);

  const authHeaders = useCallback(
    async (forceRefresh = false) => {
      const token = await getFreshIdToken(instance, accounts, forceRefresh);
      return {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
    },
    [instance, accounts],
  );

  const refresh = useCallback(async () => {
    setProbing(true);
    try {
      const headers = await authHeaders();
      const q = live ? "?live=1" : "";
      const [dbRes, jiraRes, githubRes, swaggerRes] = await Promise.all([
        fetch("/api/integrations", { cache: "no-store", headers }),
        fetch(`/api/auth/jira/status${q}`, { cache: "no-store" }),
        fetch(`/api/auth/github/status${q}`, { cache: "no-store" }),
        fetch("/api/auth/swagger/status", { cache: "no-store" }),
      ]);

      let dbIntegrations: StoredIntegration[] = [];
      if (dbRes.ok) {
        const data = await dbRes.json();
        dbIntegrations = data.integrations ?? [];
        setStored(dbIntegrations);
      }

      const cookieJira = jiraRes.ok ? await jiraRes.json() : EMPTY_JIRA;
      const cookieGithub = githubRes.ok ? await githubRes.json() : EMPTY_GITHUB;
      const cookieSwagger = swaggerRes.ok
        ? await swaggerRes.json()
        : EMPTY_SWAGGER;

      const dbJira = dbIntegrations.find((i) => i.provider === "jira");
      const dbGithub = dbIntegrations.find((i) => i.provider === "github");
      const dbSwagger = dbIntegrations.find((i) => i.provider === "swagger");
      const dbTeams = dbIntegrations.find((i) => i.provider === "teams");

      // Cookie/live health wins. DB-only "connected" without working cookies → needs reconnect.
      const jiraHealth: ConnectionHealth = cookieJira.health
        ? cookieJira.health
        : cookieJira.connected
          ? "active"
          : dbJira
            ? "expired"
            : "disconnected";

      setJira({
        connected: Boolean(cookieJira.connected || dbJira),
        health: jiraHealth,
        siteName:
          cookieJira.siteName ||
          (typeof dbJira?.meta?.label === "string" ? dbJira.meta.label : null) ||
          null,
        siteUrl: cookieJira.siteUrl ?? null,
        user: cookieJira.user ?? null,
        detail:
          cookieJira.detail ||
          (jiraHealth === "expired" && dbJira && !cookieJira.connected
            ? "Saved as connected, but no working Jira session in this browser. Reconnect."
            : null),
        checkedAt: cookieJira.checkedAt ?? null,
      });

      const githubHealth: ConnectionHealth = cookieGithub.health
        ? cookieGithub.health
        : cookieGithub.connected
          ? "active"
          : dbGithub
            ? "expired"
            : "disconnected";

      setGithub({
        connected: Boolean(cookieGithub.connected || dbGithub),
        health: githubHealth,
        username:
          cookieGithub.username ||
          (typeof dbGithub?.meta?.username === "string"
            ? dbGithub.meta.username
            : null) ||
          null,
        detail:
          cookieGithub.detail ||
          (githubHealth === "expired" && dbGithub && !cookieGithub.connected
            ? "Saved as connected, but no working GitHub session in this browser. Reconnect."
            : null),
        checkedAt: cookieGithub.checkedAt ?? null,
      });

      setSwagger({
        connected: Boolean(cookieSwagger.connected || dbSwagger),
        health: cookieSwagger.connected || dbSwagger ? "active" : "disconnected",
        title:
          cookieSwagger.title ||
          (typeof dbSwagger?.meta?.label === "string"
            ? dbSwagger.meta.label
            : null) ||
          null,
        specUrl:
          cookieSwagger.specUrl ||
          (typeof dbSwagger?.meta?.specUrl === "string"
            ? dbSwagger.meta.specUrl
            : null) ||
          null,
        detail: null,
      });

      setTeams({
        connected: Boolean(dbTeams),
        health: dbTeams ? "active" : "disconnected",
        label:
          (typeof dbTeams?.meta?.label === "string" ? dbTeams.meta.label : null) ||
          (dbTeams ? "Microsoft Teams" : null),
        detail: null,
      });
    } catch (err) {
      console.error("Failed to load integration status", err);
    } finally {
      setProbing(false);
    }
  }, [authHeaders, live]);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const saveProviders = useCallback(
    async (
      providers: Array<{
        provider: IntegrationProvider;
        meta?: Record<string, unknown>;
      }>,
    ) => {
      const post = async (forceRefresh: boolean) => {
        const headers = await authHeaders(forceRefresh);
        return fetch("/api/integrations", {
          method: "POST",
          headers,
          body: JSON.stringify({ providers }),
        });
      };

      let res = await post(false);
      if (res.status === 401) {
        res = await post(true);
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save integrations");
      }
      await refresh();
    },
    [authHeaders, refresh],
  );

  const disconnectProvider = useCallback(
    async (provider: IntegrationProvider) => {
      const del = async (forceRefresh: boolean) => {
        const headers = await authHeaders(forceRefresh);
        return fetch(`/api/integrations?provider=${provider}`, {
          method: "DELETE",
          headers,
        });
      };

      let res = await del(false);
      if (res.status === 401) {
        res = await del(true);
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to disconnect");
      }

      if (provider !== "teams") {
        await fetch(`/api/auth/${provider}/disconnect`, { method: "POST" }).catch(
          () => undefined,
        );
      }

      await refresh();
    },
    [authHeaders, refresh],
  );

  return {
    jira,
    github,
    swagger,
    teams,
    swaggerConnected: swagger.connected,
    stored,
    loading,
    probing,
    refresh,
    saveProviders,
    disconnectProvider,
  };
}
