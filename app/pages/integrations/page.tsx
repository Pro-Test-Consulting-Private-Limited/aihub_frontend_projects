"use client";

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-toastify";
import { IconType } from "react-icons";
import Breadcrumbs from "../../components/breadcrumbs";
import { IntegrationsBreadcrumbs } from "../../constants/metrics";
import AuthGuard from "@/app/lib/authguard";
import {
  useIntegrationStatus,
  type ConnectionHealth,
} from "@/app/hooks/use-integration-status";
import ConnectIntegrationModal from "@/app/components/connect-integration-modal";
import { useMsal } from "@azure/msal-react";
import { getFreshIdToken, getGraphAccessToken } from "@/app/lib/auth-client";
import { SiJira } from "react-icons/si";
import {
  INTEGRATION_CATEGORIES,
  type AccountIntegrationProvider,
} from "@/app/lib/integrations-registry";

type LiveProvider = AccountIntegrationProvider;

type CardStatus = "connected" | "disconnected" | "needs_reconnect" | "error";

interface IntegrationTool {
  id: string;
  name: string;
  status: CardStatus;
  description: string;
  buttons: string[];
  Icon: IconType;
  color: string;
  provider?: LiveProvider;
  healthDetail?: string | null;
  checkedAt?: number | null;
}

function healthToCard(health: ConnectionHealth): CardStatus {
  if (health === "active") return "connected";
  if (health === "expired") return "needs_reconnect";
  if (health === "error") return "error";
  return "disconnected";
}

function statusLabel(status: CardStatus) {
  if (status === "connected") return "Active";
  if (status === "needs_reconnect") return "Token expired · reconnect";
  if (status === "error") return "Check failed";
  return "Not connected";
}

function agoShort(ts: number | null | undefined) {
  if (!ts) return null;
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

interface IntegrationCategory {
  title: string;
  subtitle: string;
  tools: IntegrationTool[];
}

const ERROR_MESSAGES: Record<string, string> = {
  invalid_state: "The connection request expired. Please try again.",
  token_exchange_failed: "Could not complete the connection. Please try again.",
  jira_not_configured:
    "Jira is not configured. Add JIRA_CLIENT_ID, JIRA_CLIENT_SECRET, and JIRA_REDIRECT_URI to your environment.",
  github_not_configured:
    "GitHub is not configured. Add GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, and GITHUB_REDIRECT_URI to your environment.",
  github_org_required:
    "Enter a valid GitHub organization URL, for example https://github.com/Pro-Test-Consulting-Private-Limited.",
  access_denied: "Connection was cancelled.",
};

const CATEGORIES: IntegrationCategory[] = INTEGRATION_CATEGORIES.map((category) => ({
  title: category.title,
  subtitle: category.subtitle,
  tools: category.tools.map((tool) => ({
    id: tool.id,
    name: tool.name,
    status: "disconnected" as CardStatus,
    description: tool.description,
    buttons: [tool.connectButton],
    Icon: tool.Icon,
    color: tool.color,
    provider: tool.accountProvider,
  })),
}));

function IntegrationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { instance, accounts } = useMsal();
  const {
    jira,
    github,
    swagger,
    teams,
    figma,
    loading,
    probing,
    refresh,
    saveProviders,
    disconnectProvider,
  } = useIntegrationStatus({ live: true, refreshMs: 60_000 });
  const [busy, setBusy] = useState<string | null>(null);
  const [connectProvider, setConnectProvider] = useState<Exclude<LiveProvider, "teams"> | null>(null);
  const handledCallback = useRef(false);
  const githubLinkAttempted = useRef(false);

  /** Forward the GitHub OAuth cookie to AppAtlas token vault (server-side). */
  const linkGithubVault = useCallback(async () => {
    const post = async (forceRefresh: boolean) => {
      const token = await getFreshIdToken(instance, accounts, forceRefresh);
      return fetch("/api/integrations/github/link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    };
    let res = await post(false);
    if (res.status === 401) res = await post(true);
    return res;
  }, [instance, accounts]);

  useEffect(() => {
    if (handledCallback.current) return;
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (!connected && !error) return;

    handledCallback.current = true;

    const persist = async () => {
      try {
        if (connected === "jira") {
          await saveProviders([{ provider: "jira", meta: { label: "Jira Cloud" } }]);
          toast.success("Jira connected");
        } else if (connected === "github") {
          const statusRes = await fetch("/api/auth/github/status", { cache: "no-store" });
          const status = statusRes.ok ? await statusRes.json() : null;
          await saveProviders([
            {
              provider: "github",
              meta: {
                username: status?.username || "github-user",
                org: status?.org || null,
                orgUrl: status?.orgUrl || null,
              },
            },
          ]);
          // Best-effort vault link; set the guard first so the page-load effect cannot double-call.
          githubLinkAttempted.current = true;
          await linkGithubVault().catch(() => undefined);
          const who = status?.org
            ? status.username
              ? `${status.org} (@${status.username})`
              : status.org
            : status?.username
              ? `@${status.username}`
              : null;
          toast.success(who ? `GitHub connected: ${who}` : "GitHub connected");
        } else if (error) {
          toast.error(ERROR_MESSAGES[error] || "Connection failed");
        }
      } catch {
        toast.error("Connected, but could not persist status. Try reconnecting.");
      } finally {
        router.replace("/integrations");
      }
    };

    void persist();
  }, [searchParams, router, saveProviders, linkGithubVault]);

  // People who connected GitHub earlier: link the vault once when cookies say connected.
  useEffect(() => {
    if (githubLinkAttempted.current || loading) return;
    if (!github.connected || github.health !== "active") return;
    githubLinkAttempted.current = true;
    void linkGithubVault().catch(() => undefined);
  }, [github.connected, github.health, loading, linkGithubVault]);

  const resolveTool = (tool: IntegrationTool): IntegrationTool => {
    if (tool.provider === "swagger") {
      const status = healthToCard(swagger.health);
      return {
        ...tool,
        status,
        description: swagger.connected
          ? `Connected to ${swagger.title || "OpenAPI spec"}${
              swagger.specUrl ? ` (${swagger.specUrl})` : ""
            }. ${tool.description}`
          : tool.description,
        buttons: swagger.connected ? ["Disconnect Swagger"] : ["Connect Swagger"],
      };
    }

    if (tool.provider === "jira") {
      const status = healthToCard(jira.health);
      const who = jira.user ? ` as ${jira.user}` : "";
      return {
        ...tool,
        status,
        healthDetail: jira.detail,
        checkedAt: jira.checkedAt,
        description:
          status === "connected"
            ? `Active on ${jira.siteName || "Jira"}${who}. ${tool.description}`
            : status === "needs_reconnect"
              ? jira.detail ||
                `Session for ${jira.siteName || "Jira"} expired or was revoked. Reconnect to keep mapping and SIT working.`
              : status === "error"
                ? jira.detail || "Could not reach Jira to verify the connection."
                : tool.description,
        buttons:
          status === "connected"
            ? ["Disconnect Jira", "Check connection"]
            : status === "needs_reconnect" || status === "error"
              ? ["Reconnect Jira", "Disconnect Jira"]
              : ["Connect Jira"],
      };
    }

    if (tool.provider === "github") {
      const status = healthToCard(github.health);
      const orgLabel = github.org || github.orgUrl;
      return {
        ...tool,
        status,
        healthDetail: github.detail,
        checkedAt: github.checkedAt,
        description:
          status === "connected"
            ? `Active on ${orgLabel || "GitHub"}${
                github.username ? ` as @${github.username}` : ""
              }. ${tool.description}`
            : status === "needs_reconnect"
              ? github.detail ||
                "GitHub session expired or was revoked. Reconnect to restore sync."
              : status === "error"
                ? github.detail || "Could not reach GitHub to verify the connection."
                : tool.description,
        buttons:
          status === "connected"
            ? ["Disconnect GitHub", "Check connection"]
            : status === "needs_reconnect" || status === "error"
              ? ["Reconnect GitHub", "Disconnect GitHub"]
              : ["Connect GitHub"],
      };
    }

    if (tool.provider === "teams") {
      const status = healthToCard(teams.health);
      return {
        ...tool,
        status,
        description: teams.connected
          ? `${teams.label || "Microsoft Teams"} ready. Link a channel on each canvas in Connect apps.`
          : tool.description,
        buttons: teams.connected ? ["Disconnect Teams"] : ["Connect Teams"],
      };
    }

    if (tool.provider === "figma") {
      const status = healthToCard(figma.health);
      const who = figma.handle ? ` as @${figma.handle}` : figma.email ? ` as ${figma.email}` : "";
      return {
        ...tool,
        status,
        healthDetail: figma.detail,
        checkedAt: figma.checkedAt,
        description:
          status === "connected"
            ? `Active on Figma${who}. ${tool.description}`
            : status === "needs_reconnect"
              ? figma.detail ||
                "Figma session expired or was revoked. Reconnect to restore Design Validation."
              : status === "error"
                ? figma.detail || "Could not reach Figma to verify the connection."
                : tool.description,
        buttons:
          status === "connected"
            ? ["Disconnect Figma", "Check connection"]
            : status === "needs_reconnect" || status === "error"
              ? ["Reconnect Figma", "Disconnect Figma"]
              : ["Connect Figma"],
      };
    }

    return tool;
  };

  const handleDemoConnect = async () => {
    setBusy("demo");
    try {
      await saveProviders([
        { provider: "jira", meta: { label: "ProTest Jira (demo)" } },
        { provider: "github", meta: { username: "protest-demo" } },
        { provider: "swagger", meta: { label: "demo OpenAPI workspace" } },
      ]);
    } catch (err) {
      console.error(err);
      toast.error("Could not save integrations. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const handleAction = async (tool: IntegrationTool, label: string) => {
    if (label === "Check connection") {
      setBusy("check");
      try {
        await refresh();
        toast.success("Connection status refreshed");
      } catch {
        toast.error("Could not refresh connection status");
      } finally {
        setBusy(null);
      }
      return;
    }

    if (tool.provider && label.startsWith("Disconnect")) {
      setBusy(tool.provider);
      try {
        await disconnectProvider(tool.provider);
      } catch {
        toast.error(`Could not disconnect ${tool.name}. Please try again.`);
      } finally {
        setBusy(null);
      }
      return;
    }

    if (tool.provider === "teams" && label.startsWith("Connect")) {
      setBusy("teams");
      try {
        await getGraphAccessToken(instance, accounts);
        await saveProviders([{ provider: "teams", meta: { label: "Microsoft Teams" } }]);
        toast.success("Microsoft Teams connected");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not connect Teams. Check Entra admin consent.");
      } finally {
        setBusy(null);
      }
      return;
    }

    if (
      tool.provider &&
      tool.provider !== "teams" &&
      (label.startsWith("Connect") || label.startsWith("Reconnect"))
    ) {
      setConnectProvider(tool.provider);
      return;
    }

    toast.info(`${tool.name} integration is coming soon`);
  };

  return (
    <div className="relative p-6 pb-[4.5rem] h-full overflow-y-auto">
      <Breadcrumbs breadcrumbs={IntegrationsBreadcrumbs} />

      <div className="mb-[16px] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="text-[22px] font-[500] text-[#081332] dark:text-[#ededed]">
            Integrations
          </div>
          <button
            type="button"
            aria-label="Demo connect"
            disabled={busy === "demo"}
            onClick={() => handleDemoConnect()}
            className="h-5 w-5 shrink-0 rounded-full border-0 bg-transparent opacity-0"
          />
        </div>
        <button
          type="button"
          disabled={probing || busy === "check"}
          onClick={() => void handleAction({ id: "check", name: "All", status: "disconnected", description: "", buttons: [], Icon: SiJira, color: "#000" }, "Check connection")}
          className="rounded-[8px] border border-[rgba(94,96,102,0.3)] px-3 py-1.5 text-[12.5px] font-medium text-[#1F1F1F] hover:bg-[#F5F6F6] disabled:opacity-60 dark:border-[#2a2a2a] dark:text-[#ededed] dark:hover:bg-[#1a1a1a]"
        >
          {probing || busy === "check" ? "Checking…" : "Refresh connection status"}
        </button>
      </div>

      <div className="mb-[28px] rounded-[12px] border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3 dark:border-[#2a2a2a] dark:bg-[#141414]">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
          Connection status
          {loading ? " · loading…" : probing ? " · checking…" : ""}
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { name: "Jira", status: healthToCard(jira.health), detail: jira.detail, checkedAt: jira.checkedAt, site: jira.siteName || jira.user },
              { name: "GitHub", status: healthToCard(github.health), detail: github.detail, checkedAt: github.checkedAt, site: github.org ? `${github.org}${github.username ? ` (@${github.username})` : ""}` : github.username ? `@${github.username}` : null },
              { name: "Swagger", status: healthToCard(swagger.health), detail: null, checkedAt: null, site: swagger.title },
              { name: "Teams", status: healthToCard(teams.health), detail: null, checkedAt: null, site: teams.label },
              ...(process.env.NEXT_PUBLIC_FIGMA_INTEGRATION === "1"
                ? [
                    {
                      name: "Figma",
                      status: healthToCard(figma.health),
                      detail: figma.detail,
                      checkedAt: figma.checkedAt,
                      site: figma.handle ? `@${figma.handle}` : figma.email,
                    },
                  ]
                : []),
            ] as Array<{
              name: string;
              status: CardStatus;
              detail: string | null;
              checkedAt: number | null;
              site: string | null;
            }>
          ).map((row) => (
            <div
              key={row.name}
              title={row.detail || undefined}
              className={`rounded-full border px-2.5 py-1 text-[12px] font-medium ${
                row.status === "connected"
                  ? "border-[#86EFAC] bg-[#F0FDF4] text-[#166534]"
                  : row.status === "needs_reconnect"
                    ? "border-[#FCD34D] bg-[#FFFBEB] text-[#92400E]"
                    : row.status === "error"
                      ? "border-[#FCA5A5] bg-[#FEF2F2] text-[#991B1B]"
                      : "border-[#E5E7EB] bg-white text-[#6B7280] dark:border-[#2a2a2a] dark:bg-[#0f0f0f]"
              }`}
            >
              <span className="font-semibold">{row.name}</span>
              <span className="ml-1.5 opacity-90">{statusLabel(row.status)}</span>
              {row.site && row.status !== "disconnected" ? (
                <span className="ml-1.5 opacity-70">· {row.site}</span>
              ) : null}
              {agoShort(row.checkedAt) ? (
                <span className="ml-1.5 text-[10.5px] opacity-60">checked {agoShort(row.checkedAt)}</span>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {CATEGORIES.map((category) => {
        const tools = category.tools.map(resolveTool);
        const connectedCount = tools.filter((t) => t.status === "connected").length;
        const attentionCount = tools.filter((t) => t.status === "needs_reconnect" || t.status === "error").length;

        return (
          <div key={category.title} className="mb-[35px]">
            <div className="flex justify-between items-center pb-[12px] border-b border-[rgba(94,96,102,0.2)] dark:border-[#2a2a2a] mb-[20px]">
              <div>
                <div className="text-[13px] font-[700] tracking-wide text-[#1F1F1F] dark:text-[#ededed]">
                  {category.title}
                </div>
                <div className="text-[12px] text-[#7E7E7E] dark:text-[#9ca3af] mt-[2px]">
                  {category.subtitle}
                </div>
              </div>
              <div className="text-[12px] font-[500] px-[12px] py-[4px] rounded-[20px] bg-[#F2F2F2] dark:bg-[#1a1a1a] text-[#5E6066] dark:text-[#9ca3af] whitespace-nowrap">
                {connectedCount}/{category.tools.length} active
                {attentionCount > 0 ? ` · ${attentionCount} need reconnect` : ""}
              </div>
            </div>

            <div className="flex flex-wrap gap-[20px]">
              {tools.map((tool) => {
                const Icon = tool.Icon;
                const isBusy = busy === tool.id || busy === tool.provider || busy === "check";
                const isGreenCard =
                  tool.status === "connected" &&
                  (tool.id === "jira" ||
                    tool.id === "github" ||
                    tool.id === "swagger" ||
                    tool.id === "teams" ||
                    tool.id === "figma");
                const isWarnCard = tool.status === "needs_reconnect" || tool.status === "error";
                return (
                  <div
                    key={tool.id}
                    className={`w-[320px] rounded-xl p-5 border transition-all duration-300 ${
                      isGreenCard
                        ? "bg-gradient-to-br from-[#ECFDF5] via-[#D1FAE5] to-[#A7F3D0] border-[#22C55E] shadow-[0_0_0_1px_rgba(34,197,94,0.35),0_10px_28px_rgba(34,197,94,0.28)] dark:from-[#052e1c] dark:via-[#064e3b] dark:to-[#065f46] dark:border-[#34D399]"
                        : isWarnCard
                          ? "bg-gradient-to-br from-[#FFFBEB] via-[#FEF3C7] to-[#FDE68A] border-[#F59E0B] dark:from-[#2a2210] dark:via-[#422006] dark:to-[#78350f] dark:border-[#FBBF24]"
                          : "bg-[#fff] dark:bg-[#141414] border-[0.7px] border-[#E2ECF9] dark:border-[#2a2a2a]"
                    }`}
                  >
                    <div className="flex items-center gap-[12px] mb-[12px]">
                      <div
                        className={`w-[36px] h-[36px] rounded-[10px] flex items-center justify-center shrink-0 border ${
                          isGreenCard
                            ? "bg-white/90 border-[#86EFAC] shadow-[0_0_14px_rgba(34,197,94,0.55)]"
                            : isWarnCard
                              ? "bg-white/90 border-[#FCD34D]"
                              : "bg-white border-[#E2ECF9] dark:border-transparent"
                        }`}
                      >
                        <Icon size={20} color={tool.color} />
                      </div>
                      <div className="flex flex-col">
                        <div
                          className={`text-[15px] font-[600] ${
                            isGreenCard
                              ? "text-[#14532D] dark:text-[#BBF7D0]"
                              : isWarnCard
                                ? "text-[#92400E] dark:text-[#FCD34D]"
                                : "text-[#1F1F1F] dark:text-[#ededed]"
                          }`}
                        >
                          {tool.name}
                        </div>
                        <div
                          className={`text-[11px] font-[600] w-fit mt-[2px] ${
                            tool.status === "connected"
                              ? "text-[#15803D] dark:text-[#4ADE80]"
                              : tool.status === "needs_reconnect" || tool.status === "error"
                                ? "text-[#B45309] dark:text-[#FBBF24]"
                                : "text-[#D97706]"
                          }`}
                        >
                          {statusLabel(tool.status)}
                          {agoShort(tool.checkedAt) ? ` · checked ${agoShort(tool.checkedAt)}` : ""}
                        </div>
                      </div>
                    </div>

                    <div
                      className={`text-[13px] mb-[15px] min-h-[36px] ${
                        isGreenCard
                          ? "text-[#166534] dark:text-[#A7F3D0]"
                          : isWarnCard
                            ? "text-[#92400E] dark:text-[#FDE68A]"
                            : "text-[#7E7E7E] dark:text-[#9ca3af]"
                      }`}
                    >
                      {tool.description}
                    </div>

                    <div className="flex flex-col gap-[8px]">
                      {tool.buttons.map((label) => (
                        <button
                          key={label}
                          type="button"
                          disabled={Boolean(isBusy)}
                          onClick={() => handleAction(tool, label)}
                          className={`w-full h-[36px] rounded-[8px] border text-[13px] font-[500] transition-colors disabled:opacity-60 ${
                            isGreenCard
                              ? "border-[#16A34A]/60 bg-white/70 text-[#14532D] hover:bg-white dark:bg-[#052e1c]/60 dark:text-[#BBF7D0] dark:hover:bg-[#064e3b]"
                              : isWarnCard && label.startsWith("Reconnect")
                                ? "border-[#D97706] bg-[#D97706] text-white hover:bg-[#B45309]"
                                : "border-[rgba(94,96,102,0.3)] dark:border-[#2a2a2a] text-[#1F1F1F] dark:text-[#ededed] hover:bg-[#F5F6F6] dark:hover:bg-[#1a1a1a]"
                          }`}
                        >
                          {isBusy && label.startsWith("Disconnect")
                            ? "Disconnecting..."
                            : isBusy && label === "Check connection"
                              ? "Checking..."
                              : label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <ConnectIntegrationModal
        provider={connectProvider}
        onClose={() => setConnectProvider(null)}
        onConnected={async (connected, meta) => {
          try {
            if (connected === "jira") {
              await saveProviders([
                {
                  provider: "jira",
                  meta: { label: meta?.siteName || "Jira Cloud" },
                },
              ]);
            } else if (connected === "swagger") {
              await saveProviders([
                {
                  provider: "swagger",
                  meta: {
                    label: meta?.title || "OpenAPI Spec",
                    specUrl: meta?.specUrl || "",
                  },
                },
              ]);
            } else if (connected === "figma") {
              await saveProviders([
                {
                  provider: "figma",
                  meta: {
                    handle: meta?.handle || null,
                    email: meta?.email || null,
                    userId: meta?.userId || null,
                  },
                },
              ]);
            }
          } catch {
            await refresh();
          }
          toast.success(
            connected === "swagger"
              ? "Swagger connected"
              : connected === "figma"
                ? meta?.handle
                  ? `Figma connected as @${meta.handle}`
                  : "Figma connected"
                : "Jira connected",
          );
        }}
      />
    </div>
  );
}

export default function Integrations() {
  return (
    <AuthGuard>
      <Suspense fallback={<div className="p-6 text-sm text-[#7E7E7E]">Loading integrations...</div>}>
        <IntegrationsContent />
      </Suspense>
    </AuthGuard>
  );
}
