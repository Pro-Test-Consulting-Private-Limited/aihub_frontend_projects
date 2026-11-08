"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { useMsal } from "@azure/msal-react";
import { getFreshIdToken } from "@/app/lib/auth-client";
import { isLocalAuthBypassEnabled } from "@/app/lib/auth-bypass";

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

const BYPASS_PROJECT: Project = {
  id: "local-bypass-project",
  name: "Local Bypass Demo",
  description: "DEV-ONLY project for Phase A UI verification",
  domain: "Testing",
  department: "Information Technology",
  workspace: "Local",
  owner: "local-bypass",
  dateOfCreation: new Date().toISOString().slice(0, 10),
  applicationUrl: process.env.NEXT_PUBLIC_BYPASS_APP_URL || "https://ai-hub-demo.protestcorp.com/",
  authRequired: false,
  authType: "",
  product: "App Atlas",
  status: "Active",
};

type ProjectsContextType = {
  projects: Project[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addProject: (p: Omit<Project, "id" | "owner">) => Promise<Project>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
};

const ProjectsContext = createContext<ProjectsContextType | null>(null);

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const { instance, accounts } = useMsal();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getIdToken = useCallback(async () => {
    return getFreshIdToken(instance, accounts);
  }, [instance, accounts]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isLocalAuthBypassEnabled()) {
        setProjects([BYPASS_PROJECT]);
        return;
      }
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error(`Failed to load projects (${res.status})`);
      setProjects(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const authHeaders = async () => {
    const token = await getIdToken();
    return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  };

  const addProject = async (p: Omit<Project, "id" | "owner">) => {
    const res = await fetch("/api/projects", { method: "POST", headers: await authHeaders(), body: JSON.stringify(p) });
    if (!res.ok) throw new Error("Failed to create project");
    const created: Project = await res.json();
    setProjects((prev) => [created, ...prev]);
    return created;
  };

  const updateProject = async (id: string, updates: Partial<Project>) => {
    const res = await fetch(`/api/projects/${id}`, { method: "PATCH", headers: await authHeaders(), body: JSON.stringify(updates) });
    if (!res.ok) throw new Error("Failed to update project");
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };

  const deleteProject = async (id: string) => {
    const token = await getIdToken();
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE", headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) throw new Error("Failed to delete project");
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <ProjectsContext.Provider value={{ projects, loading, error, refresh, addProject, updateProject, deleteProject }}>
      {children}
    </ProjectsContext.Provider>
  );
}

export function useProjects() {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error("useProjects must be used inside <ProjectsProvider>");
  return ctx;
}