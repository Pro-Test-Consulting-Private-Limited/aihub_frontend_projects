"use client";

import { useEffect, useMemo, useState } from "react";
import { useMsal } from "@azure/msal-react";
import { atlasClient } from "@/app/services/appatlas";

type Flags = {
  persona: boolean;
  replay: boolean;
  health: boolean;
  simulate: boolean;
  jiraBug: boolean;
  savedLogins: boolean;
};

const LABELS: { key: keyof Flags; title: string; body: string }[] = [
  { key: "persona", title: "Persona", body: "Locale, timezone, colour scheme and geo in Start recording." },
  { key: "replay", title: "Replay video", body: "CDP screencast → MP4/GIF with overlay exports." },
  { key: "health", title: "Health", body: "Console / network / Web Vitals / axe badges and Health tab." },
  { key: "simulate", title: "What if? simulation", body: "Arm one-shot API failures while recording (dev/test/staging only)." },
  { key: "jiraBug", title: "Jira bug report", body: "One-click Bug with evidence from an AC or state." },
  { key: "savedLogins", title: "Saved logins", body: "Record as a saved role; cookies encrypted at rest, never shared." },
];

const ENVS = ["dev", "test", "staging", "production", "unknown"] as const;

/** Per-project AppAtlas feature toggles (env defaults when unset). */
export function ProjectFeatureFlags({ projectId }: { projectId: string }) {
  const { instance, accounts } = useMsal();
  const client = useMemo(() => atlasClient({ instance, accounts }), [instance, accounts]);
  const [flags, setFlags] = useState<Flags | null>(null);
  const [environment, setEnvironment] = useState<string>("unknown");
  const [defaults, setDefaults] = useState<Flags | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void client
      .getProjectFeatures(projectId)
      .then((r) => {
        if (cancelled) return;
        setFlags({
          persona: r.features.persona,
          replay: r.features.replay,
          health: r.features.health,
          simulate: Boolean((r.features as Flags).simulate),
          jiraBug: Boolean((r.features as Flags).jiraBug),
          savedLogins: Boolean((r.features as Flags).savedLogins),
        });
        setEnvironment((r as { environment?: string }).environment || "unknown");
        setDefaults({
          persona: r.defaults.persona,
          replay: r.defaults.replay,
          health: r.defaults.health,
          simulate: Boolean((r.defaults as Flags).simulate),
          jiraBug: Boolean((r.defaults as Flags).jiraBug),
          savedLogins: Boolean((r.defaults as Flags).savedLogins),
        });
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load feature flags");
      });
    return () => {
      cancelled = true;
    };
  }, [client, projectId]);

  const persist = async (nextFlags: Flags, nextEnv: string) => {
    setSaving(true);
    setError(null);
    try {
      const r = await client.setProjectFeatures(projectId, { ...nextFlags, environment: nextEnv });
      setFlags({
        persona: r.features.persona,
        replay: r.features.replay,
        health: r.features.health,
        simulate: Boolean(r.features.simulate),
        jiraBug: Boolean(r.features.jiraBug),
        savedLogins: Boolean(r.features.savedLogins),
      });
      setEnvironment(r.environment || nextEnv);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (key: keyof Flags) => {
    if (!flags || saving) return;
    const next = { ...flags, [key]: !flags[key] };
    setFlags(next);
    await persist(next, environment);
  };

  return (
    <div className="aihub-card" style={{ marginTop: 16 }}>
      <div className="aihub-view-card-head">
        <h3>AppAtlas features</h3>
      </div>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 12 }}>
        Per-project toggles. Phase B flags default OFF. Defaults follow the environment ({defaults ? "loaded" : "…"}).
      </p>
      <label style={{ display: "block", fontSize: 13, marginBottom: 12 }}>
        <span style={{ fontWeight: 600 }}>Environment</span>
        <select
          value={environment}
          disabled={saving || !flags}
          onChange={(e) => {
            const next = e.target.value;
            setEnvironment(next);
            if (flags) void persist(flags, next);
          }}
          style={{ display: "block", marginTop: 6, width: "100%", padding: "8px 10px", borderRadius: 8 }}
        >
          {ENVS.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <span style={{ fontSize: 12, color: "#6B7280" }}>
          What-if simulation is locked for production and unknown (enforced in API + UI).
        </span>
      </label>
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
