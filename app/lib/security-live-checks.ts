import type { CheckMode, SecurityCheck } from "@/app/lib/security-checklist";

/** How a checklist row opens when live Security is enabled from the logs dashboard. */
export type LiveKind = "stuffing" | "guided";

export type LiveBinding = {
  kind: LiveKind;
  /** Checklist row name this binding attaches to */
  checkName: string;
};

/**
 * Only these Authentication Security rows are runnable today.
 * Automated live = headed credential stuffing / brute force.
 * Guided live = step procedures (enumeration first; others get a written guide).
 */
export const LIVE_BINDINGS: LiveBinding[] = [
  { checkName: "Brute force detection", kind: "stuffing" },
  { checkName: "Credential stuffing rate limiting", kind: "stuffing" },
  { checkName: "Username enumeration prevention", kind: "guided" },
  { checkName: "Password hashing algorithm verification", kind: "guided" },
  { checkName: "MFA enforcement validation", kind: "guided" },
  { checkName: "Credential stuffing protection effectiveness", kind: "guided" },
  { checkName: "Secure password reset flow", kind: "guided" },
  { checkName: "Account lockout notification", kind: "guided" },
  { checkName: "JWT signature validation & algorithm confusion", kind: "guided" },
  { checkName: "Refresh token rotation policy", kind: "guided" },
];

export function liveKindFor(check: SecurityCheck): LiveKind | null {
  const b = LIVE_BINDINGS.find((x) => x.checkName === check.name);
  if (!b) return null;
  // Don't attach stuffing UI to a guided checklist row or vice versa
  if (b.kind === "stuffing" && check.mode !== "automated") return null;
  if (b.kind === "guided" && check.mode !== "guided") return null;
  return b.kind;
}

export function isLiveRunnable(check: SecurityCheck, liveEnabled: boolean): boolean {
  return liveEnabled && liveKindFor(check) !== null;
}

export type GuidedProcedure = {
  title: string;
  plainStory: string;
  steps: { n: number; title: string; does: string }[];
  passWhen: string;
  failWhen: string;
  /** Open the app login in the middle pane for manual tries */
  showAppFrame?: boolean;
};

const GUIDED: Record<string, GuidedProcedure> = {
  "Username enumeration prevention": {
    title: "Username enumeration prevention",
    plainStory:
      "Attackers try fake vs real usernames. If the error text differs, they learned which accounts exist — without knowing any password.",
    showAppFrame: true,
    steps: [
      { n: 1, title: "Open the login page", does: "Use the Application URL (middle pane). The field may say Email but accept mobile." },
      { n: 2, title: "Try a nonsense identifier", does: "Enter something that cannot be a real user with any password. Note the exact error." },
      { n: 3, title: "Try a real or known-looking identifier", does: "Use a test account you own. Same garbage password. Note the error again." },
      { n: 4, title: "Compare", does: "Same message (and similar timing)? Pass. Different (“user not found” vs “wrong password”)? Fail." },
    ],
    passWhen: "Messages (and ideally timing) match for valid vs invalid identifiers.",
    failWhen: "Responses clearly differ for valid vs invalid identifiers.",
  },
  "Password hashing algorithm verification": {
    title: "Password hashing algorithm verification",
    plainStory: "Confirm the app stores passwords with a modern slow hash (bcrypt, Argon2, or scrypt) — not plain text or fast hashes.",
    steps: [
      { n: 1, title: "Find how passwords are stored", does: "Check backend docs, swagger, or ask the owning team which algorithm is configured." },
      { n: 2, title: "Reject weak schemes", does: "Fail if MD5/SHA1 without salt, reversible encryption, or plaintext appears in any store." },
      { n: 3, title: "Confirm parameters", does: "For bcrypt/Argon2/scrypt, note cost/work factor meets org policy." },
    ],
    passWhen: "bcrypt, Argon2, or scrypt is confirmed in use with adequate cost.",
    failWhen: "Weak or unknown hashing, or cannot be verified.",
  },
  "MFA enforcement validation": {
    title: "MFA enforcement validation",
    plainStory: "A second factor must be required and not skippable for accounts that should have MFA.",
    showAppFrame: true,
    steps: [
      { n: 1, title: "Sign in with password only", does: "Use a test account that should require MFA." },
      { n: 2, title: "Look for a second factor", does: "OTP, authenticator, or push must appear before reaching the app." },
      { n: 3, title: "Try bypass paths", does: "Direct URLs, “remember this device”, or API tokens must not skip MFA when policy requires it." },
    ],
    passWhen: "Second factor is required and not bypassable for in-scope accounts.",
    failWhen: "Password-only access reaches protected areas.",
  },
  "Credential stuffing protection effectiveness": {
    title: "Credential stuffing protection effectiveness",
    plainStory: "After the automated stuffing run (or a manual burst of bad passwords), confirm lockout, throttle, or CAPTCHA actually stops abuse.",
    showAppFrame: true,
    steps: [
      { n: 1, title: "Use a dedicated test account", does: "Do not use production user accounts." },
      { n: 2, title: "Trigger repeated failures", does: "Run Brute force detection (automated) or fail login N times yourself." },
      { n: 3, title: "Confirm protection", does: "Lockout, CAPTCHA, or rate limit must appear; note whether a valid password still works after." },
    ],
    passWhen: "Protection engages and blocks or slows further attempts.",
    failWhen: "Unlimited attempts succeed without friction.",
  },
  "Secure password reset flow": {
    title: "Secure password reset flow",
    plainStory: "Reset tokens must expire, be single-use, and must not reveal whether an account exists.",
    showAppFrame: true,
    steps: [
      { n: 1, title: "Request reset for a real test user", does: "Use Forgot Password; note messaging." },
      { n: 2, title: "Request reset for a fake user", does: "Same form with a nonsense id; messaging should match." },
      { n: 3, title: "Use the token once", does: "Confirm it works once, then fails on reuse; confirm expiry if documented." },
    ],
    passWhen: "No enumeration; token single-use and time-bound.",
    failWhen: "Different messages leak accounts, or tokens reuse / never expire.",
  },
  "Account lockout notification": {
    title: "Account lockout notification",
    plainStory: "When an account locks after failed logins, the user should get an email/SMS alert.",
    steps: [
      { n: 1, title: "Trigger a lockout", does: "On a test account, fail login until lockout (or use the automated brute-force check)." },
      { n: 2, title: "Check notification channels", does: "Confirm email/SMS (or in-app) arrives for the account owner." },
      { n: 3, title: "Note timing", does: "Alert should arrive promptly; record channel and content (no password in clear)." },
    ],
    passWhen: "Lockout triggers a clear notification on an expected channel.",
    failWhen: "No notification, or notification missing for lockout events.",
  },
  "JWT signature validation & algorithm confusion": {
    title: "JWT signature validation & algorithm confusion",
    plainStory: "Forged or alg=none / algorithm-switched JWTs must be rejected.",
    steps: [
      { n: 1, title: "Capture a valid token", does: "From a test login (browser storage or API)." },
      { n: 2, title: "Tamper with payload", does: "Change a claim without re-signing; call a protected API." },
      { n: 3, title: "Try algorithm confusion", does: "If applicable, attempt alg=none or HS256 with a public key; expect 401." },
    ],
    passWhen: "Altered and confused tokens are rejected.",
    failWhen: "Server accepts forged or algorithm-confused JWTs.",
  },
  "Refresh token rotation policy": {
    title: "Refresh token rotation policy",
    plainStory: "Refresh tokens should rotate; an old refresh token must not keep working after rotation.",
    steps: [
      { n: 1, title: "Obtain access + refresh", does: "Login as a test user; store both tokens." },
      { n: 2, title: "Refresh once", does: "Exchange refresh for a new pair; note the new refresh value." },
      { n: 3, title: "Reuse the old refresh", does: "Old refresh must fail (revoked). New refresh should still work once." },
    ],
    passWhen: "Old refresh is revoked after rotation.",
    failWhen: "Old refresh tokens remain valid indefinitely.",
  },
};

export function guidedProcedureFor(checkName: string): GuidedProcedure | null {
  return GUIDED[checkName] || null;
}

export function modeLabel(mode: CheckMode | null | undefined) {
  if (mode === "automated") return "AUTOMATED";
  if (mode === "guided") return "GUIDED";
  return null;
}
