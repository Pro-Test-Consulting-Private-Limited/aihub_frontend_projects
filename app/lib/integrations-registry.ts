import type { IconType } from "react-icons";
import { SiJira, SiLinear, SiGithub, SiGitlab, SiGit, SiFigma, SiSwagger } from "react-icons/si";
import { VscAzureDevops } from "react-icons/vsc";
import { FaMicrosoft, FaAws, FaSlack, FaBook, FaCode } from "react-icons/fa";

/** Providers that can be linked at canvas level today. */
export type CanvasConnectProvider = "jira" | "swagger" | "teams" | "github";

/** Account-level Integrations (cookies / vault). Includes Figma before canvas connect exists. */
export type AccountIntegrationProvider = CanvasConnectProvider | "figma";

export type IntegrationProviderId =
  | CanvasConnectProvider
  | "linear"
  | "redocly"
  | "stoplight"
  | "gitlab"
  | "gitbucket"
  | "codecommit"
  | "azure-repos"
  | "figma"
  | "slack";

/** DEV (and flagged envs) expose Figma on the Integrations page. */
const FIGMA_ACCOUNT_ENABLED =
  process.env.NEXT_PUBLIC_FIGMA_INTEGRATION === "1" || process.env.FIGMA_INTEGRATION === "1";

export type IntegrationProviderDef = {
  id: IntegrationProviderId;
  name: string;
  description: string;
  connectButton: string;
  Icon: IconType;
  color: string;
  /** Account-level live status on Integrations (OAuth / vault). */
  accountProvider?: AccountIntegrationProvider;
  /** Can open a canvas connect step in the modal. */
  canvasConnect: boolean;
};

export type IntegrationCategoryDef = {
  title: string;
  subtitle: string;
  tools: IntegrationProviderDef[];
};

/**
 * Single source of truth for Integrations page cards and the Connect-apps modal.
 * Order and titles must stay identical in both UIs.
 */
export const INTEGRATION_CATEGORIES: IntegrationCategoryDef[] = [
  {
    title: "AGILE PROJECT MANAGEMENT & ISSUE TRACKING",
    subtitle: "Product ops, sprints, and issue tracking",
    tools: [
      {
        id: "jira",
        name: "Jira",
        description: "Test cases push as issues. Execution results sync back.",
        connectButton: "Connect Jira",
        Icon: SiJira,
        color: "#2684FF",
        accountProvider: "jira",
        canvasConnect: true,
      },
      {
        id: "linear",
        name: "Linear",
        description: "Connect to push test cases as Linear issues.",
        connectButton: "Connect Linear",
        Icon: SiLinear,
        color: "#5E6AD2",
        canvasConnect: false,
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
        description: "Import API specs to generate and validate test cases.",
        connectButton: "Connect Swagger",
        Icon: SiSwagger,
        color: "#85EA2D",
        accountProvider: "swagger",
        canvasConnect: true,
      },
      {
        id: "redocly",
        name: "Redoc / Redocly",
        description: "Pull published API docs to keep contracts in sync.",
        connectButton: "Connect Redocly",
        Icon: FaBook,
        color: "#263238",
        canvasConnect: false,
      },
      {
        id: "stoplight",
        name: "Stoplight",
        description: "Sync API design and mock servers for contract testing.",
        connectButton: "Connect Stoplight",
        Icon: FaCode,
        color: "#0B5FFF",
        canvasConnect: false,
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
        description:
          "Connect with your GitHub organization, then sign in with GitHub. Canvases you connect are saved to your project's repo automatically.",
        connectButton: "Connect GitHub",
        Icon: SiGithub,
        color: "#24292E",
        accountProvider: "github",
        canvasConnect: true,
      },
      {
        id: "gitlab",
        name: "GitLab",
        description: "Sync page objects and tests to a GitLab repository.",
        connectButton: "Connect GitLab",
        Icon: SiGitlab,
        color: "#FC6D26",
        canvasConnect: false,
      },
      {
        id: "gitbucket",
        name: "GitBucket",
        description: "Self-hosted Git  -  sync scripts to your GitBucket instance.",
        connectButton: "Connect GitBucket",
        Icon: SiGit,
        color: "#F05032",
        canvasConnect: false,
      },
      {
        id: "codecommit",
        name: "AWS CodeCommit",
        description: "Push generated test scripts to an AWS CodeCommit repo.",
        connectButton: "Connect CodeCommit",
        Icon: FaAws,
        color: "#FF9900",
        canvasConnect: false,
      },
      {
        id: "azure-repos",
        name: "Azure Repos",
        description: "Sync with Azure DevOps Repos for source control.",
        connectButton: "Connect Azure Repos",
        Icon: VscAzureDevops,
        color: "#0078D7",
        canvasConnect: false,
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
        description:
          "Connect your Figma account to validate UI specs against crawled screenshots (Design Validation).",
        connectButton: "Connect Figma",
        Icon: SiFigma,
        color: "#F24E1E",
        accountProvider: FIGMA_ACCOUNT_ENABLED ? "figma" : undefined,
        canvasConnect: false,
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
        description: "Connect once with your Microsoft account. Then link a team and channel on each canvas.",
        connectButton: "Connect Teams",
        Icon: FaMicrosoft,
        color: "#6264A7",
        accountProvider: "teams",
        canvasConnect: true,
      },
      {
        id: "slack",
        name: "Slack",
        description: "Failure alerts to #qa-alerts. Daily summary to #engineering.",
        connectButton: "Connect Slack",
        Icon: FaSlack,
        color: "#4A154B",
        canvasConnect: false,
      },
    ],
  },
];

export const CANVAS_CONNECT_IDS: CanvasConnectProvider[] = ["jira", "swagger", "teams", "github"];

export function listIntegrationProviders(): IntegrationProviderDef[] {
  return INTEGRATION_CATEGORIES.flatMap((c) => c.tools);
}

export function getIntegrationProvider(id: string): IntegrationProviderDef | undefined {
  return listIntegrationProviders().find((t) => t.id === id);
}

export function isCanvasConnectProvider(id: string): id is CanvasConnectProvider {
  return (CANVAS_CONNECT_IDS as string[]).includes(id);
}
