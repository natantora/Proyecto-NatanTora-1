import { NextResponse } from "next/server";
import { createClient } from "@/lib/data/server";
import { getUserRole } from "@/lib/admin-bootstrap";
import { canPromoteUsers } from "@/lib/permissions";
import { storageReady } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/setup-class-media
 * Verifica que el Storage Bucket privado de Railway este conectado.
 */
export async function POST() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canPromoteUsers(role)) {
    return NextResponse.json({ error: "Solo propietarios pueden hacer esto" }, { status: 403 });
  }

  const ready = await storageReady();
  return NextResponse.json(
    ready ? { ok: true, alreadyExists: true } : { ok: false, error: "Conecta un Storage Bucket de Railway al servicio" },
    { status: ready ? 200 : 503 },
  );
}
