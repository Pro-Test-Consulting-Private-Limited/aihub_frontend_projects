"use client";

import { useEffect, useState } from "react";
import type { AtlasConfig, SessionSnapshot } from "@/app/interfaces/appatlas";
import type { AtlasClient } from "@/app/services/appatlas";
import { Modal, fieldInput, fieldLabel, outlineButton, primaryButton } from "./modal";

export function NewRecordingModal({
  client,
  url,
  onStarted,
  onClose,
}: {
  client: AtlasClient;
  url: string;
  onStarted: (snap: SessionSnapshot) => void;
  onClose: () => void;
}) {
  const [config, setConfig] = useState<AtlasConfig | null>(null);
  const [device, setDevice] = useState("desktop");
  const [network, setNetwork] = useState("none");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    client
      .getConfig()
      .then(setConfig)
      .catch((err) => setError(`AppAtlas is not reachable: ${err.message}`));
  }, [client]);

  const capacity = config?.capacity;
  const full = capacity ? capacity.next === null : false;

  const start = async () => {
    setStarting(true);
    setError(null);
    try {
      onStarted(await client.startSession({ url, devicePreset: device, networkPreset: network }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the browser.");
      setStarting(false);
    }
  };

  const presetOptions = (list?: { id: string; label: string }[]) =>
    (list ?? []).filter((p) => p.id !== "custom").map((p) => (
      <option key={p.id} value={p.id}>{p.label}</option>
    ));

  return (
    <Modal title="New Canvas" onClose={onClose}>
      <label className={fieldLabel}>Application URL</label>
      {url ? (
        <input className={`${fieldInput} bg-[#F9FAFC]`} value={url} readOnly />
      ) : (
        <div className="text-[13px] text-[#DC3545]">
          This project has no Application URL. Add one in Projects → Target App first.
        </div>
      )}
      <div className="mt-1 text-[11px] text-[#7E7E7E]">From the project setup. A remote browser opens this page and maps every screen you visit.</div>

      <div className="flex gap-4">
        <div className="flex-1">
          <label className={fieldLabel}>Device</label>
          <select className={fieldInput} value={device} onChange={(e) => setDevice(e.target.value)}>
            {presetOptions(config?.presets.devices)}
          </select>
        </div>
        <div className="flex-1">
          <label className={fieldLabel}>Network</label>
          <select className={fieldInput} value={network} onChange={(e) => setNetwork(e.target.value)}>
            {presetOptions(config?.presets.networks)}
          </select>
        </div>
      </div>

      {capacity && (
        <div className={`mt-3 text-[12px] ${full ? "text-[#DC3545]" : "text-[#7E7E7E]"}`}>
          {full
            ? `All browsers are busy. Try again in about ${Math.ceil((capacity.retryAfterSec ?? 60) / 60)} min.`
            : `${capacity.active} of ${capacity.max} browsers in use. Each session runs for up to 5 minutes.`}
        </div>
      )}
      {error && <div className="mt-3 text-[12px] text-[#DC3545]">{error}</div>}

      <div className="mt-7 flex justify-center gap-4">
        <button type="button" className={primaryButton} disabled={!url || !config || full || starting} onClick={start}>
          {starting ? "Starting browser…" : "Start Recording"}
        </button>
        <button type="button" className={outlineButton} onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}
