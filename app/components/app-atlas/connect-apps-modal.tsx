"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TbArrowLeft, TbLink, TbLoader2 } from "react-icons/tb";
import { SiJira, SiLinear, SiSwagger } from "react-icons/si";
import { FaBook, FaCode, FaMicrosoft, FaSlack } from "react-icons/fa";
import type { Canvas, CanvasSummary, JiraProject } from "@/app/interfaces/appatlas";
import type { AtlasClient } from "@/app/services/appatlas";
import {
  useIntegrationStatus,
  type ConnectionHealth,
  type SwaggerStatus,
} from "@/app/hooks/use-integration-status";
import { clearCanvasSwagger, setCanvasSwagger, type CanvasSwagger } from "@/app/lib/canvas-swagger";
import { clearToken, getEnvironment, getToken, selectEnvProfile, setEnvironment, setToken, validateBaseUrl, type TestEnvironment } from "@/app/lib/api-testing/environment";
import { EnvProfileChips } from "@/app/components/app-atlas/endpoint-tests/env-profile-chips";
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

type StatusKind = "linked" | "active" | "expired" | "error" | "none" | "soon";

function statusOf(health: ConnectionHealth, linkedOnCanvas: boolean, mappable: boolean): {
  kind: StatusKind;
  label: string;
  tip: string;
} {
  if (!mappable) return { kind: "soon", label: "Soon", tip: "Coming soon" };
  if (linkedOnCanvas && health === "active") {
    return { kind: "linked", label: "On canvas", tip: "Linked to this canvas" };
  }
  if (health === "active") return { kind: "active", label: "Active", tip: "Integrated and ready to connect" };
  if (health === "expired") return { kind: "expired", label: "Expired", tip: "Token expired. Open Integrations to reconnect." };
  if (health === "error") return { kind: "error", label: "Error", tip: "Integration error. Open Integrations to fix." };
  return { kind: "none", label: "Not connected", tip: "Not integrated. Open Integrations to connect." };
}

const STATUS_PILL: Record<StatusKind, string> = {
  linked: "bg-[#DBEAFE] text-[#1D4ED8]",
  active: "bg-[#DCFCE7] text-[#15803D]",
  expired: "bg-[#FEF3C7] text-[#B45309]",
  error: "bg-[#FEE2E2] text-[#B91C1C]",
  none: "bg-[#F3F4F6] text-[#6B7280]",
  soon: "bg-[#F3F4F6] text-[#9CA3AF]",
};

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
  const {
    jira,
    swagger: swaggerIntegration,
    teams,
    loading: statusLoading,
    probing,
  } = useIntegrationStatus({ live: true, refreshMs: 60_000 });
  const teamsConnected = teams.connected;

  const healthOf = (id: AppId): ConnectionHealth => {
    if (id === "jira") return jira.health;
    if (id === "swagger") return swaggerIntegration.health;
    if (id === "teams") return teams.health;
    return "disconnected";
  };

  /** Usable for Connect: Active only. Expired/disconnected must go to Integrations. */
  const canUse = (id: AppId) => {
    const h = healthOf(id);
    return h === "active";
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
          {(statusLoading || probing) && (
            <p className="text-[11.5px] text-[#7E7E7E]">Checking integrations…</p>
          )}
          {CATEGORIES.map((cat) => (
            <div key={cat.title} className="rounded-[12px] border border-[#ECECEC] bg-[#FAFAFA] p-3 dark:border-[#2a2a2a] dark:bg-[#101010]">
              <div className="px-1 text-[12.5px] font-medium text-[#5E6066] dark:text-[#9ca3af]">{cat.title}</div>
              <div className="mt-2 space-y-1.5">
                {cat.apps.map((app) => {
                  const health = healthOf(app.id);
                  const ok = canUse(app.id);
                  const mappable = CAN_MAP.includes(app.id);
                  const linkedTeams = (canvas as CanvasSummary & { teams?: { teamId?: string } | null }).teams;
                  const linkedOnCanvas =
                    (app.id === "jira" && !!canvas.jiraProjectKey) ||
                    (app.id === "swagger" && !!swagger) ||
                    (app.id === "teams" && !!linkedTeams?.teamId);
                  const selected = picked === app.id;
                  const needsIntegrate =
                    mappable && (health === "disconnected" || health === "error" || health === "expired");
                  const status = statusOf(health, linkedOnCanvas, mappable);
                  const tooltip = selected
                    ? `${app.name}: ${status.tip}. Selected. Click again to unselect.`
                    : `${app.name}: ${status.tip}`;

                  const onAppClick = () => {
                    if (needsIntegrate) {
                      router.push("/integrations");
                      return;
                    }
                    if (!mappable || !ok) return;
                    setPicked((prev) => (prev === app.id ? null : app.id));
                  };

                  return (
                    <button
                      key={app.id}
                      type="button"
                      onClick={onAppClick}
                      title={tooltip}
                      aria-label={tooltip}
                      aria-pressed={selected}
                      disabled={!mappable && !needsIntegrate}
                      className={`flex w-full items-center gap-3 rounded-[10px] border bg-white px-3 py-2.5 text-left transition dark:bg-[#1a1a1a] ${
                        selected && ok
                          ? "border-[#8664F2] ring-2 ring-[#8664F2]/25"
                          : ok
                            ? "border-[#E5E7EB] hover:border-[#8664F2]/60 dark:border-[#2a2a2a]"
                            : needsIntegrate
                              ? "border-dashed border-[#C4B5E8] hover:border-[#8664F2] dark:border-[#3a3060]"
                              : "cursor-default border-[#E5E7EB] opacity-55 dark:border-[#2a2a2a]"
                      }`}
                    >
                      <span
                        className={`flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[9px] border bg-[#FAFAFA] dark:bg-[#141414] ${
                          status.kind === "linked" || status.kind === "active"
                            ? "border-[#86EFAC]"
                            : status.kind === "expired"
                              ? "border-[#FCD34D]"
                              : "border-[#E5E7EB] dark:border-[#2a2a2a]"
                        }`}
                      >
                        {app.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium text-[#1F1F1F] dark:text-[#ededed]">
                          {app.name}
                        </span>
                        <span className="mt-0.5 block truncate text-[11.5px] text-[#7E7E7E]">
                          {status.tip}
                          {selected ? " · Selected" : ""}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${STATUS_PILL[status.kind]}`}
                      >
                        {status.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {picked && canUse(picked) && (
            <p className="text-[12px] font-medium text-[#8664F2]">
              Selected: {CATEGORIES.flatMap((c) => c.apps).find((a) => a.id === picked)?.name}. Click Connect
              (or click again to unselect).
            </p>
          )}
          <button
            type="button"
            disabled={!picked || !CAN_MAP.includes(picked) || !canUse(picked)}
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
        <TeamsStep
          client={client}
          canvas={canvas}
          teamsConnected={teamsConnected}
          onBack={() => setStep("apps")}
          onConnected={onConnected}
        />
      ) : (
        <SwaggerStep
          client={client}
          canvas={canvas}
          integration={swaggerIntegration}
          current={swagger}
          onBack={() => setStep("apps")}
          onChange={onSwaggerChange}
        />
      )}
    </Modal>
  );
}

function TeamsStep({
  client,
  canvas,
  teamsConnected,
  onBack,
  onConnected,
}: {
  client: AtlasClient;
  canvas: CanvasSummary & {
    teams?: { teamId: string; channelId: string; teamName?: string | null; channelName?: string | null } | null;
  };
  teamsConnected: boolean;
  onBack: () => void;
  onConnected: (c: Canvas) => void;
}) {
  const router = useRouter();
  const linked = canvas.teams ?? null;
  const [teamsList, setTeamsList] = useState<Array<{ id: string; displayName: string }> | null>(null);
  const [channels, setChannels] = useState<Array<{ id: string; displayName: string }> | null>(null);
  const [teamId, setTeamId] = useState(linked?.teamId ?? "");
  const [channelId, setChannelId] = useState(linked?.channelId ?? "");
  const [busy, setBusy] = useState<"load" | "channels" | "link" | "disconnect" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!teamsConnected) return;
    let cancelled = false;
    setBusy("load");
    setError(null);
    client
      .listJoinedTeams()
      .then((res) => {
        if (cancelled) return;
        const items = res.items ?? [];
        setTeamsList(items);
        setTeamId((prev) => prev || items[0]?.id || "");
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load Teams.");
      })
      .finally(() => {
        if (!cancelled) setBusy(null);
      });
    return () => {
      cancelled = true;
    };
  }, [client, teamsConnected]);

  useEffect(() => {
    if (!teamsConnected || !teamId) {
      setChannels(null);
      return;
    }
    let cancelled = false;
    setBusy("channels");
    setError(null);
    setChannelId("");
    client
      .listTeamChannels(teamId)
      .then((res) => {
        if (cancelled) return;
        const items = res.items ?? [];
        setChannels(items);
        const prefer =
          (linked?.teamId === teamId && linked.channelId && items.find((c) => c.id === linked.channelId)?.id) ||
          items[0]?.id ||
          "";
        setChannelId(prefer);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load channels.");
      })
      .finally(() => {
        if (!cancelled) setBusy((b) => (b === "channels" ? null : b));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload channels when the selected team changes
  }, [client, teamsConnected, teamId]);

  const link = async () => {
    const team = teamsList?.find((t) => t.id === teamId);
    const channel = channels?.find((c) => c.id === channelId);
    if (!team || !channel) return;
    setBusy("link");
    setError(null);
    try {
      onConnected(
        await client.connectTeams(canvas.id, {
          teamId: team.id,
          channelId: channel.id,
          teamName: team.displayName,
          channelName: channel.displayName,
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
          <div className="text-[#7E7E7E]">
            {linked
              ? `Linked: ${linked.teamName || linked.teamId} / ${linked.channelName || linked.channelId}`
              : "Link a channel on this canvas to post clarifications (canvas owner only)."}
          </div>
        </div>
      </div>

      {!teamsConnected ? (
        <div className="mt-4 space-y-3">
          <p className="text-[12.5px] leading-relaxed text-[#5E6066]">
            Connect Microsoft Teams on the Integrations page first (one-time for your account). Then come back here to pick the team and channel for this canvas.
          </p>
          <button
            type="button"
            className={primaryButton}
            onClick={() => {
              onBack();
              router.push("/integrations");
            }}
          >
            Open Integrations
          </button>
        </div>
      ) : (
        <>
          <label className={fieldLabel}>Team</label>
          {busy === "load" && !teamsList ? (
            <div className="flex items-center gap-2 py-2 text-[13px] text-[#7E7E7E]">
              <TbLoader2 size={15} className="animate-spin" /> Loading your teams…
            </div>
          ) : (
            <select className={fieldInput} value={teamId} onChange={(e) => setTeamId(e.target.value)} disabled={!!busy || !teamsList?.length}>
              {teamsList?.length === 0 && <option value="">No teams found</option>}
              {teamsList?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.displayName}
                </option>
              ))}
            </select>
          )}

          <label className={fieldLabel}>Channel</label>
          {busy === "channels" && !channels ? (
            <div className="flex items-center gap-2 py-2 text-[13px] text-[#7E7E7E]">
              <TbLoader2 size={15} className="animate-spin" /> Loading channels…
            </div>
          ) : (
            <select className={fieldInput} value={channelId} onChange={(e) => setChannelId(e.target.value)} disabled={!!busy || !channels?.length}>
              {channels?.length === 0 && <option value="">No channels found</option>}
              {channels?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName}
                </option>
              ))}
            </select>
          )}

          {error && <div className="mt-3 rounded-[8px] bg-[#FDF1F1] px-3 py-2 text-[12px] text-[#991B1B]">{error}</div>}
          <div className="mt-5 flex justify-end gap-3">
            {linked && (
              <button type="button" className={outlineButton} onClick={disconnect} disabled={!!busy}>
                {busy === "disconnect" ? "Disconnecting…" : "Unlink channel"}
              </button>
            )}
            <button type="button" className={primaryButton} onClick={link} disabled={!!busy || !teamId || !channelId}>
              {busy === "link" ? "Linking…" : linked ? "Update channel" : "Link channel"}
            </button>
          </div>
        </>
      )}
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
  client,
  canvas,
  integration,
  current,
  onBack,
  onChange,
}: {
  client: AtlasClient;
  canvas: CanvasSummary;
  integration: SwaggerStatus;
  current: CanvasSwagger | null;
  onBack: () => void;
  onChange: (conn: CanvasSwagger | null) => void;
}) {
  const specUrl = integration.specUrl;
  // Where the tests are sent. Named env profiles + base URL stay in this browser; the token only in memory.
  const [env, setEnv] = useState<TestEnvironment>(() => (specUrl ? getEnvironment(specUrl) : getEnvironment("")));
  const [token, setTokenText] = useState(() => (specUrl ? getToken(specUrl) : ""));
  const [busy, setBusy] = useState<"connect" | "disconnect" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const baseUrl = env.baseUrl;
  const baseUrlError = baseUrl.trim() ? validateBaseUrl(baseUrl) : null;
  useEffect(() => {
    if (!specUrl) return;
    setEnv(getEnvironment(specUrl));
    setTokenText(getToken(specUrl));
  }, [specUrl]);

  const connect = async () => {
    if (!specUrl || baseUrlError) return;
    setBusy("connect");
    setError(null);
    setEnvironment(specUrl, env);
    setToken(specUrl, token);
    // Optimistic local mirror so API Testing opens immediately.
    onChange(setCanvasSwagger(canvas.id, { specUrl, title: integration.title }));
    try {
      const canvasRes = await client.connectSwagger(canvas.id, { specUrl, title: integration.title });
      const s = canvasRes.swagger;
      if (s) {
        onChange(
          setCanvasSwagger(canvas.id, {
            specUrl: s.specUrl,
            title: s.title,
            connectedAt: s.connectedAt,
            swaggerKey: s.swaggerKey,
            specHash: s.specHash,
          }),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save swagger on the canvas.");
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    setBusy("disconnect");
    setError(null);
    if (specUrl) clearToken(specUrl);
    clearCanvasSwagger(canvas.id);
    onChange(null);
    try {
      await client.disconnectSwagger(canvas.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not disconnect swagger.");
    } finally {
      setBusy(null);
    }
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
      <div className="mt-4 space-y-3">
        <div>
          <label className={fieldLabel} htmlFor="swagger-base-url">
            Base URL for testing
          </label>
          <div className="mb-2">
            <EnvProfileChips
              env={env}
              onSelect={(id) => {
                if (!specUrl) return;
                setEnv(selectEnvProfile(specUrl, id));
              }}
            />
          </div>
          <input
            id="swagger-base-url"
            className={fieldInput}
            value={baseUrl}
            onChange={(e) => {
              if (!specUrl) return;
              setEnv(setEnvironment(specUrl, { baseUrl: e.target.value }));
            }}
            placeholder={`https://${env.active}.example.com/api`}
            autoComplete="off"
          />
          {baseUrlError && <p className="mt-1 text-[11.5px] text-[#DC2626]">{baseUrlError}</p>}
        </div>
        <div>
          <label className={fieldLabel} htmlFor="swagger-token">
            Bearer token (optional)
          </label>
          <input
            id="swagger-token"
            className={fieldInput}
            type="password"
            value={token}
            onChange={(e) => setTokenText(e.target.value)}
            placeholder="Paste a token, or log in with a prerequisite later"
            autoComplete="new-password"
          />
          <p className="mt-1 text-[11.5px] text-[#7E7E7E]">Kept in memory only: never saved, and gone when you reload the page.</p>
        </div>
      </div>
      {error && <p className="mt-3 text-[12px] text-[#DC2626]">{error}</p>}
      <div className="mt-5 flex justify-end gap-3">
        {current && (
          <button type="button" className={outlineButton} onClick={() => void disconnect()} disabled={!!busy}>
            {busy === "disconnect" ? <TbLoader2 size={14} className="animate-spin" /> : null}
            Disconnect
          </button>
        )}
        <button type="button" className={primaryButton} onClick={() => void connect()} disabled={!specUrl || !!baseUrlError || !!busy}>
          {busy === "connect" ? <TbLoader2 size={14} className="animate-spin" /> : null}
          {current ? "Reconnect" : "Connect"}
        </button>
      </div>
    </div>
  );
}
