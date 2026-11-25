import { describe, expect, it } from "vitest";
import { DEFAULT_PERSONA, personaSummary, personaToSessionFields } from "./persona";

describe("personaToSessionFields", () => {
  it("maps Bangalore city to geo + timezone", () => {
    const fields = personaToSessionFields({
      ...DEFAULT_PERSONA,
      geoId: "bengaluru",
      locale: "en-IN",
      permissionLocation: "allow",
    });
    expect(fields.geolocation).toEqual({ latitude: 12.9716, longitude: 77.5946 });
    expect(fields.timezoneId).toBe("Asia/Kolkata");
    expect(fields.permissions).toContain("geolocation");
  });

  it("summarises for the chip", () => {
    expect(personaSummary({ ...DEFAULT_PERSONA, colorScheme: "dark", locale: "ja-JP" })).toMatch(/Dark/);
  });
});
