import { ProjectItem } from "../interfaces/project";

export const AIHubProjectList: ProjectItem[] = [
  { id: 1, name: "QA Workbench", due_date: "18/10/2025", progress: 78 },
  { id: 2, name: "Project 2", due_date: "03/12/2025", progress: 20 },
  { id: 3, name: "Project 3", due_date: "14/01/2026", progress: 5 },
];

export const AppAtlasProjectList: ProjectItem[] = [
  {
    id: 4,
    name: "Digital Wallet",
    due_date: "04/11/2026",
    progress: 78,
    url: "https://app-atlas.protestcorp.com/",
  },
  {
    id: 5,
    name: "Data Bank",
    due_date: "12/12/2026",
    progress: 45,
    url: "https://app-atlas.protestcorp.com/",
  },
];

export const ProjectList: ProjectItem[] = [
  ...AIHubProjectList,
  ...AppAtlasProjectList,
];