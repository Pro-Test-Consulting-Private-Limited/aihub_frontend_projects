/**
 * Round 14 Step 0: the pre-fix dual-count path kept for failing tests only.
 * Do not use in UI.
 */
import type { SitSheetRow } from "@/app/interfaces/appatlas";
import { liveCaseCount } from "./sit-scope";

/** Old pill badge formula: prefer cached liveCounts snapshot. */
export function legacyPillCount(
  allWorkingRows: SitSheetRow[],
  liveCounts: Record<string, number>,
  key: string,
): number {
  return liveCounts[key] ?? liveCaseCount(allWorkingRows, key);
}

/** After Add with setWorkbook-only, All moves but cache does not. */
export function legacyAllVsPillSum(
  allWorkingRows: SitSheetRow[],
  liveCounts: Record<string, number>,
  keys: string[],
): { all: number; pillSum: number; diff: number } {
  const all = liveCaseCount(allWorkingRows);
  const pillSum = keys.reduce((n, k) => n + legacyPillCount(allWorkingRows, liveCounts, k), 0);
  return { all, pillSum, diff: all - pillSum };
}
