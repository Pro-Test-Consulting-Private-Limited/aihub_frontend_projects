"use client";

/**
 * The test target for a Swagger spec: where requests are sent. Using the product means agreeing that this is a test
 * environment, so there is no per-run confirmation.
 * Named profiles (dev / sit / prod) keep base URLs in this browser, per spec.
 * The bearer token is a secret: it lives in this module's memory only and is gone on reload.
 */
export type EnvProfileId = "dev" | "sit" | "prod";

export const ENV_PROFILE_IDS: EnvProfileId[] = ["dev", "sit", "prod"];

export const ENV_PROFILE_LABEL: Record<EnvProfileId, string> = {
  dev: "dev",
  sit: "sit",
  prod: "prod",
};

export type TestEnvironment = {
  /** Active profile chip. */
  active: EnvProfileId;
  /** Named base URLs for this spec. */
  profiles: Record<EnvProfileId, string>;
  /** Convenience mirror of profiles[active] — what runners read. */
  baseUrl: string;
};

const key = (specUrl: string) => `api-testing-env:${specUrl}`;
const tokens = new Map<string, string>();

const emptyProfiles = (): Record<EnvProfileId, string> => ({ dev: "", sit: "", prod: "" });

function normalize(raw: Partial<TestEnvironment> & { baseUrl?: string }): TestEnvironment {
  const profiles = emptyProfiles();
  if (raw.profiles && typeof raw.profiles === "object") {
    for (const id of ENV_PROFILE_IDS) {
      const v = (raw.profiles as Record<string, unknown>)[id];
      profiles[id] = typeof v === "string" ? v : "";
    }
  }
  const active: EnvProfileId =
    raw.active === "dev" || raw.active === "sit" || raw.active === "prod" ? raw.active : "dev";
  // Migrate legacy `{ baseUrl }` → active profile.
  if (!profiles[active] && typeof raw.baseUrl === "string" && raw.baseUrl.trim()) {
    profiles[active] = raw.baseUrl.trim();
  }
  return { active, profiles, baseUrl: profiles[active] || "" };
}

export function getEnvironment(specUrl: string): TestEnvironment {
  try {
    const raw = localStorage.getItem(key(specUrl));
    if (raw) return normalize(JSON.parse(raw) as Partial<TestEnvironment>);
  } catch {
    /* storage unavailable or corrupt: fall through to the defaults */
  }
  return { active: "dev", profiles: emptyProfiles(), baseUrl: "" };
}

export function setEnvironment(specUrl: string, env: Partial<TestEnvironment> & { baseUrl?: string }) {
  const prev = getEnvironment(specUrl);
  const profiles = { ...prev.profiles, ...(env.profiles || {}) };
  const active: EnvProfileId =
    env.active === "dev" || env.active === "sit" || env.active === "prod" ? env.active : prev.active;
  if (typeof env.baseUrl === "string") {
    profiles[active] = env.baseUrl.trim();
  }
  const next: TestEnvironment = { active, profiles, baseUrl: profiles[active] || "" };
  try {
    localStorage.setItem(key(specUrl), JSON.stringify({ active: next.active, profiles: next.profiles, baseUrl: next.baseUrl }));
  } catch {
    /* storage unavailable: the choice lasts until reload */
  }
  return next;
}

/** Switch active chip; keeps other profiles. */
export function selectEnvProfile(specUrl: string, active: EnvProfileId): TestEnvironment {
  return setEnvironment(specUrl, { active });
}

export const getToken = (specUrl: string) => tokens.get(specUrl) ?? "";

export function setToken(specUrl: string, token: string) {
  const t = token.trim().replace(/^Bearer\s+/i, "");
  if (t) tokens.set(specUrl, t);
  else tokens.delete(specUrl);
}

export const clearToken = (specUrl: string) => void tokens.delete(specUrl);

/** A base URL the agent will accept: absolute http(s). Returns an error message, or null when fine. */
export function validateBaseUrl(value: string): string | null {
  if (!value.trim()) return "Enter the base URL of the API under test.";
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:" ? null : "The base URL must start with http:// or https://";
  } catch {
    return "That is not a valid URL. Example: https://staging.example.com/api";
  }
}
