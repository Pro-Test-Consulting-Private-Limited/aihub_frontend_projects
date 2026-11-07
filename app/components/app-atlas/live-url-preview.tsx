"use client";

import { useEffect, useRef, useState } from "react";
import { TbRefresh } from "react-icons/tb";
import type { AtlasClient } from "@/app/services/appatlas";
import type { Orientation } from "@/app/lib/session-emulation";

type Status = "idle" | "loading" | "ready" | "error" | "offline";

export function LiveUrlPreview({
  client,
  projectId,
  appUrl,
  width,
  height,
  orientation,
  networkPreset,
  devicePreset,
  offline,
  disabled,
  hasSelection,
}: {
  client: AtlasClient;
  projectId?: string | null;
  appUrl: string;
  width: number;
  height: number;
  orientation: Orientation;
  networkPreset: string;
  devicePreset: string;
  offline?: boolean;
  disabled?: boolean;
  /** True when a device card is selected (catalog/custom/mine). */
  hasSelection?: boolean;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [host, setHost] = useState("");
  const blobRef = useRef<string | null>(null);
  const reqRef = useRef(0);

  useEffect(() => {
    try {
      setHost(appUrl ? new URL(appUrl).hostname : "");
    } catch {
      setHost("");
    }
  }, [appUrl]);

  const clearBlob = () => {
    if (blobRef.current) {
      URL.revokeObjectURL(blobRef.current);
      blobRef.current = null;
    }
  };

  const mapError = (msg: string) => {
    if (/timeout|504/i.test(msg)) return "Timed out";
    if (/unavailable|503|not configured|Executable/i.test(msg)) return "Preview service unavailable";
    if (/unreachable|502|404|no application/i.test(msg)) return "Site unreachable";
    return msg || "Site unreachable";
  };

  const load = async () => {
    if (offline) {
      setStatus("offline");
      return;
    }
    if (!hasSelection) {
      setStatus("idle");
      return;
    }
    if (!appUrl) {
      setError("Project has no application URL");
      setStatus("error");
      return;
    }
    if (!projectId) {
      setError("Preview service unavailable");
      setStatus("error");
      return;
    }
    if (disabled) return;

    const id = ++reqRef.current;
    setStatus("loading");
    setError(null);
    const body = {
      projectId,
      width,
      height,
      orientation,
      network: networkPreset,
      devicePreset,
    };
    console.info("[preview] POST /atlas-api/preview", body);
    try {
      const blob = await client.previewScreenshot(body);
      console.info("[preview] response", { status: 200, bytes: blob.size, type: blob.type });
      if (id !== reqRef.current) return;
      clearBlob();
      const url = URL.createObjectURL(blob);
      blobRef.current = url;
      setSrc(url);
      setStatus("ready");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Site unreachable";
      const statusCode = err && typeof err === "object" && "status" in err ? (err as { status: number }).status : "?";
      console.info("[preview] response", { status: statusCode, error: msg });
      if (id !== reqRef.current) return;
      setError(mapError(msg));
      setStatus("error");
    }
  };

  useEffect(() => {
    if (offline) {
      setStatus("offline");
      return;
    }
    const t = window.setTimeout(() => void load(), 600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, appUrl, width, height, orientation, networkPreset, devicePreset, offline, disabled, hasSelection]);

  useEffect(() => () => clearBlob(), []);

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#FAFAFA] dark:bg-[#050505]">
      <button
        type="button"
        aria-label="Refresh preview"
        disabled={disabled || offline || status === "loading" || !hasSelection}
        onClick={() => void load()}
        className="absolute right-1.5 top-1.5 z-10 rounded bg-white/90 p-1 text-[#5E6066] shadow-sm hover:text-[#8664F2] disabled:opacity-40 dark:bg-[#141414]/90"
      >
        <TbRefresh size={14} className={status === "loading" ? "animate-spin" : ""} />
      </button>

      {status === "offline" && (
        <Placeholder host={host} title="Offline" body="Live preview is disabled for the Offline profile." />
      )}
      {status === "loading" && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-[#E5E7EB] via-[#F3F4F6] to-[#E5E7EB] dark:from-[#1a1a1a] dark:via-[#141414] dark:to-[#1a1a1a]">
          <div className="flex h-full flex-col items-center justify-center gap-2 text-[12px] text-[#5E6066]">
            {host && <span className="font-medium text-[#1F1F1F] dark:text-[#ededed]">{host}</span>}
            <span>Loading preview…</span>
          </div>
        </div>
      )}
      {status === "error" && (
        <Placeholder
          host={host}
          title={error || "Site unreachable"}
          body="Could not render the project URL."
          action={{ label: "Retry", onClick: () => void load() }}
        />
      )}
      {status === "ready" && src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover object-top" />
      )}
      {status === "idle" && (
        <Placeholder host={host} title="Preview" body="Pick a device to preview the project URL." />
      )}
    </div>
  );
}

function Placeholder({
  host,
  title,
  body,
  action,
}: {
  host: string;
  title: string;
  body: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 p-4 text-center">
      {host && <div className="text-[13px] font-medium text-[#1F1F1F] dark:text-[#ededed]">{host}</div>}
      <div className="text-[13px] font-semibold text-[#5E6066] dark:text-[#9ca3af]">{title}</div>
      <div className="text-[11px] text-[#7E7E7E]">{body}</div>
      {action && (
        <button type="button" onClick={action.onClick} className="mt-1 text-[12px] font-medium text-[#8664F2] underline">
          {action.label}
        </button>
      )}
    </div>
  );
}
