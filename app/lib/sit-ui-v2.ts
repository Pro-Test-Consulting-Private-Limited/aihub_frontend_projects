/**
 * SIT Testing UI v2 feature flag.
 *
 * Priority:
 * 1. localStorage.sit_ui_v2 === "0" → force legacy (escape hatch on DEV)
 * 2. localStorage.sit_ui_v2 === "1" → force v2
 * 3. NEXT_PUBLIC_SIT_UI_V2 === "1" → v2 (DEV build default)
 * 4. otherwise → legacy
 *
 * Keep the env value in a uniquely named module const so minifiers cannot
 * confuse it with webpack module bindings (e.g. short `tC` ids).
 */
const SIT_UI_V2_BUILD_FLAG: string = process.env.NEXT_PUBLIC_SIT_UI_V2 || "";

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
  return SIT_UI_V2_BUILD_FLAG === "1";
}
