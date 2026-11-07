import { deviceById, networkById } from "./session-emulation";

/** Minimal shape shared by SessionEmulationPrefs and EmulationSummary. */
export type EmulationLike = {
  devicePreset: string;
  networkPreset: string;
  width?: number;
  height?: number;
  viewport?: { width: number; height: number };
  orientation?: string;
  offline?: boolean;
  downloadKbps?: number;
  uploadKbps?: number;
  latencyMs?: number;
  network?: { downloadKbps: number; uploadKbps: number; latencyMs: number } | null;
};

export function pluralize(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

export function deviceDisplayName(devicePreset: string): string {
  if (devicePreset === "custom") return "Custom";
  return deviceById(devicePreset)?.label ?? devicePreset;
}

function formatKbps(kbps: number): string {
  if (kbps < 0) return "—";
  if (kbps >= 1024) {
    const mbps = kbps / 1024;
    return `${mbps % 1 === 0 ? mbps.toFixed(0) : mbps.toFixed(1)} Mbps`;
  }
  return `${kbps} kbps`;
}

export function networkChipLabel(e: EmulationLike): string {
  if (e.offline || e.networkPreset === "offline") return "Offline";
  if (e.networkPreset === "custom") {
    const down = e.network?.downloadKbps ?? e.downloadKbps ?? 0;
    const up = e.network?.uploadKbps ?? e.uploadKbps ?? 0;
    const lat = e.network?.latencyMs ?? e.latencyMs ?? 0;
    return `Custom ${formatKbps(down)} down / ${formatKbps(up)} up / ${lat} ms`;
  }
  return networkById(e.networkPreset)?.label ?? e.networkPreset;
}

export function recordingCountsLine(nodes: number, edges: number, events: number): string {
  return `${pluralize(nodes, "screen")} · ${pluralize(edges, "action")} · ${pluralize(events, "event")}`;
}
