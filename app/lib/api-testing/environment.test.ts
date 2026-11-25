import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getEnvironment, selectEnvProfile, setEnvironment } from "./environment";

const store = new Map<string, string>();

describe("api-testing environment profiles", () => {
  beforeEach(() => {
    store.clear();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("migrates legacy { baseUrl } into the active profile", () => {
    store.set("api-testing-env:https://spec", JSON.stringify({ baseUrl: "https://dev.example/api" }));
    const e = getEnvironment("https://spec");
    expect(e.active).toBe("dev");
    expect(e.baseUrl).toBe("https://dev.example/api");
    expect(e.profiles.dev).toBe("https://dev.example/api");
  });

  it("keeps separate base URLs per chip", () => {
    setEnvironment("https://spec", { active: "dev", baseUrl: "https://dev.example" });
    setEnvironment("https://spec", { active: "sit", baseUrl: "https://sit.example" });
    expect(getEnvironment("https://spec").profiles.dev).toBe("https://dev.example");
    expect(selectEnvProfile("https://spec", "dev").baseUrl).toBe("https://dev.example");
    expect(selectEnvProfile("https://spec", "sit").baseUrl).toBe("https://sit.example");
  });
});
