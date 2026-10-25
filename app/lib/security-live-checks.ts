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
    "Complex check, simple path: prove the app rejects a forged session token. Login in the middle, paste your JWT into the lab on the right — each action lights the next step live. Forge alg:none (or a flipped claim), probe a protected API, and score pass if the server says no.",
  plainStory:
    "Follow the lab on the right. Steps tick themselves when you act (you can still override Done).",
  showAppFrame: true,
  lab: "jwt",
  steps: [
    {
      n: 1,
      title: "Sign in on the app",
      does: "In the middle pane, log in with a real demo mobile + password until you reach the dashboard (or any logged-in screen).",
      autoOn: "logged_in_hint",
    },
    {
      n: 2,
      title: "Paste the session JWT",
      does: "DevTools → Application → Local Storage → copy `token`, paste it in the lab. Step completes when a valid JWT is detected.",
      autoOn: "token_pasted",
    },
    {
      n: 3,
      title: "Decode the token",
      does: "Click Decode. You should see header (alg) and payload (sub / claims). Step completes on decode.",
      autoOn: "decoded",
    },
    {
      n: 4,
      title: "Forge the token",
      does: "Click Forge alg:none (classic algorithm-confusion attempt). Step completes when a forged token is ready.",
      autoOn: "forged",
    },
    {
      n: 5,
      title: "Probe a protected API",
      does: "Click Probe with forged token. The lab calls the app’s API with the forged Bearer token.",
      autoOn: "probed",
    },
    {
      n: 6,
      title: "Read the outcome",
      does: "401/403 → app rejected the forge (good). 200 with data → forged token worked (bad). Step completes when a result appears; then Record pass/fail.",
      autoOn: "verdict_ready",
    },
  ],
  passWhen: "Forged / alg:none JWT is rejected by the API.",
  failWhen: "Forged JWT is accepted and returns protected data.",
};

const IDOR_GUIDED: GuidedProcedure = {
  title: "IDOR probes",
  whatThisIs:
    "Complex check, simple path: prove one user cannot open another user’s object by swapping an ID. Login as User A, paste A’s token, enter a transaction id that belongs to User B, probe — steps update live. 403 = ownership enforced (pass). 200 with B’s data = IDOR (fail).",
  plainStory:
    "Use two demo accounts if you can. The lab on the right drives the probe; steps tick as you act.",
  showAppFrame: true,
  lab: "idor",
  steps: [
    {
      n: 1,
      title: "Sign in as User A",
      does: "Middle pane: log in as customer A. Open History if you want to see A’s own transaction ids.",
      autoOn: "logged_in_hint",
    },
    {
      n: 2,
      title: "Paste User A’s JWT",
      does: "Copy `token` from Local Storage into the lab. Step completes on a valid JWT.",
      autoOn: "token_pasted",
    },
    {
      n: 3,
      title: "Enter another user’s transaction id",
      does: "From User B’s History (second browser / account), copy a transaction id. Paste it in the lab. Step completes when an id is present.",
      autoOn: "object_id_set",
    },
    {
      n: 4,
      title: "Optional: open that URL in the app",
      does: "Click Open in app frame to load `/transactions/{id}` as A — watch whether B’s receipt appears. Step completes when you click Open.",
      autoOn: "frame_opened",
    },
    {
      n: 5,
      title: "Probe the API as User A",
      does: "Click Probe API. Lab calls GET /transactions/{id} with A’s token.",
      autoOn: "probed",
    },
    {
      n: 6,
      title: "Read the outcome",
      does: "403 / Not your transaction → pass. 200 with someone else’s payment → fail (IDOR). Then Record pass/fail.",
      autoOn: "verdict_ready",
    },
  ],
  passWhen: "API refuses another user’s object (403) and UI does not show their data.",
  failWhen: "API or UI returns another user’s transaction details.",
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
