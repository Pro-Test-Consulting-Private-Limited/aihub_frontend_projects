import type { SessionEmulationPrefs } from "./session-emulation";

export type ColorSchemePref = "light" | "dark" | "no-preference";
export type PermissionPref = "allow" | "deny" | "ask";

export type PersonaPrefs = {
  colorScheme: ColorSchemePref;
  reducedMotion: boolean;
  locale: string;
  timezoneId: string;
  geoId: string | null;
  permissionLocation: PermissionPref;
  permissionNotifications: PermissionPref;
  permissionCameraMic: PermissionPref;
};

export const DEFAULT_PERSONA: PersonaPrefs = {
  colorScheme: "no-preference",
  reducedMotion: false,
  locale: "en-US",
  timezoneId: "UTC",
  geoId: null,
  permissionLocation: "ask",
  permissionNotifications: "ask",
  permissionCameraMic: "ask",
};

export const PERSONA_LOCALES: { id: string; label: string; flag: string; timezone: string }[] = [
  { id: "en-IN", label: "English (India)", flag: "🇮🇳", timezone: "Asia/Kolkata" },
  { id: "en-US", label: "English (US)", flag: "🇺🇸", timezone: "America/New_York" },
  { id: "hi-IN", label: "Hindi (India)", flag: "🇮🇳", timezone: "Asia/Kolkata" },
  { id: "de-DE", label: "German", flag: "🇩🇪", timezone: "Europe/Berlin" },
  { id: "fr-FR", label: "French", flag: "🇫🇷", timezone: "Europe/Paris" },
  { id: "ja-JP", label: "Japanese", flag: "🇯🇵", timezone: "Asia/Tokyo" },
  { id: "ar-SA", label: "Arabic", flag: "🇸🇦", timezone: "Asia/Riyadh" },
];

export const PERSONA_CITIES: {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  timezone: string;
}[] = [
  { id: "bengaluru", label: "Bangalore", latitude: 12.9716, longitude: 77.5946, timezone: "Asia/Kolkata" },
  { id: "london", label: "London", latitude: 51.5074, longitude: -0.1278, timezone: "Europe/London" },
  { id: "nyc", label: "New York", latitude: 40.7128, longitude: -74.006, timezone: "America/New_York" },
  { id: "singapore", label: "Singapore", latitude: 1.3521, longitude: 103.8198, timezone: "Asia/Singapore" },
  { id: "berlin", label: "Berlin", latitude: 52.52, longitude: 13.405, timezone: "Europe/Berlin" },
];

const PERSONA_KEY = "appatlas-persona";

export function loadPersona(): PersonaPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_PERSONA };
  try {
    const raw = localStorage.getItem(PERSONA_KEY);
    if (!raw) return { ...DEFAULT_PERSONA };
    const p = JSON.parse(raw) as Partial<PersonaPrefs>;
    return { ...DEFAULT_PERSONA, ...p };
  } catch {
    return { ...DEFAULT_PERSONA };
  }
}

export function savePersona(p: PersonaPrefs) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PERSONA_KEY, JSON.stringify(p));
}

export function personaSummary(p: PersonaPrefs): string {
  const loc = PERSONA_LOCALES.find((l) => l.id === p.locale);
  const city = PERSONA_CITIES.find((c) => c.id === p.geoId);
  const scheme =
    p.colorScheme === "no-preference" ? "System" : p.colorScheme === "dark" ? "Dark" : "Light";
  const parts = [scheme, loc ? `${loc.flag} ${loc.id}` : p.locale];
  if (city) parts.push(city.label);
  if (p.reducedMotion) parts.push("Reduce motion");
  return parts.join(" · ");
}

/** Map persona → optional POST /sessions fields (all already supported by the backend). */
export function personaToSessionFields(p: PersonaPrefs): Partial<{
  locale: string;
  timezoneId: string;
  colorScheme: ColorSchemePref;
  reducedMotion: "reduce" | "no-preference";
  geolocation: { latitude: number; longitude: number } | null;
  permissions: string[];
}> {
  const city = PERSONA_CITIES.find((c) => c.id === p.geoId);
  const permissions: string[] = [];
  if (p.permissionLocation === "allow") permissions.push("geolocation");
  if (p.permissionNotifications === "allow") permissions.push("notifications");
  if (p.permissionCameraMic === "allow") {
    permissions.push("camera", "microphone");
  }
  return {
    locale: p.locale,
    timezoneId: city?.timezone || p.timezoneId,
    colorScheme: p.colorScheme,
    reducedMotion: p.reducedMotion ? "reduce" : "no-preference",
    geolocation: city ? { latitude: city.latitude, longitude: city.longitude } : null,
    permissions,
  };
}

export type SessionPrefsWithPersona = SessionEmulationPrefs & { persona?: PersonaPrefs };
