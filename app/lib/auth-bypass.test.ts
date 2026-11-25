import { describe, expect, it, vi, afterEach } from "vitest";

describe("isLocalAuthBypassEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("is always false when NODE_ENV is production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_BYPASS_LOCAL", "1");
    vi.stubEnv("NEXT_PUBLIC_AUTH_BYPASS_LOCAL", "1");
    const { isLocalAuthBypassEnabled } = await import("./auth-bypass");
    expect(isLocalAuthBypassEnabled()).toBe(false);
  });

  it("is false when flag is off in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_BYPASS_LOCAL", "0");
    vi.stubEnv("NEXT_PUBLIC_AUTH_BYPASS_LOCAL", "0");
    const { isLocalAuthBypassEnabled } = await import("./auth-bypass");
    expect(isLocalAuthBypassEnabled()).toBe(false);
  });
});
