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
    "Complex check, guided entirely inside App Atlas: sign in from the lab (no DevTools), decode the JWT, forge alg:none, probe /auth/me. Steps light only when you click each action. Pass if the forged token is rejected.",
  plainStory: "Use only the JWT lab on the right. Steps stay empty until you act — Done still overrides.",
  showAppFrame: true,
  lab: "jwt",
  steps: [
    {
      n: 1,
      title: "Sign in via the lab",
      does: "Enter a demo mobile + password in the lab and click Sign in. App Atlas fetches the session token for you.",
      autoOn: "lab_signed_in",
    },
    {
      n: 2,
      title: "Token ready",
      does: "Confirms the lab held a real JWT from login (no Local Storage / DevTools).",
      autoOn: "token_ready",
    },
    {
      n: 3,
      title: "Decode the token",
      does: "Click Decode — see alg + claims. Step ticks on click.",
      autoOn: "decoded",
    },
    {
      n: 4,
      title: "Forge the token",
      does: "Click Forge alg:none (or Forge claim). Classic algorithm-confusion / tamper attempt.",
      autoOn: "forged",
    },
    {
      n: 5,
      title: "Probe with the forged token",
      does: "Click Probe /auth/me — lab calls the real API with the forged Bearer token.",
      autoOn: "probed",
    },
    {
      n: 6,
      title: "Read the outcome",
      does: "401/403 → pass (rejected). 200 → fail (forge accepted). Then Record pass/fail.",
      autoOn: "verdict_ready",
    },
  ],
  passWhen: "Forged / alg:none JWT is rejected by the API.",
  failWhen: "Forged JWT is accepted and returns protected data.",
};

const IDOR_GUIDED: GuidedProcedure = {
  title: "IDOR probes",
  whatThisIs:
    "Complex check, guided entirely inside App Atlas: sign in User A and User B in the lab, load B’s transactions, pick an id, probe as A. No second browser. 403 = ownership OK (pass). 200 with B’s data = IDOR (fail).",
  plainStory: "Everything happens in the IDOR lab on the right. Steps tick only from your clicks.",
  showAppFrame: true,
  lab: "idor",
  steps: [
    {
      n: 1,
      title: "Sign in User A",
      does: "In the lab, enter User A mobile/password → Sign in A.",
      autoOn: "user_a_signed_in",
    },
    {
      n: 2,
      title: "Sign in User B",
      does: "Enter User B (must already have at least one transaction) → Sign in B.",
      autoOn: "user_b_signed_in",
    },
    {
      n: 3,
      title: "Load B’s transactions",
      does: "Click Load B’s transactions — list appears in the lab.",
      autoOn: "b_txns_loaded",
    },
    {
      n: 4,
      title: "Pick B’s transaction id",
      does: "Click one row in the list (that id belongs to B, not A).",
      autoOn: "object_id_set",
    },
    {
      n: 5,
      title: "Probe as User A",
      does: "Click Probe this id as User A — lab calls GET /transactions/{id} with A’s token.",
      autoOn: "probed",
    },
    {
      n: 6,
      title: "Read the outcome",
      does: "403 / Not your transaction → pass. 200 with B’s payment → fail. Then Record pass/fail.",
      autoOn: "verdict_ready",
    },
  ],
  passWhen: "API refuses another user’s object (403).",
  failWhen: "API returns another user’s transaction details.",
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
