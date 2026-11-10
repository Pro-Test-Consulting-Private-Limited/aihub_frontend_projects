"use client";

import { useEffect, useState } from "react";
import { TbChevronDown, TbChevronRight, TbLoader2 } from "react-icons/tb";
import { apiAgent } from "@/app/services/api-testing";
import type { DependenciesResponse, EndpointDependency, RequirementKind } from "@/app/interfaces/api-testing";
import { getAccounts, requestAddAccount } from "@/app/lib/api-testing/identities";
import { box, label, mono, outlineButton } from "./ui";
import { likelyAccount } from "@/app/lib/api-testing/identities";

const REQUIREMENT_LABEL: Record<RequirementKind, string> = {
  public: "no account (public)",
  "any-customer": "any account with a valid token or API key",
  "fresh-customer": "a fresh customer account",
  "ready-customer": "a customer with a completed profile and verified email",
  "kyc-verified": "a customer with verified KYC and a balance",
  admin: "an admin account",
  "second-user": "a second user",
  "needs-secret": "a secret (a signature the tool cannot compute)",
  external: "an account created outside this API",
};
const ADD_ROLE: Partial<Record<RequirementKind, string>> = { admin: "admin", "kyc-verified": "customer-verified", "second-user": "customer-2", external: "external" };
const hasAccountFor = (specUrl: string, kind: RequirementKind) => {
  const list = getAccounts(specUrl);
  if (kind === "admin") return list.some((a) => a.role === "admin");
  if (kind === "kyc-verified") return list.some((a) => a.provides?.includes("kyc-verified"));
  if (kind === "second-user") return list.some((a) => a.id === "customer-2" || a.id === "otherUser");
  return list.length > 0;
};

// One lookup per spec per page load: every endpoint of the spec is classified at once.
const cache = new Map<string, DependenciesResponse>();

const describeNeed = (n: EndpointDependency["needs"][number]) => {
  const what = n.kind === "auth" ? "an access token" : n.kind === "path-param" ? `{${n.name}}` : n.kind === "query-param" ? `query ${n.name}` : `field ${n.name}`;
  if (n.providedBy) return `${what} from ${n.providedBy}${n.level === "possible" ? " (possible match)" : ""}`;
  return n.kind === "auth" ? `${what} (the spec has no call that returns one: paste it under Connect Swagger)` : `${what} (no endpoint in the spec returns it: you supply it)`;
};

/** Tells whether this endpoint can run on its own or needs other calls first, and lists the same for the whole spec. */
export function DependencyOverview({ specUrl, targetKey, hasPrerequisites, onAddSuggested, requirement, onRequirement }: { specUrl: string; targetKey: string; hasPrerequisites: boolean; onAddSuggested: () => Promise<void>; requirement: RequirementKind | ""; onRequirement: (k: RequirementKind | "") => void }) {
  const [data, setData] = useState<DependenciesResponse | null>(cache.get(specUrl) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (cache.has(specUrl)) return;
    const ctrl = new AbortController();
    apiAgent
      .dependencies(specUrl, ctrl.signal)
      .then((d) => {
        cache.set(specUrl, d);
        setData(d);
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : "Could not work out dependencies.");
      });
    return () => ctrl.abort();
  }, [specUrl]);

  if (error) return <div className="text-[12px] text-[#7E7E7E]">Dependencies unavailable: {error}</div>;
  if (!data) return <div className="flex items-center gap-1.5 text-[12px] text-[#7E7E7E]"><TbLoader2 size={13} className="animate-spin" /> Checking which APIs depend on others…</div>;

  const me = data.endpoints.find((e) => e.key === targetKey);
  const independent = data.endpoints.filter((e) => e.independent);
  const dependent = data.endpoints.filter((e) => !e.independent);

  return (
    <section className={`${box} px-3 py-3`}>
      {me && (
        <div className="flex flex-wrap items-start gap-2">
          <span className={`shrink-0 rounded-[4px] border px-2 py-0.5 text-[10.5px] font-bold tracking-wide ${me.independent ? "border-[#16A34A] bg-[#F0FDF4] text-[#16A34A]" : "border-[#D97706] bg-[#FFFBEB] text-[#D97706]"}`}>{me.independent ? "INDEPENDENT" : "DEPENDENT"}</span>
          <div className="min-w-0 flex-1 text-[12px] text-[#5E6066] dark:text-[#9ca3af]">
            {me.independent ? (
              <>
                This API needs nothing else first, so it can be tested on its own.
                {me.needs.some((n) => n.optional) && <> It can optionally use a real value instead of a made-up one: {me.needs.filter((n) => n.optional).map(describeNeed).join("; ")}.</>}
              </>
            ) : (
              <>
                Needs first: {me.needs.map(describeNeed).join("; ")}.
              </>
            )}
          </div>
          {!me.independent && !hasPrerequisites && me.dependsOn.length > 0 && (
            <button
              type="button"
              className={`${outlineButton} !px-2.5 !py-1 !text-[11.5px]`}
              disabled={adding}
              onClick={async () => {
                setAdding(true);
                try {
                  await onAddSuggested();
                } finally {
                  setAdding(false);
                }
              }}
            >
              {adding ? <TbLoader2 size={12} className="animate-spin" /> : null} Add prerequisites
            </button>
          )}
        </div>
      )}
      {me?.requirement && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[12px] text-[#5E6066] dark:text-[#9ca3af]">
          <span className="shrink-0 rounded-[4px] border border-[#8664F2] bg-[#F5F1FF] px-2 py-0.5 text-[10.5px] font-bold tracking-wide text-[#8664F2] dark:bg-[#1c1530]">NEEDS</span>
          <span className="min-w-0 flex-1" title={me.requirement.reason}>
            {REQUIREMENT_LABEL[requirement || me.requirement.kind]}
            <span className="text-[#7E7E7E]"> · {requirement ? "set by you" : `guessed from the spec, ${me.requirement.confidence} confidence`}: {requirement ? "you chose this" : me.requirement.reason}</span>
          </span>
          <select className="rounded-[6px] border border-[#D9D9D9] bg-white px-1.5 py-1 text-[11.5px] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] dark:text-[#ededed]" value={requirement} onChange={(e) => onRequirement(e.target.value as RequirementKind | "")} aria-label="Override what this endpoint needs">
            <option value="">Use the guess</option>
            {(Object.keys(REQUIREMENT_LABEL) as RequirementKind[]).map((k) => (
              <option key={k} value={k}>{REQUIREMENT_LABEL[k]}</option>
            ))}
          </select>
          {ADD_ROLE[requirement || me.requirement.kind] && !hasAccountFor(specUrl, requirement || me.requirement.kind) && (
            <button type="button" className={`${outlineButton} !px-2.5 !py-1 !text-[11.5px]`} onClick={() => requestAddAccount(ADD_ROLE[requirement || me.requirement!.kind] as string)}>
              Add account
            </button>
          )}
        </div>
      )}
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="mt-2.5 flex items-center gap-1 text-[11.5px] text-[#8664F2] hover:underline">
        {open ? <TbChevronDown size={12} /> : <TbChevronRight size={12} />} All APIs in this spec: {data.summary.independent} independent, {data.summary.dependent} dependent
      </button>
      {open && (
        <div className="mt-2 grid gap-3">
          <div>
            <div className={label}>Independent ({independent.length})</div>
            <ul className="space-y-0.5">
              {independent.map((e) => (
                <li key={e.key} className={`${mono} text-[11.5px] ${e.key === targetKey ? "font-semibold text-[#8664F2]" : "text-[#1F1F1F] dark:text-[#ededed]"}`}>{e.key}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className={label}>Dependent ({dependent.length})</div>
            <ul className="space-y-1">
              {dependent.map((e) => (
                <li key={e.key} className={`text-[11.5px] ${e.key === targetKey ? "text-[#8664F2]" : "text-[#1F1F1F] dark:text-[#ededed]"}`}>
                  <span className={`${mono} ${e.key === targetKey ? "font-semibold" : ""}`}>{e.key}</span>
                  <span className="text-[#7E7E7E]"> needs {e.needs.map((n) => (n.kind === "auth" ? "token" : n.name)).join(", ")}{e.dependsOn.length ? ` ← ${e.dependsOn.join(", ")}` : ""}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

/** The dependency answer for one endpoint, shared with DependencyOverview through the same per-spec cache. */
function useEndpointDependency(specUrl: string, key: string): EndpointDependency | undefined {
  const [data, setData] = useState<DependenciesResponse | null>(cache.get(specUrl) ?? null);
  useEffect(() => {
    if (cache.has(specUrl)) { setData(cache.get(specUrl) ?? null); return; }
    const ctrl = new AbortController();
    apiAgent.dependencies(specUrl, ctrl.signal).then((d) => { cache.set(specUrl, d); setData(d); }).catch(() => undefined);
    return () => ctrl.abort();
  }, [specUrl]);
  return data?.endpoints.find((e) => e.key === key);
}

/** One line before the Run button: who it will run as, what runs first, and what is missing. */
export function PreRunCheck({ specUrl, targetKey, runAs, requirement, prerequisiteCount, onSetup }: { specUrl: string; targetKey: string; runAs: string; requirement: RequirementKind | ""; prerequisiteCount: number; onSetup: () => void }) {
  const me = useEndpointDependency(specUrl, targetKey);
  const kind = requirement || me?.requirement?.kind;
  const who = runAs === "none" ? "no token" : runAs === "expired" ? "an expired token" : null;
  const pick = who ? null : likelyAccount(specUrl, kind, runAs);
  const missing = !runAs && kind && ADD_ROLE[kind] && kind !== "second-user" && kind !== "external" && !pick ? REQUIREMENT_LABEL[kind] : null;
  const noToken = pick?.note === "no token yet";
  // The token itself comes from the account (it signs up or logs in by itself), so it is not a "step first". Only the ids this call
  // uses (a pet id, an order id...) are.
  const dependsOn = me ? me.needs.filter((n) => n.kind !== "auth" && !n.optional && n.providedBy).map((n) => n.providedBy as string) : [];
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[8px] border px-3 py-2 text-[12px] ${missing || noToken ? "border-[#D97706] bg-[#FFFBEB] text-[#92400E] dark:bg-[#2a2008] dark:text-[#FCD34D]" : "border-[#E5E7EB] text-[#4B5563] dark:border-[#2a2a2a] dark:text-[#9ca3af]"}`}>
      <span className="shrink-0 font-semibold">Will run as</span>
      <span className={mono}>{who ?? pick?.id ?? "no account"}</span>
      {pick?.note && !noToken && <span>· {pick.note}</span>}
      {noToken && <span>· no token yet: add an account or paste one</span>}
      {prerequisiteCount > 0 ? <span>· {prerequisiteCount} step{prerequisiteCount === 1 ? "" : "s"} first</span> : dependsOn.length > 0 ? <span>· needs {[...new Set(dependsOn)].slice(0, 2).join(", ")} first</span> : null}
      {missing && <span>· no account for {missing} yet</span>}
      <button type="button" className="ml-auto shrink-0 text-[#8664F2] hover:underline" onClick={onSetup}>{missing || noToken || (dependsOn.length > 0 && prerequisiteCount === 0) ? "Fix in Setup" : "Setup"}</button>
    </div>
  );
}
