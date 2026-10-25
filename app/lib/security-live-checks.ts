import type { CheckMode, SecurityCheck } from "@/app/lib/security-checklist";

/** How a checklist row opens when live Security is enabled from the logs dashboard. */
export type LiveKind = "stuffing" | "enumeration" | "guided";

export type LiveBinding = {
  kind: LiveKind;
  checkName: string;
};

/**
 * Live demos (kind can differ from the static checklist mode when that makes a better KT).
 * Flagship guided: JWT tamper + IDOR — interactive labs with live step updates.
 */
export const LIVE_BINDINGS: LiveBinding[] = [
  { checkName: "Brute force detection", kind: "stuffing" },
  { checkName: "Credential stuffing rate limiting", kind: "stuffing" },
  { checkName: "Username enumeration prevention", kind: "enumeration" },
  { checkName: "JWT signature validation & algorithm confusion", kind: "guided" },
  { checkName: "IDOR probes", kind: "guided" },
  { checkName: "Object-level authorization on data endpoints", kind: "guided" },
  { checkName: "CAPTCHA verification", kind: "guided" },
  { checkName: "Password hashing algorithm verification", kind: "guided" },
  { checkName: "MFA enforcement validation", kind: "guided" },
  { checkName: "Credential stuffing protection effectiveness", kind: "guided" },
  { checkName: "Secure password reset flow", kind: "guided" },
  { checkName: "Account lockout notification", kind: "guided" },
  { checkName: "Refresh token rotation policy", kind: "guided" },
];

export function liveKindFor(check: SecurityCheck): LiveKind | null {
  return LIVE_BINDINGS.find((x) => x.checkName === check.name)?.kind ?? null;
}

export function isLiveRunnable(
  check: SecurityCheck,
  liveEnabled: boolean,
  checkEnabled?: Record<string, boolean> | null,
): boolean {
  if (!liveEnabled || liveKindFor(check) === null) return false;
  if (checkEnabled && checkEnabled[check.name] === false) return false;
  return true;
}

export type GuidedLab = "jwt" | "idor" | null;

export type GuidedStep = {
  n: number;
  title: string;
  does: string;
  /** When the interactive lab fires this event, the step auto-marks Done (manual override still wins). */
  autoOn?: string;
};

export type GuidedProcedure = {
  title: string;
  whatThisIs: string;
  plainStory: string;
  steps: GuidedStep[];
  passWhen: string;
  failWhen: string;
  showAppFrame?: boolean;
  lab?: GuidedLab;
};

const JWT_GUIDED: GuidedProcedure = {
  title: "JWT signature validation & algorithm confusion",
  whatThisIs:
    "JWT signature validation & algorithm confusion means: after login the app gives you a signed token (JWT). Attackers try to strip or swap the signature (e.g. set alg to none) so the server accepts a forged identity. This guided check has you sign in on the live site, decode the real token, forge alg:none, and probe /auth/me. Pass if the forged token is rejected.",
  plainStory: "Same remote browser as Canvas — sign in in the center pane. Steps tick as you go.",
  showAppFrame: true,
  lab: "jwt",
  steps: [
    {
      n: 1,
      title: "Live browser ready",
      does: "Wait until the center pane shows the login page (same remote browser as Canvas).",
      autoOn: "browser_started",
    },
    {
      n: 2,
      title: "Sign in on the live site",
      does: "Log in with a demo account in the center pane. Step ticks when login is detected.",
      autoOn: "logged_in",
    },
    {
      n: 3,
      title: "Session token detected",
      does: "App Atlas reads the token from the remote browser (no DevTools). Step ticks when captured.",
      autoOn: "token_captured",
    },
    {
      n: 4,
      title: "Decode the JWT",
      does: "Click Decode in the side tools — see alg + claims.",
      autoOn: "decoded",
    },
    {
      n: 5,
      title: "Forge the token",
      does: "Click Forge alg:none — classic algorithm-confusion attempt (empty signature).",
      autoOn: "forged",
    },
    {
      n: 6,
      title: "Probe & read outcome",
      does: "Click Probe /auth/me. Lab suggests pass/fail; you can override to Pass, Fail, or No result.",
      autoOn: "verdict_ready",
    },
  ],
  passWhen: "Forged JWT is rejected by the API.",
  failWhen: "Forged JWT is accepted.",
};

const IDOR_GUIDED: GuidedProcedure = {
  title: "IDOR probes",
  whatThisIs:
    "IDOR (Insecure Direct Object Reference) means: can User A open User B’s data just by changing an id in the URL/API? This guided check signs you in as A on the live site, opens B’s transaction id while still A, and watches whether the app blocks it. Pass if the live site refuses; fail if B’s receipt appears.",
  plainStory: "Same remote browser as Canvas — sign in as A in the center pane; open B’s txn there.",
  showAppFrame: true,
  lab: "idor",
  steps: [
    {
      n: 1,
      title: "Live browser ready",
      does: "Wait until the center pane shows the login page (same remote browser as Canvas).",
      autoOn: "browser_started",
    },
    {
      n: 2,
      title: "Sign in as User A on the site",
      does: "Log in as customer A in the center pane. Step ticks when login is detected.",
      autoOn: "logged_in",
    },
    {
      n: 3,
      title: "Load User B’s transactions",
      does: "Enter User B mobile/password in the side tools → Load B’s transactions (B must already have a txn).",
      autoOn: "victim_loaded",
    },
    {
      n: 4,
      title: "Open B’s txn on the live site",
      does: "Click Open in center browser on a B id — the remote pane navigates to /transactions/{id} as A.",
      autoOn: "idor_navigated",
    },
    {
      n: 5,
      title: "Site shows block or leak",
      does: "Refusal / Not your transaction → good. Full receipt of B → IDOR. Step ticks from the live page.",
      autoOn: "idor_result",
    },
    {
      n: 6,
      title: "Record the verdict",
      does: "Lab suggests pass/fail when complete — override anytime with Pass, Fail, or No result.",
      autoOn: "verdict_ready",
    },
  ],
  passWhen: "Live site refuses another user’s transaction.",
  failWhen: "Live site shows another user’s transaction detail.",
};

const GUIDED: Record<string, GuidedProcedure> = {
  "JWT signature validation & algorithm confusion": JWT_GUIDED,
  "IDOR probes": IDOR_GUIDED,
  "Object-level authorization on data endpoints": {
    ...IDOR_GUIDED,
    title: "Object-level authorization on data endpoints",
    whatThisIs:
      "Same live IDOR lab: ownership on data endpoints. Prove User A cannot fetch User B’s transaction by id — steps update from your lab actions.",
  },
  "CAPTCHA verification": {
    title: "CAPTCHA verification",
    whatThisIs: "Optional guided: CAPTCHA after failed logins (prefer JWT / IDOR for the showcase).",
    plainStory: "Fail login until CAPTCHA appears; tick Done on each step.",
    showAppFrame: true,
    steps: [
      { n: 1, title: "Open login", does: "Confirm Mobile number + Password." },
      { n: 2, title: "Fail three times", does: "Wrong password ×3." },
      { n: 3, title: "Confirm CAPTCHA", does: "Purple CAPTCHA box appears." },
    ],
    passWhen: "CAPTCHA appeared.",
    failWhen: "No CAPTCHA.",
  },
  "Password hashing algorithm verification": {
    title: "Password hashing algorithm verification",
    whatThisIs: "Developer check — leave static unless a backend person is in the room.",
    plainStory: "Ask how passwords are hashed; record pass/fail.",
    showAppFrame: true,
    steps: [
      { n: 1, title: "Ask a developer", does: "Ask how passwords are hashed. Note the answer." },
      { n: 2, title: "Decide", does: "bcrypt/Argon2/scrypt → pass. Plain/MD5/SHA1 → fail." },
    ],
    passWhen: "Modern slow hash confirmed.",
    failWhen: "Weak or unknown.",
  },
  "MFA enforcement validation": {
    title: "MFA enforcement validation",
    whatThisIs: "Only if the demo account has MFA enabled.",
    plainStory: "Try to reach the app with password only.",
    showAppFrame: true,
    steps: [
      { n: 1, title: "Login with real creds", does: "Enter a real test mobile and correct password. Click Login." },
      { n: 2, title: "Look for MFA", does: "OTP/authenticator screen → pass. Straight to dashboard → fail." },
    ],
    passWhen: "MFA required.",
    failWhen: "Password alone reaches the app.",
  },
  "Credential stuffing protection effectiveness": {
    title: "Credential stuffing protection effectiveness",
    whatThisIs: "Confirm lockout/CAPTCHA after many failures.",
    plainStory: "Fail login until protection shows.",
    showAppFrame: true,
    steps: [
      { n: 1, title: "Fail several times", does: "Wrong password at least 3 times." },
      { n: 2, title: "Confirm protection", does: "CAPTCHA, lockout, or try-later → pass." },
    ],
    passWhen: "Protection engages.",
    failWhen: "Unlimited tries.",
  },
  "Secure password reset flow": {
    title: "Secure password reset flow",
    whatThisIs: "Forgot Password must not reveal who exists.",
    plainStory: "Compare messages for fake vs real user.",
    showAppFrame: true,
    steps: [
      { n: 1, title: "Click Forgot Password", does: "Use the link under the password field." },
      { n: 2, title: "Fake then real", does: "Submit fake mobile, note message; submit real test mobile, note message." },
      { n: 3, title: "Compare", does: "Same → pass. Different → fail." },
    ],
    passWhen: "Messages match.",
    failWhen: "Messages leak accounts.",
  },
  "Account lockout notification": {
    title: "Account lockout notification",
    whatThisIs: "Needs a test inbox after lockout.",
    plainStory: "Trigger lockout, check email/SMS.",
    showAppFrame: true,
    steps: [
      { n: 1, title: "Trigger lockout", does: "Fail login until locked." },
      { n: 2, title: "Check inbox", does: "Alert arrived → pass." },
    ],
    passWhen: "Alert received.",
    failWhen: "No alert.",
  },
  "Refresh token rotation policy": {
    title: "Refresh token rotation policy",
    whatThisIs: "Developer API check — leave static for layman demos.",
    plainStory: "Refresh once; old refresh must die.",
    showAppFrame: true,
    steps: [
      { n: 1, title: "Rotate", does: "Refresh; reuse old refresh → must fail." },
    ],
    passWhen: "Old refresh revoked.",
    failWhen: "Old refresh works.",
  },
};

export function guidedProcedureFor(checkName: string): GuidedProcedure | null {
  if (GUIDED[checkName]) return GUIDED[checkName];
  if (!LIVE_BINDINGS.some((b) => b.checkName === checkName && b.kind === "guided")) return null;
  return {
    title: checkName,
    whatThisIs: "Follow the steps and tick Done. Override any step if needed.",
    plainStory: "Do each step in order.",
    showAppFrame: true,
    steps: [
      { n: 1, title: "Open the app", does: "Use the middle pane." },
      { n: 2, title: "Complete the check", does: "Follow your lead’s instructions." },
      { n: 3, title: "Record pass or fail", does: "Use the buttons below." },
    ],
    passWhen: "Control meets the check.",
    failWhen: "Control fails.",
  };
}

export function appFrameUrl(targetUrl?: string | null): string {
  const raw = (targetUrl || "").trim();
  if (!raw) return "";
  try {
    const u = new URL(raw);
    const path = (u.pathname || "/").replace(/\/$/, "") || "/";
    if (path === "/") return `${u.origin}/login`;
    return u.toString();
  } catch {
    return raw;
  }
}

/** API root for Digital Wallet-style demos (`origin/api`). */
export function apiBaseFromAppUrl(targetUrl?: string | null): string {
  const raw = (targetUrl || "").trim();
  if (!raw) return "";
  try {
    return `${new URL(raw).origin}/api`;
  } catch {
    return "";
  }
}

export function appOrigin(targetUrl?: string | null): string {
  const raw = (targetUrl || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
}

export function modeLabel(mode: CheckMode | null | undefined) {
  if (mode === "automated") return "AUTOMATED";
  if (mode === "guided") return "GUIDED";
  return null;
}
