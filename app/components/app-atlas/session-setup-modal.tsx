"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  TbDeviceDesktop,
  TbDeviceMobile,
  TbDeviceTablet,
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
  DEFAULT_EMULATION_PREFS,
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
  snapWidth,
  summaryLine,
  type DeviceCategory,
  type Orientation,
  type SessionEmulationPrefs,
} from "@/app/lib/session-emulation";
import { fieldInput, fieldLabel, outlineButton, primaryButton } from "./modal";

const CATEGORIES: { id: DeviceCategory | "recent"; label: string }[] = [
  { id: "recent", label: "Recent" },
  { id: "phone", label: "Phone" },
  { id: "tablet", label: "Tablet" },
  { id: "laptop", label: "Laptop / Desktop" },
  { id: "custom", label: "Custom" },
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

export function SessionSetupModal({
  appUrl,
  projectId,
  canvasId,
  loadConfig,
  starting,
  onStart,
  onClose,
}: {
  appUrl: string;
  projectId?: string | null;
  canvasId?: string | null;
  loadConfig: () => Promise<AtlasConfig>;
  starting: boolean;
  onStart: (prefs: SessionEmulationPrefs) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [prefs, setPrefs] = useState<SessionEmulationPrefs>(() => loadEmulationPrefs(projectId));
  const [category, setCategory] = useState<DeviceCategory | "recent">(() => {
    const d = deviceById(loadEmulationPrefs(projectId).devicePreset);
    return d?.category ?? "laptop";
  });
  const [search, setSearch] = useState("");
  const [deviceEdit, setDeviceEdit] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [previousViewport, setPreviousViewport] = useState<{ width: number; height: number } | null>(null);
  const [rotating, setRotating] = useState(false);
  const dragRef = useRef<{ startX: number; startW: number; startH: number; shift: boolean } | null>(null);

  useEffect(() => {
    setPrefs(loadEmulationPrefs(projectId));
    setRecent(loadRecentDevices());
    setPreviousViewport(loadCanvasViewport(canvasId));
  }, [projectId, canvasId]);

  useEffect(() => {
    let cancelled = false;
    loadConfig()
      .then((cfg) => {
        if (cancelled) return;
        // Config currently only returns id/label; catalog sizes stay local (same as BE resolve).
        if (!cfg.presets?.devices?.length) setConfigError("Using built-in device list.");
      })
      .catch((err) => {
        if (!cancelled) setConfigError(err instanceof Error ? err.message : "Using built-in presets.");
      });
    return () => {
      cancelled = true;
    };
  }, [loadConfig]);

  // Focus trap + Esc
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
  }, [onClose, starting]);

  const devicesInTab = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = DEVICE_CATALOG;
    if (category === "recent") {
      const ids = recent.length ? recent : ["desktop", "iphone-14", "pixel-7"];
      list = ids.map((id) => deviceById(id)).filter(Boolean) as typeof DEVICE_CATALOG;
    } else {
      list = DEVICE_CATALOG.filter((d) => d.category === category);
    }
    if (!q) return list;
    return list.filter((d) => d.label.toLowerCase().includes(q) || d.id.includes(q));
  }, [category, recent, search]);

  const entry = deviceById(prefs.devicePreset);
  const isCustom = prefs.devicePreset === "custom" || deviceEdit;
  const dpr = entry?.dpr ?? 1;

  const patchNetwork = (networkPreset: string) => {
    const net = networkById(networkPreset);
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
    setDeviceEdit(id === "custom");
    setPrefs((p) => selectDevicePreset(p, id));
    const d = deviceById(id);
    if (d && d.category !== "custom") setCategory(d.category);
  };

  const onOrient = (orientation: Orientation) => {
    if (motionOk()) {
      setRotating(true);
      window.setTimeout(() => setRotating(false), 180);
    }
    setPrefs((p) => setOrientation(p, orientation));
  };

  const onWidthHeight = (width: number, height: number) => {
    setDeviceEdit(true);
    setPrefs((p) => setCustomSize(p, width, height));
  };

  const onResizePointerDown = (e: React.PointerEvent) => {
    if (!isCustom || starting) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startW: prefs.width,
      startH: prefs.height,
      shift: e.shiftKey,
    };
  };

  const onResizePointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const scale = 2.2;
    let nextW = drag.startW + dx * scale;
    if (!drag.shift && !e.shiftKey) nextW = snapWidth(nextW);
    const ratio = drag.startH / drag.startW;
    const nextH = nextW * ratio;
    onWidthHeight(nextW, nextH);
  };

  const onResizePointerUp = () => {
    dragRef.current = null;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = normalizePrefs(prefs);
    saveEmulationPrefs(next, projectId);
    rememberCanvasViewport(canvasId, next.width, next.height);
    setRecent(loadRecentDevices());
    onStart(next);
  };

  const reset = () => {
    setDeviceEdit(false);
    setPrefs(normalizePrefs(DEFAULT_EMULATION_PREFS));
    setCategory("laptop");
  };

  const showPrevNote =
    previousViewport &&
    (previousViewport.width !== prefs.width || previousViewport.height !== prefs.height);

  const previewMax = 280;
  const aspect = prefs.width / Math.max(prefs.height, 1);
  let frameW = previewMax;
  let frameH = previewMax / aspect;
  if (frameH > previewMax) {
    frameH = previewMax;
    frameW = previewMax * aspect;
  }

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
              Device and network for this session. Saved for the next Run.
            </p>
            <p className="mt-1 truncate font-mono text-[11.5px] text-[#7E7E7E]" title={appUrl}>
              {appUrl || "No application URL"}
            </p>
            {showPrevNote && (
              <p className="mt-2 rounded-[8px] border border-[#E5E7EB] bg-[#F9FAFB] px-2.5 py-1.5 text-[12px] text-[#5E6066] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] dark:text-[#9ca3af]">
                Previous recordings on this canvas used {previousViewport!.width} × {previousViewport!.height}.
              </p>
            )}

            <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
              {/* Left: controls */}
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
                  <div
                    role="tablist"
                    aria-label="Device category"
                    className="mb-2 flex flex-wrap gap-1"
                  >
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
                    className="grid grid-cols-2 gap-2 sm:grid-cols-3"
                  >
                    {devicesInTab.map((d) => {
                      const selected = prefs.devicePreset === d.id && !deviceEdit;
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
                              <div className="font-mono text-[10.5px] text-[#7E7E7E]">
                                {d.width} × {d.height}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                    {devicesInTab.length === 0 && (
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
                      <p className="text-[11px] text-[#7E7E7E]">
                        Clamped {VIEWPORT.widthMin}–{VIEWPORT.widthMax} × {VIEWPORT.heightMin}–{VIEWPORT.heightMax}. Drag
                        the preview corner to resize (Shift = no snap).
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
                      const selected = prefs.networkPreset === n.id;
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

                  {prefs.networkPreset === "offline" && (
                    <p className="mt-2 rounded-[8px] border border-[#FCD34D] bg-[#FFFBEB] px-2.5 py-1.5 text-[12px] text-[#92400E] dark:border-[#854d0e] dark:bg-[#1c1408] dark:text-[#FCD34D]">
                      Pages will not load while offline. Use it only to record offline behaviour.
                    </p>
                  )}

                  {prefs.networkPreset === "custom" && (
                    <div className="mt-2 grid grid-cols-3 gap-2">
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
                  )}
                </section>

                {configError && <p className="text-[12px] text-[#B45309]">{configError}</p>}
              </div>

              {/* Right: live preview */}
              <div className="flex min-h-[300px] flex-col items-center justify-center rounded-[12px] border border-[#E5E7EB] bg-[#F7F7FA] p-4 dark:border-[#2a2a2a] dark:bg-[#0a0a0a]">
                <div
                  className={`relative bg-[#111] text-white shadow-lg transition-transform duration-150 ease-out dark:bg-[#000] ${
                    rotating && motionOk() ? "scale-[0.97]" : "scale-100"
                  } ${
                    frameKind === "phone"
                      ? "rounded-[28px] border-[3px] border-[#333]"
                      : frameKind === "tablet"
                        ? "rounded-[16px] border-2 border-[#444]"
                        : frameKind === "laptop"
                          ? "rounded-t-[8px] border border-[#555]"
                          : "rounded-[8px] border-2 border-dashed border-[#8664F2]"
                  }`}
                  style={{ width: frameW, height: frameH }}
                >
                  {frameKind === "phone" && (
                    <div className="absolute left-1/2 top-1.5 h-1.5 w-14 -translate-x-1/2 rounded-full bg-[#222]" aria-hidden />
                  )}
                  <div className="flex h-full flex-col items-center justify-center gap-1 p-3 text-center">
                    <div className="font-mono text-[12px] font-semibold tracking-wide">
                      {prefs.width} × {prefs.height}
                    </div>
                    <div className="text-[11px] text-white/70">
                      {prefs.orientation === "portrait" ? "Portrait" : "Landscape"}
                      {dpr !== 1 ? ` · ${dpr}× DPR` : ""}
                    </div>
                  </div>
                  {isCustom && (
                    <div
                      role="slider"
                      aria-label="Resize custom viewport"
                      aria-valuemin={VIEWPORT.widthMin}
                      aria-valuemax={VIEWPORT.widthMax}
                      aria-valuenow={prefs.width}
                      tabIndex={0}
                      className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize rounded-tl bg-[#8664F2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                      onPointerDown={onResizePointerDown}
                      onPointerMove={onResizePointerMove}
                      onPointerUp={onResizePointerUp}
                      onPointerCancel={onResizePointerUp}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowRight" || e.key === "ArrowUp") {
                          e.preventDefault();
                          onWidthHeight(prefs.width + (e.shiftKey ? 1 : 10), prefs.height + (e.shiftKey ? 1 : 10));
                        }
                        if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
                          e.preventDefault();
                          onWidthHeight(prefs.width - (e.shiftKey ? 1 : 10), prefs.height - (e.shiftKey ? 1 : 10));
                        }
                      }}
                    />
                  )}
                </div>
                {frameKind === "laptop" && (
                  <div className="h-2 w-[min(100%,calc(100%+24px))] rounded-b-[6px] bg-[#333]" aria-hidden />
                )}
                <p className="mt-3 max-w-full truncate text-center text-[12px] text-[#5E6066] dark:text-[#9ca3af]">
                  {summaryLine(prefs)}
                </p>
              </div>
            </div>
          </div>

          {/* Sticky footer — outside scroll so dropdowns never cover it */}
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
