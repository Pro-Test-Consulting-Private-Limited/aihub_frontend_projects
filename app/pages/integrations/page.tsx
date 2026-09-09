"use client";

import React from "react";
import { IconType } from "react-icons";
import { SiJira, SiLinear, SiGithub, SiGitlab, SiGit, SiFigma, SiSwagger } from "react-icons/si";
import { VscAzureDevops } from "react-icons/vsc";
import { FaMicrosoft, FaAws, FaSlack, FaBook, FaCode } from "react-icons/fa";
import Breadcrumbs from "../../components/breadcrumbs";
import { IntegrationsBreadcrumbs } from "../../constants/metrics";

interface IntegrationTool {
  name: string;
  status: "connected" | "disconnected";
  description: string;
  buttons: string[];
  Icon: IconType;
  color: string;
}

interface IntegrationCategory {
  title: string;
  subtitle: string;
  tools: IntegrationTool[];
}

const CATEGORIES: IntegrationCategory[] = [
  {
    title: "AGILE PROJECT MANAGEMENT & ISSUE TRACKING",
    subtitle: "Product ops, sprints, and issue tracking",
    tools: [
      {
        name: "Jira",
        status: "disconnected",
        description: "Test cases push as issues. Execution results sync back.",
        buttons: ["Connect Jira"],
        Icon: SiJira,
        color: "#2684FF",
      },
      {
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
        name: "Swagger / OpenAPI",
        status: "disconnected",
        description: "Import API specs to generate and validate test cases.",
        buttons: ["Connect Swagger"],
        Icon: SiSwagger,
        color: "#85EA2D",
      },
      {
        name: "Redoc / Redocly",
        status: "disconnected",
        description: "Pull published API docs to keep contracts in sync.",
        buttons: ["Connect Redocly"],
        Icon: FaBook,
        color: "#263238",
      },
      {
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
        name: "GitHub",
        status: "disconnected",
        description: "Scripts synced to main branch. Auto-commit on heal.",
        buttons: ["Connect GitHub"],
        Icon: SiGithub,
        color: "#24292E",
      },
      {
        name: "GitLab",
        status: "disconnected",
        description: "Sync page objects and tests to a GitLab repository.",
        buttons: ["Connect GitLab"],
        Icon: SiGitlab,
        color: "#FC6D26",
      },
      {
        name: "GitBucket",
        status: "disconnected",
        description: "Self-hosted Git — sync scripts to your GitBucket instance.",
        buttons: ["Connect GitBucket"],
        Icon: SiGit,
        color: "#F05032",
      },
      {
        name: "AWS CodeCommit",
        status: "disconnected",
        description: "Push generated test scripts to an AWS CodeCommit repo.",
        buttons: ["Connect CodeCommit"],
        Icon: FaAws,
        color: "#FF9900",
      },
      {
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
        name: "Microsoft Teams",
        status: "disconnected",
        description: "Failure alerts and daily summaries posted to a Teams channel.",
        buttons: ["Connect Teams"],
        Icon: FaMicrosoft,
        color: "#6264A7",
      },
      {
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

export default function Integrations() {
  return (
    <div className="p-6 pb-[4.5rem] h-full overflow-y-auto">
      <Breadcrumbs breadcrumbs={IntegrationsBreadcrumbs} />

      <div className="text-[22px] font-[500] text-[#081332] dark:text-[#ededed] mb-[25px]">
        Integrations
      </div>

      {CATEGORIES.map((category) => {
        const connectedCount = category.tools.filter(
          (t) => t.status === "connected",
        ).length;

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
              {category.tools.map((tool) => {
                const Icon = tool.Icon;
                return (
                  <div
                    key={tool.name}
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
                          className="w-full h-[36px] rounded-[8px] border border-[rgba(94,96,102,0.3)] dark:border-[#2a2a2a] text-[13px] font-[500] text-[#1F1F1F] dark:text-[#ededed] hover:bg-[#F5F6F6] dark:hover:bg-[#1a1a1a] transition-colors"
                        >
                          {label}
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
    </div>
  );
}