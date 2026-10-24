import { describe, expect, it } from "vitest";
import { clearSession, getSession, mergeSession, sessionKey } from "./session-cache";

describe("session cache", () => {
  it("keys by spec and base URL, ignoring a trailing slash", () => {
    expect(sessionKey("s", "https://a.test/api/")).toBe(sessionKey("s", "https://a.test/api"));
    expect(sessionKey("s", "https://a.test")).not.toBe(sessionKey("t", "https://a.test"));
  });
  it("merges values, returns copies and clears", () => {
    const k = sessionKey("spec", "https://a.test");
    expect(getSession(k)).toEqual({});
    mergeSession(k, { token: "t1" });
    mergeSession(k, { id: "7" });
    const got = getSession(k);
    expect(got).toEqual({ token: "t1", id: "7" });
    got.token = "changed";
    expect(getSession(k).token).toBe("t1");
    clearSession(k);
    expect(getSession(k)).toEqual({});
  });
  it("is never persisted to browser storage", () => {
    const store: Record<string, string> = {};
    const g = globalThis as unknown as { localStorage?: unknown; sessionStorage?: unknown };
    const spy = { setItem: (k: string, v: string) => void (store[k] = v), getItem: () => null, removeItem: () => {} };
    g.localStorage = spy;
    g.sessionStorage = spy;
    mergeSession("k2", { token: "secret" });
    expect(Object.keys(store)).toHaveLength(0);
  });
});
