"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { Canvas } from "@/app/interfaces/appatlas";
import { atlasApiBase, atlasUrl } from "@/app/services/appatlas";
import { ReplayPlayer } from "@/app/components/app-atlas/replay-player";

type SharePayload = {
  expiresAt: number;
  canvas: Pick<
    Canvas,
    "id" | "name" | "description" | "nodes" | "edges" | "replay" | "timeline" | "host" | "startUrl"
  >;
};

/** Public read-only share of a canvas / replay (no auth). Token from Phase C share link. */
export default function ShareReplayPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token || "";
  const [data, setData] = useState<SharePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replayOpen, setReplayOpen] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void fetch(`${atlasApiBase()}/share/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || `Share link unavailable (${res.status})`);
        return body as SharePayload;
      })
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not open share link");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F7F8] p-6">
        <div className="max-w-md rounded-[12px] border border-[#FECACA] bg-white p-6 text-center shadow-sm">
          <div className="text-[16px] font-semibold text-[#991B1B]">Share link unavailable</div>
          <p className="mt-2 text-[13px] text-[#5E6066]">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F7F8] text-[13px] text-[#6B7280]">
        Loading shared replay…
      </div>
    );
  }

  const { canvas, expiresAt } = data;
  const expiresLabel = new Date(expiresAt).toLocaleString();
  const canvasFull = {
    ...canvas,
    isMine: false,
    owner: { id: "shared", name: "Shared", email: "" },
    screens: canvas.nodes.length,
    transitions: canvas.edges.length,
    events: 0,
    states: canvas.nodes.reduce((n, node) => n + (node.states?.length || 0), 0),
    pageObjects: 0,
    thumbnailUrl: canvas.nodes[0]?.screenshotUrl ?? null,
    jiraProjectKey: null,
    sessionId: null,
    testData: [],
    jira: null,
    teams: null,
    createdAt: 0,
    updatedAt: 0,
  } as Canvas;

  return (
    <div className="min-h-screen bg-[#F7F7F8] dark:bg-[#0b0b0b]" data-testid="phase-c-share-page">
      <header className="border-b border-[#E5E7EB] bg-white px-5 py-3 dark:border-[#2a2a2a] dark:bg-[#141414]">
        <div className="text-[11px] uppercase tracking-wide text-[#7E7E7E]">Read-only share</div>
        <div className="text-[18px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">{canvas.name}</div>
        <div className="text-[12px] text-[#6B7280]">
          {canvas.host} · expires {expiresLabel}
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-[13px] text-[#5E6066]">{canvas.description || "Shared App Atlas canvas / replay."}</p>
          <button
            type="button"
            onClick={() => setReplayOpen(true)}
            className="rounded-[8px] bg-[#8664F2] px-3 py-1.5 text-[12px] font-medium text-white"
          >
            Open replay
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {canvas.nodes.map((n) => (
            <div key={n.id} className="overflow-hidden rounded-[10px] border border-[#E5E7EB] bg-white dark:border-[#2a2a2a] dark:bg-[#141414]">
              <div className="border-b border-[#F3F4F6] px-3 py-2 text-[12px] font-medium dark:border-[#2a2a2a]">
                {n.path}
              </div>
              {n.screenshotUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={atlasUrl(n.screenshotUrl)}
                  alt={n.path}
                  className="h-[140px] w-full object-cover object-top"
                />
              ) : (
                <div className="flex h-[140px] items-center justify-center text-[11px] text-[#9CA3AF]">No shot</div>
              )}
            </div>
          ))}
        </div>
      </main>

      {replayOpen && <ReplayPlayer canvas={canvasFull} onClose={() => setReplayOpen(false)} />}
    </div>
  );
}
