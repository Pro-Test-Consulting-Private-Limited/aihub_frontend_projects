"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { APPATLAS_API } from "@/app/services/appatlas";
import { DEV_TEST_TOKEN_KEY, DEV_TEST_USER_KEY } from "@/app/lib/dev-test-auth";

export default function DevLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("qa-bot@ai-hub-dev.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${APPATLAS_API}/dev-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; token?: string; user?: unknown };
      if (!res.ok) {
        setError(body.error || (res.status === 404 ? "Dev login is disabled" : "Sign-in failed"));
        return;
      }
      if (!body.token) {
        setError("No token returned");
        return;
      }
      sessionStorage.setItem(DEV_TEST_TOKEN_KEY, body.token);
      if (body.user) sessionStorage.setItem(DEV_TEST_USER_KEY, JSON.stringify(body.user));
      router.replace("/app-atlas");
    } catch {
      setError("Could not reach App Atlas API");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f4f5] px-4 dark:bg-[#0f0f0f]">
      <form
        onSubmit={(e) => void onSubmit(e)}
        className="w-full max-w-sm rounded-xl border border-[#e2e6ef] bg-white p-6 shadow-sm dark:border-[#2a2a2a] dark:bg-[#151515]"
      >
        <h1 className="text-lg font-semibold text-[#1F1F1F] dark:text-[#ededed]">Dev test sign-in</h1>
        <p className="mt-1 text-[12px] text-[#6b7280]">SIT / ai-hub-dev only. Not linked from the public login page.</p>
        {error ? <p className="mt-3 text-[12px] text-[#b42318]">{error}</p> : null}
        <label className="mt-4 block text-[12px] font-medium text-[#374151] dark:text-[#d1d5db]">
          Email
          <input
            type="email"
            autoComplete="username"
            className="mt-1 w-full rounded border border-[#d1d5db] px-3 py-2 text-[14px] dark:border-[#3f3f46] dark:bg-[#1a1a1a]"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
          />
        </label>
        <label className="mt-3 block text-[12px] font-medium text-[#374151] dark:text-[#d1d5db]">
          Password
          <input
            type="password"
            autoComplete="current-password"
            className="mt-1 w-full rounded border border-[#d1d5db] px-3 py-2 text-[14px] dark:border-[#3f3f46] dark:bg-[#1a1a1a]"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="mt-5 w-full rounded-lg bg-[#8664F2] px-4 py-2 text-[14px] font-medium text-white disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
