"use client";

import {
  AuthError,
  BrowserAuthError,
  InteractionRequiredAuthError,
  type AccountInfo,
  type IPublicClientApplication,
} from "@azure/msal-browser";
import { graphTeamsRequest, loginRequest } from "@/app/lib/msal";

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

/** Graph access token for Teams posting (same MSAL account as app sign-in). */
export async function getGraphAccessToken(
  instance: IPublicClientApplication,
  accounts: AccountInfo[],
) {
  if (accounts.length === 0) throw new Error("Sign in to the application with Microsoft first");
  const account = accounts[0];
  try {
    const result = await instance.acquireTokenSilent({ ...graphTeamsRequest, account });
    return result.accessToken;
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      await instance.acquireTokenRedirect({ ...graphTeamsRequest, account });
      throw new Error("Redirecting to allow posting to Teams (same Microsoft account)");
    }
    throw err;
  }
}

/** Graph access token with User.Read — profile photo /me. Always the access token (not idToken). */
export async function getGraphUserReadToken(
  instance: IPublicClientApplication,
  accounts: AccountInfo[],
  forceRefresh = false,
) {
  if (accounts.length === 0) return null;
  const account = accounts[0];
  try {
    const result = await instance.acquireTokenSilent({
      ...loginRequest,
      account,
      forceRefresh,
    });
    return result.accessToken || null;
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      await instance.acquireTokenRedirect({ ...loginRequest, account });
    }
    return null;
  }
}

/** True when bytes look like JPEG / PNG / GIF / WebP (Graph often omits Content-Type or uses octet-stream). */
function looksLikeImage(buf: ArrayBuffer): boolean {
  const u = new Uint8Array(buf);
  if (u.length < 12) return false;
  // JPEG
  if (u[0] === 0xff && u[1] === 0xd8 && u[2] === 0xff) return true;
  // PNG
  if (u[0] === 0x89 && u[1] === 0x50 && u[2] === 0x4e && u[3] === 0x47) return true;
  // GIF
  if (u[0] === 0x47 && u[1] === 0x49 && u[2] === 0x46) return true;
  // WebP (RIFF....WEBP)
  if (u[0] === 0x52 && u[1] === 0x49 && u[2] === 0x46 && u[3] === 0x46 && u[8] === 0x57 && u[9] === 0x45) return true;
  return false;
}

async function graphPhotoBlob(token: string, path: string): Promise<Blob | null> {
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401 || res.status === 403) return null;
  // 404 = this user has no photo at this size.
  if (!res.ok) return null;
  const buf = await res.arrayBuffer();
  if (!buf.byteLength) return null;
  const headerType = (res.headers.get("content-type") || "").split(";")[0]!.trim().toLowerCase();
  const typed =
    headerType.startsWith("image/")
      ? headerType
      : looksLikeImage(buf)
        ? "image/jpeg"
        : "";
  if (!typed) return null;
  return new Blob([buf], { type: typed });
}

/**
 * Fetch the signed-in user's Graph profile photo as a blob URL.
 * Tries several sizes — some accounts only have a photo at 48x48 / 64x64.
 * Accepts octet-stream bodies that are real images (common Graph quirk).
 * Returns null when no photo is set (caller should show initials).
 */
export async function fetchGraphProfilePhotoUrl(
  instance: IPublicClientApplication,
  accounts: AccountInfo[],
): Promise<string | null> {
  let token = await getGraphUserReadToken(instance, accounts);
  if (!token) return null;

  const paths = [
    "/me/photos/48x48/$value",
    "/me/photos/64x64/$value",
    "/me/photos/96x96/$value",
    "/me/photo/$value",
  ];

  const tryPaths = async (accessToken: string) => {
    for (const path of paths) {
      try {
        const blob = await graphPhotoBlob(accessToken, path);
        if (blob) return URL.createObjectURL(blob);
      } catch {
        /* try next size */
      }
    }
    return null;
  };

  let url = await tryPaths(token);
  if (url) return url;

  // First pass often 401 with a stale Graph token — refresh once and retry.
  token = await getGraphUserReadToken(instance, accounts, true);
  if (!token) return null;
  url = await tryPaths(token);
  return url;
}
