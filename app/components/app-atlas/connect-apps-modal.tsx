"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TbArrowLeft, TbChevronRight, TbLoader2 } from "react-icons/tb";
import { SiJira, SiLinear, SiSwagger } from "react-icons/si";
import { FaMicrosoft, FaSlack } from "react-icons/fa";
import type { Canvas, CanvasSummary, JiraProject } from "@/app/interfaces/appatlas";
import type { AtlasClient } from "@/app/services/appatlas";
import { useIntegrationStatus, type SwaggerStatus } from "@/app/hooks/use-integration-status";
import { clearCanvasSwagger, setCanvasSwagger, type CanvasSwagger } from "@/app/lib/canvas-swagger";
import { Modal, fieldInput, fieldLabel, outlineButton, primaryButton } from "./modal";

type AppId = "jira" | "swagger" | "linear" | "teams" | "slack";

const CATEGORIES: { title: string; apps: { id: AppId; name: string; icon: React.ReactNode }[] }[] = [
  {
    title: "Agile Project Management & Issue Tracking",
    apps: [
      { id: "jira", name: "Jira", icon: <SiJira size={26} color="#2684FF" /> },
      { id: "linear", name: "Linear", icon: <SiLinear size={24} color="#222" /> },
    ],
  },
  {
    title: "API Documentation & Testing",
    apps: [{ id: "swagger", name: "Swagger", icon: <SiSwagger size={26} color="#85EA2D" /> }],
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
  swagger,
  onSwaggerChange,
  onConnected,
  onClose,
}: {
  client: AtlasClient;
  canvas: CanvasSummary;
  /** Swagger spec already connected to this canvas, if any. */
  swagger: CanvasSwagger | null;
  onSwaggerChange: (conn: CanvasSwagger | null) => void;
  onConnected: (c: Canvas) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const { jira, swagger: swaggerIntegration, loading: statusLoading } = useIntegrationStatus();
  const integrated: Record<AppId, boolean> = { jira: jira.connected, swagger: swaggerIntegration.connected, linear: false, teams: false, slack: false };
  const [step, setStep] = useState<"apps" | "jira" | "swagger">("apps");

  return (
    <Modal title={step === "apps" ? "Select an app to connect with this canvas" : step === "jira" ? "Connect Jira" : "Connect Swagger"} onClose={onClose} width={480}>
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
                  const connected = (app.id === "jira" && !!canvas.jiraProjectKey) || (app.id === "swagger" && !!swagger);
                  return (
                    <button
                      key={app.id}
                      type="button"
                      disabled={!ok}
                      onClick={() => (app.id === "jira" || app.id === "swagger") && setStep(app.id)}
                      title={
                        ok
                          ? connected
                            ? `${app.name}: connected to ${app.id === "swagger" ? swagger?.title || "this spec" : canvas.jiraProjectKey}`
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
        step === "jira" ? (
          <JiraStep client={client} canvas={canvas} siteName={jira.siteName} onBack={() => setStep("apps")} onConnected={onConnected} />
        ) : (
          <SwaggerStep canvas={canvas} integration={swaggerIntegration} current={swagger} onBack={() => setStep("apps")} onChange={onSwaggerChange} />
        )
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

/** Swagger and Jira are independent: this step only reads the Swagger integration and never touches the Jira mapping. */
function SwaggerStep({
  canvas,
  integration,
  current,
  onBack,
  onChange,
}: {
  canvas: CanvasSummary;
  integration: SwaggerStatus;
  current: CanvasSwagger | null;
  onBack: () => void;
  onChange: (conn: CanvasSwagger | null) => void;
}) {
  const specUrl = integration.specUrl;

  const connect = () => {
    if (!specUrl) return;
    onChange(setCanvasSwagger(canvas.id, { specUrl, title: integration.title }));
  };

  const disconnect = () => {
    clearCanvasSwagger(canvas.id);
    onChange(null);
  };

  return (
    <div>
      <button type="button" onClick={onBack} className="mt-3 flex items-center gap-1 text-[12px] text-[#5E6066] hover:text-[#8664F2]">
        <TbArrowLeft size={14} /> All apps
      </button>
      <div className="mt-3 flex items-center gap-3 rounded-[10px] border border-[#ECECEC] p-3 dark:border-[#2a2a2a]">
        <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[8px] border-2 border-[#22C55E] bg-white">
          <SiSwagger size={20} color="#85EA2D" />
        </span>
        <div className="min-w-0 text-[12.5px]">
          <div className="font-medium text-[#1F1F1F] dark:text-[#ededed]">{integration.title || "Swagger / OpenAPI"}</div>
          <div className="truncate text-[#7E7E7E]" title={specUrl ?? undefined}>
            {specUrl ?? "No spec URL found. Reconnect Swagger on the Integrations page."}
          </div>
        </div>
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-[#7E7E7E]">
        Adds an API Testing view to this canvas: the spec&apos;s modules and a quality check for every endpoint. It works on its own and doesn&apos;t depend on the Jira connection.
      </p>
      <div className="mt-5 flex justify-end gap-3">
        {current && (
          <button type="button" className={outlineButton} onClick={disconnect}>
            Disconnect
          </button>
        )}
        <button type="button" className={primaryButton} onClick={connect} disabled={!specUrl}>
          {current ? "Reconnect" : "Connect"}
        </button>
      </div>
    </div>
  );
}
