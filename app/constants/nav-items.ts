import HomeIcon from "../../public/icons/navbar/home.png";
import WorkplaceIcon from "../../public/icons/navbar/workplace.png";
import DomainIcon from "../../public/icons/navbar/domain.png";

import ProjectsIcon from "../../public/icons/navbar/projects.png";
import ResourcesIcon from "../../public/icons/navbar/resources.png";
import BillingIcon from "../../public/icons/navbar/billing.png";
import CustomerSupportIcon from "../../public/icons/navbar/customer-support.png";
import SettingsIcon from "../../public/icons/navbar/setting.png";
import MetricsIcon from "../../public/icons/navbar/metrics.png";
import { TbPlugConnected } from "react-icons/tb";
import { NavBarItem } from "../interfaces/navbar";

export const NavItems: NavBarItem[] = [
  { name: "Home", value: "", href: "/home", icon: HomeIcon, items: [] },
  {
    name: "Workplace",
    value: "workplace",
    href: "/workplace",
    icon: WorkplaceIcon,
    activeHeight: "160px",
    items: [
      {
        name: "Workplace Setup",
        value: "workplace-setup",
        href: "/workplace/workplace-setup",
      },
      {
        name: "Error Log",
        value: "error-log",
        href: "/workplace/error-log",
      },
      {
        name: "User Management",
        value: "user-management",
        href: "/workplace/user-management",
      },
    ],
  },
  {
    name: "Domain",
    value: "domain",
    href: "/domain",
    icon: DomainIcon,
    activeHeight: "80px",
    items: [],
  },
  {
    name: "Projects",
    value: "projects",
    href: "/projects",
    icon: ProjectsIcon,
    activeHeight: "120px",
    items: [],
  },
  {
    name: "Metrics",
    value: "metrics",
    href: "/metrics",
    icon: MetricsIcon,
    activeHeight: "160px",
    items: [
      {
        name: "Business & Usage",
        value: "business-usage",
        href: "/metrics/business-usage",
      },
      {
        name: "Performance & Reliability",
        value: "performance-reliability",
        href: "/metrics/performance-reliability",
      },
      {
        name: "Model Quality & Operational",
        value: "model-quality-operational",
        href: "/metrics/model-quality-operational",
      },
    ],
  },
  {
    name: "Integrations",
    value: "integrations",
    href: "/integrations",
    icon: TbPlugConnected,
    items: [],
  },
  {
    name: "Resources",
    value: "resources",
    href: "/resources",
    icon: ResourcesIcon,
    items: [],
  },
  {
    name: "Billing Management",
    value: "billing-management",
    href: "/billing-management",
    icon: BillingIcon,
    activeHeight: "160px",
    items: [
      {
        name: "Current Plan",
        value: "current-plan",
        href: "/billing-management/current-plan",
      },
      {
        name: "Billing History",
        value: "billing-history",
        href: "/billing-management/billing-history",
      },
      {
        name: "Financial Reports",
        value: "financial-reports",
        href: "/billing-management/financial-reports",
      },
    ],
  },
];

export const SettingsNav: NavBarItem[] = [
  {
    name: "Settings",
    value: "settings",
    href: "/settings",
    icon: SettingsIcon,
    items: [],
  },
  {
    name: "Customer Support",
    value: "customer-support",
    href: "/customer-support",
    icon: CustomerSupportIcon,
    items: [],
  },
];