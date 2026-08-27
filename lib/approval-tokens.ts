import { createAdminClient } from "@/lib/data/server";
import { transaction } from "@/lib/db";
import {
  ensureMemberStatusAuditSchemaWithClient,
  recordMemberStatusChange,
  type MemberStatus,
} from "@/lib/member-status-audit";

/**
 * Crea un par de tokens (approve / reject) para un user pending.
 * El UUID generado por Postgres es el "token" en la URL.
 */
export async function createApprovalTokens(
  userId: string
): Promise<{ approveToken: string; rejectToken: string } | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("approval_tokens")
    .insert([
      { user_id: userId, action: "approve" },
      { user_id: userId, action: "reject" },
    ])
    .select("id, action");

  if (error || !data) {
    console.error("[tokens] insert failed:", error);
    return null;
  }

  const approveToken = data.find((t: any) => t.action === "approve")?.id;
  const rejectToken = data.find((t: any) => t.action === "reject")?.id;
  if (!approveToken || !rejectToken) return null;

  return { approveToken, rejectToken };
}

export interface TokenInfo {
  userId: string;
  action: "approve" | "reject";
  expiresAt: string;
  usedAt: string | null;
  user: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
    status: string | null;
    created_at: string | null;
  } | null;
}

/**
 * Lee un token sin consumirlo. Para mostrar info al admin antes de
 * confirmar la accion.
 */
export async function getTokenInfo(tokenId: string): Promise<TokenInfo | null> {
  const admin = createAdminClient();
  const { data: token, error } = await admin
    .from("approval_tokens")
    .select("user_id, action, expires_at, used_at")
    .eq("id", tokenId)
    .maybeSingle();

  if (error || !token) return null;

  const { data: user } = await admin
    .from("profiles")
    .select("full_name, email, phone, status, created_at")
    .eq("id", token.user_id)
    .maybeSingle();

  return {
    userId: token.user_id,
    action: token.action as "approve" | "reject",
    expiresAt: token.expires_at,
    usedAt: token.used_at,
    user,
  };
}

/**
 * Consume el token y aplica la accion. Atomico: marca el token como
 * usado y actualiza el profile.
 */
export async function consumeToken(
  tokenId: string,
  adminUserId: string,
): Promise<
  | { ok: true; userId: string; action: "approve" | "reject" }
  | { ok: false; error: string }
> {
  try {
    return await transaction(async (client) => {
      await ensureMemberStatusAuditSchemaWithClient(client);
      await client.query(
        "ALTER TABLE approval_tokens ADD COLUMN IF NOT EXISTS used_by_admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL",
      );

      const tokenResult = await client.query<{
        id: string;
        user_id: string;
        action: "approve" | "reject";
        expires_at: string;
        used_at: string | null;
      }>(
        `SELECT id, user_id, action, expires_at, used_at
           FROM approval_tokens WHERE id = $1 FOR UPDATE`,
        [tokenId],
      );
      const token = tokenResult.rows[0];
      if (!token) return { ok: false as const, error: "Enlace no encontrado." };
      if (token.used_at) return { ok: false as const, error: "Este enlace ya fue usado." };
      if (new Date(token.expires_at).getTime() < Date.now()) {
        return { ok: false as const, error: "Este enlace expiró. Pide otro al miembro." };
      }

      const profileResult = await client.query<{ status: MemberStatus }>(
        "SELECT status FROM profiles WHERE id = $1 FOR UPDATE",
        [token.user_id],
      );
      const profile = profileResult.rows[0];
      if (!profile) return { ok: false as const, error: "El miembro ya no existe." };
      if (profile.status !== "pending") {
        return { ok: false as const, error: `La solicitud ya está ${profile.status === "approved" ? "aprobada" : "rechazada"}.` };
      }

      const newStatus: MemberStatus = token.action === "approve" ? "approved" : "rejected";
      await client.query(
        `UPDATE approval_tokens
            SET used_at = NOW(), used_by_admin_id = $2
          WHERE id = $1`,
        [tokenId, adminUserId],
      );
      await client.query(
        "UPDATE profiles SET status = $2, updated_at = NOW() WHERE id = $1",
        [token.user_id, newStatus],
      );
      await recordMemberStatusChange(client, {
        profileId: token.user_id,
        previousStatus: profile.status,
        newStatus,
        changedBy: adminUserId,
        source: "email_link",
        approvalTokenId: tokenId,
      });

      return { ok: true as const, userId: token.user_id, action: token.action };
    });
  } catch (error) {
    console.error("[tokens] consume failed:", error);
    return { ok: false, error: "Error al procesar el enlace." };
  }
}
