import { Breadcrumb } from "../interfaces/common";
import { ProjectItem, ProjectSegmentItem } from "../interfaces/project";
import RequirementAnalysis from "../../public/icons/life-cycle/requirement-analysis.png";
import TestExecution from "../../public/icons/life-cycle/test-execution.png";
import TestPlan from "../../public/icons/life-cycle/test-plan.png";
import TestCaseDevelopment from "../../public/icons/life-cycle/test-case-development.png";
import TestEnvironmentSetup from "../../public/icons/life-cycle/test-environment-setup.png";
import TestClosure from "../../public/icons/life-cycle/test-closure.png";

export const ProjectBreadcrumbs: Breadcrumb[] = [
  { label: "Home", href: "/home", active: false },
  { label: "Projects", href: "/projects", active: true },
];

export const ProjectSegmentsBreadcrumbs = (
  workplace: string,
  domain: string,
  current: ProjectItem | null | undefined,
) => {
  return [
    { label: "Home", href: "/home", active: false },
    { label: workplace, href: "/home", active: false },
    { label: domain, href: "/home", active: false },
    {
      label: `Projects : ${current?.name}`,
      href: `/projects/${current?.id}`,
      active: true,
    },
  ];
};

export const ProjectGenerateDraftBreadcrumbs = (
  workplace: string,
  domain: string,
  current: ProjectItem | null | undefined,
  segment: string,
) => {
  return [
    { label: "Home", href: "/home", active: false },
    { label: workplace, href: "/home", active: false },
    { label: domain, href: "/home", active: false },
    {
      label: `Projects : ${current?.name}`,
      href: `/projects/${current?.id}?workplace=${workplace}&domain=${domain}`,
      active: false,
    },
    {
      label: segment,
      href: `/projects/generate-draft`,
      active: true,
    },
  ];
};

export const ACCELERATORS_LIFE_CYCLE: ProjectSegmentItem[] = [
  {
    title: "Requirement analysis",
    icon: RequirementAnalysis,
    color: "#3887C7",
    accelerators: [
      {
        label: "Test case generation - Manual Testing",
        value: "test-case-generation-manual-testing",
        route: "generate-draft",
      },
    ],
  },
  {
    title: "Test Plan",
    icon: TestPlan,
    color: "#3860C7",
    accelerators: [],
  },
  {
    title: "Test Case Development",
    icon: TestCaseDevelopment,
    color: "#4C50C9",
    accelerators: [
      {
        label: "Automated test case generator - Selenium",
        value: "automated-test-case-generator-cypress",
        route: "automated-test-script-generation/cypress",
        segment: "Cypress",
      },
      {
        label: "Automated test case generator - cypress",
        value: "automated-test-case-generator-selenium",
        route: "automated-test-script-generation",
        segment: "Selenium",
      },
    ],
  },
  {
    title: "Test Environment Setup",
    icon: TestEnvironmentSetup,
    color: "#704BD4",
    accelerators: [{ label: "Debugger", value: "debugger", route: "debugger" }],
  },
  {
    title: "Test Execution",
    icon: TestExecution,
    color: "#773BBF",
    accelerators: [
      {
        label: "Action-driven Test case generation - New Run",
        value: "action-driven-test-case-generation-new-run",
        route: "action-driven-test-case-generator-new-run",
      },
      {
        label: "Action-driven Test case generation - Rerun",
        value: "action-driven-test-case-generation-rerun",
        route: "action-driven-test-case-generator-rerun",
      },
      {
        label: "Self Healing",
        value: "self-healing",
        route: "self-healing",
      },
    ],
  },
  {
    title: "Test Closure",
    icon: TestClosure,
    color: "#6B3299",
    accelerators: [],
  },
];
