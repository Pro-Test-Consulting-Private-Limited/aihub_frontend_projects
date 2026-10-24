"use client";

import { useEffect, useRef, useState } from "react";
import { TbBulb, TbChevronDown, TbChevronRight, TbLoader2, TbLock, TbPlus, TbRefresh, TbTrash, TbUserPlus } from "react-icons/tb";
import { apiAgent } from "@/app/services/api-testing";
import type { AccountSpec, AccountSuggestion, IdentitySuggestionsResponse } from "@/app/interfaces/api-testing";
import { getToken } from "@/app/lib/api-testing/environment";
import { accountChip, DEFAULT_ACCOUNT, getAccounts, getRunAccounts, getStatuses, likelyAccount, onAddAccountRequest, setAccounts, setStatuses, subscribeAccounts, suggestionCache, type AccountChip } from "@/app/lib/api-testing/identities";
import { getSession, mergeSession, sessionKey } from "@/app/lib/api-testing/session-cache";
import { Hint, useLayoutMode } from "./layout-mode";
import { box, iconButton, input, label, mono, outlineButton, primaryButton, SECRET_NAME } from "./ui";

const TONE: Record<AccountChip["tone"], string> = {
  ok: "border-[#16A34A] bg-[#F0FDF4] text-[#16A34A]",
  warn: "border-[#D97706] bg-[#FFFBEB] text-[#D97706]",
  bad: "border-[#DC2626] bg-[#FEF2F2] text-[#DC2626]",
  muted: "border-[#E5E7EB] bg-[#F5F6F6] text-[#4B5563] dark:border-[#2a2a2a] dark:bg-[#141414] dark:text-[#9ca3af]",
};
const ID_PATTERN = /^[A-Za-z][\w-]{0,39}$/;

type Draft = { source: AccountSpec["source"]; id: string; role: string; lifecycle: AccountSpec["lifecycle"]; token: string; fields: Record<string, string>; kyc: boolean; funded: boolean; ready: boolean };

const blank = (source: Draft["source"], over: Partial<Draft> = {}): Draft => ({ source, id: "", role: "customer", lifecycle: "shared", token: "", fields: {}, kyc: false, funded: false, ready: true, ...over });

/** What an "Add account" request from a result or the dependency box (needs an admin account...) pre-fills. */
function draftFor(role: string): Draft {
  if (role === "admin") return blank("credentials", { id: "admin", role: "admin" });
  if (role === "customer-verified") return blank("credentials", { id: "customer-verified", kyc: true, funded: true });
  if (role === "customer-2" || role === "otherUser") return blank("register", { id: "customer-2", lifecycle: "disposable" });
  return blank("credentials", { id: ID_PATTERN.test(role) ? role : "", role: "customer" });
}

export function RunAsSelect({ value, onChange, accounts, allowSpecial = true, emptyLabel = "Automatic" }: { value: string; onChange: (v: string) => void; accounts: string[]; allowSpecial?: boolean; emptyLabel?: string }) {
  return (
    <select className="rounded-[6px] border border-[#D9D9D9] bg-white px-1.5 py-1 text-[12px] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] dark:text-[#ededed]" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Run as">
      <option value="">{emptyLabel}</option>
      {accounts.map((id) => (
        <option key={id} value={id}>
          {id}
        </option>
      ))}
      {allowSpecial && <option value="none">none (no token)</option>}
      {allowSpecial && <option value="expired">expired token</option>}
    </select>
  );
}

/** Who is calling: the accounts that prerequisites and tests run as, with their token state. Memory only. */
export function AccountsSection({ specUrl, targetKey, baseUrl, runAs, onRunAs }: { specUrl: string; targetKey: string; baseUrl: string; runAs: string; onRunAs: (v: string) => void }) {
  const [, setTick] = useState(0);
  const rerender = () => setTick((n) => n + 1);
  const layout = useLayoutMode();
  const [open, setOpen] = useState(layout === "classic");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"check" | "suggest" | null>(null);
  const [suggestions, setSuggestions] = useState<AccountSuggestion[] | null>(null);
  const [info, setInfo] = useState<IdentitySuggestionsResponse | null>(suggestionCache.get(specUrl) ?? null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (suggestionCache.has(specUrl)) return;
    const ctrl = new AbortController();
    apiAgent
      .suggestIdentities(specUrl, ctrl.signal)
      .then((r) => {
        suggestionCache.set(specUrl, r);
        setInfo(r);
      })
      .catch(() => undefined); // the form still works without the spec's login field names
    return () => ctrl.abort();
  }, [specUrl]);

  useEffect(() => subscribeAccounts(() => setTick((n) => n + 1)), []);

  useEffect(
    () =>
      onAddAccountRequest(({ role }) => {
        setOpen(true);
        setDraft(draftFor(role));
        setTimeout(() => formRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 0);
      }),
    [],
  );

  const added = getAccounts(specUrl);
  const all = getRunAccounts(specUrl);
  const statuses = getStatuses(specUrl);
  // Only what the spec actually has: until it has answered, or when it has no login / register call, a token is all that can be added.
  const loginFields = info?.loginFields ?? [];
  const canLogin = !!info?.canLogin && loginFields.length > 0;
  const canRegister = !!info?.canRegister;
  // "already has verified KYC / a balance" only means something for a spec with endpoints that ask for it (not the Petstore)
  const hasStates = !!info?.identities.some((i) => i.provides?.length);
  const template = info?.identities.find((i) => i.source === "register");
  // The accounts this endpoint needs, from the spec's own wording: shown without asking, ahead of the whole-spec list.
  const recommended = (info?.identities ?? []).filter((i) => i.forEndpoints.includes(targetKey));
  const missingRecommendedCount = recommended.filter((i) => !added.some((a) => a.id === i.id)).length;
  const save = (list: AccountSpec[]) => {
    setAccounts(specUrl, list);
    rerender();
  };

  const draftError = (d: Draft): string | null => {
    if (!ID_PATTERN.test(d.id)) return "Give the account a short name (letters, digits, - and _), for example admin.";
    if (d.id === DEFAULT_ACCOUNT || added.some((a) => a.id === d.id)) return `There is already an account called ${d.id}.`;
    if (d.source === "token" && !d.token.trim()) return "Paste a token.";
    if (d.source === "credentials" && !loginFields.every((f) => (d.fields[f] ?? "").length > 0)) return `Fill in ${loginFields.join(" and ")}.`;
    return null;
  };

  const commit = (d: Draft) => {
    const problem = draftError(d);
    if (problem) return setError(problem);
    const provides = [...(d.kyc ? ["kyc-verified"] : []), ...(d.funded ? ["funded"] : [])];
    const spec: AccountSpec = {
      id: d.id,
      role: d.role.trim() || "customer",
      lifecycle: d.source === "register" ? d.lifecycle : "shared",
      source: d.source,
      ...(d.source === "token" ? { token: d.token.trim().replace(/^Bearer\s+/i, "") } : {}),
      ...(d.source === "credentials" ? { credentials: { fields: d.fields } } : {}),
      ...(d.source === "register" && d.ready && template?.readySteps?.length ? { readySteps: template.readySteps } : {}),
      ...(provides.length ? { provides } : {}),
    };
    setError(null);
    setDraft(null);
    save([...added, spec]);
  };

  const acceptSuggestion = (s: AccountSuggestion) => {
    setSuggestions((cur) => cur?.filter((x) => x.id !== s.id) ?? null);
    if (s.needs === null) {
      const { reason: _r, confidence: _c, needs: _n, forEndpoints: _f, ...spec } = s;
      void [_r, _c, _n, _f];
      if (!added.some((a) => a.id === spec.id)) save([...added, spec as AccountSpec]);
    } else setDraft({ ...draftFor(s.role ?? "customer"), id: s.id, role: s.role ?? "customer", kyc: !!s.provides?.includes("kyc-verified"), funded: !!s.provides?.includes("funded") });
  };

  const suggest = async () => {
    setBusy("suggest");
    setError(null);
    try {
      const r = await apiAgent.suggestIdentities(specUrl);
      suggestionCache.set(specUrl, r);
      setInfo(r);
      setSuggestions(r.identities.filter((s) => !added.some((a) => a.id === s.id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not get suggestions.");
    } finally {
      setBusy(null);
    }
  };

  const testLogin = async () => {
    if (!baseUrl.trim()) return setError("Enter the base URL first.");
    setBusy("check");
    setError(null);
    try {
      const key = sessionKey(specUrl, baseUrl);
      const res = await apiAgent.checkIdentities({ swaggerUrl: specUrl, baseUrl: baseUrl.trim(), identities: getRunAccounts(specUrl), session: getSession(key) });
      mergeSession(key, res.session ?? {}); // real values stay in module memory
      setStatuses(specUrl, res.identities);
      rerender();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test login failed.");
    } finally {
      setBusy(null);
    }
  };

  const addOptions: [Draft["source"], string, string][] = [["token", "Paste a token / API key", "Fast. Cannot refresh."]];
  if (canLogin) addOptions.push(["credentials", "Login credentials", "Refreshes itself."]);
  if (canRegister) addOptions.push(["register", "Create a new account", "Calls register."]);
  const kindLabel = (a: AccountSpec) => (a.source === "token" ? "pasted token" : a.source === "credentials" ? "login data" : "created by register") + (a.lifecycle === "disposable" ? " · new account every run" : "");
  const issue = (id: string) => statuses.find((s) => s.id === id)?.error;
  const hasDefaultToken = !!getToken(specUrl);

  return (
    <section className={`${box} px-4 py-3`}>
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex items-center gap-1.5 text-[13px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">
          {open ? <TbChevronDown size={14} /> : <TbChevronRight size={14} />} Accounts ({all.length})
          {!open && <span className="font-normal text-[#7E7E7E]">· runs as {runAs || (likelyAccount(specUrl, undefined, "")?.id ?? "default")}{missingRecommendedCount > 0 ? ` · ${missingRecommendedCount} recommended` : ""}</span>}
        </button>
        <div className="flex items-center gap-1.5">
          <button type="button" className={`${outlineButton} !px-2.5 !py-1 !text-[11.5px]`} onClick={testLogin} disabled={busy !== null} title="Gives every account a usable token: uses it, logs in, or registers. No endpoint test is run.">
            {busy === "check" ? <TbLoader2 size={12} className="animate-spin" /> : <TbRefresh size={12} />} Test login
          </button>
          <div className="relative">
            <button type="button" className={`${outlineButton} !px-2.5 !py-1 !text-[11.5px]`} onClick={() => setMenu(!menu)} aria-expanded={menu}>
              <TbUserPlus size={12} /> Add account
            </button>
            {menu && (
              <div className={`${box} absolute right-0 z-10 mt-1 w-[210px] space-y-0.5 !bg-white p-1 shadow-md dark:!bg-[#0a0a0a]`}>
                {addOptions.map(([source, title, sub]) => (
                  <button key={source} type="button" className="block w-full rounded-[6px] px-2.5 py-1.5 text-left hover:bg-[#F5F6F6] dark:hover:bg-[#1a1a1a]" onClick={() => { setMenu(false); setError(null); setDraft(blank(source)); }}>
                    <div className="text-[12px] font-medium text-[#1F1F1F] dark:text-[#ededed]">{title}</div>
                    <div className="text-[11px] text-[#7E7E7E]">{sub}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {open && (
        <div className="mt-2 space-y-2">
          <Hint short="Who is calling. Each account has its own token.">
            Who is calling. Prerequisites and tests run as one of these accounts, each with its own token, so an admin login never overwrites the customer&apos;s. Use one as <span className={mono}>{"{{<name>.token}}"}</span> in a header or body; plain <span className={mono}>{"{{token}}"}</span> is the account that is calling. Kept in memory only.
          </Hint>
          {all.map((a) => {
            const chip = accountChip(a, statuses.find((s) => s.id === a.id));
            const err = issue(a.id);
            return (
              <div key={a.id} className={`${box} px-3 py-2`}>
                <div className="flex flex-wrap items-center gap-2">
                  <TbLock size={13} className="shrink-0 text-[#7E7E7E]" />
                  <span className={`${mono} text-[12.5px] font-semibold text-[#1F1F1F] dark:text-[#ededed]`}>{a.id}</span>
                  <span className="text-[11.5px] text-[#7E7E7E]">{a.id === DEFAULT_ACCOUNT ? (hasDefaultToken ? "token from Connect Swagger" : "no token (set one in Connect Swagger)") : `${a.role ?? "customer"} · ${kindLabel(a)}`}</span>
                  {a.provides?.map((p) => (
                    <span key={p} className="rounded-[4px] border border-[#E5E7EB] px-1.5 py-0.5 text-[10px] text-[#4B5563] dark:border-[#2a2a2a] dark:text-[#9ca3af]">{p}</span>
                  ))}
                  <span className={`ml-auto shrink-0 rounded-[4px] border px-2 py-0.5 text-[10.5px] font-bold tracking-wide ${TONE[chip.tone]}`}>{chip.text}</span>
                  {a.id !== DEFAULT_ACCOUNT && (
                    <button type="button" className={iconButton} aria-label={`Remove account ${a.id}`} onClick={() => save(added.filter((x) => x.id !== a.id))}>
                      <TbTrash size={14} />
                    </button>
                  )}
                </div>
                {err && <div className="mt-1 text-[11.5px] text-[#DC2626]">{err}</div>}
              </div>
            );
          })}
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#5E6066] dark:text-[#9ca3af]">
            <span>Run this endpoint as</span>
            <RunAsSelect value={runAs} onChange={onRunAs} accounts={all.map((a) => a.id)} emptyLabel="Automatic (from what it needs)" />
            <button type="button" className={`${outlineButton} !px-2 !py-1 !text-[11.5px]`} onClick={suggest} disabled={busy !== null}>
              {busy === "suggest" ? <TbLoader2 size={12} className="animate-spin" /> : <TbBulb size={12} />} All accounts for this spec
            </button>
          </div>
          {recommended.length > 0 && (
            <div className="space-y-1.5">
              <div className={label}>Recommended for {targetKey}</div>
              {recommended.map((s) => {
                const have = added.some((a) => a.id === s.id);
                return (
                  <div key={s.id} className={`${box} flex items-start gap-2 !border-[#8664F2] px-3 py-2`}>
                    <div className="min-w-0 flex-1 text-[12px]">
                      <div className={`${mono} font-semibold text-[#1F1F1F] dark:text-[#ededed]`}>
                        {s.id} <span className="font-normal text-[#7E7E7E]">{s.role} · {s.lifecycle === "disposable" ? "new every run" : "shared"}{s.needs ? " · needs your login data or token" : ""}</span>
                      </div>
                      <div className="mt-0.5 text-[#5E6066] dark:text-[#9ca3af]">{s.reason}</div>
                      {!have && s.lifecycle === "disposable" && !s.needs && <div className="mt-0.5 text-[11.5px] text-[#7E7E7E]">Not added yet: a fresh account is created automatically for each run, so adding it only lets you see and edit it.</div>}
                    </div>
                    {have ? <span className="shrink-0 rounded-[4px] border border-[#16A34A] bg-[#F0FDF4] px-2 py-0.5 text-[10.5px] font-bold text-[#16A34A]">ADDED</span> : (
                      <button type="button" className={`${outlineButton} !px-2.5 !py-1 !text-[11.5px]`} onClick={() => acceptSuggestion(s)}>{s.needs ? "Set up" : "Add"}</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {error && <div className="text-[12px] text-[#DC2626]">{error}</div>}
          {info && !canLogin && !canRegister && <div className="text-[11.5px] text-[#7E7E7E]">{info.hint ?? "This spec has no login or register call: paste a token or API key."}</div>}
          {suggestions && (
            <div className="space-y-1.5">
              {suggestions.length === 0 && <div className={`${box} px-3 py-2 text-[12px] text-[#7E7E7E]`}>No more suggestions.</div>}
              {suggestions.map((s) => (
                <div key={s.id} className={`${box} flex items-start gap-2 px-3 py-2`}>
                  <div className="min-w-0 flex-1 text-[12px]">
                    <div className={`${mono} font-semibold text-[#1F1F1F] dark:text-[#ededed]`}>
                      {s.id} <span className="font-normal text-[#7E7E7E]">{s.role} · {s.lifecycle === "disposable" ? "new every run" : "shared"}{s.needs ? " · needs your login data or token" : ""}</span>
                    </div>
                    <div className="mt-0.5 text-[#5E6066] dark:text-[#9ca3af]">{s.reason}</div>
                  </div>
                  <button type="button" className={`${outlineButton} !px-2.5 !py-1 !text-[11.5px]`} onClick={() => acceptSuggestion(s)}>
                    {s.needs ? "Set up" : "Add"}
                  </button>
                </div>
              ))}
            </div>
          )}
          {draft && (
            <div ref={formRef} className={`${box} space-y-2.5 px-3 py-3`}>
              <div className={label}>{draft.source === "token" ? "Paste a token / API key" : draft.source === "credentials" ? "Login credentials" : "Create a new account"}</div>
              <div className="flex flex-wrap items-center gap-2">
                <input className={`${input} ${mono} !w-[150px]`} placeholder="name, e.g. admin" value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value.replace(/[^\w-]/g, "") })} aria-label="Account name" />
                <input className={`${input} !w-[130px]`} list="account-roles" placeholder="role" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} aria-label="Role" />
                <datalist id="account-roles">
                  <option value="customer" />
                  <option value="admin" />
                </datalist>
                {draft.source === "register" && (
                  <select className="rounded-[6px] border border-[#D9D9D9] bg-white px-1.5 py-1 text-[12px] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] dark:text-[#ededed]" value={draft.lifecycle} onChange={(e) => setDraft({ ...draft, lifecycle: e.target.value as Draft["lifecycle"] })} aria-label="Lifecycle">
                    <option value="shared">one account, reused across runs</option>
                    <option value="disposable">a new account every run</option>
                  </select>
                )}
              </div>
              {draft.source === "token" && <input className={`${input} ${mono}`} type="password" autoComplete="new-password" placeholder="Token or API key (kept in memory only)" value={draft.token} onChange={(e) => setDraft({ ...draft, token: e.target.value })} aria-label="Token" />}
              {draft.source === "credentials" && (
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {loginFields.map((f) => (
                    <input key={f} className={`${input} ${mono}`} type={SECRET_NAME.test(f) ? "password" : "text"} autoComplete="new-password" placeholder={f} value={draft.fields[f] ?? ""} onChange={(e) => setDraft({ ...draft, fields: { ...draft.fields, [f]: e.target.value } })} aria-label={f} />
                  ))}
                </div>
              )}
              {draft.source === "register" && (
                <div className="text-[11.5px] text-[#7E7E7E]">
                  {template?.registerStep ? `Calls ${template.registerStep.endpoint.method} ${template.registerStep.endpoint.path} with generated data and remembers what it sent, so the token can be refreshed by logging in.` : "Calls the spec's register endpoint with generated data."}
                  {template?.readySteps?.length ? (
                    <label className="mt-1 flex items-center gap-1.5 text-[12px] text-[#5E6066] dark:text-[#9ca3af]">
                      <input type="checkbox" checked={draft.ready} onChange={(e) => setDraft({ ...draft, ready: e.target.checked })} /> Then call {template.readySteps.map((r) => `${r.endpoint.method} ${r.endpoint.path}`).join(", ")} to make the account usable (a guess: check it with Test login)
                    </label>
                  ) : null}
                </div>
              )}
              {draft.source !== "register" && hasStates && (
                <div className="flex flex-wrap items-center gap-4 text-[12px] text-[#5E6066] dark:text-[#9ca3af]">
                  <span>This account already has:</span>
                  <label className="flex items-center gap-1.5"><input type="checkbox" checked={draft.kyc} onChange={(e) => setDraft({ ...draft, kyc: e.target.checked })} /> verified KYC</label>
                  <label className="flex items-center gap-1.5"><input type="checkbox" checked={draft.funded} onChange={(e) => setDraft({ ...draft, funded: e.target.checked })} /> a balance</label>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button type="button" className={outlineButton} onClick={() => { setDraft(null); setError(null); }}>Cancel</button>
                <button type="button" className={primaryButton} onClick={() => commit(draft)}><TbPlus size={13} /> Add account</button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
