"use client";

import type { AccountSpec, IdentityReport, IdentitySuggestionsResponse } from "@/app/interfaces/api-testing";
import { getToken } from "./environment";

/**
 * Accounts ("who is calling") for a Swagger spec. Memory only, like the bearer token and for the same reason: they hold tokens and
 * passwords. Nothing here is written to localStorage, sessionStorage or logs, and a page reload starts clean.
 *
 * The token typed in the Connect Swagger step is the account `default` (source: token): the starting value, never replaced by
 * another account's token. Other accounts are added in the Accounts section.
 */
export const DEFAULT_ACCOUNT = "default";

const accounts = new Map<string, AccountSpec[]>();
const statuses = new Map<string, IdentityReport[]>();

/** The accounts added by the person (without `default`, which is the Connect-step token). */
export const getAccounts = (specUrl: string): AccountSpec[] => [...(accounts.get(specUrl) ?? [])];

const changed = new Set<() => void>();
/** Called whenever the accounts of any spec change (added by the form, by "Set up for me", removed). */
export const subscribeAccounts = (fn: () => void) => {
  changed.add(fn);
  return () => void changed.delete(fn);
};
/** What the spec's suggest call answered, kept so the form, the recommendations and "Set up for me" ask once. */
export const suggestionCache = new Map<string, IdentitySuggestionsResponse>();

export function setAccounts(specUrl: string, list: AccountSpec[]) {
  if (list.length) accounts.set(specUrl, list);
  else accounts.delete(specUrl);
  changed.forEach((fn) => fn());
}

/** Every account a run may use: `default` (the Connect-step token, possibly empty) plus the added ones. */
export function getRunAccounts(specUrl: string): AccountSpec[] {
  const token = getToken(specUrl);
  return [{ id: DEFAULT_ACCOUNT, role: "unknown", lifecycle: "shared", source: "token", ...(token ? { token } : {}) }, ...getAccounts(specUrl)];
}

export const getStatuses = (specUrl: string): IdentityReport[] => [...(statuses.get(specUrl) ?? [])];
export function setStatuses(specUrl: string, report: IdentityReport[]) {
  // A run that did not touch an account keeps what we knew about it.
  const merged = new Map((statuses.get(specUrl) ?? []).map((r) => [r.id, r]));
  for (const r of report) merged.set(r.id, r);
  statuses.set(specUrl, [...merged.values()]);
}
export const clearAccounts = (specUrl: string) => {
  accounts.delete(specUrl);
  statuses.delete(specUrl);
};

/** exp (seconds) of a JWT, or null for an opaque / malformed token. Decoded in the browser: nothing is sent for this. */
export function jwtExp(token: string | undefined): number | null {
  if (!token) return null;
  const parts = token.trim().replace(/^Bearer\s+/i, "").split(".");
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=")));
    return typeof json?.exp === "number" ? json.exp : null;
  } catch {
    return null;
  }
}

export function formatDuration(sec: number): string {
  const s = Math.abs(Math.round(sec));
  if (s < 90) return `${s}s`;
  if (s < 90 * 60) return `${Math.round(s / 60)}m`;
  if (s < 48 * 3600) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

export type AccountChip = { text: string; tone: "ok" | "warn" | "bad" | "muted" };

/** What the chip next to an account says: READY, EXPIRES IN 12m, EXPIRED, NO CREDENTIALS, CREATED, FAILED... */
export function accountChip(spec: AccountSpec, report: IdentityReport | undefined, now = Date.now()): AccountChip {
  const hasCreds = !!spec.credentials && Object.keys(spec.credentials.fields).length > 0;
  const refreshable = hasCreds || spec.source === "register" || spec.lifecycle === "disposable";
  if (report?.status === "failed") return { text: "FAILED", tone: "bad" };
  if (spec.lifecycle === "disposable") return { text: report?.status === "created" ? "CREATED THIS RUN" : "NEW EACH RUN", tone: "muted" };
  const exp = jwtExp(spec.token);
  if (exp !== null && exp * 1000 - 30000 <= now) return refreshable ? { text: "EXPIRED · WILL REFRESH", tone: "warn" } : { text: "EXPIRED · NO CREDENTIALS", tone: "bad" };
  if (report?.status === "expired") return { text: refreshable ? "EXPIRED · WILL REFRESH" : "EXPIRED · NO CREDENTIALS", tone: refreshable ? "warn" : "bad" };
  if (report?.status === "refreshed") return { text: "REFRESHED", tone: "ok" };
  if (report?.status === "created") return { text: "CREATED", tone: "ok" };
  if (exp !== null) return { text: `EXPIRES IN ${formatDuration(exp - now / 1000)}`, tone: exp - now / 1000 < 300 ? "warn" : "ok" };
  if (spec.token) return { text: "READY", tone: "ok" };
  if (report?.expiresInSec !== undefined) return { text: `EXPIRES IN ${formatDuration(report.expiresInSec)}`, tone: "ok" };
  if (report?.status === "ready") return { text: "READY", tone: "ok" };
  return refreshable ? { text: "LOGS IN ON RUN", tone: "muted" } : { text: spec.id === DEFAULT_ACCOUNT ? "NO TOKEN" : "NO CREDENTIALS", tone: spec.id === DEFAULT_ACCOUNT ? "muted" : "bad" };
}

// A tiny signal so a result ("needs an admin account") can open the Add account form without threading props through every tab.
type AddRequest = { role: string };
const listeners = new Set<(r: AddRequest) => void>();
export const onAddAccountRequest = (fn: (r: AddRequest) => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};
export const requestAddAccount = (role: string) => listeners.forEach((fn) => fn({ role }));

/**
 * The account a run will use when "Run this endpoint as" is Automatic. Mirrors the server: an explicit choice wins; an endpoint that
 * needs an admin / a verified account / a fresh one uses the account that is that; otherwise `default` if it has a token, else the first
 * added account that can get one (login data, register, or a pasted token). Returns null when no account can call.
 */
export function likelyAccount(specUrl: string, kind: string | undefined, runAs: string): { id: string; note?: string } | null {
  if (runAs) return { id: runAs };
  const all = getRunAccounts(specUrl);
  const canCall = (a: AccountSpec) => !!a.token || (!!a.credentials && Object.keys(a.credentials.fields).length > 0) || a.source === "register" || a.lifecycle === "disposable";
  if (kind === "admin") { const a = all.find((x) => x.role === "admin" && canCall(x)); return a ? { id: a.id } : null; }
  if (kind === "kyc-verified") { const a = all.find((x) => x.provides?.includes("kyc-verified") && canCall(x)); return a ? { id: a.id } : null; }
  if (kind === "fresh-customer") { const a = all.find((x) => x.lifecycle === "disposable" && x.role !== "admin" && !/^(customer-2|otherUser)$/.test(x.id)); return a ? { id: a.id, note: "a new account every run" } : { id: "customer-fresh", note: "a new account, made automatically" }; }
  if (kind === "public") return { id: "none", note: "no token needed" };
  const d = all.find((x) => x.id === DEFAULT_ACCOUNT);
  if (d?.token) return { id: DEFAULT_ACCOUNT };
  const a = all.find((x) => x.id !== DEFAULT_ACCOUNT && x.lifecycle !== "disposable" && x.role !== "admin" && canCall(x));
  return a ? { id: a.id } : d ? { id: DEFAULT_ACCOUNT, note: "no token yet" } : null;
}
