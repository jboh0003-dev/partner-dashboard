/**
 * 사용자 구분 (권한은 profiles.role 기준, 이메일 하드코딩 없음)
 * - admin: 내부 포털 전체 + 파트너 신청 관리자 검토/승인
 * - viewer | legacy user: 내부 포털 조회 + Partner AI + /partner-apply 작성
 * - 외부 신청자: Auth 계정 없음, /partner-apply 와 /api/public/* 만
 */
export type AppRole = "admin" | "viewer" | "user";

export function isProductionEnv(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Production에서는 항상 false. 로컬은 ENABLE_DEV_ADMIN_BYPASS=true 일 때만. */
export function isDevAdminBypassEnabled(): boolean {
  if (isProductionEnv()) return false;
  return process.env.ENABLE_DEV_ADMIN_BYPASS === "true";
}

export function isAdminRole(role: string | null | undefined): boolean {
  return role === "admin";
}

/**
 * admin만 쓰기 권한.
 * legacy `user`와 `viewer`는 조회 전용.
 * bypass는 프로필 role이 없을 때만 (로컬 시드 전).
 */
export function resolveIsAdmin(role: string | null | undefined): boolean {
  if (isAdminRole(role)) return true;
  if (role === "viewer" || role === "user") return false;
  return isDevAdminBypassEnabled();
}

export function displayRoleLabel(role: string | null | undefined): string {
  if (role === "admin") return "관리자";
  return "사내 사용자";
}

export function isAdminOnlyDashboardPath(pathname: string): boolean {
  const prefixes = [
    "/dashboard/partner-applications",
    "/dashboard/upload-hub",
    "/dashboard/upload",
    "/dashboard/performance/upload",
    "/dashboard/trainings/tech-partner-upload",
    "/dashboard/events/upload",
    "/dashboard/policy/upload",
    "/dashboard/partners/new",
    "/dashboard/platinum-upgrade",
    "/dashboard/documents/duplicates",
    "/dashboard/storage-audit",
    "/dashboard/data-quality",
    "/dashboard/contacts/review",
    "/dashboard/settings/users"
  ];
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** 외부 신청자·viewer 모두 로그인 없이(또는 세션과 무관하게) 접근 가능한 신청 경로 */
export function isPublicApplicantPath(pathname: string): boolean {
  return pathname === "/partner-apply" || pathname.startsWith("/partner-apply/");
}

export function isViewerAllowedApiMutation(pathname: string): boolean {
  if (pathname.startsWith("/api/public/")) return true;
  if (pathname === "/api/account/password") return true;
  return false;
}

export function isAdminOnlySidebarHref(href: string): boolean {
  return href === "/dashboard/partner-applications" || href === "/dashboard/platinum-upgrade";
}

export function isAdminOnlyApiPath(pathname: string, method: string): boolean {
  if (pathname.startsWith("/api/public/")) return false;
  if (pathname.startsWith("/api/admin/")) return true;
  if (pathname.startsWith("/api/import/")) return true;
  if (pathname.startsWith("/api/platinum-upgrade")) return true;
  if (isApiMutationMethod(method) && !isViewerAllowedApiMutation(pathname)) return true;
  return false;
}

export function isApiMutationMethod(method: string): boolean {
  return method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
}
