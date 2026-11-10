import { beforeEach, describe, expect, it } from "vitest";
import type { PrerequisiteStep } from "@/app/interfaces/api-testing";
import { clearShared, cloneSteps, getSharedSetup, getSharedVariables, setSharedSetup, setSharedVariables, stopSharingSetup } from "./shared-setup";

const step = (id: string): PrerequisiteStep => ({ id, endpoint: { method: "POST", path: "/auth/register" }, request: { body: { a: 1 } }, extract: [{ name: "token", source: "body", path: "$.token", secret: true }], cache: true });

describe("setup shared by the endpoints of a spec", () => {
  beforeEach(() => clearShared("spec"));

  it("variables are kept per spec", () => {
    expect(getSharedVariables("spec")).toBeUndefined();
    setSharedVariables("spec", { otherUserToken: "t" });
    expect(getSharedVariables("spec")).toEqual({ otherUserToken: "t" });
    expect(getSharedVariables("other")).toBeUndefined();
  });

  it("shares steps and headers, hands out copies with new ids, and can stop sharing without losing the variables", () => {
    setSharedVariables("spec", { v: "1" });
    expect(getSharedSetup("spec")).toBeNull();
    setSharedSetup("spec", [step("a")], { H: "x" });
    const got = getSharedSetup("spec")!;
    expect(got.prerequisites).toHaveLength(1);
    expect(got.defaultHeaders).toEqual({ H: "x" });
    const copy = cloneSteps(got.prerequisites);
    expect(copy[0].id).not.toBe("a");
    copy[0].extract[0].name = "changed";
    (copy[0].request as { body: { a: number } }).body.a = 2;
    expect(getSharedSetup("spec")!.prerequisites[0].extract[0].name).toBe("token");
    expect((getSharedSetup("spec")!.prerequisites[0].request as { body: { a: number } }).body.a).toBe(1);
    stopSharingSetup("spec");
    expect(getSharedSetup("spec")).toBeNull();
    expect(getSharedVariables("spec")).toEqual({ v: "1" });
  });
});
