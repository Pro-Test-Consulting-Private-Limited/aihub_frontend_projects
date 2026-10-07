/**
 * In the browser on an AI Hub site (prod / sit / dev), that site's origin: each site's nginx routes the APIs to
 * its own backends, while the build env is shared. Elsewhere (server rendering, localhost) undefined.
 */
export const siteOrigin = (): string | undefined =>
  typeof window !== "undefined" && /^ai-hub(-sit|-dev)?\.protestcorp\.com$/.test(window.location.hostname)
    ? window.location.origin
    : undefined;

export const BASE_URL = siteOrigin() ? `${siteOrigin()}/` : process.env.NEXT_PUBLIC_API_BASE_URL!;
export const BASE_URL_VERSION = process.env.NEXT_PUBLIC_API_BASE_URL_VERSION!;
export const CLARIFY_API_BASE =
  siteOrigin() || process.env.NEXT_PUBLIC_CLARIFY_API_BASE_URL || "http://localhost:4000";

export const ACTION_DRIVEN_TEST_CASE_GENERATOR_SITE = `${
  siteOrigin() || "https://ai-hub.protestcorp.com"
}/vnc_lite.html`;

export const SELF_HEALING_SPEC =
  "cypress/e2e/BDD/Smoke/NewAdvisor/02_Checkout.feature";
