import { NextResponse } from "next/server"
import { createClient, createAdminClient } from "@/lib/supabase/server"
import { getUserRole } from "@/lib/admin-bootstrap"
import { canEditAllClasses, type Role } from "@/lib/permissions"

/**
 * TEMP DIAG endpoint. Borrar después de verificar.
 * Devuelve count + lista mínima de clases (id, title) directamente desde service_role
 * para confirmar si la DB tiene rows o no.
 */
export async function GET() {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: "no auth" }, { status: 401 })
  const role = (await getUserRole(user.id)) as Role | null
  if (!canEditAllClasses(role)) return NextResponse.json({ error: "no perms" }, { status: 403 })

  const admin = createAdminClient()
  const { data, error, count } = await admin
    .from("classes")
    .select("id,title,rabbi,published,pending_review,owner_id,created_at,media_url,media_type", { count: "exact" })
    .order("created_at", { ascending: false })

  return NextResponse.json({
    count,
    error: error?.message ?? null,
    rows: data ?? [],
    queriedAt: new Date().toISOString(),
  })
}
