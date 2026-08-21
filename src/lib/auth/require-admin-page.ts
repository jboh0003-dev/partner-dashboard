import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function requireAdminPage() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.status === 401) redirect("/login");
    redirect("/dashboard");
  }
  return auth;
}
