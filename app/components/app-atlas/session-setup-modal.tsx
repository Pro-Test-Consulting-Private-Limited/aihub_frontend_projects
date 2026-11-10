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
  TbBookmark,
  TbCopy,
  TbExternalLink,
  TbLock,
  TbLockOpen,
  TbRefresh,
  TbRotate,
  TbWifiOff,
  TbWorld,
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
  type DeviceCategory,
  type Orientation,
  type SessionEmulationPrefs,
} from "@/app/lib/session-emulation";
import {
  PRESET_SAVE_SOFT_FAIL,
  USER_PRESET_MAX,
  applyUserPreset,
  devicePayloadFromPrefs,
  isLocalPresetId,
  loadPresetCache,
  makeLocalPreset,
  nameTaken,
  networkPayloadFromPrefs,
  resolveResetPrefs,
  savePresetCache,
  setupPayloadFromPrefs,
  type PresetKind,
  type UserRecordingPreset,
} from "@/app/lib/user-recording-presets";
import {
  isCardSelected,
  selectionAfterSizeEdit,
  selectionFromPrefs,
  showCustomPanel,
  tabForSelection,
  type DeviceSelection,
  type DeviceTab,
} from "@/app/lib/session-setup-selection";
import {
  RATIO_CHIPS,
  applyLockedDimension,
  loadLockRatio,
  ratioLabel,
  saveLockRatio,
  sizeFromRatio,
  type SizeByMode,
} from "@/app/lib/viewport-ratio";
import {
  RESOLUTION_PRESETS,
  myScreenSize,
  sizeCardSubtitle,
  sizeFromResolution,
  sizePrimaryLabel,
  thisWindowSize,
} from "@/app/lib/viewport-resolution";
import {
  PERSONA_CITIES,
  PERSONA_LOCALES,
  loadPersona,
  personaSummary,
  personaToSessionFields,
  savePersona,
  type PersonaPrefs,
} from "@/app/lib/persona";
import type { AtlasClient } from "@/app/services/appatlas";
import { DevicePreviewFrame } from "./device-preview-frame";
import { LiveUrlPreview } from "./live-url-preview";
import { fieldInput, fieldLabel, outlineButton, primaryButton } from "./modal";

type CategoryTab = DeviceTab;

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
  onStart: (prefs: SessionEmulationPrefs, personaFields?: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [prefs, setPrefs] = useState<SessionEmulationPrefs>(() => loadEmulationPrefs(projectId));
  const [selection, setSelection] = useState<DeviceSelection>(() => selectionFromPrefs(loadEmulationPrefs(projectId)));
  const [category, setCategory] = useState<CategoryTab>(() =>
    tabForSelection(selectionFromPrefs(loadEmulationPrefs(projectId)), loadEmulationPrefs(projectId)),
  );
  const [search, setSearch] = useState("");
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
  const [sizeBy, setSizeBy] = useState<SizeByMode>("pixels");
  const [lockRatio, setLockRatio] = useState(false);
  const [sizeHint, setSizeHint] = useState<string | null>(null);
  const [persona, setPersona] = useState(() => loadPersona());
  const [personaOpen, setPersonaOpen] = useState(false);
  const [savedLogins, setSavedLogins] = useState<Array<{ id: string; roleLabel: string; origin: string; expiresInLabel: string }>>([]);
  const [savedLoginId, setSavedLoginId] = useState("");
  const [recordAsOpen, setRecordAsOpen] = useState(false);
  const [personaClock, setPersonaClock] = useState("");
  /** Compact density: smaller preview, tighter rows, persona groups on one row — auto under 900px viewport height. */
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const read = () => {
      const force = typeof document !== "undefined" ? document.documentElement.dataset.appatlasDensity : undefined;
      if (force === "comfortable") {
        setCompact(false);
        return;
      }
      if (force === "compact") {
        setCompact(true);
        return;
      }
      setCompact(window.matchMedia("(max-height: 900px)").matches);
    };
    read();
    const mq = window.matchMedia("(max-height: 900px)");
    mq.addEventListener("change", read);
    window.addEventListener("appatlas-density", read);
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-appatlas-density"] });
    return () => {
      mq.removeEventListener("change", read);
      window.removeEventListener("appatlas-density", read);
      obs.disconnect();
    };
  }, []);

  const syncPresets = useCallback(
    (items: UserRecordingPreset[]) => {
      setPresets(items);
      savePresetCache(userId, items);
    },
    [userId],
  );

  useEffect(() => {
    const loaded = loadEmulationPrefs(projectId);
    const sel = selectionFromPrefs(loaded);
    setPrefs(loaded);
    setSelection(sel);
    setCategory(tabForSelection(sel, loaded));
    setRecent(loadRecentDevices());
    setPreviousViewport(loadCanvasViewport(canvasId));
    setPresets(loadPresetCache(userId));
    setLockRatio(loadLockRatio());
    setSizeBy("pixels");
    setSizeHint(null);
  }, [projectId, canvasId, userId]);

  useEffect(() => {
    let cancelled = false;
    void client
      .listSavedLogins()
      .then((items) => {
        if (!cancelled) setSavedLogins(items);
      })
      .catch(() => {
        if (!cancelled) setSavedLogins([]);
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  useEffect(() => {
    let cancelled = false;
    const syncFromServer = async () => {
      const cached = loadPresetCache(userId);
      // Retry local-only presets from a previous soft-fail.
      let working = cached;
      for (const local of cached.filter((p) => isLocalPresetId(p.id))) {
        try {
          const created = await client.createRecordingPreset({
            kind: local.kind,
            name: local.name,
            payload: local.payload,
          });
          working = working.map((p) => (p.id === local.id ? created : p));
          if (local.isDefault) {
            try {
              await client.setRecordingPresetDefault(created.id);
              working = working.map((p) =>
                p.kind === created.kind ? { ...p, isDefault: p.id === created.id } : p,
              );
            } catch {
              /* keep local default flag */
            }
          }
        } catch {
          break;
        }
      }
      if (cancelled) return;
      try {
        const items = await client.listRecordingPresets();
        if (cancelled) return;
        const stillLocal = working.filter((p) => isLocalPresetId(p.id));
        syncPresets([...items, ...stillLocal]);
      } catch {
        if (!cancelled) syncPresets(working);
      }
    };
    void syncFromServer();
    return () => {
      cancelled = true;
    };
  }, [client, syncPresets, userId]);

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
  const isCustom = showCustomPanel(selection);
  const dpr = isCustom ? prefs.deviceScaleFactor ?? 1 : entry?.dpr ?? 1;
  const atLimit = presets.length >= USER_PRESET_MAX;

  const applySelection = (sel: DeviceSelection, nextPrefs: SessionEmulationPrefs) => {
    setSelection(sel);
    setCategory(tabForSelection(sel, nextPrefs));
    setPrefs(nextPrefs);
  };

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
    const sel: DeviceSelection = id === "custom" ? { kind: "custom" } : { kind: "catalog", id };
    const next = selectDevicePreset(prefs, id);
    applySelection(sel, next);
  };

  const chooseUserPreset = (preset: UserRecordingPreset) => {
    setSelectedPresetId(preset.id);
    const next = applyUserPreset(prefs, preset);
    if (preset.kind === "device" || preset.kind === "setup") {
      applySelection({ kind: "mine", presetId: preset.id }, next);
    } else {
      setPrefs(next);
    }
  };

  const onOrient = (orientation: Orientation) => {
    if (motionOk()) {
      setRotating(true);
      window.setTimeout(() => setRotating(false), 180);
    }
    setSelectedPresetId(null);
    setPrefs((p) => setOrientation(p, orientation));
  };

  const onWidthHeight = (width: number, height: number, opts?: { fromLock?: boolean }) => {
    setSelectedPresetId(null);
    let w = width;
    let h = height;
    if (lockRatio && !opts?.fromLock) {
      const onlyW = width !== prefs.width && height === prefs.height;
      const onlyH = height !== prefs.height && width === prefs.width;
      if (onlyW || onlyH) {
        const locked = applyLockedDimension(
          { width: prefs.width, height: prefs.height },
          onlyW ? { width } : { height },
        );
        w = locked.width;
        h = locked.height;
        setSizeHint(locked.limited ? "Limited by min/max size" : null);
      } else {
        setSizeHint(null);
      }
    } else {
      setSizeHint(null);
    }
    const next = setCustomSize(prefs, w, h);
    const sel = selectionAfterSizeEdit(next.width, next.height, next.orientation);
    applySelection(sel, sel.kind === "catalog" ? selectDevicePreset(next, sel.id) : next);
  };

  const toggleLockRatio = () => {
    setLockRatio((on) => {
      const next = !on;
      saveLockRatio(next);
      return next;
    });
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
      setPresetMsg("Saved to My presets");
      if (kind === "device") applySelection({ kind: "mine", presetId: created.id }, prefs);
    } catch {
      const local = makeLocalPreset(kind, name, payload);
      syncPresets([...presets, local]);
      setSelectedPresetId(local.id);
      setSavingKind(null);
      setPresetMsg(PRESET_SAVE_SOFT_FAIL);
      if (kind === "device") applySelection({ kind: "mine", presetId: local.id }, prefs);
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
    savePersona(persona);
    onStart(next, {
      ...personaToSessionFields(persona),
      ...(savedLoginId ? { savedLoginId } : {}),
    });
  };

  const updatePersona = (patch: Partial<PersonaPrefs>) => {
    setPersona((p) => {
      const next = { ...p, ...patch };
      if (patch.locale) {
        const loc = PERSONA_LOCALES.find((l) => l.id === patch.locale);
        if (loc) next.timezoneId = loc.timezone;
      }
      if (patch.geoId) {
        const city = PERSONA_CITIES.find((c) => c.id === patch.geoId);
        if (city) next.timezoneId = city.timezone;
      }
      savePersona(next);
      return next;
    });
  };

  useEffect(() => {
    const tick = () => {
      try {
        setPersonaClock(
          new Intl.DateTimeFormat(persona.locale || "en-US", {
            timeZone: persona.timezoneId || "UTC",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }).format(new Date()),
        );
      } catch {
        setPersonaClock("");
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [persona.locale, persona.timezoneId]);

  const reset = () => {
    setSelectedPresetId(null);
    const next = resolveResetPrefs(presets);
    const sel = selectionFromPrefs(next);
    applySelection(sel, next);
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
        data-density={compact ? "compact" : "comfortable"}
        className={`flex max-h-[calc(100vh-48px)] w-full max-w-[1040px] flex-col overflow-hidden rounded-[16px] bg-white shadow-xl dark:bg-[#141414] ${
          compact ? "text-[12px]" : ""
        }`}
      >
        <div
          className={`flex shrink-0 flex-col border-b border-[#D9D9D9] dark:border-[#2a2a2a] ${
            compact ? "gap-1 px-3 py-1.5 sm:px-4" : "gap-2 px-5 py-3 sm:px-6"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <h2
              id={titleId}
              className={`font-semibold text-[#1F1F1F] dark:text-[#ededed] ${compact ? "text-[15px]" : "text-[18px]"}`}
            >
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
          <div className="flex min-w-0 items-center gap-2 rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-2.5 py-2 dark:border-[#2a2a2a] dark:bg-[#0a0a0a]">
            <TbWorld size={18} className="shrink-0 text-[#8664F2]" />
            <div className="min-w-0 flex-1 truncate text-[14px] text-[#1F1F1F] dark:text-[#ededed]" title={appUrl}>
              {appUrl || "No application URL"}
            </div>
            <button
              type="button"
              className="rounded p-1.5 text-[#5E6066] hover:bg-white hover:text-[#8664F2] dark:hover:bg-[#1a1a1a]"
              aria-label="Copy URL"
              disabled={!appUrl}
              onClick={() => void navigator.clipboard.writeText(appUrl)}
            >
              <TbCopy size={16} />
            </button>
            <a
              href={appUrl || undefined}
              target="_blank"
              rel="noreferrer"
              aria-label="Open in new tab"
              className={`rounded p-1.5 text-[#5E6066] hover:bg-white hover:text-[#8664F2] dark:hover:bg-[#1a1a1a] ${!appUrl ? "pointer-events-none opacity-40" : ""}`}
            >
              <TbExternalLink size={16} />
            </a>
          </div>
          {presetMsg && (
            <p className="rounded-[8px] border border-[#C4B5FD] bg-[#F5F0FF] px-2.5 py-1.5 text-[12px] text-[#5B3FD1]">
              {presetMsg}
            </p>
          )}
          {atLimit && (
            <p className="rounded-[8px] border border-[#FCD34D] bg-[#FFFBEB] px-2.5 py-1.5 text-[12px] text-[#92400E]">
              You have {USER_PRESET_MAX} presets (the limit). Delete one to save another.
            </p>
          )}
        </div>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div
            className={`min-h-0 flex-1 overflow-hidden ${
              compact ? "px-3 py-1.5 sm:px-4" : "px-5 py-3 sm:px-6"
            }`}
          >
            <div
              className={`grid h-full grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)] ${
                compact ? "gap-1.5" : "gap-4"
              }`}
            >
              <div className={`min-w-0 overflow-hidden ${compact ? "space-y-1 max-h-full" : "space-y-3"}`}>
                <section>
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-medium text-[#1F1F1F] dark:text-[#ededed]">Device</span>
                      <div
                        role="group"
                        aria-label="Orientation"
                        className="inline-flex rounded-[8px] border border-[#E5E7EB] p-0.5 dark:border-[#2a2a2a]"
                      >
                        {(["portrait", "landscape"] as const).map((o) => (
                          <button
                            key={o}
                            type="button"
                            aria-pressed={prefs.orientation === o}
                            disabled={starting}
                            onClick={() => onOrient(o)}
                            className={`inline-flex items-center gap-1 rounded-[6px] px-2 py-0.5 text-[11px] font-medium ${
                              prefs.orientation === o
                                ? "bg-[#8664F2] text-white"
                                : "text-[#5E6066] hover:bg-[#F3F4F6] dark:text-[#9ca3af]"
                            }`}
                          >
                            <TbRotate size={12} className={o === "landscape" ? "rotate-90" : ""} />
                            {o === "portrait" ? "Portrait" : "Landscape"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search…"
                      className={`${fieldInput} !mt-0 max-w-[140px] !py-1 text-[12px]`}
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
                  <div
                    role="listbox"
                    aria-label="Device presets"
                    className={`grid grid-cols-2 sm:grid-cols-3 ${compact ? "max-h-[64px] gap-1 overflow-hidden" : "gap-2"}`}
                  >
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
                                    {sizeCardSubtitle(d.width, d.height)}
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
                          const selected = isCardSelected(selection, d.id) && !selectedPresetId;
                          const sizeLabel =
                            d.id === "custom"
                              ? sizeCardSubtitle(prefs.width, prefs.height)
                              : sizeCardSubtitle(d.width, d.height);
                          return (
                            <button
                              key={d.id}
                              type="button"
                              role="option"
                              aria-selected={selected}
                              disabled={starting}
                              onClick={() => chooseDevice(d.id)}
                              className={`${cardBase} ${selected ? cardSelected : cardIdle}`}
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
                          const next = setCustomSize(prefs, prefs.width, prefs.height);
                          applySelection({ kind: "custom" }, next);
                        }}
                        disabled={starting}
                      >
                        Edit as custom
                      </button>
                    </p>
                  )}

                  {isCustom && (
                    <div className="mt-2 space-y-1.5 rounded-[10px] border border-dashed border-[#C4B5FD] bg-[#FAFAFF] p-2.5 dark:border-[#5b4a9a] dark:bg-[#12101a]">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <div
                          role="tablist"
                          aria-label="Size by"
                          className="inline-flex rounded-full border border-[#E5E7EB] bg-white p-0.5 dark:border-[#2a2a2a] dark:bg-[#0a0a0a]"
                        >
                          {(
                            [
                              ["pixels", "Pixels"],
                              ["ratio", "Ratio"],
                              ["resolution", "Resolution"],
                            ] as const
                          ).map(([id, label]) => (
                            <button
                              key={id}
                              type="button"
                              role="tab"
                              aria-selected={sizeBy === id}
                              disabled={starting}
                              onClick={() => setSizeBy(id)}
                              className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                                sizeBy === id
                                  ? "bg-[#8664F2] text-white"
                                  : "text-[#5E6066] hover:text-[#8664F2] dark:text-[#9ca3af]"
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          title={lockRatio ? "Unlock ratio" : "Lock ratio"}
                          aria-pressed={lockRatio}
                          disabled={starting}
                          onClick={toggleLockRatio}
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                            lockRatio
                              ? "border-[#8664F2] bg-[#F5F0FF] text-[#8664F2]"
                              : "border-[#E5E7EB] bg-white text-[#5E6066] dark:border-[#2a2a2a] dark:bg-[#0a0a0a]"
                          }`}
                        >
                          {lockRatio ? <TbLock size={12} /> : <TbLockOpen size={12} />}
                          Lock
                        </button>
                        <span className="font-mono text-[11px] text-[#7E7E7E]">{ratioLabel(prefs.width, prefs.height)}</span>
                      </div>

                      {sizeBy === "pixels" && (
                        <>
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
                              onClick={() => onWidthHeight(prefs.height, prefs.width, { fromLock: true })}
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
                          <div className="flex flex-wrap gap-1">
                            {BREAKPOINT_CHIPS.map((w) => (
                              <button
                                key={w}
                                type="button"
                                disabled={starting}
                                onClick={() => {
                                  if (lockRatio) {
                                    const locked = applyLockedDimension(
                                      { width: prefs.width, height: prefs.height },
                                      { width: w },
                                    );
                                    onWidthHeight(locked.width, locked.height, { fromLock: true });
                                    setSizeHint(locked.limited ? "Limited by min/max size" : null);
                                  } else {
                                    onWidthHeight(w, Math.round(w * (prefs.height / prefs.width)), { fromLock: true });
                                  }
                                }}
                                className="rounded-full border border-[#E5E7EB] bg-white px-2 py-0.5 font-mono text-[11px] text-[#5E6066] transition-colors hover:border-[#8664F2] hover:text-[#8664F2] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] dark:text-[#9ca3af]"
                              >
                                {w}
                              </button>
                            ))}
                          </div>
                        </>
                      )}

                      {sizeBy === "ratio" && (
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap gap-1">
                            {RATIO_CHIPS.map((chip) => {
                              const sized = sizeFromRatio(prefs.width, chip, prefs.orientation);
                              const active =
                                Math.abs(prefs.width / prefs.height - sized.width / sized.height) < 0.02;
                              return (
                                <button
                                  key={chip.id}
                                  type="button"
                                  disabled={starting}
                                  onClick={() => {
                                    const r = sizeFromRatio(prefs.width, chip, prefs.orientation);
                                    onWidthHeight(r.width, r.height, { fromLock: true });
                                    setSizeHint(r.limited ? "Limited by min/max size" : null);
                                  }}
                                  className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                                    active
                                      ? "border-[#8664F2] bg-[#F5F0FF] text-[#8664F2]"
                                      : "border-[#E5E7EB] bg-white text-[#5E6066] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] dark:text-[#9ca3af]"
                                  }`}
                                >
                                  {chip.label}
                                </button>
                              );
                            })}
                          </div>
                          <label
                            className={`items-center gap-2 text-[11px] text-[#5E6066] ${compact ? "hidden" : "flex"}`}
                          >
                            <span className="shrink-0">Width</span>
                            <input
                              type="range"
                              min={VIEWPORT.widthMin}
                              max={VIEWPORT.widthMax}
                              value={prefs.width}
                              disabled={starting}
                              onChange={(e) => {
                                const chip =
                                  RATIO_CHIPS.find((c) => {
                                    const r = sizeFromRatio(prefs.width, c, prefs.orientation);
                                    return Math.abs(prefs.width / prefs.height - r.width / r.height) < 0.02;
                                  }) ?? RATIO_CHIPS[0];
                                const r = sizeFromRatio(Number(e.target.value), chip, prefs.orientation);
                                onWidthHeight(r.width, r.height, { fromLock: true });
                                setSizeHint(r.limited ? "Limited by min/max size" : null);
                              }}
                              className="min-w-0 flex-1"
                            />
                            <span className="w-10 shrink-0 font-mono text-right">{prefs.width}</span>
                          </label>
                        </div>
                      )}

                      {sizeBy === "resolution" && (
                        <div className="flex flex-wrap gap-1">
                          {RESOLUTION_PRESETS.map((p) => {
                            const sized = sizeFromResolution(p, prefs.orientation);
                            const active = prefs.width === sized.width && prefs.height === sized.height;
                            return (
                              <button
                                key={p.id}
                                type="button"
                                disabled={starting}
                                title={`${sized.width} × ${sized.height}`}
                                onClick={() => {
                                  onWidthHeight(sized.width, sized.height, { fromLock: true });
                                  setSizeHint(null);
                                }}
                                className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                                  active
                                    ? "border-[#8664F2] bg-[#F5F0FF] text-[#8664F2]"
                                    : "border-[#E5E7EB] bg-white text-[#5E6066] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] dark:text-[#9ca3af]"
                                }`}
                              >
                                {p.label}
                              </button>
                            );
                          })}
                          <button
                            type="button"
                            disabled={starting}
                            onClick={() => {
                              const s = myScreenSize();
                              const sized =
                                prefs.orientation === "portrait" && s.width > s.height
                                  ? { width: s.height, height: s.width }
                                  : prefs.orientation === "landscape" && s.height > s.width
                                    ? { width: s.height, height: s.width }
                                    : s;
                              onWidthHeight(sized.width, sized.height, { fromLock: true });
                            }}
                            className="rounded-full border border-[#E5E7EB] bg-white px-2 py-0.5 text-[11px] font-medium text-[#5E6066] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] dark:text-[#9ca3af]"
                          >
                            My screen
                          </button>
                          <button
                            type="button"
                            disabled={starting}
                            onClick={() => {
                              const s = thisWindowSize();
                              const sized =
                                prefs.orientation === "portrait" && s.width > s.height
                                  ? { width: s.height, height: s.width }
                                  : prefs.orientation === "landscape" && s.height > s.width
                                    ? { width: s.height, height: s.width }
                                    : s;
                              onWidthHeight(sized.width, sized.height, { fromLock: true });
                            }}
                            className="rounded-full border border-[#E5E7EB] bg-white px-2 py-0.5 text-[11px] font-medium text-[#5E6066] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] dark:text-[#9ca3af]"
                          >
                            This window
                          </button>
                        </div>
                      )}

                      {!compact && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-[#7E7E7E]">Density</span>
                          {[1, 2, 3].map((d) => (
                            <button
                              key={d}
                              type="button"
                              disabled={starting}
                              onClick={() =>
                                setPrefs((p) => normalizePrefs({ ...p, devicePreset: "custom", deviceScaleFactor: d }))
                              }
                              className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                                (prefs.deviceScaleFactor ?? 1) === d
                                  ? "border-[#8664F2] bg-[#F5F0FF] text-[#8664F2]"
                                  : "border-[#E5E7EB] bg-white text-[#5E6066] dark:border-[#2a2a2a] dark:bg-[#0a0a0a]"
                              }`}
                            >
                              {d}x
                            </button>
                          ))}
                          {(prefs.deviceScaleFactor ?? 1) > 1 && (
                            <span className="text-[10px] text-[#7E7E7E]">2x/3x make screenshots larger</span>
                          )}
                        </div>
                      )}

                      {sizeHint && <p className="text-[11px] text-[#B45309]">{sizeHint}</p>}

                      {!compact && (
                        <div className="flex flex-wrap items-center gap-2">
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
                              className={`${outlineButton} !inline-flex !items-center !gap-1.5 !px-3 !py-1.5 !text-[12px]`}
                              onClick={() => setSavingKind("device")}
                            >
                              <TbBookmark size={14} />
                              Save device preset
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </section>

                <section>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 text-left"
                    onClick={() => setPersonaOpen((o) => !o)}
                    aria-expanded={personaOpen}
                  >
                    <span className="text-[13px] font-medium text-[#1F1F1F] dark:text-[#ededed]">Persona</span>
                    <span className="truncate text-[11px] text-[#7E7E7E]">{personaSummary(persona)}</span>
                  </button>
                  {personaOpen && (
                    <div
                      className={`mt-1 rounded-[10px] border border-[#E5E7EB] bg-[#FAFAFA] dark:border-[#2a2a2a] dark:bg-[#121212] ${
                        compact
                          ? "flex flex-nowrap items-center gap-1 overflow-x-auto p-1.5"
                          : "space-y-1.5 p-2"
                      }`}
                    >
                      <div className={`flex gap-1 ${compact ? "shrink-0 flex-nowrap" : "flex-wrap"}`}>
                        {(["light", "dark", "no-preference"] as const).map((c) => (
                          <button
                            key={c}
                            type="button"
                            disabled={starting}
                            onClick={() => updatePersona({ colorScheme: c })}
                            className={`rounded-full border px-2 py-0.5 text-[11px] ${
                              persona.colorScheme === c
                                ? "border-[#8664F2] bg-[#F5F0FF] text-[#8664F2]"
                                : "border-[#E5E7EB] bg-white text-[#5E6066] dark:border-[#2a2a2a] dark:bg-[#0a0a0a]"
                            }`}
                          >
                            {c === "no-preference" ? "System" : c === "dark" ? "Dark" : "Light"}
                          </button>
                        ))}
                        <button
                          type="button"
                          disabled={starting}
                          onClick={() => updatePersona({ reducedMotion: !persona.reducedMotion })}
                          className={`rounded-full border px-2 py-0.5 text-[11px] ${
                            persona.reducedMotion
                              ? "border-[#8664F2] bg-[#F5F0FF] text-[#8664F2]"
                              : "border-[#E5E7EB] bg-white text-[#5E6066] dark:border-[#2a2a2a]"
                          }`}
                        >
                          Reduced motion
                        </button>
                      </div>
                      <div className={`flex gap-1 ${compact ? "shrink-0 flex-nowrap" : "flex-wrap"}`}>
                        {PERSONA_LOCALES.map((l) => (
                          <button
                            key={l.id}
                            type="button"
                            disabled={starting}
                            title={l.label}
                            onClick={() => updatePersona({ locale: l.id })}
                            className={`rounded-full border px-2 py-0.5 text-[11px] ${
                              persona.locale === l.id
                                ? "border-[#8664F2] bg-[#F5F0FF] text-[#8664F2]"
                                : "border-[#E5E7EB] bg-white text-[#5E6066] dark:border-[#2a2a2a]"
                            }`}
                          >
                            {l.flag} {l.id}
                          </button>
                        ))}
                      </div>
                      {!compact && (
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#5E6066]">
                          <span className="font-mono">{personaClock || "—"}</span>
                          <span className="text-[#7E7E7E]">{persona.timezoneId}</span>
                        </div>
                      )}
                      <div className={`flex gap-1 ${compact ? "shrink-0 flex-nowrap" : "flex-wrap"}`}>
                        {PERSONA_CITIES.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            disabled={starting}
                            onClick={() => updatePersona({ geoId: persona.geoId === c.id ? null : c.id })}
                            className={`rounded-full border px-2 py-0.5 text-[11px] ${
                              persona.geoId === c.id
                                ? "border-[#8664F2] bg-[#F5F0FF] text-[#8664F2]"
                                : "border-[#E5E7EB] bg-white text-[#5E6066] dark:border-[#2a2a2a]"
                            }`}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                      <div className={`flex gap-2 text-[11px] text-[#5E6066] ${compact ? "shrink-0 flex-nowrap" : "flex-wrap"}`}>
                        {(
                          [
                            ["permissionLocation", "Location"],
                            ["permissionNotifications", "Notifications"],
                            ["permissionCameraMic", "Camera/mic"],
                          ] as const
                        ).map(([key, label]) => (
                          <label key={key} className="inline-flex items-center gap-1">
                            {label}
                            <select
                              className="rounded border border-[#E5E7EB] bg-white px-1 py-0.5 dark:border-[#2a2a2a] dark:bg-[#0a0a0a]"
                              value={persona[key]}
                              disabled={starting}
                              onChange={(e) =>
                                updatePersona({ [key]: e.target.value as PersonaPrefs[typeof key] })
                              }
                            >
                              <option value="ask">Ask</option>
                              <option value="allow">Allow</option>
                              <option value="deny">Deny</option>
                            </select>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </section>

                <section>
                  <span className="text-[13px] font-medium text-[#1F1F1F] dark:text-[#ededed]">Network</span>
                  <div role="listbox" aria-label="Network profile" className="mt-1.5 flex flex-wrap gap-1.5">
                    {NETWORK_CATALOG.map((n) => {
                      const selected = prefs.networkPreset === n.id && !selectedPresetId;
                      const short =
                        n.id === "none"
                          ? "No throttle"
                          : n.id === "slow-3g"
                            ? "Slow 3G"
                            : n.id === "fast-3g"
                              ? "Fast 3G"
                              : n.label;
                      const tip =
                        n.id === "none"
                          ? "Full speed"
                          : n.offline
                            ? "No network"
                            : `↓ ${formatRate(n.downloadKbps)} · ↑ ${formatRate(n.uploadKbps)} · ${n.latencyMs} ms`;
                      return (
                        <button
                          key={n.id}
                          type="button"
                          role="option"
                          title={tip}
                          aria-selected={selected}
                          disabled={starting}
                          onClick={() => patchNetwork(n.id)}
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] font-medium ${
                            selected
                              ? "border-[#8664F2] bg-[#F5F0FF] text-[#8664F2]"
                              : "border-[#E5E7EB] bg-white text-[#5E6066] hover:border-[#C4B5FD] dark:border-[#2a2a2a] dark:bg-[#0a0a0a]"
                          }`}
                        >
                          <NetworkIcon id={n.id} className="text-[#8664F2]" />
                          {short}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-[11px] text-[#7E7E7E]">
                    {prefs.networkPreset === "none"
                      ? "Full speed"
                      : prefs.networkPreset === "offline"
                        ? "No network"
                        : `↓ ${formatRate(prefs.downloadKbps)} · ↑ ${formatRate(prefs.uploadKbps)} · ${prefs.latencyMs} ms`}
                  </p>

                  <div className="relative mt-3" data-testid="record-as-picker">
                    <div className="mb-1.5 text-[12px] font-medium text-[#5E6066] dark:text-[#9ca3af]">Record as</div>
                    <button
                      type="button"
                      disabled={starting}
                      aria-haspopup="listbox"
                      aria-expanded={recordAsOpen}
                      onClick={() => setRecordAsOpen((o) => !o)}
                      className={`flex w-full items-center justify-between rounded-[8px] border px-3 py-2 text-left text-[12px] ${
                        savedLoginId
                          ? "border-[#8664F2] bg-[#F5F0FF] text-[#5B3FD1]"
                          : "border-[#E5E7EB] bg-white text-[#5E6066] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] dark:text-[#9ca3af]"
                      }`}
                    >
                      <span className="min-w-0 truncate">
                        {savedLoginId
                          ? (() => {
                              const l = savedLogins.find((x) => x.id === savedLoginId);
                              return l
                                ? `${l.roleLabel} · ${l.origin.replace(/^https?:\/\//, "")} · ${l.expiresInLabel}`
                                : "Saved login";
                            })()
                          : "None"}
                      </span>
                      <span className="ml-2 shrink-0 text-[#9ca3af]">{recordAsOpen ? "▴" : "▾"}</span>
                    </button>
                    {recordAsOpen && (
                      <>
                        <button
                          type="button"
                          className="fixed inset-0 z-10 cursor-default"
                          aria-label="Close Record as"
                          onClick={() => setRecordAsOpen(false)}
                        />
                        <ul
                          role="listbox"
                          aria-label="Record as"
                          className="absolute z-20 mt-1 max-h-[220px] w-full overflow-y-auto rounded-[8px] border border-[#E5E7EB] bg-white py-1 text-[12px] shadow-lg dark:border-[#2a2a2a] dark:bg-[#141414]"
                        >
                          <li>
                            <button
                              type="button"
                              role="option"
                              aria-selected={!savedLoginId}
                              className="block w-full px-3 py-2 text-left hover:bg-[#F5F0FF] dark:hover:bg-[#1a1430]"
                              onClick={() => {
                                setSavedLoginId("");
                                setRecordAsOpen(false);
                              }}
                            >
                              None
                            </button>
                          </li>
                          {savedLogins.map((l) => (
                            <li key={l.id} className="group flex items-center gap-1 px-1">
                              <button
                                type="button"
                                role="option"
                                aria-selected={savedLoginId === l.id}
                                className={`min-w-0 flex-1 truncate rounded-[6px] px-2 py-2 text-left hover:bg-[#F5F0FF] dark:hover:bg-[#1a1430] ${
                                  savedLoginId === l.id ? "bg-[#F5F0FF] text-[#5B3FD1]" : ""
                                }`}
                                onClick={() => {
                                  setSavedLoginId(l.id);
                                  setRecordAsOpen(false);
                                }}
                              >
                                <span className="font-medium">{l.roleLabel}</span>
                                <span className="text-[#7E7E7E]">
                                  {" "}
                                  · {l.origin.replace(/^https?:\/\//, "")} · {l.expiresInLabel}
                                </span>
                              </button>
                              <button
                                type="button"
                                title="Delete saved login"
                                aria-label={`Delete ${l.roleLabel}`}
                                className="mr-1 rounded p-1 text-[#9ca3af] opacity-0 hover:bg-[#FEF2F2] hover:text-[#B91C1C] group-hover:opacity-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void client
                                    .deleteSavedLogin(l.id)
                                    .then(() => {
                                      setSavedLogins((prev) => prev.filter((x) => x.id !== l.id));
                                      if (savedLoginId === l.id) setSavedLoginId("");
                                    })
                                    .catch(() => undefined);
                                }}
                              >
                                ✕
                              </button>
                            </li>
                          ))}
                          {savedLogins.length === 0 && (
                            <li className="px-3 py-2 text-[#9ca3af]">No saved logins yet — use Save this login while recording.</li>
                          )}
                        </ul>
                      </>
                    )}
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
                      <div className="flex flex-wrap items-center gap-2">
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
                            className={`${outlineButton} !inline-flex !items-center !gap-1.5 !px-3 !py-1.5 !text-[12px]`}
                            onClick={() => setSavingKind("network")}
                          >
                            <TbBookmark size={14} />
                            Save network preset
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </section>

                {configError && <p className="text-[12px] text-[#B45309]">{configError}</p>}
              </div>

              <div className={`flex flex-col overflow-hidden lg:min-h-0 ${compact ? "min-h-[56px]" : "min-h-[280px]"}`}>
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
                  lockRatio={lockRatio}
                  ratioText={ratioLabel(prefs.width, prefs.height)}
                  onSizeChange={onWidthHeight}
                  appUrl={appUrl}
                  compact={compact}
                >
                  <LiveUrlPreview
                    client={client}
                    projectId={projectId}
                    appUrl={appUrl}
                    width={prefs.width}
                    height={prefs.height}
                    orientation={prefs.orientation}
                    networkPreset={prefs.networkPreset}
                    devicePreset={prefs.devicePreset}
                    colorScheme={persona.colorScheme}
                    locale={persona.locale}
                    offline={prefs.networkPreset === "offline"}
                    disabled={starting}
                    hasSelection={Boolean(selection)}
                  />
                </DevicePreviewFrame>
                {!compact && (
                  <div className="mt-2 flex flex-wrap justify-center gap-1">
                    {(
                      [
                        {
                          key: "device",
                          label:
                            deviceById(prefs.devicePreset)?.label ??
                            (prefs.devicePreset === "custom" ? "Custom" : prefs.devicePreset),
                        },
                        {
                          key: "size",
                          label: sizeCardSubtitle(prefs.width, prefs.height),
                        },
                        {
                          key: "orient",
                          label: prefs.orientation === "portrait" ? "Portrait" : "Landscape",
                        },
                        {
                          key: "net",
                          label: networkById(prefs.networkPreset)?.label ?? prefs.networkPreset,
                        },
                        // "Emulated, stream scaled" is shown only on the live recording chips when
                        // session.emulation.streamScaled === true (API). Never predicted client-side.
                        ...(isCustom && (prefs.deviceScaleFactor ?? 1) > 1
                          ? [{ key: "dpr", label: `${prefs.deviceScaleFactor}x dens.` }]
                          : []),
                      ] as Array<{ key: string; label: string; danger?: boolean }>
                    ).map((chip) => (
                      <span
                        key={chip.key}
                        className={`rounded-full border px-2 py-0.5 text-[11px] ${
                          chip.danger
                            ? "border-[#FCD34D] bg-[#FFFBEB] text-[#92400E]"
                            : "border-[#E5E7EB] bg-[#F9FAFB] text-[#374151] dark:border-[#2a2a2a] dark:bg-[#141414] dark:text-[#d1d5db]"
                        }`}
                      >
                        {chip.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div
            className={`flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#D9D9D9] bg-white dark:border-[#2a2a2a] dark:bg-[#141414] ${
              compact ? "px-3 py-1.5 sm:px-4" : "px-5 py-3 sm:px-6"
            }`}
          >
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="text-[13px] font-medium text-[#374151] underline-offset-2 hover:text-[#8664F2] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8664F2] disabled:opacity-50 dark:text-[#d1d5db]"
                onClick={reset}
                disabled={starting}
              >
                Reset to default
              </button>
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
                  className={`${outlineButton} !px-3 !py-1.5 !text-[13px]`}
                  onClick={() => setSavingKind("setup")}
                >
                  Save current setup
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
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
