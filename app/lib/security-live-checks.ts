import type { CheckMode, SecurityCheck } from "@/app/lib/security-checklist";

/** How a checklist row opens when live Security is enabled from the logs dashboard. */
export type LiveKind = "stuffing" | "enumeration" | "guided";

export type LiveBinding = {
  kind: LiveKind;
  checkName: string;
};

/**
 * Live demos (kind can differ from the static checklist mode when that makes a better KT).
 * - stuffing / enumeration = headed automated agent
 * - guided = human click-steps with Done toggles (CAPTCHA showcase)
 */
export const LIVE_BINDINGS: LiveBinding[] = [
  { checkName: "Brute force detection", kind: "stuffing" },
  { checkName: "Credential stuffing rate limiting", kind: "stuffing" },
  { checkName: "Username enumeration prevention", kind: "enumeration" },
  { checkName: "CAPTCHA verification", kind: "guided" },
  { checkName: "Password hashing algorithm verification", kind: "guided" },
  { checkName: "MFA enforcement validation", kind: "guided" },
  { checkName: "Credential stuffing protection effectiveness", kind: "guided" },
  { checkName: "Secure password reset flow", kind: "guided" },
  { checkName: "Account lockout notification", kind: "guided" },
  { checkName: "JWT signature validation & algorithm confusion", kind: "guided" },
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

export type GuidedProcedure = {
  title: string;
  whatThisIs: string;
  plainStory: string;
  steps: { n: number; title: string; does: string }[];
  passWhen: string;
  failWhen: string;
  showAppFrame?: boolean;
};

const GUIDED: Record<string, GuidedProcedure> = {
  "CAPTCHA verification": {
    title: "CAPTCHA verification",
    whatThisIs:
      "This guided check proves a CAPTCHA appears after too many failed logins — something you confirm on screen. Fail login three times with a wrong password; when the CAPTCHA box shows, mark that step done. You can override any step. Pass if CAPTCHA appeared and blocked another try until solved.",
    plainStory: "Do each step on the login screen in the middle. Tick Done when you finish a step (you can untick to override).",
    showAppFrame: true,
    steps: [
      {
        n: 1,
        title: "Confirm you are on Login",
        does: "Middle pane shows “Hello, Welcome Back” and Mobile number + Password. If you see a dashboard, click Open in new tab and use /login, or Back to plan and reopen.",
      },
      {
        n: 2,
        title: "First failed login",
        does: "In Mobile number type 0000000000. In Password type wrongpass. Click Login. You should see a red error (e.g. Invalid credentials). Tick Done.",
      },
      {
        n: 3,
        title: "Second failed login",
        does: "Keep the same mobile and wrongpass. Click Login again. Error again. Tick Done.",
      },
      {
        n: 4,
        title: "Third failed login",
        does: "Click Login once more with wrongpass. Tick Done.",
      },
      {
        n: 5,
        title: "Confirm CAPTCHA appeared",
        does: "Look for the purple CAPTCHA box (“Too many failed attempts… What is N + M?”). If you see it, tick Done. If not, leave unticked and Record fail.",
      },
      {
        n: 6,
        title: "Prove it blocks you",
        does: "Leave the CAPTCHA answer empty or wrong, click Login. You should stay blocked / see CAPTCHA failed. Tick Done if that happened.",
      },
      {
        n: 7,
        title: "Solve CAPTCHA (optional)",
        does: "Type the correct sum, click Login with wrongpass again — CAPTCHA should accept and show Invalid credentials again. Tick Done if you verified that.",
      },
    ],
    passWhen: "CAPTCHA appeared after failed attempts and blocked progress until solved.",
    failWhen: "No CAPTCHA after several failures, or login continues with no challenge.",
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
    whatThisIs: "Confirm lockout/CAPTCHA after many failures (pairs with the CAPTCHA guided check).",
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
      { n: 1, title: "Trigger lockout", does: "Fail login until locked / CAPTCHA storm." },
      { n: 2, title: "Check inbox", does: "Alert arrived → pass." },
    ],
    passWhen: "Alert received.",
    failWhen: "No alert.",
  },
  "JWT signature validation & algorithm confusion": {
    title: "JWT signature validation & algorithm confusion",
    whatThisIs: "Developer API check — leave static for layman demos.",
    plainStory: "Forge a token; expect 401.",
    showAppFrame: true,
    steps: [
      { n: 1, title: "Tamper a JWT", does: "Change a claim without resigning; call a protected API." },
      { n: 2, title: "Expect reject", does: "401 → pass." },
    ],
    passWhen: "Forged JWT rejected.",
    failWhen: "Accepted.",
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

export function modeLabel(mode: CheckMode | null | undefined) {
  if (mode === "automated") return "AUTOMATED";
  if (mode === "guided") return "GUIDED";
  return null;
}
