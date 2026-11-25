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
  visualDiff: boolean;
  responsiveSheet: boolean;
  shareExport: boolean;
};

const PHASE_A: { key: keyof Flags; title: string; body: string }[] = [
  { key: "persona", title: "Persona", body: "Locale, timezone, colour scheme and geo in Start recording." },
  { key: "replay", title: "Replay video", body: "CDP screencast → MP4/GIF with overlay exports." },
  { key: "health", title: "Health", body: "Console / network / Web Vitals / axe badges and Health tab." },
];

const PHASE_B: { key: keyof Flags; title: string; body: string }[] = [
  { key: "simulate", title: "What if? simulation", body: "Arm one-shot API failures while recording (dev/test/staging only)." },
  { key: "jiraBug", title: "Jira bug report", body: "One-click Bug with evidence from an AC or state." },
  { key: "savedLogins", title: "Saved logins", body: "Record as a saved role; cookies encrypted at rest, never shared." },
];

const PHASE_C: { key: keyof Flags; title: string; body: string }[] = [
  { key: "visualDiff", title: "Visual diff", body: "Compare screens across two canvases/releases with slider and % changed." },
  { key: "responsiveSheet", title: "Responsive contact sheet", body: "Phone / tablet / laptop captures with overflow warnings." },
  { key: "shareExport", title: "Share & export", body: "Read-only share link with expiry and PDF canvas poster." },
];

const ENVS = ["dev", "test", "staging", "production", "unknown"] as const;

function ToggleRow({
  title,
  body,
  on,
  disabled,
  onToggle,
}: {
  title: string;
  body: string;
  on: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <div
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
        <div style={{ fontWeight: 600, fontSize: 13 }}>{title}</div>
        <div style={{ fontSize: 12, color: "#6B7280" }}>{body}</div>
      </div>
      <button
        type="button"
        aria-pressed={on}
        onClick={onToggle}
        disabled={disabled}
        style={{
          width: 38,
          height: 20,
          background: on ? "var(--purple)" : "#D6D6D6",
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
            right: on ? 2 : 20,
            top: 2,
            transition: "right 0.15s",
            display: "block",
          }}
        />
      </button>
    </div>
  );
}

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
          visualDiff: Boolean((r.features as Flags).visualDiff),
          responsiveSheet: Boolean((r.features as Flags).responsiveSheet),
          shareExport: Boolean((r.features as Flags).shareExport),
        });
        setEnvironment((r as { environment?: string }).environment || "unknown");
        setDefaults({
          persona: r.defaults.persona,
          replay: r.defaults.replay,
          health: r.defaults.health,
          simulate: Boolean((r.defaults as Flags).simulate),
          jiraBug: Boolean((r.defaults as Flags).jiraBug),
          savedLogins: Boolean((r.defaults as Flags).savedLogins),
          visualDiff: Boolean((r.defaults as Flags).visualDiff),
          responsiveSheet: Boolean((r.defaults as Flags).responsiveSheet),
          shareExport: Boolean((r.defaults as Flags).shareExport),
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
        visualDiff: Boolean(r.features.visualDiff),
        responsiveSheet: Boolean(r.features.responsiveSheet),
        shareExport: Boolean(r.features.shareExport),
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
    <div className="aihub-card" style={{ marginTop: 16 }} data-testid="appatlas-feature-flags">
      <div className="aihub-view-card-head">
        <h3>AppAtlas features</h3>
      </div>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 12 }}>
        Per-project toggles. Phase B flags default OFF. Defaults follow the environment ({defaults ? "loaded" : "…"}).
      </p>
      {error && <div style={{ color: "#B45309", fontSize: 12, marginBottom: 8 }}>{error}</div>}
      {!flags ? (
        <div style={{ fontSize: 13, color: "#9CA3AF" }}>Loading…</div>
      ) : (
        <>
          <div style={{ fontWeight: 700, fontSize: 13, margin: "4px 0 10px" }}>Phase A features</div>
          {PHASE_A.map((row) => (
            <ToggleRow
              key={row.key}
              title={row.title}
              body={row.body}
              on={flags[row.key]}
              disabled={saving}
              onToggle={() => void toggle(row.key)}
            />
          ))}

          <div
            data-testid="phase-b-features"
            style={{
              marginTop: 18,
              paddingTop: 14,
              borderTop: "1px solid var(--line)",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Phase B features</div>
            <p style={{ fontSize: 12, color: "#6B7280", marginBottom: 12 }}>
              What-if simulation, one-click Jira bugs, and saved logins. Environment lock applies to simulation.
            </p>
            <label style={{ display: "block", fontSize: 13, marginBottom: 12 }}>
              <span style={{ fontWeight: 600 }}>Environment</span>
              <select
                value={environment}
                disabled={saving}
                onChange={(e) => {
                  const next = e.target.value;
                  setEnvironment(next);
                  void persist(flags, next);
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
            {PHASE_B.map((row) => (
              <ToggleRow
                key={row.key}
                title={row.title}
                body={row.body}
                on={flags[row.key]}
                disabled={saving}
                onToggle={() => void toggle(row.key)}
              />
            ))}
          </div>

          <div
            data-testid="phase-c-features"
            style={{
              marginTop: 18,
              paddingTop: 14,
              borderTop: "1px solid var(--line)",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Phase C features</div>
            <p style={{ fontSize: 12, color: "#6B7280", marginBottom: 12 }}>
              Visual diff, responsive contact sheet, and share / PDF export. Default OFF.
            </p>
            {PHASE_C.map((row) => (
              <ToggleRow
                key={row.key}
                title={row.title}
                body={row.body}
                on={flags[row.key]}
                disabled={saving}
                onToggle={() => void toggle(row.key)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
