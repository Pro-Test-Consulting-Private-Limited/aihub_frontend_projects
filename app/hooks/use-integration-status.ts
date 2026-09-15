"use client";

import { useCallback, useEffect, useState } from "react";
import { useMsal } from "@azure/msal-react";
import { getFreshIdToken } from "@/app/lib/auth-client";

export type IntegrationProvider = "jira" | "github" | "swagger";

export type StoredIntegration = {
  provider: IntegrationProvider;
  meta: Record<string, unknown>;
  connectedAt?: string;
};

export type JiraStatus = {
  connected: boolean;
  siteName: string | null;
  siteUrl: string | null;
};

export type GitHubStatus = {
  connected: boolean;
  username: string | null;
};

export type SwaggerStatus = {
  connected: boolean;
  title: string | null;
  specUrl: string | null;
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

const EMPTY_SWAGGER: SwaggerStatus = {
  connected: false,
  title: null,
  specUrl: null,
};

export function useIntegrationStatus() {
  const { instance, accounts } = useMsal();
  const [jira, setJira] = useState<JiraStatus>(EMPTY_JIRA);
  const [github, setGithub] = useState<GitHubStatus>(EMPTY_GITHUB);
  const [swagger, setSwagger] = useState<SwaggerStatus>(EMPTY_SWAGGER);
  const [stored, setStored] = useState<StoredIntegration[]>([]);
  const [loading, setLoading] = useState(true);

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
    try {
      const headers = await authHeaders();
      const [dbRes, jiraRes, githubRes, swaggerRes] = await Promise.all([
        fetch("/api/integrations", { cache: "no-store", headers }),
        fetch("/api/auth/jira/status", { cache: "no-store" }),
        fetch("/api/auth/github/status", { cache: "no-store" }),
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

      setJira({
        connected: Boolean(cookieJira.connected || dbJira),
        siteName:
          cookieJira.siteName ||
          (typeof dbJira?.meta?.label === "string" ? dbJira.meta.label : null) ||
          null,
        siteUrl: cookieJira.siteUrl ?? null,
      });

      setGithub({
        connected: Boolean(cookieGithub.connected || dbGithub),
        username:
          cookieGithub.username ||
          (typeof dbGithub?.meta?.username === "string"
            ? dbGithub.meta.username
            : null) ||
          null,
      });

      setSwagger({
        connected: Boolean(cookieSwagger.connected || dbSwagger),
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
      });
    } catch (err) {
      console.error("Failed to load integration status", err);
    }
  }, [authHeaders]);

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

      await fetch(`/api/auth/${provider}/disconnect`, { method: "POST" }).catch(
        () => undefined,
      );

      await refresh();
    },
    [authHeaders, refresh],
  );

  return {
    jira,
    github,
    swagger,
    swaggerConnected: swagger.connected,
    stored,
    loading,
    refresh,
    saveProviders,
    disconnectProvider,
  };
}
