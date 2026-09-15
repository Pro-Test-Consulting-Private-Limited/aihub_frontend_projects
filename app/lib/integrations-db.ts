import { pool } from "@/app/lib/db";
import type { VerifiedUser } from "@/app/lib/auth-server";

export type IntegrationProvider = "jira" | "github" | "swagger";

export type UserIntegrationRow = {
  provider: IntegrationProvider;
  user_name: string;
  user_email: string | null;
  meta: Record<string, unknown>;
  connected_at: string;
};

let ensured = false;

export async function ensureIntegrationsTable() {
  if (ensured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_integrations (
      id SERIAL PRIMARY KEY,
      user_oid TEXT NOT NULL,
      user_name TEXT NOT NULL,
      user_email TEXT,
      provider TEXT NOT NULL,
      meta JSONB NOT NULL DEFAULT '{}'::jsonb,
      connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_oid, provider)
    );
  `);
  ensured = true;
}

export async function listUserIntegrations(userOid: string) {
  await ensureIntegrationsTable();
  const { rows } = await pool.query<UserIntegrationRow>(
    `SELECT provider, user_name, user_email, meta, connected_at
     FROM user_integrations
     WHERE user_oid = $1
     ORDER BY connected_at ASC`,
    [userOid],
  );
  return rows;
}

export async function upsertUserIntegrations(
  user: VerifiedUser,
  providers: Array<{ provider: IntegrationProvider; meta?: Record<string, unknown> }>,
) {
  await ensureIntegrationsTable();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const item of providers) {
      await client.query(
        `INSERT INTO user_integrations (user_oid, user_name, user_email, provider, meta, connected_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
         ON CONFLICT (user_oid, provider)
         DO UPDATE SET
           user_name = EXCLUDED.user_name,
           user_email = EXCLUDED.user_email,
           meta = EXCLUDED.meta,
           connected_at = NOW()`,
        [
          user.oid,
          user.name,
          user.email || null,
          item.provider,
          JSON.stringify(item.meta ?? {}),
        ],
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteUserIntegration(userOid: string, provider: IntegrationProvider) {
  await ensureIntegrationsTable();
  await pool.query(
    `DELETE FROM user_integrations WHERE user_oid = $1 AND provider = $2`,
    [userOid, provider],
  );
}
