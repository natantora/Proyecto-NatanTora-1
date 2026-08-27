import { createHash, randomBytes } from "crypto";
import { hash } from "bcryptjs";
import type { PoolClient } from "pg";
import { query, transaction } from "@/lib/db";

const RESET_MINUTES = 30;

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function ensureSchema(client?: PoolClient): Promise<void> {
  const run = client ? client.query.bind(client) : query;
  await run(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await run("CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id, created_at DESC)");
  await run("CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expiry ON password_reset_tokens(expires_at)");
}

export async function createPasswordResetToken(email: string): Promise<{
  token: string;
  memberName: string;
  email: string;
} | null> {
  await ensureSchema();
  const profile = await query<{ id: string; email: string; full_name: string | null }>(
    "SELECT id, email, full_name FROM profiles WHERE email = $1 LIMIT 1",
    [email],
  );
  const user = profile.rows[0];
  if (!user) return null;

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + RESET_MINUTES * 60 * 1000);
  await transaction(async (client) => {
    await ensureSchema(client);
    await client.query(
      "UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL",
      [user.id],
    );
    await client.query(
      "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
      [user.id, tokenHash(token), expiresAt],
    );
  });
  return { token, memberName: user.full_name || user.email, email: user.email };
}

export async function resetPassword(token: string, password: string): Promise<"ok" | "invalid"> {
  const passwordHash = await hash(password, 12);
  return transaction(async (client) => {
    await ensureSchema(client);
    const result = await client.query<{ id: string; user_id: string }>(
      `SELECT id, user_id
         FROM password_reset_tokens
        WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
        FOR UPDATE`,
      [tokenHash(token)],
    );
    const reset = result.rows[0];
    if (!reset) return "invalid" as const;

    await client.query("UPDATE profiles SET password_hash = $2, updated_at = NOW() WHERE id = $1", [reset.user_id, passwordHash]);
    await client.query("UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL", [reset.user_id]);
    await client.query("DELETE FROM sessions WHERE user_id = $1", [reset.user_id]);
    return "ok" as const;
  });
}
