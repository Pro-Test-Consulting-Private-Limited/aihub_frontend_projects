import { describe, expect, it } from "vitest";
import type { RunResult } from "@/app/interfaces/api-testing";
import { plainCause } from "./plain-cause";

const r = (status: RunResult["status"], code?: number): RunResult => ({ id: "1", name: "t", kind: "scenario", status, request: null, response: code === undefined ? null : { status: code, headers: {}, body: null, contentType: null }, durationMs: 1, checks: [] } as unknown as RunResult);

describe("plain-words cause of a failure", () => {
  it("explains the usual status codes, only for failed calls that got an answer", () => {
    expect(plainCause(r("failed", 401))).toMatch(/token/);
    expect(plainCause(r("failed", 403))).toMatch(/not allowed/);
    expect(plainCause(r("failed", 404))).toMatch(/Not found/);
    expect(plainCause(r("failed", 409))).toMatch(/conflict/i);
    expect(plainCause(r("failed", 422))).toMatch(/rejected the data/);
    expect(plainCause(r("failed", 429))).toMatch(/Too many/);
    expect(plainCause(r("failed", 503))).toMatch(/not in the test/);
    expect(plainCause(r("passed", 200))).toBeNull();
    expect(plainCause(r("failed"))).toBeNull();
    expect(plainCause(r("failed", 418))).toBeNull();
  });
});
