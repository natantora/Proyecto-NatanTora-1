import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { ensureAliyotSchema } from "@/lib/aliyot";
import { canManageAliyot, type Role } from "@/lib/permissions";
import AliyotAdmin, { type AliyahRecord } from "./AliyotAdmin";

export const dynamic = "force-dynamic";

export default async function AliyotPage() {
  const user = await getCurrentUser();
  if (!user || user.status !== "approved" || !canManageAliyot(user.role as Role)) {
    redirect("/admin/dashboard?error=no_access");
  }

  await ensureAliyotSchema();
  const result = await query<AliyahRecord>(
    `SELECT aliyah.id, aliyah.person_name, aliyah.occurred_on::text,
            aliyah.reading_type, aliyah.parasha, aliyah.had_donation,
            aliyah.donation_amount::text, aliyah.notes,
            aliyah.created_at, profile.full_name AS created_by_name
       FROM aliyot_records aliyah
  LEFT JOIN profiles profile ON profile.id = aliyah.created_by
   ORDER BY aliyah.occurred_on DESC, aliyah.created_at DESC`,
  );

  return <AliyotAdmin initial={result.rows} />;
}
