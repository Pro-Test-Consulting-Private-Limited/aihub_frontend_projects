import { beforeEach, describe, expect, it } from "vitest";
import type { AccountSpec } from "@/app/interfaces/api-testing";
import { setToken } from "./environment";
import { accountChip, clearAccounts, DEFAULT_ACCOUNT, formatDuration, getAccounts, getRunAccounts, jwtExp, setAccounts } from "./identities";

const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const jwt = (exp: number) => `${b64({ alg: "HS256" })}.${b64({ exp })}.sig`;
const now = Date.now();
const inSec = (s: number) => Math.floor(now / 1000) + s;
const account = (over: Partial<AccountSpec> = {}): AccountSpec => ({ id: "customer", lifecycle: "shared", source: "token", ...over });

describe("accounts (memory only)", () => {
  beforeEach(() => {
    clearAccounts("spec");
    setToken("spec", "");
  });

  it("the Connect-step token is the account `default`, ahead of the added accounts", () => {
    setToken("spec", "Bearer abc.def.ghi");
    setAccounts("spec", [account({ id: "admin", role: "admin", source: "credentials", credentials: { fields: { mobileNumber: "1", password: "p" } } })]);
    const run = getRunAccounts("spec");
    expect(run.map((a) => a.id)).toEqual([DEFAULT_ACCOUNT, "admin"]);
    expect(run[0]).toMatchObject({ source: "token", token: "abc.def.ghi" });
    expect(getAccounts("spec")).toHaveLength(1);
  });

  it("default is always sent, even without a token, so a login prerequisite has an account to fill", () => {
    expect(getRunAccounts("spec")).toEqual([{ id: DEFAULT_ACCOUNT, role: "unknown", lifecycle: "shared", source: "token" }]);
  });

  it("is never written to browser storage", () => {
    setAccounts("spec", [account({ token: "secret-token" })]);
    expect(JSON.stringify(Object.entries(globalThis.localStorage ?? {}))).not.toContain("secret-token");
  });
});

describe("token expiry in the browser", () => {
  it("reads exp from a JWT and returns null for an opaque token", () => {
    expect(jwtExp(jwt(2000000000))).toBe(2000000000);
    expect(jwtExp("opaque")).toBeNull();
    expect(jwtExp(undefined)).toBeNull();
  });

  it("formats durations", () => {
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(12 * 60)).toBe("12m");
    expect(formatDuration(3 * 3600)).toBe("3h");
  });

  it("chips: READY, EXPIRES IN, EXPIRED with and without a way to refresh, NO CREDENTIALS", () => {
    expect(accountChip(account({ token: "opaque" }), undefined, now).text).toBe("READY");
    expect(accountChip(account({ token: jwt(inSec(12 * 60 + 5)) }), undefined, now).text).toBe("EXPIRES IN 12m");
    expect(accountChip(account({ token: jwt(inSec(-10)) }), undefined, now)).toEqual({ text: "EXPIRED · NO CREDENTIALS", tone: "bad" });
    expect(accountChip(account({ token: jwt(inSec(-10)), source: "credentials", credentials: { fields: { password: "p" } } }), undefined, now).text).toBe("EXPIRED · WILL REFRESH");
    expect(accountChip(account({ id: "admin" }), undefined, now)).toEqual({ text: "NO CREDENTIALS", tone: "bad" });
    expect(accountChip(account({ lifecycle: "disposable", source: "register" }), undefined, now).text).toBe("NEW EACH RUN");
    expect(accountChip(account(), { id: "customer", status: "failed", source: "token", role: "customer", lifecycle: "shared", refreshable: false }, now).text).toBe("FAILED");
  });
});

describe("accounts change notifications", () => {
  it("tell listeners when accounts are added or removed, until they unsubscribe", async () => {
    const { subscribeAccounts } = await import("./identities");
    let calls = 0;
    const off = subscribeAccounts(() => void calls++);
    setAccounts("notify-spec", [account({ id: "a" })]);
    setAccounts("notify-spec", []);
    expect(calls).toBe(2);
    off();
    setAccounts("notify-spec", [account({ id: "b" })]);
    expect(calls).toBe(2);
    clearAccounts("notify-spec");
  });
});

describe("which account will call (mirrors the server)", () => {
  beforeEach(() => { clearAccounts("pick"); setToken("pick", ""); });

  it("uses an added account when `default` has no token, and `default` once it has one", async () => {
    const { likelyAccount } = await import("./identities");
    expect(likelyAccount("pick", "ready-customer", "")).toEqual({ id: DEFAULT_ACCOUNT, note: "no token yet" });
    setAccounts("pick", [account({ id: "customer", source: "register" })]);
    expect(likelyAccount("pick", "ready-customer", "")).toEqual({ id: "customer" });
    setToken("pick", "tok");
    expect(likelyAccount("pick", "ready-customer", "")).toEqual({ id: DEFAULT_ACCOUNT });
    expect(likelyAccount("pick", "ready-customer", "customer")).toEqual({ id: "customer" });
  });

  it("an admin endpoint needs an admin account, a fresh one gets a new account, a public one needs none", async () => {
    const { likelyAccount } = await import("./identities");
    expect(likelyAccount("pick", "admin", "")).toBeNull();
    setAccounts("pick", [account({ id: "boss", role: "admin", source: "credentials", credentials: { fields: { p: "x" } } })]);
    expect(likelyAccount("pick", "admin", "")).toEqual({ id: "boss" });
    expect(likelyAccount("pick", "any-customer", "")?.id).not.toBe("boss");
    expect(likelyAccount("pick", "fresh-customer", "")).toEqual({ id: "customer-fresh", note: "a new account, made automatically" });
    expect(likelyAccount("pick", "public", "")?.id).toBe("none");
  });
});
