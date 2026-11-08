/**
 * DEV-ONLY local auth bypass for Phase A verification harness.
 *
 * Active only when ALL of:
 *   - process.env.NODE_ENV !== "production"  (dead-code eliminated in prod builds)
 *   - AUTH_BYPASS_LOCAL=1 (or NEXT_PUBLIC_AUTH_BYPASS_LOCAL=1 for client)
 *   - browser host is localhost / 127.0.0.1 (runtime)
 *
 * Never enable on ai-hub-dev / sit / prod. CI: `npm run test:auth-bypass-prod`.
 */

/** Compile-time + runtime gate. In production bundles `NODE_ENV==='production'` collapses this to `false`. */
export function isLocalAuthBypassEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const flag =
    process.env.AUTH_BYPASS_LOCAL === "1" || process.env.NEXT_PUBLIC_AUTH_BYPASS_LOCAL === "1";
  if (!flag) return false;
  if (typeof window === "undefined") return true; // next dev SSR on localhost
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

/** Server-only helper — never call from client code. */
export function localProxyAuthSecret(): string | null {
  if (process.env.NODE_ENV === "production") return null;
  if (process.env.AUTH_BYPASS_LOCAL !== "1") return null;
  return process.env.PROXY_AUTH_SECRET || process.env.DEV_PROXY_AUTH || null;
}
