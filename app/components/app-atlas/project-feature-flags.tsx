"use client";

import { useEffect, useMemo, useState } from "react";
import { useMsal } from "@azure/msal-react";
import { atlasClient } from "@/app/services/appatlas";

type Flags = { persona: boolean; replay: boolean; health: boolean };

const LABELS: { key: keyof Flags; title: string; body: string }[] = [
  { key: "persona", title: "Persona", body: "Locale, timezone, colour scheme and geo in Start recording." },
  { key: "replay", title: "Replay video", body: "CDP screencast → MP4/GIF with overlay exports." },
  { key: "health", title: "Health", body: "Console / network / Web Vitals / axe badges and Health tab." },
];

/** Per-project AppAtlas feature toggles (env defaults when unset). */
export function ProjectFeatureFlags({ projectId }: { projectId: string }) {
  const { instance, accounts } = useMsal();
  const client = useMemo(() => atlasClient({ instance, accounts }), [instance, accounts]);
  const [flags, setFlags] = useState<Flags | null>(null);
  const [defaults, setDefaults] = useState<Flags | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void client
      .getProjectFeatures(projectId)
      .then((r) => {
        if (cancelled) return;
        setFlags(r.features);
        setDefaults(r.defaults);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load feature flags");
      });
    return () => {
      cancelled = true;
    };
  }, [client, projectId]);

  const toggle = async (key: keyof Flags) => {
    if (!flags || saving) return;
    const next = { ...flags, [key]: !flags[key] };
    setFlags(next);
    setSaving(true);
    setError(null);
    try {
      const r = await client.setProjectFeatures(projectId, next);
      setFlags(r.features);
    } catch (err: unknown) {
      setFlags(flags);
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="aihub-card" style={{ marginTop: 16 }}>
      <div className="aihub-view-card-head">
        <h3>AppAtlas features</h3>
      </div>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 12 }}>
        Per-project toggles. Defaults follow the environment ({defaults ? "loaded" : "…"}).
      </p>
      {error && <div style={{ color: "#B45309", fontSize: 12, marginBottom: 8 }}>{error}</div>}
      {!flags ? (
        <div style={{ fontSize: 13, color: "#9CA3AF" }}>Loading…</div>
      ) : (
        LABELS.map((row) => (
          <div
            key={row.key}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              border: "1px solid var(--line)",
              borderRadius: 8,
              padding: "12px 14px",
              marginBottom: 8,
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{row.title}</div>
              <div style={{ fontSize: 12, color: "#6B7280" }}>{row.body}</div>
            </div>
            <button
              type="button"
              aria-pressed={flags[row.key]}
              onClick={() => void toggle(row.key)}
              disabled={saving}
              style={{
                width: 38,
                height: 20,
                background: flags[row.key] ? "var(--purple)" : "#D6D6D6",
                borderRadius: 20,
                position: "relative",
                cursor: "pointer",
                border: "none",
              }}
            >
              <span
                style={{
                  width: 16,
                  height: 16,
                  background: "#fff",
                  borderRadius: "50%",
                  position: "absolute",
                  right: flags[row.key] ? 2 : 20,
                  top: 2,
                  transition: "right 0.15s",
                  display: "block",
                }}
              />
            </button>
          </div>
        ))
      )}
    </div>
  );
}
