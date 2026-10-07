"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMsal } from "@azure/msal-react";
import {
  TbChartLine,
  TbChevronDown,
  TbChevronRight,
  TbHistory,
  TbLayoutGrid,
  TbNetwork,
  TbReportSearch,
  TbShieldCheck,
  TbBrandSpeedtest,
  TbWorld,
  TbListCheck,
} from "react-icons/tb";
import { useProjects } from "@/app/lib/projectsStore";
import type { Canvas, CanvasSummary, PresenceUser, SessionSnapshot } from "@/app/interfaces/appatlas";
import { AtlasError, atlasClient } from "@/app/services/appatlas";
import { CanvasFlow } from "./canvas-flow";
import { Explorer } from "./explorer";
import { ConnectAppsModal } from "./connect-apps-modal";
import { JiraPanel } from "./jira-panel";
import { SaveExecutionModal } from "./save-execution-modal";
import { RecordingView } from "./recording-view";

const TABS = [
  { id: "canvas", label: "Canvas", icon: TbLayoutGrid },
  { id: "api", label: "API Testing", icon: TbNetwork },
  { id: "sit", label: "SIT", icon: TbListCheck },
  { id: "coverage", label: "Coverage", icon: TbChartLine },
  { id: "security", label: "Security", icon: TbShieldCheck },
  { id: "performance", label: "Performance", icon: TbBrandSpeedtest },
] as const;

type TabId = (typeof TABS)[number]["id"];

const hostOf = (url: string) => {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
};

const initials = (name: string) =>
  name
    .split(/[\s.@_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

/** Only the id is kept: the snapshot's viewer URL carries a one-time login. */
const ACTIVE_SESSION_KEY = "appatlas-active-session";
/** "vnc" once the user picked the compatible viewer (their network blocks neko's WebRTC port). */
const VIEWER_PREF_KEY = "appatlas-viewer";
const LIVE_STATUSES: SessionSnapshot["status"][] = ["starting", "recording", "finishing"];

const AVATAR_COLORS = ["bg-[#3B82F6]", "bg-[#22C55E]", "bg-[#8664F2]", "bg-[#E1962E]"];

export default function AtlasWorkspace() {
  const { instance, accounts } = useMsal();
  const client = useMemo(() => atlasClient({ instance, accounts }), [instance, accounts]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { projects, loading: projectsLoading } = useProjects();

  const projectId = searchParams.get("projectId");
  const project =
    projects.find((p) => p.id === projectId) ?? projects.find((p) => p.applicationUrl?.trim()) ?? projects[0] ?? null;
  const appUrl = project?.applicationUrl?.trim() ?? "";
  const host = hostOf(appUrl);

  const [tab, setTab] = useState<TabId>("canvas");
  const [projectMenu, setProjectMenu] = useState(false);
  const [explorerOpen, setExplorerOpen] = useState(true);
  const [mineOnly, setMineOnly] = useState(false);

  const [canvases, setCanvases] = useState<CanvasSummary[]>([]);
  const [canvasesLoading, setCanvasesLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [canvas, setCanvas] = useState<Canvas | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [recording, setRecording] = useState<SessionSnapshot | null>(null);
  const [unsaved, setUnsaved] = useState<SessionSnapshot | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [starting, setStarting] = useState(false);

  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [panelNodeId, setPanelNodeId] = useState<string | null>(null);
  const [connectFor, setConnectFor] = useState<CanvasSummary | null>(null);

  const clarifying = canvas?.clarifications?.some((c) => c.status === "queued" || c.status === "running") ?? false;
  const canvasId = canvas?.id;

  const mergeClarifications = useCallback((id: string, items: Canvas["clarifications"]) => {
    setCanvas((prev) => (prev && prev.id === id ? { ...prev, clarifications: items } : prev));
  }, []);

  useEffect(() => {
    if (!canvasId || !clarifying) return;
    const timer = setInterval(() => {
      client
        .getClarifications(canvasId)
        .then((r) => mergeClarifications(canvasId, r.items))
        .catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [canvasId, clarifying, client, mergeClarifications]);

  const retryClarification = async (issueKey: string, force: boolean) => {
    if (!canvasId) return;
    const r = await client.retryClarifications(canvasId, { issueKey, force });
    mergeClarifications(canvasId, r.items);
  };

  const refreshJira = async () => {
    if (!canvas?.jira) return;
    onJiraConnected(await client.connectJira(canvas.id, canvas.jira.projectKey, true));
  };

  const setNodeTickets = async (nodeId: string, issueKeys: string[] | null) => {
    if (!canvas) return;
    const updated = await client.setNodeTickets(canvas.id, nodeId, issueKeys);
    setCanvas((prev) => (prev?.id === updated.id ? updated : prev));
  };

  const onJiraConnected = (updated: Canvas) => {
    setCanvases((prev) => prev.map((x) => (x.id === updated.id ? { ...x, jiraProjectKey: updated.jiraProjectKey } : x)));
    if (canvas?.id === updated.id) setCanvas(updated);
    setConnectFor(null);
  };

  const loadCanvases = useCallback(async () => {
    setCanvasesLoading(true);
    try {
      setCanvases(await client.listCanvases());
    } catch (err) {
      setNotice(err instanceof Error ? `Could not load canvases: ${err.message}` : "Could not load canvases.");
    } finally {
      setCanvasesLoading(false);
    }
  }, [client]);

  useEffect(() => {
    if (accounts.length) loadCanvases();
  }, [accounts.length, loadCanvases]);

  const visible = useMemo(
    () => canvases.filter((c) => (!host || hostOf(c.startUrl) === host) && (!mineOnly || c.isMine)),
    [canvases, host, mineOnly],
  );

  const [online, setOnline] = useState<PresenceUser[]>([]);
  const presenceRoom = project ? `app-atlas:${project.id}` : null;

  useEffect(() => {
    if (!presenceRoom || !accounts.length) return;
    let stopped = false;
    const beat = () =>
      client
        .presence(presenceRoom)
        .then((r) => !stopped && setOnline(r.users))
        .catch(() => {});
    beat();
    const timer = setInterval(beat, 15_000);
    return () => {
      stopped = true;
      clearInterval(timer);
      setOnline([]);
      client.presence(presenceRoom, true).catch(() => {});
    };
  }, [presenceRoom, accounts.length, client]);

  const selectCanvas = useCallback(
    async (id: string | null) => {
      setSelectedId(id);
      setFocusNodeId(null);
      setPanelNodeId(null);
      if (!id) return setCanvas(null);
      if (canvas?.id === id) return;
      setCanvas(null);
      try {
        setCanvas(await client.getCanvas(id));
      } catch (err) {
        if (err instanceof AtlasError && err.status === 404) {
          setNotice("That canvas was deleted.");
          setSelectedId(null);
          loadCanvases();
        } else {
          setNotice(err instanceof Error ? err.message : "Could not open the canvas.");
        }
      }
    },
    [canvas?.id, client, loadCanvases],
  );

  // Switching app clears a selection that belongs to another app.
  useEffect(() => {
    if (selectedId && !visible.some((c) => c.id === selectedId)) {
      setSelectedId(null);
      setCanvas(null);
    }
  }, [visible, selectedId]);

  const startRecording = (snap: SessionSnapshot) => {
    localStorage.setItem(ACTIVE_SESSION_KEY, snap.id);
    setUnsaved(null);
    setRecording(snap);
    setTab("canvas");
  };

  // A reload mid-recording reattaches to the running session, or offers to save it if it already stopped.
  useEffect(() => {
    if (!accounts.length) return;
    const id = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!id) return;
    let cancelled = false;
    client
      .getSession(id)
      .then((snap) => {
        if (cancelled) return;
        if (LIVE_STATUSES.includes(snap.status)) {
          setRecording(snap);
          setTab("canvas");
        } else {
          localStorage.removeItem(ACTIVE_SESSION_KEY);
          if (snap.status !== "error" && snap.nodes.length) {
            setUnsaved(snap);
            setNotice("Your last recording stopped while you were away. Save it below or start a new one.");
          }
        }
      })
      .catch(() => {
        if (!cancelled) localStorage.removeItem(ACTIVE_SESSION_KEY);
      });
    return () => {
      cancelled = true;
    };
  }, [accounts.length, client]);

  const startSession = async () => {
    if (!appUrl) return;
    setStarting(true);
    try {
      const viewer = localStorage.getItem(VIEWER_PREF_KEY) === "vnc" ? "vnc" : "auto";
      startRecording(await client.startSession({ url: appUrl, devicePreset: "desktop", networkPreset: "none", viewer }));
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not start the browser.");
    } finally {
      setStarting(false);
    }
  };
  const runQuick = () => void startSession();

  const switchViewer = async (to: "vnc" | "auto") => {
    if (!recording) return;
    if (to === "vnc") localStorage.setItem(VIEWER_PREF_KEY, "vnc");
    else localStorage.removeItem(VIEWER_PREF_KEY);
    await client.discardSession(recording.id).catch(() => undefined);
    localStorage.removeItem(ACTIVE_SESSION_KEY);
    setRecording(null);
    await startSession();
  };

  const onRecordingDone = useCallback((snap: SessionSnapshot) => {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
    setRecording(null);
    if (snap.status === "error") {
      setNotice(snap.error ? `Recording failed: ${snap.error}` : "Recording failed.");
      return;
    }
    if (!snap.nodes.length) {
      setNotice("Nothing was recorded.");
      return;
    }
    setUnsaved(snap);
    setSaveOpen(true);
  }, []);

  const save = async (name: string, description: string) => {
    if (!unsaved) return;
    const created = await client.saveCanvas({ sessionId: unsaved.id, name, description: description || undefined });
    setSaveOpen(false);
    setUnsaved(null);
    setCanvases((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);
    setSelectedId(created.id);
    setCanvas(created);
  };

  const rename = async (c: CanvasSummary) => {
    const name = window.prompt("Canvas name", c.name)?.trim();
    if (!name || name === c.name) return;
    try {
      const updated = await client.renameCanvas(c.id, { name });
      setCanvases((prev) => prev.map((x) => (x.id === c.id ? { ...x, name: updated.name } : x)));
      if (canvas?.id === c.id) setCanvas(updated);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not rename the canvas.");
    }
  };

  const remove = async (c: CanvasSummary) => {
    if (!window.confirm(`Delete "${c.name}"? Its screenshots are deleted too. This can't be undone.`)) return;
    try {
      await client.deleteCanvas(c.id);
      setCanvases((prev) => prev.filter((x) => x.id !== c.id));
      if (selectedId === c.id) {
        setSelectedId(null);
        setCanvas(null);
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not delete the canvas.");
    }
  };

  const canStart = !!appUrl && !recording && !starting;
  const tabLabel = TABS.find((t) => t.id === tab)!.label;

  return (
    <div className="flex h-full flex-col bg-[#F7F7FA] dark:bg-[#0a0a0a]">
      <div className="flex h-[56px] shrink-0 items-center justify-between border-b border-[#EEE] bg-white px-4 dark:border-[#1a1a1a] dark:bg-[#0a0a0a]">
        <div className="flex min-w-0 items-center gap-4">
          <div className="relative">
            <button
              type="button"
              onClick={() => setProjectMenu((o) => !o)}
              className="flex h-[34px] max-w-[340px] items-center gap-2 rounded-[8px] border border-[#E5E7EB] bg-[#F5F6F6] px-3 text-[13px] text-[#1F1F1F] dark:border-[#2a2a2a] dark:bg-[#141414] dark:text-[#ededed]"
              title={appUrl || "No application URL"}
            >
              <TbWorld size={15} className="shrink-0 text-[#5E6066]" />
              <span className="truncate">
                {project ? (
                  <>
                    <span className="font-medium">{project.name}</span>
                    {host && <span className="text-[#7E7E7E]"> · {host}</span>}
                  </>
                ) : projectsLoading ? (
                  "Loading…"
                ) : (
                  "No projects yet"
                )}
              </span>
              <TbChevronDown size={14} className="shrink-0 text-[#5E6066]" />
            </button>
            {projectMenu && (
              <div className="absolute top-10 left-0 z-40 w-[320px] rounded-[10px] border border-[#E6E1F5] bg-white py-1 shadow-lg dark:border-[#2a2a2a] dark:bg-[#141414]">
                {projects.length === 0 && <div className="px-3 py-2 text-[12px] text-[#7E7E7E]">No projects yet.</div>}
                {projects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setProjectMenu(false);
                      router.replace(`/app-atlas?projectId=${p.id}`);
                    }}
                    className={`block w-full px-3 py-2 text-left hover:bg-[#F9FAFC] dark:hover:bg-[#1a1a1a] ${p.id === project?.id ? "bg-[#F2EBFB] dark:bg-[#2a2440]" : ""}`}
                  >
                    <div className="truncate text-[12.5px] font-medium text-[#1F1F1F] dark:text-[#ededed]">{p.name}</div>
                    <div className="truncate text-[11px] text-[#7E7E7E]">{p.applicationUrl?.trim() || "No Application URL"}</div>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => router.push("/projects")}
                  className="mt-1 block w-full border-t border-[#EEE] px-3 py-2 text-left text-[12px] text-[#8664F2] dark:border-[#2a2a2a]"
                >
                  Set up a project URL →
                </button>
              </div>
            )}
          </div>
          <nav className="flex items-center gap-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex h-[32px] items-center gap-1.5 rounded-[8px] px-3 text-[13px] ${
                  tab === id
                    ? "bg-[#F2EBFB] text-[#8664F2] dark:bg-[#2a2440]"
                    : "text-[#1F1F1F] hover:text-[#8664F2] dark:text-[#ededed]"
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-4 text-[13px] text-[#1F1F1F] dark:text-[#ededed]">
          <div className="h-[24px] w-px bg-[#E5E7EB] dark:bg-[#2a2a2a]" />
          <button
            type="button"
            className={`flex items-center gap-1.5 hover:text-[#8664F2] ${mineOnly ? "text-[#8664F2]" : ""}`}
            onClick={() => setMineOnly((m) => !m)}
            title={mineOnly ? "Showing only your canvases" : "Show only your canvases"}
          >
            <TbHistory size={15} />
            {mineOnly ? "My History" : "History"}
          </button>
          <div className="flex -space-x-2" title={online.length ? `On this page now: ${online.map((u) => u.name || u.email).join(", ")}` : undefined}>
            {online.slice(0, 3).map((u, i) => (
              <span
                key={u.id}
                title={`${u.name || u.email}${u.email && u.name ? ` (${u.email})` : ""} · on this page now`}
                className={`relative flex h-[28px] w-[28px] items-center justify-center rounded-full border-2 border-white text-[10px] font-semibold text-white dark:border-[#0a0a0a] ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}
              >
                {initials(u.name || u.email)}
                <span className="absolute -right-0.5 -bottom-0.5 h-[8px] w-[8px] rounded-full border-[1.5px] border-white bg-[#22C55E] dark:border-[#0a0a0a]" />
              </span>
            ))}
            {online.length > 3 && (
              <span className="flex h-[28px] w-[28px] items-center justify-center rounded-full border-2 border-white bg-[#E5E7EB] text-[10px] font-semibold text-[#4B5563] dark:border-[#0a0a0a]">
                +{online.length - 3}
              </span>
            )}
          </div>
        </div>
      </div>

      {notice && (
        <div className="flex items-center justify-between bg-[#FFFBEB] px-4 py-2 text-[12px] text-[#92400E]">
          {notice}
          <button type="button" onClick={() => setNotice(null)} className="ml-4">✕</button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {tab === "canvas" && explorerOpen && (
          <Explorer
            canvases={visible}
            loading={canvasesLoading}
            selectedId={selectedId}
            canvas={canvas}
            canSave={!!unsaved}
            canStart={canStart}
            onSelect={(id) => selectCanvas(id === selectedId ? null : id)}
            onRename={rename}
            onDelete={remove}
            onNew={runQuick}
            onRun={runQuick}
            onSave={() => setSaveOpen(true)}
            onCollapse={() => setExplorerOpen(false)}
            onFocusNode={setFocusNodeId}
              onConnect={setConnectFor}
              onRefreshJira={refreshJira}
          />
        )}
        {tab === "canvas" && !explorerOpen && (
          <button
            type="button"
            onClick={() => setExplorerOpen(true)}
            className="flex w-[28px] shrink-0 items-start justify-center border-r border-[#EEE] bg-white pt-3 text-[#5E6066] hover:text-[#8664F2] dark:border-[#1a1a1a] dark:bg-[#0a0a0a]"
            title="Show explorer"
          >
            <TbChevronRight size={16} />
          </button>
        )}

        <div className="relative min-w-0 flex-1">
          {tab !== "canvas" ? (
            <EmptyState title={`${tabLabel} is coming soon`} body="This part of AppAtlas isn't available yet. Use Canvas to record and map your app." />
          ) : recording ? (
            <RecordingView key={recording.id} client={client} initial={recording} onFinished={onRecordingDone} onSwitchViewer={switchViewer} onDiscarded={() => {
                localStorage.removeItem(ACTIVE_SESSION_KEY);
                setRecording(null);
              }}
            />
          ) : canvas ? (
            <>
              <CanvasFlow
                key={canvas.id}
                nodes={canvas.nodes}
                edges={canvas.edges}
                editable={canvas.isMine}
                focusNodeId={focusNodeId}
                selectedNodeId={panelNodeId}
                onSelectNode={setPanelNodeId}
              />
              <div className="pointer-events-none absolute top-3 left-4 rounded-[8px] bg-white/90 px-3 py-1.5 text-[11px] text-[#5E6066] shadow-sm dark:bg-[#141414]/90 dark:text-[#9ca3af]">
                <span className="font-medium text-[#1F1F1F] dark:text-[#ededed]">{canvas.name}</span> · {canvas.owner.name}
                {!canvas.isMine && " · view only"}
              </div>
              {panelNodeId && (
                <JiraPanel
                  key={panelNodeId}
                  canvas={canvas}
                  nodeId={panelNodeId}
                  onClose={() => setPanelNodeId(null)}
                  onConnect={canvas.isMine ? () => setConnectFor(canvas) : undefined}
                  onRetryClarification={canvas.isMine ? retryClarification : undefined}
                  onRefresh={canvas.isMine ? refreshJira : undefined}
                  onSetTickets={canvas.isMine ? (keys) => setNodeTickets(panelNodeId, keys) : undefined}
                />
              )}
            </>
          ) : selectedId ? (
            <EmptyState title="Loading canvas…" body="" />
          ) : unsaved ? (
            <EmptyState title="Recording finished" body="Save it to turn it into a canvas, or start a new one." action={{ label: "Save Execution", onClick: () => setSaveOpen(true) }} />
          ) : (
            <EmptyState
              title="No app crawled yet"
              body={
                appUrl
                  ? "Click + in the Explorer or Run AppAtlas to open your app in a remote browser and map every screen you visit."
                  : project
                    ? `"${project.name}" has no Application URL yet. Add one in the project setup, then come back here.`
                    : "Create a project with an Application URL, then open it here."
              }
              action={
                appUrl
                  ? { label: starting ? "Starting…" : "Run AppAtlas", onClick: runQuick, disabled: !canStart }
                  : { label: project ? "Open project setup" : "Go to Projects", onClick: () => router.push(project ? `/projects/${project.id}` : "/projects") }
              }
            />
          )}
        </div>
      </div>

      {saveOpen && unsaved && <SaveExecutionModal onSave={save} onClose={() => setSaveOpen(false)} />}
      {connectFor && (
        <ConnectAppsModal client={client} canvas={connectFor} onConnected={onJiraConnected} onClose={() => setConnectFor(null)} />
      )}
    </div>
  );
}

function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { label: string; onClick: () => void; disabled?: boolean };
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <TbReportSearch size={44} className="mb-4 text-[#8664F2]" />
      <h2 className="mb-2 text-[24px] font-medium text-[#1F1F1F] dark:text-[#ededed]">{title}</h2>
      {body && <p className="max-w-[420px] text-[14px] leading-relaxed text-[#5E6066] dark:text-[#9ca3af]">{body}</p>}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          disabled={action.disabled}
          className="mt-5 rounded-[8px] bg-[#8664F2] px-5 py-2 text-[13px] font-medium text-white hover:bg-[#7451e8] disabled:opacity-60"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
