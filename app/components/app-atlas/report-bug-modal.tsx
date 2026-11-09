"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AtlasClient } from "@/app/services/appatlas";
import { outlineButton, primaryButton } from "./modal";

type Props = {
  client: AtlasClient;
  acSummary: string;
  acKey: string;
  acText: string;
  projectKey: string;
  storyKey?: string;
  deepLink: string;
  environmentLine: string;
  timeline: Array<{ at: number; kind: string; label: string }>;
  untilAt: number;
  screenshotUrl?: string | null;
  onClose: () => void;
  onCreated?: (key: string) => void;
};

type Tool = "box" | "arrow" | "blur";

export function ReportBugModal(props: Props) {
  const [actual, setActual] = useState("See recording evidence.");
  const [preview, setPreview] = useState<{
    steps: string[];
    createPayload: unknown;
    similar?: Array<{ key: string; summary: string }>;
    idempotencyKey?: string;
    redactedNetwork?: unknown[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tool, setTool] = useState<Tool>("box");
  const [annots, setAnnots] = useState<Array<{ tool: Tool; x: number; y: number; w: number; h: number }>>([]);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const body = useMemo(
    () => ({
      acSummary: props.acSummary,
      acKey: props.acKey,
      acText: props.acText,
      actual,
      projectKey: props.projectKey,
      storyKey: props.storyKey,
      deepLink: props.deepLink,
      environmentLine: props.environmentLine,
      timeline: props.timeline,
      untilAt: props.untilAt,
      createmeta: false,
    }),
    [props, actual],
  );

  useEffect(() => {
    let cancelled = false;
    void props.client
      .previewBug(body)
      .then(async (p) => {
        if (cancelled) return;
        const sim = await props.client.similarBugs(body).catch(() => ({ similar: [] }));
        setPreview({ ...p, similar: sim.similar });
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Preview failed");
      });
    return () => {
      cancelled = true;
    };
  }, [props.client, body]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !props.screenshotUrl) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      c.width = img.width;
      c.height = img.height;
      ctx.drawImage(img, 0, 0);
      // Pre-blur password-ish regions heuristically (bottom-center band as soft mask).
      try {
        const bandY = Math.floor(img.height * 0.55);
        const bandH = Math.floor(img.height * 0.2);
        const data = ctx.getImageData(0, bandY, img.width, bandH);
        for (let i = 0; i < data.data.length; i += 16) {
          const v = (data.data[i] + data.data[i + 1] + data.data[i + 2]) / 3;
          data.data[i] = data.data[i + 1] = data.data[i + 2] = v;
        }
        ctx.putImageData(data, 0, bandY);
      } catch {
        /* tainted canvas */
      }
      for (const a of annots) {
        ctx.strokeStyle = a.tool === "blur" ? "rgba(0,0,0,0.35)" : "#8664F2";
        ctx.lineWidth = 3;
        if (a.tool === "blur") {
          ctx.fillStyle = "rgba(120,120,120,0.55)";
          ctx.fillRect(a.x, a.y, a.w, a.h);
        } else if (a.tool === "arrow") {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(a.x + a.w, a.y + a.h);
          ctx.stroke();
        } else {
          ctx.strokeRect(a.x, a.y, a.w, a.h);
        }
      }
    };
    img.src = props.screenshotUrl;
  }, [props.screenshotUrl, annots]);

  const submit = async (mode: "create" | "comment", similarKey?: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // Live create is blocked server-side unless JIRA_LIVE_TEST=1 — surface that clearly.
      const res = await props.client.createBug({ ...body, mode, similarKey });
      if (res.key) props.onCreated?.(res.key);
      else if (res.error) setError(res.error + (res.livePath ? ` (${res.livePath}; liveTested=${res.liveTested})` : ""));
      else props.onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal>
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[12px] bg-white shadow-xl dark:bg-[#141414]">
        <div className="flex items-center justify-between border-b border-[#EEE] px-4 py-2 dark:border-[#2a2a2a]">
          <div className="text-[14px] font-medium text-[#1F1F1F] dark:text-[#ededed]">Report bug</div>
          <button type="button" className={outlineButton} onClick={props.onClose}>
            Close
          </button>
        </div>
        <div className="grid flex-1 grid-cols-1 gap-3 overflow-y-auto p-4 md:grid-cols-2">
          <div className="space-y-2 text-[12px] text-[#5E6066] dark:text-[#9ca3af]">
            <div>
              <div className="font-medium text-[#1F1F1F] dark:text-[#ededed]">Title</div>
              <div>[AppAtlas] {props.acSummary}</div>
            </div>
            <div>
              <div className="font-medium text-[#1F1F1F] dark:text-[#ededed]">Steps</div>
              <ol className="list-decimal pl-4">
                {(preview?.steps || []).map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </div>
            <div>
              <div className="font-medium text-[#1F1F1F] dark:text-[#ededed]">Expected</div>
              <div>{props.acText}</div>
            </div>
            <label className="block">
              <div className="font-medium text-[#1F1F1F] dark:text-[#ededed]">Actual</div>
              <textarea
                className="mt-1 w-full rounded-[6px] border border-[#EEE] p-2 dark:border-[#333] dark:bg-[#0a0a0a]"
                rows={3}
                value={actual}
                onChange={(e) => setActual(e.target.value)}
              />
            </label>
            <div>
              <div className="font-medium text-[#1F1F1F] dark:text-[#ededed]">Environment</div>
              <div>{props.environmentLine}</div>
            </div>
            <div>
              <div className="font-medium text-[#1F1F1F] dark:text-[#ededed]">Deep link</div>
              <div className="break-all">{props.deepLink}</div>
            </div>
            {preview?.similar && preview.similar.length > 0 && (
              <div className="rounded-[8px] border border-[#FDE68A] bg-[#FFFBEB] p-2 text-[#92400E]">
                Similar bug exists: {preview.similar[0].key} — {preview.similar[0].summary}
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className={outlineButton}
                    disabled={busy}
                    onClick={() => void submit("comment", preview.similar![0].key)}
                  >
                    Add as comment + attachments
                  </button>
                  <button type="button" className={primaryButton} disabled={busy} onClick={() => void submit("create")}>
                    Create anyway
                  </button>
                </div>
              </div>
            )}
            {error && <div className="text-[#B45309]">{error}</div>}
          </div>
          <div>
            <div className="mb-2 flex gap-2 text-[11px]">
              {(["box", "arrow", "blur"] as Tool[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`rounded-[4px] border px-2 py-1 ${tool === t ? "border-[#8664F2] text-[#8664F2]" : "border-[#EEE]"}`}
                  onClick={() => setTool(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            <canvas
              ref={canvasRef}
              className="max-h-[360px] w-full rounded-[8px] border border-[#EEE] bg-[#111] object-contain dark:border-[#333]"
              onMouseDown={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                drag.current = { x: e.clientX - r.left, y: e.clientY - r.top };
              }}
              onMouseUp={(e) => {
                if (!drag.current) return;
                const r = e.currentTarget.getBoundingClientRect();
                const x2 = e.clientX - r.left;
                const y2 = e.clientY - r.top;
                const x = Math.min(drag.current.x, x2);
                const y = Math.min(drag.current.y, y2);
                const w = Math.abs(x2 - drag.current.x);
                const h = Math.abs(y2 - drag.current.y);
                drag.current = null;
                if (w > 4 && h > 4) setAnnots((a) => [...a, { tool, x, y, w, h }]);
              }}
            />
            <div className="mt-2 text-[11px] text-[#9ca3af]">
              Video clip: last 10s before state + 2s after (mask burned in; ≤10 MB). Falls back to GIF/frames when
              oversize — notice shown at create time.
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-[#EEE] px-4 py-3 dark:border-[#2a2a2a]">
          <button type="button" className={outlineButton} onClick={props.onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={primaryButton}
            disabled={busy || Boolean(preview?.similar?.length)}
            onClick={() => void submit("create")}
          >
            {busy ? "Working…" : "Create bug (dry-run gated)"}
          </button>
        </div>
      </div>
    </div>
  );
}
