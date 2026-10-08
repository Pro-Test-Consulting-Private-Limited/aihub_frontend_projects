"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TbArrowLeft, TbChevronRight, TbLoader2 } from "react-icons/tb";
import { SiJira, SiLinear } from "react-icons/si";
import { FaMicrosoft, FaSlack } from "react-icons/fa";
import type { Canvas, CanvasSummary, JiraProject } from "@/app/interfaces/appatlas";
import type { AtlasClient } from "@/app/services/appatlas";
import { useIntegrationStatus } from "@/app/hooks/use-integration-status";
import { Modal, fieldInput, fieldLabel, outlineButton, primaryButton } from "./modal";

type AppId = "jira" | "linear" | "teams" | "slack";

const CATEGORIES: { title: string; apps: { id: AppId; name: string; icon: React.ReactNode }[] }[] = [
  {
    title: "Agile Project Management & Issue Tracking",
    apps: [
      { id: "jira", name: "Jira", icon: <SiJira size={26} color="#2684FF" /> },
      { id: "linear", name: "Linear", icon: <SiLinear size={24} color="#222" /> },
    ],
  },
  {
    title: "Team Collaboration & Communication",
    apps: [
      { id: "teams", name: "Microsoft Teams", icon: <FaMicrosoft size={24} color="#6264A7" /> },
      { id: "slack", name: "Slack", icon: <FaSlack size={26} color="#4A154B" /> },
    ],
  },
];

export function ConnectAppsModal({
  client,
  canvas,
  onConnected,
  onClose,
}: {
  client: AtlasClient;
  canvas: CanvasSummary;
  onConnected: (c: Canvas) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const { jira, loading: statusLoading } = useIntegrationStatus();
  const integrated: Record<AppId, boolean> = { jira: jira.connected, linear: false, teams: false, slack: false };
  const [step, setStep] = useState<"apps" | "jira">("apps");

  return (
    <Modal title={step === "apps" ? "Select an app to connect with this canvas" : "Connect Jira"} onClose={onClose} width={480}>
      {step === "apps" ? (
        <div className="mt-4 space-y-4">
          {CATEGORIES.map((cat) => (
            <div key={cat.title} className="rounded-[12px] border border-[#ECECEC] bg-[#FAFAFA] p-4 dark:border-[#2a2a2a] dark:bg-[#101010]">
              <button
                type="button"
                onClick={() => router.push("/integrations")}
                className="flex w-full items-center justify-between text-left text-[14px] font-medium text-[#1F1F1F] dark:text-[#ededed]"
                title="Manage integrations"
              >
                {cat.title}
                <TbChevronRight size={16} className="text-[#7E7E7E]" />
              </button>
              <div className="mt-3 flex gap-3">
                {cat.apps.map((app) => {
                  const ok = integrated[app.id];
                  const connected = app.id === "jira" && !!canvas.jiraProjectKey;
                  return (
                    <button
                      key={app.id}
                      type="button"
                      disabled={!ok}
                      onClick={() => app.id === "jira" && setStep("jira")}
                      title={
                        ok
                          ? connected
                            ? `${app.name}: connected to ${canvas.jiraProjectKey}`
                            : `Connect ${app.name}`
                          : `${app.name} isn't integrated yet. Integrate it on the Integrations page first.`
                      }
                      className={`relative flex h-[56px] w-[56px] items-center justify-center rounded-[10px] bg-white shadow-sm transition dark:bg-[#1a1a1a] ${
                        ok
                          ? "border-2 border-[#22C55E] hover:scale-105"
                          : "cursor-not-allowed border border-[#E5E7EB] opacity-45 grayscale dark:border-[#2a2a2a]"
                      }`}
                    >
                      {app.icon}
                      {connected && <span className="absolute -top-1 -right-1 h-[10px] w-[10px] rounded-full border-2 border-white bg-[#22C55E]" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <p className="text-[11.5px] text-[#7E7E7E]">
            {statusLoading
              ? "Checking your integrations…"
              : "Apps with a green border are integrated in AI Hub and can be connected. Integrate the others from the Integrations page."}
          </p>
        </div>
      ) : (
        <JiraStep client={client} canvas={canvas} siteName={jira.siteName} onBack={() => setStep("apps")} onConnected={onConnected} />
      )}
    </Modal>
  );
}

function JiraStep({
  client,
  canvas,
  siteName,
  onBack,
  onConnected,
}: {
  client: AtlasClient;
  canvas: CanvasSummary;
  siteName: string | null;
  onBack: () => void;
  onConnected: (c: Canvas) => void;
}) {
  const [projects, setProjects] = useState<JiraProject[] | null>(null);
  const [projectKey, setProjectKey] = useState(canvas.jiraProjectKey ?? "");
  const [busy, setBusy] = useState<"map" | "disconnect" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    client
      .listJiraProjects()
      .then((list) => {
        if (cancelled) return;
        setProjects(list);
        setProjectKey((k) => k || list[0]?.key || "");
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Could not load Jira projects."));
    return () => {
      cancelled = true;
    };
  }, [client]);

  const connect = async () => {
    setBusy("map");
    setError(null);
    try {
      onConnected(await client.connectJira(canvas.id, projectKey));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect Jira.");
      setBusy(null);
    }
  };

  const disconnect = async () => {
    setBusy("disconnect");
    setError(null);
    try {
      onConnected(await client.disconnectJira(canvas.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disconnect Jira.");
      setBusy(null);
    }
  };

  return (
    <div>
      <button type="button" onClick={onBack} disabled={!!busy} className="mt-3 flex items-center gap-1 text-[12px] text-[#5E6066] hover:text-[#8664F2]">
        <TbArrowLeft size={14} /> All apps
      </button>
      <div className="mt-3 flex items-center gap-3 rounded-[10px] border border-[#ECECEC] p-3 dark:border-[#2a2a2a]">
        <span className="flex h-[38px] w-[38px] items-center justify-center rounded-[8px] border-2 border-[#22C55E] bg-white">
          <SiJira size={20} color="#2684FF" />
        </span>
        <div className="min-w-0 text-[12.5px]">
          <div className="font-medium text-[#1F1F1F] dark:text-[#ededed]">{siteName || "Jira"}</div>
          <div className="text-[#7E7E7E]">
            {canvas.jiraProjectKey ? `Connected to ${canvas.jiraProjectKey}` : "Each screen is matched to the epics, stories, tasks and bugs it covers."}
          </div>
        </div>
      </div>

      <label className={fieldLabel}>Jira project</label>
      {projects === null && !error ? (
        <div className="flex items-center gap-2 py-2 text-[13px] text-[#7E7E7E]">
          <TbLoader2 size={15} className="animate-spin" /> Loading projects…
        </div>
      ) : (
        <select className={fieldInput} value={projectKey} onChange={(e) => setProjectKey(e.target.value)} disabled={!!busy || !projects?.length}>
          {projects?.length === 0 && <option value="">No projects found</option>}
          {projects?.map((p) => (
            <option key={p.key} value={p.key}>
              {p.key} · {p.name}
            </option>
          ))}
        </select>
      )}

      {busy === "map" && (
        <div className="mt-3 flex items-center gap-2 rounded-[8px] bg-[#F4EFFE] px-3 py-2 text-[12px] text-[#5B3FD1] dark:bg-[#1e1a2e]">
          <TbLoader2 size={15} className="animate-spin" />
          Mapping screens to {projectKey} tickets. Big projects can take up to a minute…
        </div>
      )}
      {error && <div className="mt-3 rounded-[8px] bg-[#FDF1F1] px-3 py-2 text-[12px] text-[#991B1B]">{error}</div>}

      <div className="mt-5 flex justify-end gap-3">
        {canvas.jiraProjectKey && (
          <button type="button" className={outlineButton} onClick={disconnect} disabled={!!busy}>
            {busy === "disconnect" ? "Disconnecting…" : "Disconnect"}
          </button>
        )}
        <button type="button" className={primaryButton} onClick={connect} disabled={!!busy || !projectKey}>
          {busy === "map" ? "Mapping…" : canvas.jiraProjectKey ? "Re-map" : "Connect"}
        </button>
      </div>
    </div>
  );
}
