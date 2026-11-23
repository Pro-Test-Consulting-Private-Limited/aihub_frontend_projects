"use client";

import type { DeadFlagHit } from "@/app/interfaces/appatlas";
import {
  QUALITY_CHIP_SHORT_LABEL,
  QUALITY_GROUP_LABEL,
  QUALITY_GROUP_ORDER,
  highlightQualityRow,
} from "../sit-dead-finder";

const QUALITY_SET = new Set(QUALITY_GROUP_ORDER);

function chipShortLabel(flag: DeadFlagHit["flag"]): string {
  return QUALITY_CHIP_SHORT_LABEL[flag] || QUALITY_GROUP_LABEL[flag] || flag;
}

/** R7-05 / R10-01: amber flag chip with SHORT labels; tooltip keeps full plain-words reasons. */
export function SitQualityFlagChip({
  hits,
  onJumpToCase,
}: {
  hits: DeadFlagHit[] | undefined;
  onJumpToCase?: (caseId: string) => void;
}) {
  const quality = (hits || []).filter((h) => QUALITY_SET.has(h.flag));
  if (!quality.length) return null;
  const short = chipShortLabel(quality[0]!.flag);
  const extra = quality.length > 1 ? ` +${quality.length - 1}` : "";
  const tip = quality.map((h) => h.reason).join("\n");
  return (
    <span
      className="inline-block max-w-full shrink-0 truncate rounded-full border border-[#fde68a] bg-[#fffbeb] px-1.5 py-0.5 text-[12px] font-semibold text-[#92400e]"
      title={tip}
      data-testid="sit-quality-flag-chip"
    >
      {short}
      {extra}
    </span>
  );
}

/** R7-05/R7-06: list of quality reasons; duplicate links jump to peer case. */
export function SitQualityReasons({
  hits,
}: {
  hits: DeadFlagHit[] | undefined;
}) {
  const quality = (hits || []).filter((h) => QUALITY_SET.has(h.flag));
  if (!quality.length) return null;
  return (
    <div className="space-y-1" data-testid="sit-expand-quality">
      <div className="text-[12px] font-semibold text-[#92400e]">Quality</div>
      <ul className="m-0 list-none space-y-1 p-0 text-[13px] text-[#78350f]">
        {quality.map((h, i) => {
          const peer = h.reason.match(/\b([A-Z]+-\d+(?:-\d+)?)\b/);
          return (
            <li key={`${h.flag}-${i}`}>
              {h.reason}
              {h.flag === "duplicate_case" && peer?.[1] ? (
                <>
                  {" "}
                  <button
                    type="button"
                    className="font-medium text-[#8664F2] underline"
                    data-testid="sit-quality-jump-dup"
                    onClick={() => {
                      const el = document.querySelector(`[data-case-id="${peer[1]}"]`) as HTMLElement | null;
                      if (el?.dataset?.rowId) highlightQualityRow(el.dataset.rowId);
                      else {
                        const row = [...document.querySelectorAll("[data-row-id]")].find((n) =>
                          n.textContent?.includes(peer[1]!),
                        ) as HTMLElement | undefined;
                        if (row?.dataset?.rowId) highlightQualityRow(row.dataset.rowId);
                      }
                    }}
                  >
                    Go to {peer[1]}
                  </button>
                </>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
