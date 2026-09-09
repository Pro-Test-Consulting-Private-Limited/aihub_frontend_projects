import ActiveProjectsIcon from "../../public/icons/home/active-projects.png";
import CompletedProjectsIcon from "../../public/icons/home/completed-projects.png";
import PendingProjectsIcon from "../../public/icons/home/pending-projects.png";

export const WORKPLACES = [
  { label: "Pro Test", value: "Pro Test" },
  { label: "Company 1", value: "Company 1" },
  { label: "Company 2", value: "Company 2" },
];

export const DOMAIN = [
  { label: "Information Technology", value: "Information Technology" },
  { label: "Operations", value: "Operations" },
  { label: "Management", value: "Management" },
  { label: "Finance", value: "Finance" },
  { label: "Human Resources", value: "Human Resources" },
  { label: "Sales and Marketing", value: "Sales and Marketing" },
];
export const PERIODOPTIONS = [
  { label: "Current Month", value: "Current Month" },
  { label: "Last Month", value: "Last Month" },
];
export const LASTOPTIONS = [
  { label: "30 Minutes", value: "30 Minutes" },
  { label: "2 Hours", value: "2 Hours" },
  { label: "12 Hours", value: "12 Hours" },
  { label: "day", value: "day" },
  { label: "week", value: "week" },
  { label: "month", value: "month" },
  { label: "year", value: "year" },
];

export const HOME_PROJECT_STATS = [
  {
    label: "Active Projects",
    value: "active-projects",
    count: 3,
    icon: ActiveProjectsIcon,
  },
  {
    label: "Completed Projects",
    value: "completed-projects",
    count: 1,
    icon: CompletedProjectsIcon,
  },
  {
    label: "Pending Projects",
    value: "pending-projects",
    count: 2,
    icon: PendingProjectsIcon,
  },
];

export const GENERATE_DRAFT_HEADER = [
  { label: "Test Case ID", key: "TestCaseId" },
  { label: "Module", key: "Module" },
  { label: "Sub Module", key: "SubModule" },
  { label: "Scenario Description", key: "ScenarioDescription" },
  { label: "Preconditions", key: "Preconditions" },
  { label: "Test Steps", key: "TestSteps" },
  { label: "Inputs", key: "Inputs" },
  { label: "Expected Result", key: "ExpectedResult" },
];
