"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  TbDeviceDesktop,
  TbDeviceMobile,
  TbDeviceTablet,
  TbDots,
  TbMaximize,
  TbAntennaBars1,
  TbAntennaBars2,
  TbAntennaBars3,
  TbAntennaBars5,
  TbAntennaBarsOff,
  TbGauge,
  TbRefresh,
  TbRotate,
  TbWifiOff,
  TbX,
} from "react-icons/tb";
import type { AtlasConfig } from "@/app/interfaces/appatlas";
import {
  BREAKPOINT_CHIPS,
  DEVICE_CATALOG,
  NETWORK_CATALOG,
  VIEWPORT,
  deviceById,
  loadCanvasViewport,
  loadEmulationPrefs,
  loadRecentDevices,
  networkById,
  normalizePrefs,
  rememberCanvasViewport,
  saveEmulationPrefs,
  selectDevicePreset,
  setCustomSize,
  setOrientation,
  summaryLine,
  type DeviceCategory,
  type Orientation,
  type SessionEmulationPrefs,
} from "@/app/lib/session-emulation";
import {
  USER_PRESET_MAX,
  applyUserPreset,
  devicePayloadFromPrefs,
  loadPresetCache,
  nameTaken,
  networkPayloadFromPrefs,
  resolveResetPrefs,
  savePresetCache,
  setupPayloadFromPrefs,
  type PresetKind,
  type UserRecordingPreset,
} from "@/app/lib/user-recording-presets";
import type { AtlasClient } from "@/app/services/appatlas";
import { DevicePreviewFrame } from "./device-preview-frame";
import { fieldInput, fieldLabel, outlineButton, primaryButton } from "./modal";

type CategoryTab = DeviceCategory | "recent" | "mine";

const CATEGORIES: { id: CategoryTab; label: string }[] = [
  { id: "recent", label: "Recent" },
  { id: "phone", label: "Phone" },
  { id: "tablet", label: "Tablet" },
  { id: "laptop", label: "Laptop / Desktop" },
  { id: "custom", label: "Custom" },
  { id: "mine", label: "My presets" },
];

const motionOk = () =>
  typeof window === "undefined" || !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function DeviceIcon({ category, className }: { category: DeviceCategory; className?: string }) {
  if (category === "phone") return <TbDeviceMobile className={className} size={18} />;
  if (category === "tablet") return <TbDeviceTablet className={className} size={18} />;
  if (category === "laptop") return <TbDeviceDesktop className={className} size={18} />;
  return <TbMaximize className={className} size={18} />;
}

function NetworkIcon({ id, className }: { id: string; className?: string }) {
  if (id === "offline") return <TbWifiOff className={className} size={18} />;
  if (id === "slow-3g") return <TbAntennaBars1 className={className} size={18} />;
  if (id === "fast-3g") return <TbAntennaBars2 className={className} size={18} />;
  if (id === "4g") return <TbAntennaBars3 className={className} size={18} />;
  if (id === "none") return <TbAntennaBars5 className={className} size={18} />;
  if (id === "custom") return <TbGauge className={className} size={18} />;
  return <TbAntennaBarsOff className={className} size={18} />;
}

function SignalBars({ strength }: { strength: 0 | 1 | 2 | 3 | 4 }) {
  return (
    <div className="flex h-3 items-end gap-[2px]" aria-hidden>
      {[1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={`w-[3px] rounded-sm ${i <= strength ? "bg-current" : "bg-current/25"}`}
          style={{ height: `${4 + i * 2}px` }}
        />
      ))}
    </div>
  );
}

function networkStrength(id: string): 0 | 1 | 2 | 3 | 4 {
  if (id === "offline") return 0;
  if (id === "slow-3g") return 1;
  if (id === "fast-3g") return 2;
  if (id === "4g") return 3;
  if (id === "none") return 4;
  return 2;
}

function formatRate(kbps: number | null): string {
  if (kbps == null) return "—";
  if (kbps >= 1024) return `${(kbps / 1024).toFixed(kbps % 1024 === 0 ? 0 : 1)} Mbps`;
  return `${kbps} kbps`;
}

const cardBase =
  "rounded-[10px] border px-2.5 py-2 text-left transition-[border-color,background-color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8664F2] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#141414]";
const cardIdle =
  "border-[#E5E7EB] bg-white hover:border-[#C4B5FD] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] dark:hover:border-[#5b4a9a]";
const cardSelected =
  "border-[#8664F2] bg-[#F5F0FF] shadow-[0_0_0_1px_#8664F2] dark:border-[#8664F2] dark:bg-[#1a1430]";

function InlineSaveName({
  kind,
  disabled,
  onSave,
  onCancel,
}: {
  kind: PresetKind;
  disabled?: boolean;
  onSave: (name: string) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <input
        ref={ref}
        type="text"
        maxLength={64}
        placeholder={`Name this ${kind}…`}
        className={`${fieldInput} !mt-0 max-w-[220px] !py-1.5 text-[12.5px]`}
        value={name}
        disabled={disabled}
        onChange={(e) => {
          setName(e.target.value);
          setErr(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
          if (e.key === "Enter") {
            e.preventDefault();
            const trimmed = name.trim();
            if (!trimmed) {
              setErr("Enter a name");
              return;
            }
            void Promise.resolve(onSave(trimmed)).catch((ex) =>
              setErr(ex instanceof Error ? ex.message : "Could not save"),
            );
          }
        }}
        aria-label={`Preset name for ${kind}`}
      />
      <button
        type="button"
        className="text-[12px] font-medium text-[#8664F2]"
        disabled={disabled}
        onClick={() => {
          const trimmed = name.trim();
          if (!trimmed) {
            setErr("Enter a name");
            return;
          }
          void Promise.resolve(onSave(trimmed)).catch((ex) =>
            setErr(ex instanceof Error ? ex.message : "Could not save"),
          );
        }}
      >
        Save
      </button>
      <button type="button" className="text-[12px] text-[#7E7E7E]" disabled={disabled} onClick={onCancel}>
        Cancel
      </button>
      {err && <span className="w-full text-[11px] text-[#B91C1C]">{err}</span>}
    </div>
  );
}

function PresetMenu({
  disabled,
  onRename,
  onDelete,
  onDefault,
}: {
  disabled?: boolean;
  onRename: () => void;
  onDelete: () => void;
  onDefault: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        aria-label="Preset actions"
        className="rounded p-0.5 text-[#7E7E7E] opacity-0 transition-opacity hover:bg-[#F3F4F6] hover:text-[#8664F2] group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8664F2] dark:hover:bg-[#1a1a1a]"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <TbDots size={14} />
      </button>
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-10 cursor-default" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 min-w-[140px] rounded-[8px] border border-[#E5E7EB] bg-white py-1 text-[12px] shadow-lg dark:border-[#2a2a2a] dark:bg-[#141414]">
            <button
              type="button"
              className="block w-full px-3 py-1.5 text-left hover:bg-[#F5F0FF] dark:hover:bg-[#1a1430]"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onDefault();
              }}
            >
              Set as my default
            </button>
            <button
              type="button"
              className="block w-full px-3 py-1.5 text-left hover:bg-[#F5F0FF] dark:hover:bg-[#1a1430]"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onRename();
              }}
            >
              Rename
            </button>
            <button
              type="button"
              className="block w-full px-3 py-1.5 text-left text-[#B91C1C] hover:bg-[#FEF2F2]"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onDelete();
              }}
            >
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function SessionSetupModal({
  appUrl,
  projectId,
  canvasId,
  userId,
  client,
  loadConfig,
  starting,
  onStart,
  onClose,
}: {
  appUrl: string;
  projectId?: string | null;
  canvasId?: string | null;
  userId: string;
  client: AtlasClient;
  loadConfig: () => Promise<AtlasConfig>;
  starting: boolean;
  onStart: (prefs: SessionEmulationPrefs) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [prefs, setPrefs] = useState<SessionEmulationPrefs>(() => loadEmulationPrefs(projectId));
  const [category, setCategory] = useState<CategoryTab>(() => {
    const d = deviceById(loadEmulationPrefs(projectId).devicePreset);
    return d?.category ?? "laptop";
  });
  const [search, setSearch] = useState("");
  const [deviceEdit, setDeviceEdit] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [previousViewport, setPreviousViewport] = useState<{ width: number; height: number } | null>(null);
  const [rotating, setRotating] = useState(false);
  const [presets, setPresets] = useState<UserRecordingPreset[]>(() => loadPresetCache(userId));
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [savingKind, setSavingKind] = useState<PresetKind | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [presetMsg, setPresetMsg] = useState<string | null>(null);

  const syncPresets = useCallback(
    (items: UserRecordingPreset[]) => {
      setPresets(items);
      savePresetCache(userId, items);
    },
    [userId],
  );

  useEffect(() => {
    setPrefs(loadEmulationPrefs(projectId));
    setRecent(loadRecentDevices());
    setPreviousViewport(loadCanvasViewport(canvasId));
    setPresets(loadPresetCache(userId));
  }, [projectId, canvasId, userId]);

  useEffect(() => {
    let cancelled = false;
    client
      .listRecordingPresets()
      .then((items) => {
        if (!cancelled) syncPresets(items);
      })
      .catch(() => {
        /* offline / no DB — keep localStorage cache */
      });
    return () => {
      cancelled = true;
    };
  }, [client, syncPresets]);

  useEffect(() => {
    let cancelled = false;
    loadConfig()
      .then((cfg) => {
        if (cancelled) return;
        if (!cfg.presets?.devices?.length) setConfigError("Using built-in device list.");
      })
      .catch((err) => {
        if (!cancelled) setConfigError(err instanceof Error ? err.message : "Using built-in presets.");
      });
    return () => {
      cancelled = true;
    };
  }, [loadConfig]);

  useEffect(() => {
    const root = dialogRef.current;
    if (!root) return;
    const focusable = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);

    const first = focusable()[0];
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !starting) {
        if (savingKind || renamingId) {
          setSavingKind(null);
          setRenamingId(null);
          return;
        }
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const i = items.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && (i <= 0 || document.activeElement === root)) {
        e.preventDefault();
        items[items.length - 1]?.focus();
      } else if (!e.shiftKey && i === items.length - 1) {
        e.preventDefault();
        items[0]?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, starting, savingKind, renamingId]);

  const myDevicePresets = useMemo(() => presets.filter((p) => p.kind === "device"), [presets]);
  const myNetworkPresets = useMemo(() => presets.filter((p) => p.kind === "network"), [presets]);
  const mySetupPresets = useMemo(() => presets.filter((p) => p.kind === "setup"), [presets]);

  const devicesInTab = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = DEVICE_CATALOG;
    if (category === "recent") {
      const ids = recent.length ? recent : ["desktop", "iphone-14", "pixel-7"];
      list = ids.map((id) => deviceById(id)).filter(Boolean) as typeof DEVICE_CATALOG;
    } else if (category === "mine") {
      list = [];
    } else {
      list = DEVICE_CATALOG.filter((d) => d.category === category);
    }
    if (!q) return list;
    return list.filter((d) => d.label.toLowerCase().includes(q) || d.id.includes(q));
  }, [category, recent, search]);

  const entry = deviceById(prefs.devicePreset);
  const isCustom = prefs.devicePreset === "custom" || deviceEdit;
  const dpr = entry?.dpr ?? 1;
  const atLimit = presets.length >= USER_PRESET_MAX;

  const patchNetwork = (networkPreset: string) => {
    const net = networkById(networkPreset);
    setSelectedPresetId(null);
    setPrefs((p) =>
      normalizePrefs({
        ...p,
        networkPreset,
        latencyMs: net?.latencyMs ?? p.latencyMs,
        downloadKbps: net?.downloadKbps ?? p.downloadKbps,
        uploadKbps: net?.uploadKbps ?? p.uploadKbps,
      }),
    );
  };

  const chooseDevice = (id: string) => {
    setSelectedPresetId(null);
    setDeviceEdit(id === "custom");
    setPrefs((p) => selectDevicePreset(p, id));
    const d = deviceById(id);
    if (d && d.category !== "custom") setCategory(d.category);
  };

  const chooseUserPreset = (preset: UserRecordingPreset) => {
    setSelectedPresetId(preset.id);
    setDeviceEdit(preset.kind !== "network");
    setPrefs((p) => applyUserPreset(p, preset));
    if (preset.kind === "device" || preset.kind === "setup") setCategory("mine");
  };

  const onOrient = (orientation: Orientation) => {
    if (motionOk()) {
      setRotating(true);
      window.setTimeout(() => setRotating(false), 180);
    }
    setSelectedPresetId(null);
    setPrefs((p) => setOrientation(p, orientation));
  };

  const onWidthHeight = (width: number, height: number) => {
    setSelectedPresetId(null);
    setDeviceEdit(true);
    setPrefs((p) => setCustomSize(p, width, height));
  };

  const createPreset = async (kind: PresetKind, name: string) => {
    if (atLimit) {
      setPresetMsg(`You can save up to ${USER_PRESET_MAX} presets. Delete one to add another.`);
      return;
    }
    if (nameTaken(presets, kind, name)) {
      throw new Error(`A ${kind} preset named “${name}” already exists`);
    }
    const payload =
      kind === "device"
        ? devicePayloadFromPrefs(prefs)
        : kind === "network"
          ? networkPayloadFromPrefs(prefs)
          : setupPayloadFromPrefs(prefs);
    try {
      const created = await client.createRecordingPreset({ kind, name, payload });
      syncPresets([...presets, created]);
      setSelectedPresetId(created.id);
      setSavingKind(null);
      setPresetMsg(null);
      if (kind === "device") setCategory("mine");
    } catch (err) {
      // Fallback: local-only cache when API unavailable
      if (err instanceof Error && /fetch|Network|503|Failed/i.test(err.message)) {
        const local: UserRecordingPreset = {
          id: `local-${Date.now()}`,
          kind,
          name,
          payload,
          isDefault: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        syncPresets([...presets, local]);
        setSelectedPresetId(local.id);
        setSavingKind(null);
        setPresetMsg("Saved locally (server unavailable).");
        return;
      }
      throw err;
    }
  };

  const renamePreset = async (id: string, name: string) => {
    const cur = presets.find((p) => p.id === id);
    if (!cur) return;
    if (nameTaken(presets, cur.kind, name, id)) throw new Error(`A ${cur.kind} preset named “${name}” already exists`);
    try {
      const updated = await client.updateRecordingPreset(id, { name });
      syncPresets(presets.map((p) => (p.id === id ? updated : p)));
    } catch {
      syncPresets(presets.map((p) => (p.id === id ? { ...p, name, updatedAt: new Date().toISOString() } : p)));
    }
    setRenamingId(null);
  };

  const deletePreset = async (id: string) => {
    if (!window.confirm("Delete this preset?")) return;
    try {
      await client.deleteRecordingPreset(id);
    } catch {
      /* local fallback */
    }
    syncPresets(presets.filter((p) => p.id !== id));
    if (selectedPresetId === id) setSelectedPresetId(null);
  };

  const setDefaultPreset = async (id: string) => {
    try {
      const updated = await client.setRecordingPresetDefault(id);
      syncPresets(
        presets.map((p) =>
          p.kind === updated.kind ? { ...p, isDefault: p.id === id } : p,
        ),
      );
    } catch {
      const cur = presets.find((p) => p.id === id);
      if (!cur) return;
      syncPresets(
        presets.map((p) => (p.kind === cur.kind ? { ...p, isDefault: p.id === id } : p)),
      );
    }
    setPresetMsg("Default updated.");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    let next = normalizePrefs(prefs);
    if (selectedPresetId) {
      const preset = presets.find((p) => p.id === selectedPresetId);
      if (preset) next = applyUserPreset(next, preset);
    }
    next = normalizePrefs(next);
    saveEmulationPrefs(next, projectId);
    rememberCanvasViewport(canvasId, next.width, next.height);
    setRecent(loadRecentDevices());
    onStart(next);
  };

  const reset = () => {
    setDeviceEdit(false);
    setSelectedPresetId(null);
    setPrefs(resolveResetPrefs(presets));
    const d = deviceById(resolveResetPrefs(presets).devicePreset);
    setCategory(d?.category === "custom" ? "mine" : d?.category ?? "laptop");
  };

  const showPrevNote =
    previousViewport &&
    (previousViewport.width !== prefs.width || previousViewport.height !== prefs.height);

  const frameKind: DeviceCategory = entry?.category ?? "custom";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-3 sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && !starting && onClose()}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[min(920px,calc(100vh-1.5rem))] w-full max-w-[980px] flex-col overflow-hidden rounded-[16px] bg-white shadow-xl dark:bg-[#141414]"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#D9D9D9] px-5 py-3.5 dark:border-[#2a2a2a] sm:px-7">
          <h2 id={titleId} className="text-[20px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">
            Start recording
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={starting}
            aria-label="Close"
            className="rounded-md p-1 text-[#1F1F1F] transition-colors hover:bg-[#F3F4F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8664F2] dark:text-[#ededed] dark:hover:bg-[#1f1f1f]"
          >
            <TbX size={20} />
          </button>
        </div>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-7">
            <p className="text-[12.5px] text-[#5E6066] dark:text-[#9ca3af]">
              Device and network for this session. Saved for the next Run. Presets follow your account.
            </p>
            <p className="mt-1 truncate font-mono text-[11.5px] text-[#7E7E7E]" title={appUrl}>
              {appUrl || "No application URL"}
            </p>
            {showPrevNote && (
              <p className="mt-2 rounded-[8px] border border-[#E5E7EB] bg-[#F9FAFB] px-2.5 py-1.5 text-[12px] text-[#5E6066] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] dark:text-[#9ca3af]">
                Previous recordings on this canvas used {previousViewport!.width} × {previousViewport!.height}.
              </p>
            )}
            {presetMsg && (
              <p className="mt-2 text-[12px] text-[#5E6066] dark:text-[#9ca3af]">{presetMsg}</p>
            )}
            {atLimit && (
              <p className="mt-2 rounded-[8px] border border-[#FCD34D] bg-[#FFFBEB] px-2.5 py-1.5 text-[12px] text-[#92400E]">
                You have {USER_PRESET_MAX} presets (the limit). Delete one to save another.
              </p>
            )}

            <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
              <div className="min-w-0 space-y-5">
                <section>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[14px] font-medium text-[#1F1F1F] dark:text-[#ededed]">Device</span>
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search presets…"
                      className={`${fieldInput} !mt-0 max-w-[200px] !py-1.5 text-[12.5px]`}
                      aria-label="Search device presets"
                      disabled={starting}
                    />
                  </div>
                  <div role="tablist" aria-label="Device category" className="mb-2 flex flex-wrap gap-1">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        role="tab"
                        aria-selected={category === c.id}
                        disabled={starting}
                        onClick={() => setCategory(c.id)}
                        className={`rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8664F2] ${
                          category === c.id
                            ? "bg-[#8664F2] text-white"
                            : "bg-[#F3F4F6] text-[#5E6066] hover:bg-[#E5E7EB] dark:bg-[#1a1a1a] dark:text-[#9ca3af] dark:hover:bg-[#222]"
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                  <div role="listbox" aria-label="Device presets" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {category === "mine"
                      ? myDevicePresets
                          .filter((p) => {
                            const q = search.trim().toLowerCase();
                            return !q || p.name.toLowerCase().includes(q);
                          })
                          .map((p) => {
                            const d = p.payload as { width: number; height: number };
                            const selected = selectedPresetId === p.id;
                            return (
                              <div key={p.id} className={`group relative ${cardBase} ${selected ? cardSelected : cardIdle}`}>
                                <button
                                  type="button"
                                  role="option"
                                  aria-selected={selected}
                                  disabled={starting}
                                  className="w-full text-left"
                                  onClick={() => chooseUserPreset(p)}
                                >
                                  <div className="truncate text-[12.5px] font-medium text-[#1F1F1F] dark:text-[#ededed]">
                                    {p.name}
                                    {p.isDefault ? " · default" : ""}
                                  </div>
                                  <div className="font-mono text-[10.5px] text-[#7E7E7E]">
                                    {d.width} × {d.height}
                                  </div>
                                </button>
                                {renamingId === p.id ? (
                                  <input
                                    autoFocus
                                    className={`${fieldInput} !mt-1 !py-1 text-[12px]`}
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Escape") setRenamingId(null);
                                      if (e.key === "Enter") void renamePreset(p.id, renameValue.trim());
                                    }}
                                    onBlur={() => {
                                      if (renameValue.trim()) void renamePreset(p.id, renameValue.trim());
                                      else setRenamingId(null);
                                    }}
                                  />
                                ) : (
                                  <div className="absolute right-1 top-1">
                                    <PresetMenu
                                      disabled={starting}
                                      onRename={() => {
                                        setRenamingId(p.id);
                                        setRenameValue(p.name);
                                      }}
                                      onDelete={() => void deletePreset(p.id)}
                                      onDefault={() => void setDefaultPreset(p.id)}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })
                      : devicesInTab.map((d) => {
                          const selected = prefs.devicePreset === d.id && !deviceEdit && !selectedPresetId;
                          const sizeLabel =
                            d.id === "custom" ? `${prefs.width} × ${prefs.height}` : `${d.width} × ${d.height}`;
                          return (
                            <button
                              key={d.id}
                              type="button"
                              role="option"
                              aria-selected={selected}
                              disabled={starting}
                              onClick={() => chooseDevice(d.id)}
                              className={`${cardBase} ${selected || (d.id === "custom" && isCustom && !selectedPresetId) ? cardSelected : cardIdle}`}
                            >
                              <div className="flex items-start gap-2">
                                <DeviceIcon category={d.category} className="mt-0.5 shrink-0 text-[#8664F2]" />
                                <div className="min-w-0">
                                  <div className="truncate text-[12.5px] font-medium text-[#1F1F1F] dark:text-[#ededed]">
                                    {d.label}
                                  </div>
                                  <div className="font-mono text-[10.5px] text-[#7E7E7E]">{sizeLabel}</div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                    {category === "mine" && myDevicePresets.length === 0 && (
                      <p className="col-span-full text-[12px] text-[#7E7E7E]">
                        No saved device presets yet. Customize a size and use Save as preset.
                      </p>
                    )}
                    {category !== "mine" && devicesInTab.length === 0 && (
                      <p className="col-span-full text-[12px] text-[#7E7E7E]">No presets match.</p>
                    )}
                  </div>

                  {!isCustom && entry && entry.id !== "custom" && (
                    <p className="mt-2 text-[12px] text-[#5E6066] dark:text-[#9ca3af]">
                      <span className="font-mono">
                        {prefs.width} × {prefs.height}
                      </span>
                      <button
                        type="button"
                        className="ml-2 text-[#8664F2] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8664F2]"
                        onClick={() => {
                          setDeviceEdit(true);
                          setPrefs((p) => setCustomSize(p, p.width, p.height));
                          setCategory("custom");
                        }}
                        disabled={starting}
                      >
                        Edit as custom
                      </button>
                    </p>
                  )}

                  {isCustom && (
                    <div className="mt-3 space-y-2 rounded-[10px] border border-dashed border-[#C4B5FD] bg-[#FAFAFF] p-3 dark:border-[#5b4a9a] dark:bg-[#12101a]">
                      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                        <div>
                          <label className={fieldLabel} htmlFor="viewport-w">
                            Width (px)
                          </label>
                          <input
                            id="viewport-w"
                            type="number"
                            min={VIEWPORT.widthMin}
                            max={VIEWPORT.widthMax}
                            className={fieldInput}
                            value={prefs.width}
                            onChange={(e) => onWidthHeight(Number(e.target.value) || VIEWPORT.widthMin, prefs.height)}
                            disabled={starting}
                          />
                        </div>
                        <button
                          type="button"
                          className="mb-1 rounded-md border border-[#E5E7EB] p-2 text-[#8664F2] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8664F2] dark:border-[#2a2a2a] dark:hover:bg-[#1a1a1a]"
                          aria-label="Swap width and height"
                          disabled={starting}
                          onClick={() => onWidthHeight(prefs.height, prefs.width)}
                        >
                          <TbRefresh size={16} className={rotating && motionOk() ? "animate-spin" : ""} />
                        </button>
                        <div>
                          <label className={fieldLabel} htmlFor="viewport-h">
                            Height (px)
                          </label>
                          <input
                            id="viewport-h"
                            type="number"
                            min={VIEWPORT.heightMin}
                            max={VIEWPORT.heightMax}
                            className={fieldInput}
                            value={prefs.height}
                            onChange={(e) => onWidthHeight(prefs.width, Number(e.target.value) || VIEWPORT.heightMin)}
                            disabled={starting}
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {BREAKPOINT_CHIPS.map((w) => (
                          <button
                            key={w}
                            type="button"
                            disabled={starting}
                            onClick={() => onWidthHeight(w, Math.round(w * (prefs.height / prefs.width)))}
                            className="rounded-full border border-[#E5E7EB] bg-white px-2 py-0.5 font-mono text-[11px] text-[#5E6066] transition-colors hover:border-[#8664F2] hover:text-[#8664F2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8664F2] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] dark:text-[#9ca3af]"
                          >
                            {w}
                          </button>
                        ))}
                      </div>
                      {savingKind === "device" ? (
                        <InlineSaveName
                          kind="device"
                          disabled={starting}
                          onCancel={() => setSavingKind(null)}
                          onSave={(name) => createPreset("device", name)}
                        />
                      ) : (
                        <button
                          type="button"
                          disabled={starting || atLimit}
                          className="text-[12px] font-medium text-[#8664F2] underline-offset-2 hover:underline disabled:opacity-50"
                          onClick={() => setSavingKind("device")}
                        >
                          Save as preset
                        </button>
                      )}
                      <p className="text-[11px] text-[#7E7E7E]">
                        Clamped {VIEWPORT.widthMin}–{VIEWPORT.widthMax} × {VIEWPORT.heightMin}–{VIEWPORT.heightMax}. Drag
                        preview edges/corner to resize (Shift = free, no snap).
                      </p>
                    </div>
                  )}
                </section>

                <section>
                  <span className="text-[14px] font-medium text-[#1F1F1F] dark:text-[#ededed]">Orientation</span>
                  <div
                    role="group"
                    aria-label="Orientation"
                    className="mt-2 inline-flex rounded-[10px] border border-[#E5E7EB] p-0.5 dark:border-[#2a2a2a]"
                  >
                    {(["portrait", "landscape"] as const).map((o) => (
                      <button
                        key={o}
                        type="button"
                        aria-pressed={prefs.orientation === o}
                        disabled={starting}
                        onClick={() => onOrient(o)}
                        className={`inline-flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[12.5px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8664F2] ${
                          prefs.orientation === o
                            ? "bg-[#8664F2] text-white"
                            : "text-[#5E6066] hover:bg-[#F3F4F6] dark:text-[#9ca3af] dark:hover:bg-[#1a1a1a]"
                        }`}
                      >
                        <TbRotate
                          size={14}
                          className={`transition-transform duration-150 ${o === "landscape" ? "rotate-90" : ""} ${
                            rotating && prefs.orientation === o && motionOk() ? "rotate-[180deg]" : ""
                          }`}
                        />
                        {o === "portrait" ? "Portrait" : "Landscape"}
                      </button>
                    ))}
                  </div>
                </section>

                <section>
                  <span className="text-[14px] font-medium text-[#1F1F1F] dark:text-[#ededed]">Network</span>
                  <div role="listbox" aria-label="Network profile" className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {NETWORK_CATALOG.map((n) => {
                      const selected = prefs.networkPreset === n.id && !selectedPresetId;
                      return (
                        <button
                          key={n.id}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          disabled={starting}
                          onClick={() => patchNetwork(n.id)}
                          className={`${cardBase} ${selected ? cardSelected : cardIdle}`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <NetworkIcon id={n.id} className="text-[#8664F2]" />
                            <SignalBars strength={networkStrength(n.id)} />
                          </div>
                          <div className="mt-1.5 text-[12px] font-medium text-[#1F1F1F] dark:text-[#ededed]">
                            {n.label}
                          </div>
                          <div className="mt-0.5 text-[10px] leading-snug text-[#7E7E7E]">
                            {n.id === "none"
                              ? "Full speed"
                              : n.offline
                                ? "No network"
                                : `↓ ${formatRate(n.downloadKbps)} · ↑ ${formatRate(n.uploadKbps)} · ${n.latencyMs} ms`}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {(myNetworkPresets.length > 0 || mySetupPresets.length > 0) && (
                    <div className="mt-3">
                      <div className="mb-1.5 text-[12px] font-medium text-[#5E6066] dark:text-[#9ca3af]">
                        My profiles
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {[...myNetworkPresets, ...mySetupPresets].map((p) => (
                          <div
                            key={p.id}
                            className={`group relative inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] ${
                              selectedPresetId === p.id
                                ? "border-[#8664F2] bg-[#F5F0FF] text-[#8664F2]"
                                : "border-[#E5E7EB] bg-white text-[#5E6066] dark:border-[#2a2a2a] dark:bg-[#0a0a0a]"
                            }`}
                          >
                            <button
                              type="button"
                              disabled={starting}
                              onClick={() => chooseUserPreset(p)}
                              className="max-w-[140px] truncate"
                            >
                              {p.name}
                              {p.kind === "setup" ? " · setup" : ""}
                              {p.isDefault ? " ★" : ""}
                            </button>
                            <PresetMenu
                              disabled={starting}
                              onRename={() => {
                                setRenamingId(p.id);
                                setRenameValue(p.name);
                              }}
                              onDelete={() => void deletePreset(p.id)}
                              onDefault={() => void setDefaultPreset(p.id)}
                            />
                          </div>
                        ))}
                      </div>
                      {renamingId &&
                        [...myNetworkPresets, ...mySetupPresets].some((p) => p.id === renamingId) && (
                          <input
                            autoFocus
                            className={`${fieldInput} mt-2 max-w-[220px] !py-1 text-[12px]`}
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") setRenamingId(null);
                              if (e.key === "Enter") void renamePreset(renamingId, renameValue.trim());
                            }}
                            onBlur={() => {
                              if (renameValue.trim()) void renamePreset(renamingId, renameValue.trim());
                              else setRenamingId(null);
                            }}
                          />
                        )}
                    </div>
                  )}

                  {prefs.networkPreset === "offline" && (
                    <p className="mt-2 rounded-[8px] border border-[#FCD34D] bg-[#FFFBEB] px-2.5 py-1.5 text-[12px] text-[#92400E] dark:border-[#854d0e] dark:bg-[#1c1408] dark:text-[#FCD34D]">
                      Pages will not load while offline. Use it only to record offline behaviour.
                    </p>
                  )}

                  {prefs.networkPreset === "custom" && (
                    <div className="mt-2 space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className={fieldLabel} htmlFor="down-kbps">
                            Down (kbps)
                          </label>
                          <input
                            id="down-kbps"
                            type="number"
                            min={0}
                            max={100000}
                            className={fieldInput}
                            value={prefs.downloadKbps}
                            onChange={(e) =>
                              setPrefs((p) => normalizePrefs({ ...p, downloadKbps: Number(e.target.value) || 0 }))
                            }
                            disabled={starting}
                          />
                        </div>
                        <div>
                          <label className={fieldLabel} htmlFor="up-kbps">
                            Up (kbps)
                          </label>
                          <input
                            id="up-kbps"
                            type="number"
                            min={0}
                            max={100000}
                            className={fieldInput}
                            value={prefs.uploadKbps}
                            onChange={(e) =>
                              setPrefs((p) => normalizePrefs({ ...p, uploadKbps: Number(e.target.value) || 0 }))
                            }
                            disabled={starting}
                          />
                        </div>
                        <div>
                          <label className={fieldLabel} htmlFor="latency">
                            Latency (ms)
                          </label>
                          <input
                            id="latency"
                            type="number"
                            min={0}
                            max={60000}
                            className={fieldInput}
                            value={prefs.latencyMs}
                            onChange={(e) =>
                              setPrefs((p) => normalizePrefs({ ...p, latencyMs: Number(e.target.value) || 0 }))
                            }
                            disabled={starting}
                          />
                        </div>
                      </div>
                      {savingKind === "network" ? (
                        <InlineSaveName
                          kind="network"
                          disabled={starting}
                          onCancel={() => setSavingKind(null)}
                          onSave={(name) => createPreset("network", name)}
                        />
                      ) : (
                        <button
                          type="button"
                          disabled={starting || atLimit}
                          className="text-[12px] font-medium text-[#8664F2] underline-offset-2 hover:underline disabled:opacity-50"
                          onClick={() => setSavingKind("network")}
                        >
                          Save as preset
                        </button>
                      )}
                    </div>
                  )}

                  <div className="mt-3">
                    {savingKind === "setup" ? (
                      <InlineSaveName
                        kind="setup"
                        disabled={starting}
                        onCancel={() => setSavingKind(null)}
                        onSave={(name) => createPreset("setup", name)}
                      />
                    ) : (
                      <button
                        type="button"
                        disabled={starting || atLimit}
                        className="text-[12px] font-medium text-[#8664F2] underline-offset-2 hover:underline disabled:opacity-50"
                        onClick={() => setSavingKind("setup")}
                      >
                        Save current setup
                      </button>
                    )}
                  </div>
                </section>

                {configError && <p className="text-[12px] text-[#B45309]">{configError}</p>}
              </div>

              <div className="flex min-h-[360px] flex-col">
                <DevicePreviewFrame
                  width={prefs.width}
                  height={prefs.height}
                  orientation={prefs.orientation}
                  dpr={dpr}
                  frameKind={isCustom ? "custom" : frameKind}
                  editable={isCustom}
                  disabled={starting}
                  rotating={rotating}
                  motionOk={motionOk()}
                  onSizeChange={onWidthHeight}
                />
                <p className="mt-3 max-w-full truncate text-center text-[12px] text-[#5E6066] dark:text-[#9ca3af]">
                  {summaryLine(prefs)}
                </p>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#D9D9D9] bg-white px-5 py-3.5 dark:border-[#2a2a2a] dark:bg-[#141414] sm:px-7">
            <button
              type="button"
              className="text-[13px] text-[#5E6066] underline-offset-2 hover:text-[#8664F2] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8664F2] disabled:opacity-50 dark:text-[#9ca3af]"
              onClick={reset}
              disabled={starting}
            >
              Reset to default
            </button>
            <div className="flex gap-3">
              <button type="button" className={outlineButton} onClick={onClose} disabled={starting}>
                Cancel
              </button>
              <button type="submit" className={primaryButton} disabled={starting || !appUrl}>
                {starting ? "Starting…" : "Start recording"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
