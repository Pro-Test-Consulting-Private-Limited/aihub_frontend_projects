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
} from "@/app/hooks/use-integration-status";
import ConnectIntegrationModal from "@/app/components/connect-integration-modal";

type LiveProvider = "jira" | "github";

interface IntegrationTool {
  id: string;
  name: string;
  status: "connected" | "disconnected";
  description: string;
  buttons: string[];
  Icon: IconType;
  color: string;
  provider?: LiveProvider;
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
        description: "Failure alerts and daily summaries posted to a Teams channel.",
        buttons: ["Connect Teams"],
        Icon: FaMicrosoft,
        color: "#6264A7",
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
  const { jira, github, refresh } = useIntegrationStatus();
  const [busy, setBusy] = useState<LiveProvider | null>(null);
  const [connectProvider, setConnectProvider] = useState<LiveProvider | null>(null);
  const handledCallback = useRef(false);

  useEffect(() => {
    if (handledCallback.current) return;
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (!connected && !error) return;

    handledCallback.current = true;
    if (connected === "jira") toast.success("Jira connected");
    else if (connected === "github") toast.success("GitHub connected");
    else if (error) toast.error(ERROR_MESSAGES[error] || "Connection failed");

    router.replace("/integrations");
  }, [searchParams, router]);

  const resolveTool = (tool: IntegrationTool): IntegrationTool => {
    if (tool.provider === "jira") {
      return {
        ...tool,
        status: jira.connected ? "connected" : "disconnected",
        description: jira.connected
          ? jira.siteName
            ? `Connected to ${jira.siteName}. ${tool.description}`
            : `Connected. ${tool.description}`
          : tool.description,
        buttons: jira.connected ? ["Disconnect Jira"] : ["Connect Jira"],
      };
    }

    if (tool.provider === "github") {
      return {
        ...tool,
        status: github.connected ? "connected" : "disconnected",
        description: github.connected
          ? github.username
            ? `Connected as @${github.username}. ${tool.description}`
            : `Connected. ${tool.description}`
          : tool.description,
        buttons: github.connected ? ["Disconnect GitHub"] : ["Connect GitHub"],
      };
    }

    return tool;
  };

  const handleAction = async (tool: IntegrationTool, label: string) => {
    if (tool.provider && label.startsWith("Connect")) {
      setConnectProvider(tool.provider);
      return;
    }

    if (tool.provider && label.startsWith("Disconnect")) {
      setBusy(tool.provider);
      try {
        const res = await fetch(`/api/auth/${tool.provider}/disconnect`, {
          method: "POST",
        });
        if (!res.ok) throw new Error("Disconnect failed");
        await refresh();
        toast.success(`${tool.name} disconnected`);
      } catch {
        toast.error(`Could not disconnect ${tool.name}. Please try again.`);
      } finally {
        setBusy(null);
      }
      return;
    }

    toast.info(`${tool.name} integration is coming soon`);
  };

  return (
    <div className="p-6 pb-[4.5rem] h-full overflow-y-auto">
      <Breadcrumbs breadcrumbs={IntegrationsBreadcrumbs} />

      <div className="text-[22px] font-[500] text-[#081332] dark:text-[#ededed] mb-[25px]">
        Integrations
      </div>

      {CATEGORIES.map((category) => {
        const tools = category.tools.map(resolveTool);
        const connectedCount = tools.filter((t) => t.status === "connected").length;

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
                {connectedCount}/{category.tools.length} connected
              </div>
            </div>

            <div className="flex flex-wrap gap-[20px]">
              {tools.map((tool) => {
                const Icon = tool.Icon;
                const isBusy = tool.provider ? busy === tool.provider : false;
                return (
                  <div
                    key={tool.id}
                    className="w-[320px] rounded-xl p-5 bg-[#fff] dark:bg-[#141414] border-[0.7px] border-[#E2ECF9] dark:border-[#2a2a2a]"
                  >
                    <div className="flex items-center gap-[12px] mb-[12px]">
                      <div className="w-[36px] h-[36px] rounded-[10px] flex items-center justify-center bg-white shrink-0 border border-[#E2ECF9] dark:border-transparent">
                        <Icon size={20} color={tool.color} />
                      </div>
                      <div className="flex flex-col">
                        <div className="text-[15px] font-[600] text-[#1F1F1F] dark:text-[#ededed]">
                          {tool.name}
                        </div>
                        <div
                          className={`text-[11px] font-[600] w-fit mt-[2px] ${
                            tool.status === "connected"
                              ? "text-[#28A745]"
                              : "text-[#D97706]"
                          }`}
                        >
                          {tool.status}
                        </div>
                      </div>
                    </div>

                    <div className="text-[13px] text-[#7E7E7E] dark:text-[#9ca3af] mb-[15px] min-h-[36px]">
                      {tool.description}
                    </div>

                    <div className="flex flex-col gap-[8px]">
                      {tool.buttons.map((label) => (
                        <button
                          key={label}
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleAction(tool, label)}
                          className="w-full h-[36px] rounded-[8px] border border-[rgba(94,96,102,0.3)] dark:border-[#2a2a2a] text-[13px] font-[500] text-[#1F1F1F] dark:text-[#ededed] hover:bg-[#F5F6F6] dark:hover:bg-[#1a1a1a] transition-colors disabled:opacity-60"
                        >
                          {isBusy && label.startsWith("Disconnect")
                            ? "Disconnecting..."
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
        onConnected={async (connected) => {
          await refresh();
          toast.success(connected === "github" ? "GitHub connected" : "Jira connected");
        }}
      />
    </div>
  );
}

export default function Integrations() {
  return (
    <AuthGuard>
      <Suspense fallback={null}>
        <IntegrationsContent />
      </Suspense>
    </AuthGuard>
  );
}
