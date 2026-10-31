"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TbArrowLeft, TbChevronRight, TbLink, TbLoader2 } from "react-icons/tb";
import { SiJira, SiLinear, SiSwagger } from "react-icons/si";
import { FaBook, FaCode, FaMicrosoft, FaSlack } from "react-icons/fa";
import type { Canvas, CanvasSummary, JiraProject } from "@/app/interfaces/appatlas";
import type { AtlasClient } from "@/app/services/appatlas";
import { useIntegrationStatus, type SwaggerStatus } from "@/app/hooks/use-integration-status";
import { clearCanvasSwagger, setCanvasSwagger, type CanvasSwagger } from "@/app/lib/canvas-swagger";
import { Modal, fieldInput, fieldLabel, outlineButton, primaryButton } from "./modal";

type AppId = "jira" | "linear" | "swagger" | "redocly" | "stoplight" | "teams" | "slack";

const CATEGORIES: { title: string; apps: { id: AppId; name: string; icon: React.ReactNode }[] }[] = [
  {
    title: "Agile Project Management & Issue Tracking",
    apps: [
      { id: "jira", name: "Jira", icon: <SiJira size={26} color="#2684FF" /> },
      { id: "linear", name: "Linear", icon: <SiLinear size={24} color="#5E6AD2" /> },
    ],
  },
  {
    title: "API Design & Documentation",
    apps: [
      { id: "swagger", name: "Swagger / OpenAPI", icon: <SiSwagger size={26} color="#85EA2D" /> },
      { id: "redocly", name: "Redoc / Redocly", icon: <FaBook size={22} color="#263238" /> },
      { id: "stoplight", name: "Stoplight", icon: <FaCode size={22} color="#0B5FFF" /> },
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

const CAN_MAP: AppId[] = ["jira", "swagger", "teams"];

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
  // Teams uses the same Entra sign-in (Graph ChannelMessage.Send consent) — not a separate login.
  const integrated: Record<AppId, boolean> = {
    jira: jira.connected,
    swagger: swaggerIntegration.connected,
    linear: false,
    redocly: false,
    stoplight: false,
    teams: true,
    slack: false,
  };
  const [step, setStep] = useState<"apps" | "jira" | "swagger" | "teams">("apps");
  const [picked, setPicked] = useState<AppId | null>(canvas.jiraProjectKey ? "jira" : null);

  const confirmPick = () => {
    if (picked === "jira" || picked === "swagger" || picked === "teams") setStep(picked);
  };

  const stepTitle =
    step === "apps"
      ? "Select an app to connect with this canvas"
      : step === "jira"
        ? "Connect Jira"
        : step === "teams"
          ? "Link Teams channel"
          : "Connect Swagger";

  return (
    <Modal title={stepTitle} onClose={onClose} width={480}>
      {step === "apps" ? (
        <div className="mt-4 space-y-3">
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
                  const selected = picked === app.id;
                  return (
                    <button
                      key={app.id}
                      type="button"
                      disabled={!ok}
                      onClick={() => setPicked(app.id)}
                      title={
                        ok
                          ? connected
                            ? `${app.name}: connected to ${app.id === "swagger" ? swagger?.title || "this spec" : canvas.jiraProjectKey}`
                            : `Select ${app.name}`
                          : `${app.name} isn't integrated yet. Integrate it on the Integrations page first.`
                      }
                      className={`relative flex h-[56px] w-[56px] items-center justify-center rounded-[10px] bg-white shadow-sm transition dark:bg-[#1a1a1a] ${
                        ok
                          ? selected
                            ? "border-2 border-[#22C55E] ring-2 ring-[#22C55E]/30"
                            : "border-2 border-[#22C55E] hover:scale-105"
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
              : "Apps with a green border are integrated in AI Hub. Select one, then Connect. Integrate the others from the Integrations page."}
          </p>
          {picked && !CAN_MAP.includes(picked) && (
            <p className="text-[11.5px] text-[#92400E]">
              This app can be selected once it's integrated; canvas mapping is available for Jira, Swagger, and Teams.
            </p>
          )}
          {picked === "teams" && (
            <p className="text-[11.5px] text-[#5E6066]">
              Link channel stores Team/Channel IDs on this canvas. Posting uses your app Microsoft sign-in with Graph
              permission only — not a separate Teams login.
            </p>
          )}
          <button
            type="button"
            disabled={!picked || !CAN_MAP.includes(picked)}
            onClick={confirmPick}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-[10px] border border-[#E6E1F5] bg-white py-2.5 text-[14px] font-medium text-[#8664F2] disabled:cursor-not-allowed disabled:text-[#C4B5E8] dark:border-[#2a2a2a] dark:bg-[#141414]"
          >
            <TbLink size={16} />
            Connect
          </button>
        </div>
      ) : step === "jira" ? (
        <JiraStep client={client} canvas={canvas} siteName={jira.siteName} onBack={() => setStep("apps")} onConnected={onConnected} />
      ) : step === "teams" ? (
        <TeamsStep client={client} canvas={canvas} onBack={() => setStep("apps")} onConnected={onConnected} />
      ) : (
        <SwaggerStep canvas={canvas} integration={swaggerIntegration} current={swagger} onBack={() => setStep("apps")} onChange={onSwaggerChange} />
      )}
    </Modal>
  );
}

function TeamsStep({
  client,
  canvas,
  onBack,
  onConnected,
}: {
  client: AtlasClient;
  canvas: CanvasSummary;
  onBack: () => void;
  onConnected: (c: Canvas) => void;
}) {
  const [teamId, setTeamId] = useState("");
  const [channelId, setChannelId] = useState("");
  const [channelName, setChannelName] = useState("requirement-clarifications");
  const [busy, setBusy] = useState<"link" | "disconnect" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const link = async () => {
    setBusy("link");
    setError(null);
    try {
      onConnected(
        await client.connectTeams(canvas.id, {
          teamId: teamId.trim(),
          channelId: channelId.trim(),
          channelName: channelName.trim() || undefined,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not link Teams channel.");
      setBusy(null);
    }
  };

  const disconnect = async () => {
    setBusy("disconnect");
    setError(null);
    try {
      onConnected(await client.disconnectTeams(canvas.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disconnect Teams.");
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
          <FaMicrosoft size={20} color="#6264A7" />
        </span>
        <div className="min-w-0 text-[12.5px]">
          <div className="font-medium text-[#1F1F1F] dark:text-[#ededed]">Microsoft Teams</div>
          <div className="text-[#7E7E7E]">Same Microsoft account as AI Hub. Link a channel to post clarifications (Phase 1).</div>
        </div>
      </div>
      <label className={fieldLabel}>Team ID</label>
      <input className={fieldInput} value={teamId} onChange={(e) => setTeamId(e.target.value)} placeholder="GUID from Teams admin / Graph" disabled={!!busy} />
      <label className={fieldLabel}>Channel ID</label>
      <input className={fieldInput} value={channelId} onChange={(e) => setChannelId(e.target.value)} placeholder="19:….@thread.tacv2" disabled={!!busy} />
      <label className={fieldLabel}>Channel name (display)</label>
      <input className={fieldInput} value={channelName} onChange={(e) => setChannelName(e.target.value)} disabled={!!busy} />
      {error && <div className="mt-3 rounded-[8px] bg-[#FDF1F1] px-3 py-2 text-[12px] text-[#991B1B]">{error}</div>}
      <div className="mt-5 flex justify-end gap-3">
        <button type="button" className={outlineButton} onClick={disconnect} disabled={!!busy}>
          {busy === "disconnect" ? "Disconnecting…" : "Disconnect"}
        </button>
        <button type="button" className={primaryButton} onClick={link} disabled={!!busy || !teamId.trim() || !channelId.trim()}>
          {busy === "link" ? "Linking…" : "Link channel"}
        </button>
      </div>
    </div>
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
