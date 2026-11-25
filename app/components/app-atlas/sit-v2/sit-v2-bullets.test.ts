import { describe, expect, it } from "vitest";
import { normalizeBulletText, bulletLines } from "./sit-v2-bullets";

describe("Round 4 B5 bullet normalize", () => {
  it("strips leading dashes and leaked numbering", () => {
    const raw = "- Page open\n- 2. Second item\n* 3) Third\n  double   spaces";
    expect(normalizeBulletText(raw)).toBe("Page open\nSecond item\nThird\ndouble spaces");
    expect(bulletLines(raw)).toHaveLength(4);
  });
});
