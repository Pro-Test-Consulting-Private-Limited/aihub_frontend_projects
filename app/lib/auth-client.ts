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
      scopes: ["User.Read", "https://graph.microsoft.com/User.Read"],
      account,
      forceRefresh,
    });
    return result.accessToken || null;
  } catch {
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
}

/** True when bytes look like JPEG / PNG / GIF / WebP (Graph often omits Content-Type or uses octet-stream). */
function looksLikeImage(buf: ArrayBuffer): boolean {
  const u = new Uint8Array(buf);
  if (u.length < 12) return false;
  if (u[0] === 0xff && u[1] === 0xd8 && u[2] === 0xff) return true;
  if (u[0] === 0x89 && u[1] === 0x50 && u[2] === 0x4e && u[3] === 0x47) return true;
  if (u[0] === 0x47 && u[1] === 0x49 && u[2] === 0x46) return true;
  if (u[0] === 0x52 && u[1] === 0x49 && u[2] === 0x46 && u[3] === 0x46 && u[8] === 0x57 && u[9] === 0x45) return true;
  return false;
}

/**
 * Microsoft's empty "gray person" placeholder is a flat low-variance image.
 * Real face photos have much higher pixel variance even at 48×48.
 */
async function isBlankProfileSilhouette(blob: Blob): Promise<boolean> {
  try {
    const bmp = await createImageBitmap(blob);
    const w = Math.min(bmp.width, 48);
    const h = Math.min(bmp.height, 48);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bmp.close();
      return false;
    }
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const { data } = ctx.getImageData(0, 0, w, h);
    let sum = 0;
    let sumSq = 0;
    const n = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      const y = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
      sum += y;
      sumSq += y * y;
    }
    const mean = sum / n;
    const variance = sumSq / n - mean * mean;
    // Empty Graph placeholders are nearly flat (variance often < 200). Faces are >> 500.
    return variance < 350;
  } catch {
    return false;
  }
}

type GraphPhotoResult = { blob: Blob | null; missing: boolean };

async function graphPhotoBlob(
  token: string,
  path: string,
  api: "v1.0" | "beta" = "v1.0",
): Promise<GraphPhotoResult> {
  const res = await fetch(`https://graph.microsoft.com/${api}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401 || res.status === 403) throw Object.assign(new Error("graph-auth"), { status: res.status });
  // Graph returns 404 when this mailbox/user has no profile photo — stop hammering sizes.
  if (res.status === 404) return { blob: null, missing: true };
  if (!res.ok) return { blob: null, missing: false };
  const buf = await res.arrayBuffer();
  if (!buf.byteLength) return { blob: null, missing: false };
  const headerType = (res.headers.get("content-type") || "").split(";")[0]!.trim().toLowerCase();
  const typed = headerType.startsWith("image/") ? headerType : looksLikeImage(buf) ? "image/jpeg" : "";
  if (!typed) return { blob: null, missing: false };
  const blob = new Blob([buf], { type: typed });
  if (await isBlankProfileSilhouette(blob)) return { blob: null, missing: false };
  return { blob, missing: false };
}

async function listPhotoSizes(token: string, userPath: string): Promise<string[]> {
  try {
    const res = await fetch(`https://graph.microsoft.com/v1.0${userPath}/photos`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 404 || !res.ok) return [];
    const body = (await res.json()) as { value?: Array<{ id?: string }> };
    const ids = (body.value || []).map((v) => v.id).filter((id): id is string => !!id);
    const rank = (id: string) => {
      const n = parseInt(id, 10);
      return Number.isFinite(n) ? n : 0;
    };
    return ids.sort((a, b) => rank(b) - rank(a));
  } catch {
    return [];
  }
}

/** One in-flight / settled result per account — menu + presence must not double-probe Graph. */
const graphPhotoBlobCache = new Map<string, Promise<Blob | null>>();

/**
 * Quiet probe: at most a couple of Graph calls.
 * 404 on `/me/photo` means no Entra photo — stop (do not fan out oid/upn/sizes/beta×bases).
 */
async function fetchGraphProfilePhotoBlob(
  instance: IPublicClientApplication,
  accounts: AccountInfo[],
): Promise<Blob | null> {
  const account = instance.getActiveAccount() || accounts[0];
  if (!account) return null;
  const cacheKey = account.homeAccountId || account.localAccountId || account.username || "me";
  const cached = graphPhotoBlobCache.get(cacheKey);
  if (cached) return cached;

  const load = (async (): Promise<Blob | null> => {
    const accountList = [account, ...accounts.filter((a) => a.homeAccountId !== account.homeAccountId)];
    let token = await getGraphUserReadToken(instance, accountList);
    if (!token) return null;

    const tryOnce = async (accessToken: string): Promise<Blob | null> => {
      // Primary: signed-in user's photo.
      const primary = await graphPhotoBlob(accessToken, "/me/photo/$value", "v1.0");
      if (primary.blob) return primary.blob;
      if (primary.missing) {
        // Some tenants only expose the AAD photo on beta — one extra call, then stop.
        const beta = await graphPhotoBlob(accessToken, "/me/photo/$value", "beta");
        return beta.blob;
      }
      // Non-404 miss (empty/bad body): ask which sizes exist, try the largest once.
      const sizes = await listPhotoSizes(accessToken, "/me");
      for (const id of sizes.slice(0, 1)) {
        const sized = await graphPhotoBlob(accessToken, `/me/photos/${id}/$value`, "v1.0");
        if (sized.blob) return sized.blob;
      }
      return null;
    };

    try {
      return await tryOnce(token);
    } catch (err) {
      // Only re-auth-and-retry on Graph 401/403 — never re-spam because the photo is missing.
      if (!(err && typeof err === "object" && "status" in err)) return null;
      token = await getGraphUserReadToken(instance, accountList, true);
      if (!token) return null;
      try {
        return await tryOnce(token);
      } catch {
        return null;
      }
    }
  })();

  graphPhotoBlobCache.set(cacheKey, load);
  try {
    return await load;
  } catch (err) {
    graphPhotoBlobCache.delete(cacheKey);
    throw err;
  }
}

/**
 * Fetch the signed-in user's Graph profile photo as a blob URL.
 * Cached per account; at most ~2 Graph calls when the tenant has no photo (no console spam).
 */
export async function fetchGraphProfilePhotoUrl(
  instance: IPublicClientApplication,
  accounts: AccountInfo[],
): Promise<string | null> {
  const blob = await fetchGraphProfilePhotoBlob(instance, accounts);
  return blob ? URL.createObjectURL(blob) : null;
}

/** Shrink a Graph photo to a small JPEG data-URL for presence heartbeats (other users can render it). */
async function blobToPresenceDataUrl(blob: Blob, edge = 48): Promise<string | null> {
  try {
    const bmp = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = edge;
    canvas.height = edge;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bmp.close();
      return null;
    }
    ctx.drawImage(bmp, 0, 0, edge, edge);
    bmp.close();
    const url = canvas.toDataURL("image/jpeg", 0.72);
    // Match backend MAX_PHOTO_CHARS.
    return url.length <= 16_000 ? url : null;
  } catch {
    return null;
  }
}

/**
 * Own Graph photo as a tiny data-URL for App Atlas presence — so other signed-in users
 * can show your face without needing User.Read.All.
 */
export async function fetchGraphProfilePhotoDataUrl(
  instance: IPublicClientApplication,
  accounts: AccountInfo[],
): Promise<string | null> {
  const blob = await fetchGraphProfilePhotoBlob(instance, accounts);
  if (!blob) return null;
  return blobToPresenceDataUrl(blob);
}

/** Identifiers for the signed-in MSAL user — match against Atlas presence `User.id` (oid) / email / name. */
export function msalSelfKeys(account: AccountInfo | undefined): Set<string> {
  const keys = new Set<string>();
  if (!account) return keys;
  const claims = (account.idTokenClaims || {}) as Record<string, unknown>;
  for (const v of [
    account.localAccountId,
    account.homeAccountId,
    account.username,
    account.name,
    claims.oid,
    claims.sub,
    claims.preferred_username,
    claims.email,
    claims.upn,
    claims.name,
  ]) {
    if (v != null && String(v).trim()) keys.add(String(v).trim().toLowerCase());
  }
  // homeAccountId is "oid.tid" — also add the oid segment alone.
  if (account.homeAccountId?.includes(".")) {
    keys.add(account.homeAccountId.split(".")[0]!.toLowerCase());
  }
  return keys;
}
