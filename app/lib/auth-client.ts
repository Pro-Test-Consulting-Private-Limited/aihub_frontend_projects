"use client";

import {
  AuthError,
  BrowserAuthError,
  InteractionRequiredAuthError,
  type AccountInfo,
  type IPublicClientApplication,
} from "@azure/msal-browser";
import { loginRequest } from "@/app/lib/msal";

function readJwtExp(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1] ?? "")) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

/** Acquire a non-expired Entra ID token (force refresh if cached id token is stale). */
export async function getFreshIdToken(
  instance: IPublicClientApplication,
  accounts: AccountInfo[],
  forceRefresh = false,
) {
  if (accounts.length === 0) return null;
  const account = accounts[0];

  const acquire = async (refresh: boolean) => {
    const result = await instance.acquireTokenSilent({
      ...loginRequest,
      account,
      forceRefresh: refresh,
    });
    return result.idToken;
  };

  try {
    let idToken = await acquire(forceRefresh);
    const exp = readJwtExp(idToken);
    const now = Math.floor(Date.now() / 1000);
    // Refresh if missing exp or expiring within 2 minutes.
    if (!forceRefresh && (exp === null || exp <= now + 120)) {
      idToken = await acquire(true);
    }
    return idToken;
  } catch (err) {
    const code = err instanceof AuthError ? err.errorCode : "";
    console.warn("Silent Microsoft token refresh failed:", code || err);
    // Popups fail with Edge's "Connected to Windows" account picker, so re-auth via redirect. Browser errors
    // (e.g. the hidden-iframe renewal timing out when third-party cookies are blocked) also need a redirect,
    // otherwise every API call goes out without a token.
    const needsRedirect =
      err instanceof InteractionRequiredAuthError || (err instanceof BrowserAuthError && code !== "interaction_in_progress");
    if (needsRedirect) await instance.acquireTokenRedirect({ ...loginRequest, account });
    return null;
  }
}
