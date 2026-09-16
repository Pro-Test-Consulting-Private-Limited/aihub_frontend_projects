"use client";

import type { AccountInfo, IPublicClientApplication } from "@azure/msal-browser";
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
  } catch {
    const result = await instance.acquireTokenPopup(loginRequest);
    return result.idToken;
  }
}
