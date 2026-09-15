import { jwtVerify, createRemoteJWKSet } from "jose";

const TENANT_ID = process.env.NEXT_PUBLIC_MICROSOFT_ENTRA_TENANT_ID!;
const CLIENT_ID = process.env.NEXT_PUBLIC_MICROSOFT_ENTRA_CLIENT_ID!;

const JWKS = createRemoteJWKSet(
  new URL(`https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`)
);

export type VerifiedUser = { oid: string; name: string; email: string };

export async function verifyRequestUser(req: Request): Promise<VerifiedUser | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length);

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
      audience: CLIENT_ID,
      // Tolerate small VM/client clock drift so freshly issued tokens are not rejected.
      clockTolerance: 120,
    });
    return {
      oid: String(payload.oid ?? payload.sub),
      name: String(payload.name ?? payload.preferred_username ?? "Unknown"),
      email: String(payload.preferred_username ?? payload.email ?? ""),
    };
  } catch (err) {
    console.error("Token verification failed:", err);
    return null;
  }
}