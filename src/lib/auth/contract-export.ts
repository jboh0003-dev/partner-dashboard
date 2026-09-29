import { redirect } from "next/navigation";
import { requireAdminPage } from "@/lib/auth/require-admin-page";
import { createAdminClient } from "@/lib/supabase/admin";

export async function requireContractExportPage() {
  const auth = await requireAdminPage();
  if (!auth.userId) redirect("/dashboard");

  const { data: profile, error } = await createAdminClient()
    .from("profiles")
    .select("contract_export_enabled")
    .eq("id", auth.userId)
    .maybeSingle();

  if (error || profile?.contract_export_enabled !== true) {
    redirect("/dashboard");
  }

  return auth;
}
