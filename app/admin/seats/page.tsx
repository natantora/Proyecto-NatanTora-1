import { redirect } from "next/navigation";

export default function LegacyAdminSeatsPage() {
  redirect("/admin/events");
}
