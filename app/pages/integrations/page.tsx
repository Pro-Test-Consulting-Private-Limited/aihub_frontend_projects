"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-toastify";
import { IconType } from "react-icons";
import { SiJira, SiLinear, SiGithub, SiGitlab, SiGit, SiFigma, SiSwagger } from "react-icons/si";
import { VscAzureDevops } from "react-icons/vsc";
import { FaMicrosoft, FaAws, FaSlack, FaBook, FaCode } from "react-icons/fa";
import Breadcrumbs from "../../components/breadcrumbs";
import { IntegrationsBreadcrumbs } from "../../constants/metrics";
import AuthGuard from "@/app/lib/authguard";
import {
  useIntegrationStatus,
  type ConnectionHealth,
} from "@/app/hooks/use-integration-status";
import ConnectIntegrationModal from "@/app/components/connect-integration-modal";
import { useMsal } from "@azure/msal-react";
import { getGraphAccessToken } from "@/app/lib/auth-client";

type LiveProvider = "jira" | "github" | "swagger" | "teams";

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
  access_denied: "Connection was cancelled.",
};

const CATEGORIES: IntegrationCategory[] = [
  {
    title: "AGILE PROJECT MANAGEMENT & ISSUE TRACKING",
    subtitle: "Product ops, sprints, and issue tracking",
    tools: [
      {
        id: "jira",
        name: "Jira",
        status: "disconnected",
        description: "Test cases push as issues. Execution results sync back.",
        buttons: ["Connect Jira"],
        Icon: SiJira,
        color: "#2684FF",
        provider: "jira",
      },
      {
        id: "linear",
        name: "Linear",
        status: "disconnected",
        description: "Connect to push test cases as Linear issues.",
        buttons: ["Connect Linear"],
        Icon: SiLinear,
        color: "#5E6AD2",
      },
    ],
  },
  {
    title: "API DESIGN & DOCUMENTATION",
    subtitle: "Define, mock, and validate API contracts",
    tools: [
      {
        id: "swagger",
        name: "Swagger / OpenAPI",
        status: "disconnected",
        description: "Import API specs to generate and validate test cases.",
        buttons: ["Connect Swagger"],
        Icon: SiSwagger,
        color: "#85EA2D",
        provider: "swagger",
      },
      {
        id: "redocly",
        name: "Redoc / Redocly",
        status: "disconnected",
        description: "Pull published API docs to keep contracts in sync.",
        buttons: ["Connect Redocly"],
        Icon: FaBook,
        color: "#263238",
      },
      {
        id: "stoplight",
        name: "Stoplight",
        status: "disconnected",
        description: "Sync API design and mock servers for contract testing.",
        buttons: ["Connect Stoplight"],
        Icon: FaCode,
        color: "#0B5FFF",
      },
    ],
  },
  {
    title: "SOURCE CODE MANAGEMENT & VERSION CONTROL",
    subtitle: "Repos, branches, and script commits",
    tools: [
      {
        id: "github",
        name: "GitHub",
        status: "disconnected",
        description: "Scripts synced to main branch. Auto-commit on heal.",
        buttons: ["Connect GitHub"],
        Icon: SiGithub,
        color: "#24292E",
        provider: "github",
      },
      {
        id: "gitlab",
        name: "GitLab",
        status: "disconnected",
        description: "Sync page objects and tests to a GitLab repository.",
        buttons: ["Connect GitLab"],
        Icon: SiGitlab,
        color: "#FC6D26",
      },
      {
        id: "gitbucket",
        name: "GitBucket",
        status: "disconnected",
        description: "Self-hosted Git — sync scripts to your GitBucket instance.",
        buttons: ["Connect GitBucket"],
        Icon: SiGit,
        color: "#F05032",
      },
      {
        id: "codecommit",
        name: "AWS CodeCommit",
        status: "disconnected",
        description: "Push generated test scripts to an AWS CodeCommit repo.",
        buttons: ["Connect CodeCommit"],
        Icon: FaAws,
        color: "#FF9900",
      },
      {
        id: "azure-repos",
        name: "Azure Repos",
        status: "disconnected",
        description: "Sync with Azure DevOps Repos for source control.",
        buttons: ["Connect Azure Repos"],
        Icon: VscAzureDevops,
        color: "#0078D7",
      },
    ],
  },
  {
    title: "UI/UX DESIGN & PROTOTYPING",
    subtitle: "Compare specs against crawled screens",
    tools: [
      {
        id: "figma",
        name: "Figma",
        status: "disconnected",
        description: "Compare UI specs against crawled screenshots.",
        buttons: ["Connect Figma"],
        Icon: SiFigma,
        color: "#F24E1E",
      },
    ],
  },
  {
    title: "TEAM COLLABORATION & COMMUNICATION",
    subtitle: "Alerts, summaries, and notifications",
    tools: [
      {
        id: "teams",
        name: "Microsoft Teams",
        status: "disconnected",
        description: "Connect once with your Microsoft account. Then link a team and channel on each canvas.",
        buttons: ["Connect Teams"],
        Icon: FaMicrosoft,
        color: "#6264A7",
        provider: "teams",
      },
      {
        id: "slack",
        name: "Slack",
        status: "disconnected",
        description: "Failure alerts to #qa-alerts. Daily summary to #engineering.",
        buttons: ["Connect Slack"],
        Icon: FaSlack,
        color: "#4A154B",
      },
    ],
  },
];

function IntegrationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { instance, accounts } = useMsal();
  const {
    jira,
    github,
    swagger,
    teams,
    loading,
    probing,
    refresh,
    saveProviders,
    disconnectProvider,
  } = useIntegrationStatus({ live: true });
  const [busy, setBusy] = useState<string | null>(null);
  const [connectProvider, setConnectProvider] = useState<Exclude<LiveProvider, "teams"> | null>(null);
  const handledCallback = useRef(false);

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
          await saveProviders([
            { provider: "github", meta: { username: "github-user" } },
          ]);
          toast.success("GitHub connected");
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
  }, [searchParams, router, saveProviders]);

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
      return {
        ...tool,
        status,
        healthDetail: github.detail,
        checkedAt: github.checkedAt,
        description:
          status === "connected"
            ? `Active as @${github.username || "github-user"}. ${tool.description}`
            : status === "needs_reconnect"
              ? github.detail ||
                "GitHub token expired or was revoked. Reconnect to restore sync."
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
              { name: "GitHub", status: healthToCard(github.health), detail: github.detail, checkedAt: github.checkedAt, site: github.username ? `@${github.username}` : null },
              { name: "Swagger", status: healthToCard(swagger.health), detail: null, checkedAt: null, site: swagger.title },
              { name: "Teams", status: healthToCard(teams.health), detail: null, checkedAt: null, site: teams.label },
            ] as const
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
                  (tool.id === "jira" || tool.id === "github" || tool.id === "swagger" || tool.id === "teams");
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
            } else if (connected === "github") {
              await saveProviders([
                {
                  provider: "github",
                  meta: { username: meta?.username || "github-user" },
                },
              ]);
            } else {
              await saveProviders([
                {
                  provider: "swagger",
                  meta: {
                    label: meta?.title || "OpenAPI Spec",
                    specUrl: meta?.specUrl || "",
                  },
                },
              ]);
            }
          } catch {
            await refresh();
          }
          toast.success(
            connected === "github"
              ? "GitHub connected"
              : connected === "swagger"
                ? "Swagger connected"
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
