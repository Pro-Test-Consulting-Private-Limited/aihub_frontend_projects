"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TbArrowLeft, TbChevronDown, TbChevronRight, TbCopy, TbExternalLink, TbLink, TbLoader2 } from "react-icons/tb";
import { SiGithub, SiJira, SiSwagger } from "react-icons/si";
import { FaMicrosoft } from "react-icons/fa";
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
import {
  INTEGRATION_CATEGORIES,
  isCanvasConnectProvider,
  type CanvasConnectProvider,
  type IntegrationProviderId,
} from "@/app/lib/integrations-registry";
import {
  gitSyncGuidance,
  gitSyncPillClass,
  gitSyncStatusLabel,
  gitSyncTone,
  githubBranchUrl,
  githubCommitUrl,
  githubRepoUrl,
  relativeTime,
  shortSha,
} from "@/app/lib/git-sync-ui";
import { Modal, fieldInput, fieldLabel, outlineButton, primaryButton } from "./modal";
import { InlineConfirm } from "./inline-confirm";

type AppId = IntegrationProviderId;

function healthLabel(health: ConnectionHealth, linkedOnCanvas: boolean): string {
  if (health === "active") return linkedOnCanvas ? "Active · linked to this canvas" : "Active · ready to connect";
  if (health === "expired") return "Expired · reconnect in Integrations";
  if (health === "error") return "Error · check Integrations";
  return "Not integrated · open Integrations";
}

export function ConnectAppsModal({
  client,
  canvas,
  swagger,
  onSwaggerChange,
  onConnected,
  onClose,
  projectId,
  gitConnected = false,
  onGitChange,
}: {
  client: AtlasClient;
  canvas: CanvasSummary;
  /** Swagger spec already connected to this canvas, if any. */
  swagger: CanvasSwagger | null;
  onSwaggerChange: (conn: CanvasSwagger | null) => void;
  onConnected: (c: Canvas) => void;
  onClose: () => void;
  projectId?: string | null;
  gitConnected?: boolean;
  onGitChange?: () => void;
}) {
  const router = useRouter();
  const {
    jira,
    github,
    swagger: swaggerIntegration,
    teams,
    loading: statusLoading,
    probing,
  } = useIntegrationStatus({ live: true, refreshMs: 60_000 });
  const teamsConnected = teams.connected;
  const [gitAvailable, setGitAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    client
      .gitSyncAvailability()
      .then((r) => {
        if (!cancelled) setGitAvailable(r.available);
      })
      .catch(() => {
        if (!cancelled) setGitAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  const healthOf = (id: AppId): ConnectionHealth => {
    if (id === "jira") return jira.health;
    if (id === "swagger") return swaggerIntegration.health;
    if (id === "teams") return teams.health;
    if (id === "github") {
      if (gitAvailable === false) return "disconnected";
      return github.health;
    }
    return "disconnected";
  };

  /** Usable for Connect: Active only. Expired/disconnected must go to Integrations. */
  const canUse = (id: AppId) => {
    if (!isCanvasConnectProvider(id)) return false;
    if (id === "github" && gitAvailable === false) return false;
    return healthOf(id) === "active";
  };

  const [step, setStep] = useState<"apps" | CanvasConnectProvider>("apps");
  const [picked, setPicked] = useState<AppId | null>(canvas.jiraProjectKey ? "jira" : null);

  const confirmPick = () => {
    if (picked && isCanvasConnectProvider(picked)) setStep(picked);
  };

  const stepTitle =
    step === "apps"
      ? "Select an app to connect with this canvas"
      : step === "jira"
        ? "Connect Jira"
        : step === "teams"
          ? "Link Teams channel"
          : step === "github"
            ? "Connect GitHub"
            : "Connect Swagger";

  return (
    <Modal title={stepTitle} onClose={onClose} width={520} scrollBody>
      {step === "apps" ? (
        <div className="mt-4 space-y-3 pb-1">
          {(statusLoading || probing) && (
            <p className="text-[11.5px] text-[#7E7E7E]">Checking integrations…</p>
          )}
          {INTEGRATION_CATEGORIES.map((cat) => (
            <div key={cat.title} className="rounded-[12px] border border-[#ECECEC] bg-[#FAFAFA] p-4 dark:border-[#2a2a2a] dark:bg-[#101010]">
              <div className="text-[12px] font-semibold tracking-wide text-[#1F1F1F] dark:text-[#ededed]">{cat.title}</div>
              <div className="mt-0.5 text-[11px] text-[#7E7E7E] dark:text-[#9ca3af]">{cat.subtitle}</div>
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-4">
                {cat.tools.map((app) => {
                  const Icon = app.Icon;
                  const health = healthOf(app.id);
                  const ok = canUse(app.id);
                  const mappable = app.canvasConnect;
                  const linkedTeams = (canvas as CanvasSummary & { teams?: { teamId?: string } | null }).teams;
                  const linkedOnCanvas =
                    (app.id === "jira" && !!canvas.jiraProjectKey) ||
                    (app.id === "swagger" && !!swagger) ||
                    (app.id === "teams" && !!linkedTeams?.teamId) ||
                    (app.id === "github" && gitConnected);
                  const selected = picked === app.id;
                  const expired = health === "expired";
                  const gitAdminOff = app.id === "github" && gitAvailable === false;
                  const needsIntegrate =
                    mappable && !gitAdminOff && (health === "disconnected" || health === "error" || expired);

                  const statusText = gitAdminOff
                    ? "Not enabled by your admin"
                    : mappable
                      ? healthLabel(health, linkedOnCanvas)
                      : "Coming soon";
                  const tooltip = !mappable
                    ? `${app.name}: Coming soon`
                    : selected
                      ? `${app.name}: ${statusText}. Selected. Click again to unselect.`
                      : `${app.name}: ${statusText}`;

                  const onAppClick = () => {
                    if (!mappable) return;
                    if (gitAdminOff) return;
                    if (needsIntegrate) {
                      router.push("/integrations");
                      return;
                    }
                    if (!ok) return;
                    setPicked((prev) => (prev === app.id ? null : app.id));
                  };

                  return (
                    <div key={app.id} className="flex w-[64px] flex-col items-center gap-1">
                      <button
                        type="button"
                        onClick={onAppClick}
                        title={tooltip}
                        aria-label={tooltip}
                        aria-pressed={selected}
                        disabled={gitAdminOff || !mappable}
                        className={`relative flex h-[56px] w-[56px] items-center justify-center rounded-[10px] bg-white shadow-sm transition dark:bg-[#1a1a1a] ${
                          selected && ok
                            ? "scale-105 border-2 border-[#8664F2] ring-2 ring-[#8664F2]/35"
                            : ok
                              ? "border-2 border-[#22C55E] hover:scale-105"
                              : expired
                                ? "border-2 border-[#F59E0B] hover:ring-2 hover:ring-[#F59E0B]/30"
                                : needsIntegrate
                                  ? "border border-dashed border-[#C4B5E8] opacity-70 hover:border-[#8664F2] hover:opacity-100"
                                  : "cursor-default border border-[#E5E7EB] opacity-40 grayscale dark:border-[#2a2a2a]"
                        }`}
                      >
                        <Icon size={24} color={app.color} />
                        {ok && (
                          <span
                            className="absolute -right-1 -top-1 h-[12px] w-[12px] rounded-full border-2 border-white bg-[#22C55E]"
                            title={statusText}
                          />
                        )}
                        {expired && (
                          <span
                            className="absolute -right-1 -top-1 h-[12px] w-[12px] rounded-full border-2 border-white bg-[#F59E0B]"
                            title={statusText}
                          />
                        )}
                        {needsIntegrate && !expired && (
                          <span
                            className="absolute -right-1 -top-1 flex h-[14px] w-[14px] items-center justify-center rounded-full border-2 border-white bg-[#8664F2] text-[9px] font-bold text-white"
                            title={statusText}
                          >
                            +
                          </span>
                        )}
                        {linkedOnCanvas && ok && (
                          <span
                            className="absolute -bottom-1 left-1/2 h-[3px] w-[18px] -translate-x-1/2 rounded-full bg-[#2563EB]"
                            title="Linked to this canvas"
                          />
                        )}
                      </button>
                      <span className="w-full truncate text-center text-[10px] leading-tight text-[#5E6066] dark:text-[#9ca3af]" title={app.name}>
                        {app.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {picked && isCanvasConnectProvider(picked) && canUse(picked) && (
            <p className="text-[12px] font-medium text-[#8664F2]">
              Selected: {INTEGRATION_CATEGORIES.flatMap((c) => c.tools).find((a) => a.id === picked)?.name}. Click
              Connect (or click the icon again to unselect).
            </p>
          )}
          <button
            type="button"
            disabled={!picked || !isCanvasConnectProvider(picked) || !canUse(picked)}
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
      ) : step === "github" ? (
        <GithubStep
          client={client}
          canvas={canvas}
          projectId={projectId}
          githubConnected={github.connected && github.health === "active"}
          needsReconnectAccount={github.health === "expired" || github.health === "error"}
          gitConnected={gitConnected}
          masterOff={gitAvailable === false}
          onBack={() => setStep("apps")}
          onConnected={() => {
            onGitChange?.();
            onClose();
          }}
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

function GithubStep({
  client,
  canvas,
  projectId,
  githubConnected,
  needsReconnectAccount,
  gitConnected,
  masterOff,
  onBack,
  onConnected,
}: {
  client: AtlasClient;
  canvas: CanvasSummary;
  projectId?: string | null;
  githubConnected: boolean;
  needsReconnectAccount?: boolean;
  gitConnected: boolean;
  masterOff?: boolean;
  onBack: () => void;
  onConnected: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"load" | "connect" | "disconnect" | null>("load");
  const [error, setError] = useState<string | null>(null);
  const [confirmKind, setConfirmKind] = useState<null | "disconnect" | "public">(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [folderOpen, setFolderOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mapping, setMapping] = useState<{
    connected: boolean;
    owner?: string;
    repo?: string;
    branch?: string;
    autoNewCanvases?: boolean;
  } | null>(null);
  const [allowed, setAllowed] = useState<{ repos: string[]; wildcardOwners: string[] }>({
    repos: [],
    wildcardOwners: [],
  });
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("appatlas-sync");
  const [autoNew, setAutoNew] = useState(false);
  const [status, setStatus] = useState<{
    connected: boolean;
    folder: string | null;
    repo: string | null;
    owner: string | null;
    branch: string | null;
    lastStatus: string | null;
    lastError: string | null;
    lastSyncedAt: number | null;
    lastCommitSha: string | null;
    dirty: boolean;
    syncing: boolean;
  } | null>(null);

  const pid = projectId || null;
  const folderPreview = pid ? `projects/${pid}/canvases/${canvas.id}/` : null;
  const connected = gitConnected || Boolean(status?.connected);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBusy("load");
      setError(null);
      try {
        type ProjectGitMap = {
          connected: boolean;
          owner?: string;
          repo?: string;
          branch?: string;
          autoNewCanvases?: boolean;
          folderPrefix?: string;
        };
        const emptyMap: ProjectGitMap = { connected: false };
        const [st, allow, map] = await Promise.all([
          client.getCanvasGit(canvas.id).catch(() => null),
          client.gitSyncAllowedRepos().catch(() => ({ repos: [] as string[], wildcardOwners: [] as string[] })),
          pid ? client.getProjectGit(pid).catch((): ProjectGitMap => emptyMap) : Promise.resolve(emptyMap),
        ]);
        if (cancelled) return;
        if (st) {
          setStatus({
            connected: st.connected,
            folder: st.folder,
            repo: st.repo,
            owner: st.owner,
            branch: st.branch,
            lastStatus: st.lastStatus,
            lastError: st.lastError,
            lastSyncedAt: st.lastSyncedAt,
            lastCommitSha: st.lastCommitSha,
            dirty: st.dirty,
            syncing: Boolean(st.syncing),
          });
        }
        setAllowed(allow);
        setMapping(map);
        if (map.connected && map.owner && map.repo) {
          setRepo(`${map.owner}/${map.repo}`);
          setBranch(map.branch || "appatlas-sync");
          setAutoNew(Boolean(map.autoNewCanvases));
        } else if (allow.repos[0]) {
          setRepo(allow.repos[0]);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load GitHub sync.");
      } finally {
        if (!cancelled) setBusy(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, canvas.id, pid]);

  const connect = async (confirmPublic = false) => {
    if (!pid) {
      setError("Open App Atlas from a project so this canvas has a project id.");
      return;
    }
    setBusy("connect");
    setError(null);
    setConfirmError(null);
    try {
      const body: {
        projectId: string;
        repo?: string;
        branch?: string;
        autoNewCanvases?: boolean;
        confirmPublic?: boolean;
      } = { projectId: pid, confirmPublic: confirmPublic || undefined };
      if (!mapping?.connected) {
        body.repo = repo.trim();
        body.branch = branch.trim() || "appatlas-sync";
        body.autoNewCanvases = autoNew;
      }
      await client.connectCanvasGit(canvas.id, body);
      setConfirmKind(null);
      onConnected();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Connect failed";
      if (/public/i.test(msg) && !confirmPublic) {
        setConfirmKind("public");
        setConfirmError(null);
        setBusy(null);
        return;
      }
      if (confirmPublic) setConfirmError(msg);
      else setError(msg);
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    setBusy("disconnect");
    setConfirmError(null);
    setError(null);
    try {
      await client.disconnectCanvasGit(canvas.id);
      setConfirmKind(null);
      onConnected();
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setBusy(null);
    }
  };

  const copyFolder = async () => {
    const path = status?.folder || folderPreview;
    if (!path) return;
    try {
      await navigator.clipboard.writeText(path);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Could not copy folder path.");
    }
  };

  if (!githubConnected) {
    return (
      <div>
        <button type="button" onClick={onBack} className="mt-3 flex items-center gap-1 text-[12px] text-[#5E6066] hover:text-[#8664F2]">
          <TbArrowLeft size={14} /> All apps
        </button>
        <div className="mt-3 rounded-[10px] border border-[#ECECEC] p-4 dark:border-[#2a2a2a]">
          <div className="flex items-center gap-3">
            <span className="flex h-[38px] w-[38px] items-center justify-center rounded-[8px] border border-[#E5E7EB] bg-white dark:border-[#2a2a2a]">
              <SiGithub size={20} color="#24292F" />
            </span>
            <div>
              <div className="text-[13px] font-medium text-[#1F1F1F] dark:text-[#ededed]">Connect GitHub</div>
              <div className="text-[12px] text-[#7E7E7E]">
                {needsReconnectAccount
                  ? "Your GitHub session expired. Reconnect on the Integrations page."
                  : "Connect your GitHub account in Integrations first, then return here."}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" className={outlineButton} onClick={onBack}>
            Back
          </button>
          <button type="button" className={primaryButton} onClick={() => router.push("/integrations")}>
            Open Integrations
          </button>
        </div>
      </div>
    );
  }

  if (connected && status) {
    const tone = gitSyncTone({
      connected: true,
      lastStatus: status.lastStatus,
      lastError: status.lastError,
      dirty: status.dirty,
      syncing: status.syncing,
      masterOff,
      needsReconnectAccount,
    });
    const repoFull = status.repo || repo;
    const repoLink = githubRepoUrl(status.owner, repoFull);
    const branchLink = githubBranchUrl(repoFull, status.branch || branch);
    const commitLink = githubCommitUrl(repoFull, status.lastCommitSha);
    const folder = status.folder || folderPreview;

    return (
      <div>
        <button type="button" onClick={onBack} disabled={!!busy} className="mt-3 flex items-center gap-1 text-[12px] text-[#5E6066] hover:text-[#8664F2]">
          <TbArrowLeft size={14} /> All apps
        </button>
        <div className="mt-3 flex items-center gap-3 rounded-[10px] border border-[#ECECEC] p-3 dark:border-[#2a2a2a]">
          <span className="flex h-[38px] w-[38px] items-center justify-center rounded-[8px] border-2 border-[#22C55E] bg-white dark:bg-[#1a1a1a]">
            <SiGithub size={20} color="#24292F" />
          </span>
          <div className="min-w-0 text-[12.5px]">
            <div className="font-medium text-[#1F1F1F] dark:text-[#ededed]">Connected to GitHub</div>
            <div className="truncate text-[#7E7E7E]">{repoFull}</div>
          </div>
        </div>

        <div className="mt-3 space-y-2.5 rounded-[10px] border border-[#ECECEC] bg-[#FAFAFA] p-3 text-[12.5px] dark:border-[#2a2a2a] dark:bg-[#101010]">
          <div className="flex items-start justify-between gap-2">
            <span className="shrink-0 text-[#7E7E7E]">Repository</span>
            {repoLink ? (
              <a href={repoLink} target="_blank" rel="noreferrer" className="min-w-0 truncate text-right font-medium text-[#8664F2] hover:underline">
                {repoFull}
              </a>
            ) : (
              <span className="min-w-0 truncate text-right font-medium text-[#1F1F1F] dark:text-[#ededed]">{repoFull}</span>
            )}
          </div>
          <div className="flex items-start justify-between gap-2">
            <span className="shrink-0 text-[#7E7E7E]">Branch</span>
            {branchLink ? (
              <a href={branchLink} target="_blank" rel="noreferrer" className="font-medium text-[#8664F2] hover:underline">
                {status.branch || branch}
              </a>
            ) : (
              <span className="font-medium text-[#1F1F1F] dark:text-[#ededed]">{status.branch || branch}</span>
            )}
          </div>
          <div className="flex items-start justify-between gap-2">
            <span className="shrink-0 text-[#7E7E7E]">Last synced</span>
            <span className="text-right font-medium text-[#1F1F1F] dark:text-[#ededed]">
              {relativeTime(status.lastSyncedAt)}
              {status.lastCommitSha ? (
                <>
                  {" · "}
                  {commitLink ? (
                    <a href={commitLink} target="_blank" rel="noreferrer" className="font-mono text-[#8664F2] hover:underline">
                      {shortSha(status.lastCommitSha)}
                    </a>
                  ) : (
                    <span className="font-mono">{shortSha(status.lastCommitSha)}</span>
                  )}
                </>
              ) : null}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[#7E7E7E]">Status</span>
            <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${gitSyncPillClass(tone)}`}>
              {gitSyncStatusLabel(tone)}
            </span>
          </div>
        </div>

        {folder && (
          <div className="mt-3 rounded-[10px] border border-[#ECECEC] dark:border-[#2a2a2a]">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] font-medium text-[#1F1F1F] dark:text-[#ededed]"
              onClick={() => setFolderOpen((o) => !o)}
            >
              {folderOpen ? <TbChevronDown size={14} /> : <TbChevronRight size={14} />}
              Folder in repo
            </button>
            {folderOpen && (
              <div className="flex items-start gap-2 border-t border-[#ECECEC] px-3 py-2 dark:border-[#2a2a2a]">
                <code className="min-w-0 flex-1 break-all font-mono text-[11px] text-[#5E6066] dark:text-[#9ca3af]">{folder}</code>
                <button type="button" className={outlineButton + " !px-2 !py-1 text-[11px]"} onClick={() => void copyFolder()} title="Copy path">
                  <TbCopy size={13} />
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            )}
          </div>
        )}

        <p className="mt-3 text-[12px] leading-relaxed text-[#5E6066] dark:text-[#9ca3af]">{gitSyncGuidance(tone, status.lastError)}</p>
        {error && confirmKind !== "disconnect" && (
          <div className="mt-3 rounded-[8px] bg-[#FDF1F1] px-3 py-2 text-[12px] text-[#991B1B]">{error}</div>
        )}

        {confirmKind === "disconnect" ? (
          <InlineConfirm
            title="Disconnect GitHub?"
            message="Disconnect GitHub sync for this canvas? Files already on GitHub stay; new edits will not sync."
            confirmLabel="Disconnect"
            cancelLabel="Cancel"
            busyLabel="Disconnecting…"
            busy={busy === "disconnect"}
            error={confirmError}
            onCancel={() => {
              if (busy === "disconnect") return;
              setConfirmKind(null);
              setConfirmError(null);
            }}
            onConfirm={() => void disconnect()}
          />
        ) : (
          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <button type="button" className={outlineButton} onClick={onBack} disabled={!!busy}>
              Back
            </button>
            <button
              type="button"
              className={outlineButton}
              onClick={() => {
                setConfirmError(null);
                setConfirmKind("disconnect");
              }}
              disabled={!!busy}
            >
              Disconnect
            </button>
            {repoLink && (
              <a href={repoLink} target="_blank" rel="noreferrer" className={primaryButton}>
                <TbExternalLink size={14} />
                View on GitHub
              </a>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <button type="button" onClick={onBack} disabled={!!busy} className="mt-3 flex items-center gap-1 text-[12px] text-[#5E6066] hover:text-[#8664F2]">
        <TbArrowLeft size={14} /> All apps
      </button>
      <div className="mt-3 flex items-center gap-3 rounded-[10px] border border-[#ECECEC] p-3 dark:border-[#2a2a2a]">
        <span className="flex h-[38px] w-[38px] items-center justify-center rounded-[8px] border-2 border-[#22C55E] bg-white dark:bg-[#1a1a1a]">
          <SiGithub size={20} color="#24292F" />
        </span>
        <div className="min-w-0 text-[12.5px]">
          <div className="font-medium text-[#1F1F1F] dark:text-[#ededed]">Connect this canvas to GitHub</div>
          <div className="text-[#7E7E7E]">Changes sync automatically to your project’s repo.</div>
        </div>
      </div>

      {busy === "load" && (
        <div className="mt-3 flex items-center gap-2 text-[13px] text-[#7E7E7E]">
          <TbLoader2 size={15} className="animate-spin" /> Loading…
        </div>
      )}

      {mapping?.connected ? (
        <div className="mt-3 space-y-2 rounded-[10px] border border-[#ECECEC] bg-[#FAFAFA] p-3 text-[12.5px] dark:border-[#2a2a2a] dark:bg-[#101010]">
          <div>
            <span className="text-[#7E7E7E]">Project repo · </span>
            <span className="font-medium text-[#1F1F1F] dark:text-[#ededed]">
              {mapping.owner}/{mapping.repo}
            </span>
          </div>
          <div>
            <span className="text-[#7E7E7E]">Branch · </span>
            <span className="font-medium">{mapping.branch || "appatlas-sync"}</span>
          </div>
          {folderPreview && (
            <div className="text-[#7E7E7E]">
              Folder · <code className="font-mono text-[11px] text-[#5E6066] dark:text-[#9ca3af]">{folderPreview}</code>
            </div>
          )}
        </div>
      ) : (
        <>
          <label className={fieldLabel}>
            Repository
            {allowed.repos.length > 0 ? (
              <select className={fieldInput} value={repo} onChange={(e) => setRepo(e.target.value)}>
                {allowed.repos.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className={fieldInput}
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder={
                  allowed.wildcardOwners.length ? `${allowed.wildcardOwners[0]}/repo-name` : "owner/repo (must be allowlisted)"
                }
              />
            )}
          </label>
          <label className={fieldLabel}>
            Branch
            <input className={fieldInput} value={branch} onChange={(e) => setBranch(e.target.value)} />
          </label>
          <label className="mt-3 flex items-center gap-2 text-[12.5px] text-[#5A5A5A] dark:text-[#9ca3af]">
            <input type="checkbox" checked={autoNew} onChange={(e) => setAutoNew(e.target.checked)} />
            Automatically connect new canvases in this project
          </label>
        </>
      )}

      {error && confirmKind !== "public" && (
        <div className="mt-3 rounded-[8px] bg-[#FDF1F1] px-3 py-2 text-[12px] text-[#991B1B]">{error}</div>
      )}
      {!pid && (
        <p className="mt-3 text-[12px] text-[#B45309]">Open App Atlas from a project so this canvas has a project id.</p>
      )}

      {confirmKind === "public" ? (
        <InlineConfirm
          title="Public repository"
          message="This repository is public. Canvas data will be visible on GitHub. Continue?"
          confirmLabel="Connect anyway"
          cancelLabel="Cancel"
          busyLabel="Connecting…"
          busy={busy === "connect"}
          error={confirmError}
          onCancel={() => {
            if (busy === "connect") return;
            setConfirmKind(null);
            setConfirmError(null);
          }}
          onConfirm={() => void connect(true)}
        />
      ) : (
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" className={outlineButton} onClick={onBack} disabled={!!busy}>
            Back
          </button>
          <button type="button" className={primaryButton} disabled={busy !== null || !pid} onClick={() => void connect(false)}>
            {busy === "connect" ? (
              <>
                <TbLoader2 className="animate-spin" size={14} /> Connecting…
              </>
            ) : (
              "Connect"
            )}
          </button>
        </div>
      )}
    </div>
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
