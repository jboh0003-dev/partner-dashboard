import { redirect } from "next/navigation";
import { getCachedAuthUser } from "@/lib/auth/session";
import { isWorkHubOwner } from "@/lib/auth/work-hub-access";
import WorkHubClient from "./work-hub-client";

export const dynamic = "force-dynamic";

export default async function WorkHubPage() {
  const user = await getCachedAuthUser();
  if (!user) redirect("/login?redirect=%2Fwork-hub");
  if (!isWorkHubOwner(user.id)) redirect("/dashboard");
  return <WorkHubClient ownerId={user.id} />;
}
