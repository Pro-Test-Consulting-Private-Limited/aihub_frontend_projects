"use client";

import { useState } from "react";
import { TbLoader2, TbWand } from "react-icons/tb";
import { apiAgent } from "@/app/services/api-testing";
import type { AccountSpec, GateRow } from "@/app/interfaces/api-testing";
import { getAccounts, likelyAccount, requestAddAccount, setAccounts, suggestionCache } from "@/app/lib/api-testing/identities";
import { newId } from "@/app/lib/api-testing/rows";
import type { TestState } from "@/app/hooks/use-endpoint-tests";
import { box, outlineButton } from "./ui";

type AccountSuggestionLike = Parameters<typeof suggestionCache.set>[1]["identities"][number];
type Outcome = { added: string[]; already: string[]; todo: { text: string; role: string }[]; caller: string | null; callerWarn: boolean };

/**
 * One click for the setup of this endpoint: the accounts it needs that can be created without you (a new account per run),
 * and the calls that must run first (the ones that create the ids it uses). What only you can supply (an admin login, an account
 * with verified KYC) is listed with a button, not guessed.
 */
export function SetupForMe({ specUrl, row, state, patch, secured }: { specUrl: string; row: GateRow; state: TestState; patch: (p: Partial<TestState>) => void; secured: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const added: string[] = [];
      const already: string[] = [];
      const todo: Outcome["todo"] = [];
      const strip = (s: AccountSuggestionLike): AccountSpec => {
        const { reason: _r, confidence: _c, needs: _n, forEndpoints: _f, ...spec } = s;
        void [_r, _c, _n, _f];
        return spec as AccountSpec;
      };

      // 1) accounts
      let info = suggestionCache.get(specUrl);
      if (!info) {
        info = await apiAgent.suggestIdentities(specUrl);
        suggestionCache.set(specUrl, info);
      }
      const have = getAccounts(specUrl);
      const toAdd: AccountSpec[] = [];
      for (const s of info.identities.filter((i) => i.forEndpoints.includes(row.key))) {
        if (have.some((a) => a.id === s.id)) { already.push(`account ${s.id}`); continue; }
        if (s.needs === null) {
          toAdd.push(strip(s));
          added.push(`account ${s.id}${s.lifecycle === "disposable" ? " (a new one every run)" : ""}`);
        } else todo.push({ text: `${s.id}: ${s.reason}`, role: s.id === "admin" ? "admin" : s.id });
      }
      // A secured endpoint with no account able to call yet: add the plain customer that signs itself up.
      const anyCaller = likelyAccount(specUrl, state.requirement || undefined, state.runAs);
      const callable = anyCaller && anyCaller.note !== "no token yet";
      if (secured && !callable && toAdd.length === 0 && !state.runAs) {
        const customer = info.identities.find((i) => i.needs === null && i.lifecycle !== "disposable" && !have.some((a) => a.id === i.id));
        if (customer) { toAdd.push(strip(customer)); added.push(`account ${customer.id}`); }
      }
      if (toAdd.length) setAccounts(specUrl, [...have, ...toAdd]);

      // 2) the calls that must run first: only clear matches (the ones that create an id this endpoint uses)
      if (state.prerequisites.length > 0) already.push(`${state.prerequisites.length} first step${state.prerequisites.length === 1 ? "" : "s"}`);
      else {
        const res = await apiAgent.suggestPrerequisites(specUrl, row.path, row.method);
        const useful = res.suggestions.filter((s) => !s.defaultHeader && !s.optional && s.level !== "possible");
        if (useful.length) {
          patch({ prerequisites: useful.map((s) => ({ id: newId(), endpoint: s.endpoint, request: s.request ?? {}, extract: s.extract, cache: s.cache, origin: "suggested" as const, reason: s.reason })) });
          added.push(...useful.map((s) => `step ${s.endpoint.method} ${s.endpoint.path}`));
        }
      }
      // 3) who will call now
      const caller = secured ? likelyAccount(specUrl, state.requirement || undefined, state.runAs) : { id: "none", note: "no token needed" };
      setOutcome({ added, already, todo, caller: caller ? `${caller.id}${caller.note && caller.note !== "no token yet" ? ` (${caller.note})` : ""}` : null, callerWarn: !caller || caller.note === "no token yet" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not set this endpoint up.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`${box} space-y-2 px-3 py-2.5`}>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 text-[12px] text-[#5E6066] dark:text-[#9ca3af]">Let the tool add the accounts and first steps this endpoint needs.</div>
        <button type="button" className={`${outlineButton} shrink-0 !px-2.5 !py-1 !text-[11.5px]`} onClick={run} disabled={busy}>
          {busy ? <TbLoader2 size={12} className="animate-spin" /> : <TbWand size={12} />} Set up for me
        </button>
      </div>
      {error && <div className="text-[12px] text-[#DC2626]">{error}</div>}
      {outcome && (
        <div className="space-y-1 text-[12px]">
          {outcome.added.length > 0 && <div className="text-[#16A34A]">Added: {outcome.added.join(", ")}.</div>}
          {outcome.already.length > 0 && <div className="text-[#5E6066] dark:text-[#9ca3af]">Already set up: {outcome.already.join(", ")}.</div>}
          {outcome.added.length === 0 && outcome.already.length === 0 && outcome.todo.length === 0 && <div className="text-[#7E7E7E]">This endpoint needs no extra account or first step.</div>}
          <div className={outcome.callerWarn ? "text-[#92400E] dark:text-[#FCD34D]" : "text-[#1F1F1F] dark:text-[#ededed]"}>
            {outcome.caller ? <>Will run as <span className="font-mono">{outcome.caller}</span>.</> : "No account can call this yet: add a token or login data."}
          </div>
          {outcome.todo.map((t) => (
            <div key={t.text} className="flex items-start gap-2 text-[#92400E] dark:text-[#FCD34D]">
              <span className="min-w-0 flex-1">Still needs you: {t.text}</span>
              <button type="button" className="shrink-0 text-[#8664F2] hover:underline" onClick={() => requestAddAccount(t.role)}>Set up</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
