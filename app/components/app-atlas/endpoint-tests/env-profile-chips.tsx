"use client";

import {
  ENV_PROFILE_IDS,
  ENV_PROFILE_LABEL,
  type EnvProfileId,
  type TestEnvironment,
} from "@/app/lib/api-testing/environment";

const chip =
  "rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize transition-colors";

/** Named base-URL targets (dev / sit / prod) for one Swagger spec. */
export function EnvProfileChips({
  env,
  onSelect,
}: {
  env: TestEnvironment;
  onSelect: (id: EnvProfileId) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] font-medium text-[#7E7E7E]">Env</span>
      {ENV_PROFILE_IDS.map((id) => {
        const active = env.active === id;
        const filled = !!(env.profiles[id] || "").trim();
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            title={filled ? env.profiles[id] : `No ${ENV_PROFILE_LABEL[id]} URL saved yet — enter one below`}
            className={`${chip} ${
              active
                ? "border-[#8664F2] bg-[#8664F2] text-white"
                : filled
                  ? "border-[#c4b5fd] bg-[#F5F1FF] text-[#5B3FC4] dark:bg-[#1c1530] dark:text-[#C4B5FD]"
                  : "border-[#E5E7EB] bg-white text-[#7E7E7E] dark:border-[#2a2a2a] dark:bg-[#141414]"
            }`}
          >
            {ENV_PROFILE_LABEL[id]}
            {filled && !active ? <span className="ml-1 opacity-70">·</span> : null}
          </button>
        );
      })}
      <span className="text-[10.5px] text-[#9ca3af]">
        {env.baseUrl ? `Active: ${ENV_PROFILE_LABEL[env.active]}` : "Pick a chip, then save its base URL"}
      </span>
    </div>
  );
}
