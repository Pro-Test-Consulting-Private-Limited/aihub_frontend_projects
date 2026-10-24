"use client";

/**
 * The test target for a Swagger spec: where requests are sent. Using the product means agreeing that this is a test
 * environment, so there is no per-run confirmation.
 * The base URL is not secret and is kept in this browser, per spec.
 * The bearer token is a secret: it lives in this module's memory only and is gone on reload.
 */
export type TestEnvironment = { baseUrl: string };

const key = (specUrl: string) => `api-testing-env:${specUrl}`;
const tokens = new Map<string, string>();

export function getEnvironment(specUrl: string): TestEnvironment {
  try {
    const raw = localStorage.getItem(key(specUrl));
    if (raw) {
      const v = JSON.parse(raw) as Partial<TestEnvironment>;
      return { baseUrl: typeof v.baseUrl === "string" ? v.baseUrl : "" };
    }
  } catch {
    /* storage unavailable or corrupt: fall through to the defaults */
  }
  return { baseUrl: "" };
}

export function setEnvironment(specUrl: string, env: TestEnvironment) {
  try {
    localStorage.setItem(key(specUrl), JSON.stringify({ baseUrl: env.baseUrl.trim() }));
  } catch {
    /* storage unavailable: the choice lasts until reload */
  }
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
