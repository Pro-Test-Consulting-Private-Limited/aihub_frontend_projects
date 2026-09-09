"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Project = {
  id: string;
  name: string;
  description: string;
  domain: string;
  department: string;
  workspace: string;
  owner: string;
  dateOfCreation: string;
  applicationUrl: string;
  authRequired: boolean;
  authType: string;
  product: "AI Hub" | "App Atlas";
  status: "Active" | "Completed" | "Pending";
  dueDate?: string;
  progress?: number;
};

type ProjectsContextType = {
  projects: Project[];
  addProject: (p: Omit<Project, "id">) => Project;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
};

const ProjectsContext = createContext<ProjectsContextType | null>(null);

const STORAGE_KEY = "aihub_projects";

// Seeded so existing demo rows keep showing up even after this change.
// Ids "1".."5" match the old static data/project.ts ids (as strings).
const DEFAULT_PROJECTS: Project[] = [
  {
    id: "1",
    name: "QA Workbench",
    description: "",
    domain: "Testing",
    department: "Information Technology",
    workspace: "Pro Test",
    owner: "Divya K",
    dateOfCreation: "10 Jun 2025",
    applicationUrl: "",
    authRequired: false,
    authType: "",
    product: "AI Hub",
    status: "Active",
    dueDate: "18/10/2025",
    progress: 78,
  },
  {
    id: "4",
    name: "Digital Wallet",
    description:
      "Digital wallet application for payments, transfers, and balance management.",
    domain: "Testing",
    department: "Information Technology",
    workspace: "Pro Test",
    owner: "Divya K",
    dateOfCreation: "28 Aug 2026",
    applicationUrl: "https://app-atlas.protestcorp.com/",
    authRequired: false,
    authType: "",
    product: "App Atlas",
    status: "Active",
    dueDate: "04/11/2026",
    progress: 78,
  },
  {
    id: "5",
    name: "Data Bank",
    description: "",
    domain: "Testing",
    department: "Information Technology",
    workspace: "Pro Test",
    owner: "Divya K",
    dateOfCreation: "01 Sep 2026",
    applicationUrl: "https://app-atlas.protestcorp.com/",
    authRequired: false,
    authType: "",
    product: "App Atlas",
    status: "Active",
    dueDate: "12/12/2026",
    progress: 45,
  },
];

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setProjects(JSON.parse(raw));
      } else {
        setProjects(DEFAULT_PROJECTS);
      }
    } catch {
      setProjects(DEFAULT_PROJECTS);
    } finally {
      setInitialized(true);
    }
  }, []);

  useEffect(() => {
    if (!initialized) return; // never write until the initial load has finished
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    } catch {
      // ignore quota errors
    }
  }, [projects, initialized]);

  const addProject = (p: Omit<Project, "id">) => {
    const newProject: Project = { ...p, id: crypto.randomUUID() };
    setProjects((prev) => [...prev, newProject]);
    return newProject;
  };

  const updateProject = (id: string, updates: Partial<Project>) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };

  const deleteProject = (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <ProjectsContext.Provider value={{ projects, addProject, updateProject , deleteProject }}>
      {children}
    </ProjectsContext.Provider>
  );
}

export function useProjects() {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error("useProjects must be used inside <ProjectsProvider>");
  return ctx;
}



