/** Private workspace owner, verified against the existing Connect Auth account. */
export const WORK_HUB_OWNER_ID = "6b290f26-391a-432f-bec9-a72c3cc8335c";

export function isWorkHubOwner(userId: string | null | undefined): boolean {
  return userId === WORK_HUB_OWNER_ID;
}

export function isWorkHubPath(pathname: string): boolean {
  return pathname === "/work-hub" || pathname.startsWith("/work-hub/")
    || pathname === "/api/work-hub" || pathname.startsWith("/api/work-hub/")
    || pathname.startsWith("/api/public/work-hub-");
}
