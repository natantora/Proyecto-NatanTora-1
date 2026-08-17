import { createAdminClient } from "@/lib/data/server";

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
  tokenId: string
): Promise<
  | { ok: true; userId: string; action: "approve" | "reject" }
  | { ok: false; error: string }
> {
  const admin = createAdminClient();

  const { data: token, error: fetchError } = await admin
    .from("approval_tokens")
    .select("id, user_id, action, expires_at, used_at")
    .eq("id", tokenId)
    .maybeSingle();

  if (fetchError || !token) {
    return { ok: false, error: "Enlace no encontrado." };
  }
  if (token.used_at) {
    return { ok: false, error: "Este enlace ya fue usado." };
  }
  if (new Date(token.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "Este enlace expiró. Pide otro al miembro." };
  }

  // Marcar como usado primero (anti race condition)
  const { error: updateError } = await admin
    .from("approval_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", tokenId)
    .is("used_at", null);

  if (updateError) {
    return { ok: false, error: "Error al procesar el enlace." };
  }

  // Aplicar la accion al profile
  const newStatus = token.action === "approve" ? "approved" : "rejected";
  const { error: profileError } = await admin
    .from("profiles")
    .update({ status: newStatus })
    .eq("id", token.user_id);

  if (profileError) {
    return { ok: false, error: "Error al actualizar el miembro." };
  }

  // Si se aprueba, confirmar email del user
  if (newStatus === "approved") {
    await admin.auth.admin
      .updateUserById(token.user_id, { email_confirm: true })
      .catch((e) => console.error("[tokens] email_confirm failed:", e));
  }

  return {
    ok: true,
    userId: token.user_id,
    action: token.action as "approve" | "reject",
  };
}
