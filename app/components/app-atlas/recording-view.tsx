"use client";

import { useEffect, useRef, useState } from "react";
import type { SessionSnapshot } from "@/app/interfaces/appatlas";
import { atlasUrl, type AtlasClient } from "@/app/services/appatlas";
import { outlineButton, primaryButton } from "./modal";

const DONE: SessionSnapshot["status"][] = ["finished", "expired", "error"];

export function RecordingView({
  client,
  initial,
  onFinished,
  onDiscarded,
}: {
  client: AtlasClient;
  initial: SessionSnapshot;
  onFinished: (snap: SessionSnapshot) => void;
  onDiscarded: () => void;
}) {
  const [snap, setSnap] = useState(initial);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<"finish" | "discard" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(initial);
  const finishedRef = useRef(onFinished);
  finishedRef.current = onFinished;

  useEffect(() => {
    let es: EventSource | null = null;
    let closed = false;
    client.openEvents(initial.id).then((source) => {
      if (closed) return source.close();
      es = source;
      source.addEventListener("snapshot", (e) => {
        const next: SessionSnapshot = JSON.parse((e as MessageEvent).data);
        if (next.revision < latest.current.revision) return;
        latest.current = next;
        setSnap(next);
        if (DONE.includes(next.status)) {
          source.close();
          finishedRef.current(next);
        }
      });
    });
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      closed = true;
      es?.close();
      clearInterval(timer);
    };
  }, [client, initial.id]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const finish = async () => {
    setBusy("finish");
    setError(null);
    try {
      const final = await client.finishSession(snap.id);
      latest.current = final;
      onFinished(final);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not finish the recording.");
      setBusy(null);
    }
  };

  const discard = async () => {
    if (!window.confirm("Discard this recording? Nothing will be saved.")) return;
    setBusy("discard");
    await client.discardSession(snap.id).catch(() => undefined);
    onDiscarded();
  };

  const left = Math.max(0, snap.expiresAt - now);
  const countdown = `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}`;
  const viewer = snap.viewer;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-4 border-b border-[#EEE] bg-white px-5 py-2.5 dark:border-[#1a1a1a] dark:bg-[#0a0a0a]">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[13px] font-medium text-[#1F1F1F] dark:text-[#ededed]">
            <span className="h-[8px] w-[8px] animate-pulse rounded-full bg-[#DC3545]" />
            {snap.status === "starting" ? "Starting browser…" : "Recording"}
            <span className={`text-[12px] font-normal ${left < 60000 ? "text-[#DC3545]" : "text-[#7E7E7E]"}`}>
              auto-stops in {countdown}
            </span>
          </div>
          <div className="truncate text-[11px] text-[#7E7E7E]">
            {snap.currentUrl || snap.startUrl} · {snap.nodes.length} screens · {snap.edges.length} actions · {snap.eventCount} events
          </div>
        </div>
        <div className="flex shrink-0 gap-3">
          <button type="button" className={`${outlineButton} !py-1.5 !text-[13px]`} onClick={discard} disabled={!!busy}>
            {busy === "discard" ? "Discarding…" : "Discard"}
          </button>
          <button type="button" className={`${primaryButton} !py-1.5 !text-[13px]`} onClick={finish} disabled={!!busy || snap.status !== "recording"}>
            {busy === "finish" ? "Building map…" : "Finish & Save"}
          </button>
        </div>
      </div>
      {error && <div className="bg-[#FDF1F1] px-5 py-2 text-[12px] text-[#991B1B]">{error}</div>}

      <div className="flex min-h-0 flex-1 gap-4 p-4">
        <div className="flex min-w-0 flex-1 items-start justify-center overflow-auto">
          {viewer && viewer.kind !== "local" ? (
            <iframe
              src={atlasUrl(viewer.url)}
              allow="autoplay; clipboard-read; clipboard-write; fullscreen"
              className="w-full rounded-[10px] border border-[#E6E1F5] bg-black dark:border-[#2a2a2a]"
              style={{ aspectRatio: "16 / 10" }}
              title="Remote browser"
            />
          ) : (
            <div className="mt-20 text-center text-[13px] text-[#7E7E7E]">
              {viewer?.kind === "local" ? "Use the Chromium window opened on the backend machine." : "Waiting for the browser…"}
            </div>
          )}
        </div>
        <div className="w-[230px] shrink-0 overflow-y-auto">
          <div className="mb-2 text-[12px] font-medium text-[#1F1F1F] dark:text-[#ededed]">Screens captured</div>
          {snap.nodes.length === 0 && <div className="text-[11px] text-[#7E7E7E]">Screens appear here as you browse.</div>}
          {[...snap.nodes].reverse().map((n) => (
            <div
              key={n.id}
              className={`mb-2 overflow-hidden rounded-[8px] border bg-white dark:bg-[#141414] ${
                n.status === "active" ? "border-[#8664F2]" : "border-[#E6E1F5] dark:border-[#2a2a2a]"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={atlasUrl(n.shotUrl)} alt="" loading="lazy" className="h-[90px] w-full object-cover object-top" />
              <div className="px-2 py-1.5">
                <div className="truncate text-[11px] font-medium text-[#1F1F1F] dark:text-[#ededed]">{n.path}</div>
                <div className="text-[10px] text-[#7E7E7E]">{n.states.length} states</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
