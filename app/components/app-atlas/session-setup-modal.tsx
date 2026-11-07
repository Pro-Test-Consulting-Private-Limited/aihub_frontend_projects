"use client";

import { useEffect, useState } from "react";
import type { AtlasConfig, Preset } from "@/app/interfaces/appatlas";
import {
  DEFAULT_EMULATION_PREFS,
  loadEmulationPrefs,
  saveEmulationPrefs,
  type SessionEmulationPrefs,
} from "@/app/lib/session-emulation";
import { Modal, fieldInput, fieldLabel, outlineButton, primaryButton } from "./modal";

const FALLBACK_DEVICES: Preset[] = [
  { id: "desktop", label: "Desktop" },
  { id: "desktop-hd", label: "Desktop HD" },
  { id: "iphone-14", label: "iPhone 14" },
  { id: "pixel-7", label: "Pixel 7" },
  { id: "ipad", label: "iPad Pro 11" },
  { id: "custom", label: "Custom size" },
];

const FALLBACK_NETWORKS: Preset[] = [
  { id: "none", label: "No throttling" },
  { id: "slow-3g", label: "Slow 3G" },
  { id: "fast-3g", label: "Fast 3G" },
  { id: "4g", label: "4G" },
  { id: "offline", label: "Offline" },
  { id: "custom", label: "Custom" },
];

export function SessionSetupModal({
  appUrl,
  loadConfig,
  starting,
  onStart,
  onClose,
}: {
  appUrl: string;
  loadConfig: () => Promise<AtlasConfig>;
  starting: boolean;
  onStart: (prefs: SessionEmulationPrefs) => void;
  onClose: () => void;
}) {
  const [prefs, setPrefs] = useState<SessionEmulationPrefs>(() => loadEmulationPrefs());
  const [devices, setDevices] = useState<Preset[]>(FALLBACK_DEVICES);
  const [networks, setNetworks] = useState<Preset[]>(FALLBACK_NETWORKS);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadConfig()
      .then((cfg) => {
        if (cancelled) return;
        if (cfg.presets?.devices?.length) setDevices(cfg.presets.devices);
        if (cfg.presets?.networks?.length) setNetworks(cfg.presets.networks);
      })
      .catch((err) => {
        if (!cancelled) setConfigError(err instanceof Error ? err.message : "Using built-in presets.");
      });
    return () => {
      cancelled = true;
    };
  }, [loadConfig]);

  const patch = (partial: Partial<SessionEmulationPrefs>) => setPrefs((p) => ({ ...p, ...partial }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = { ...prefs };
    if (next.devicePreset !== "custom") {
      next.width = DEFAULT_EMULATION_PREFS.width;
      next.height = DEFAULT_EMULATION_PREFS.height;
    }
    saveEmulationPrefs(next);
    onStart(next);
  };

  const selectCls = fieldInput;

  return (
    <Modal title="Start recording" onClose={starting ? () => undefined : onClose} width={520}>
      <form onSubmit={submit}>
        <p className="mt-3 text-[12.5px] text-[#5E6066] dark:text-[#9ca3af]">
          Device and network for this session. Saved for the next Run.
        </p>
        <p className="mt-1 truncate font-mono text-[11.5px] text-[#7E7E7E]" title={appUrl}>
          {appUrl || "No application URL"}
        </p>

        <label className={fieldLabel} htmlFor="device-preset">
          Device
        </label>
        <select
          id="device-preset"
          className={selectCls}
          value={prefs.devicePreset}
          onChange={(e) => patch({ devicePreset: e.target.value })}
          disabled={starting}
        >
          {devices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>

        {prefs.devicePreset === "custom" && (
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div>
              <label className={fieldLabel} htmlFor="viewport-w">
                Width (px)
              </label>
              <input
                id="viewport-w"
                type="number"
                min={320}
                max={3840}
                className={fieldInput}
                value={prefs.width}
                onChange={(e) => patch({ width: Number(e.target.value) || 320 })}
                disabled={starting}
              />
            </div>
            <div>
              <label className={fieldLabel} htmlFor="viewport-h">
                Height (px)
              </label>
              <input
                id="viewport-h"
                type="number"
                min={480}
                max={2160}
                className={fieldInput}
                value={prefs.height}
                onChange={(e) => patch({ height: Number(e.target.value) || 480 })}
                disabled={starting}
              />
            </div>
          </div>
        )}

        <label className={fieldLabel} htmlFor="orientation">
          Orientation
        </label>
        <select
          id="orientation"
          className={selectCls}
          value={prefs.orientation}
          onChange={(e) => patch({ orientation: e.target.value === "landscape" ? "landscape" : "portrait" })}
          disabled={starting}
        >
          <option value="portrait">Portrait</option>
          <option value="landscape">Landscape</option>
        </select>

        <label className={fieldLabel} htmlFor="network-preset">
          Network
        </label>
        <select
          id="network-preset"
          className={selectCls}
          value={prefs.networkPreset}
          onChange={(e) => patch({ networkPreset: e.target.value })}
          disabled={starting}
        >
          {networks.map((n) => (
            <option key={n.id} value={n.id}>
              {n.label}
            </option>
          ))}
        </select>

        {prefs.networkPreset === "custom" && (
          <div className="mt-2 grid grid-cols-3 gap-2">
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
                onChange={(e) => patch({ latencyMs: Number(e.target.value) || 0 })}
                disabled={starting}
              />
            </div>
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
                onChange={(e) => patch({ downloadKbps: Number(e.target.value) || 0 })}
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
                onChange={(e) => patch({ uploadKbps: Number(e.target.value) || 0 })}
                disabled={starting}
              />
            </div>
          </div>
        )}

        {configError && <div className="mt-3 text-[12px] text-[#B45309]">{configError}</div>}

        <div className="mt-7 flex justify-center gap-4">
          <button type="submit" className={primaryButton} disabled={starting || !appUrl}>
            {starting ? "Starting…" : "Start recording"}
          </button>
          <button type="button" className={outlineButton} onClick={onClose} disabled={starting}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
