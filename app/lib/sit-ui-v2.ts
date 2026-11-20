/**
 * SIT Testing UI v2 feature flag.
 * Default OFF. Enable with NEXT_PUBLIC_SIT_UI_V2=1 (build-time) or localStorage sit_ui_v2=1.
 */
export function isSitUiV2Enabled(): boolean {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SIT_UI_V2 === "1") return true;
  if (typeof window !== "undefined") {
    try {
      if (window.localStorage.getItem("sit_ui_v2") === "1") return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}
