/**
 * SIT Testing UI v2 feature flag.
 *
 * Priority:
 * 1. localStorage.sit_ui_v2 === "0" → force legacy (escape hatch on DEV)
 * 2. localStorage.sit_ui_v2 === "1" → force v2
 * 3. NEXT_PUBLIC_SIT_UI_V2 === "1" → v2 (DEV build default)
 * 4. otherwise → legacy
 */
export function isSitUiV2Enabled(): boolean {
  if (typeof window !== "undefined") {
    try {
      const ls = window.localStorage.getItem("sit_ui_v2");
      if (ls === "0") return false;
      if (ls === "1") return true;
    } catch {
      /* ignore */
    }
  }
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SIT_UI_V2 === "1") return true;
  return false;
}
