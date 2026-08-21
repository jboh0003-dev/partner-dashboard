/**
 * Role / bypass / admin-path helpers (no DB).
 * 실행: npx tsx scripts/test-auth-roles.ts
 */
import assert from "node:assert/strict";
import {
  canChangeAccountRole,
  canDeleteAccount
} from "../src/lib/auth/account-guards";
import {
  displayRoleLabel,
  isAdminOnlyApiPath,
  isAdminOnlyDashboardPath,
  isAdminOnlySidebarHref,
  isDevAdminBypassEnabled,
  isPublicApplicantPath,
  isViewerAllowedApiMutation,
  resolveIsAdmin
} from "../src/lib/auth/roles";

assert.equal(displayRoleLabel("admin"), "관리자");
assert.equal(displayRoleLabel("viewer"), "조회 사용자");
assert.equal(displayRoleLabel("user"), "조회 사용자");

assert.equal(resolveIsAdmin("admin"), true);
assert.equal(resolveIsAdmin("viewer"), false);
assert.equal(resolveIsAdmin("user"), false);

assert.equal(isAdminOnlyDashboardPath("/dashboard/partner-applications"), true);
assert.equal(isAdminOnlyDashboardPath("/dashboard/partner-applications/abc"), true);
assert.equal(isAdminOnlyDashboardPath("/dashboard/partners"), false);
assert.equal(isAdminOnlyDashboardPath("/dashboard/settings/users"), true);
assert.equal(isAdminOnlyDashboardPath("/dashboard/settings/account"), false);
assert.equal(isPublicApplicantPath("/partner-apply"), true);
assert.equal(isPublicApplicantPath("/partner-apply/abc"), true);
assert.equal(isPublicApplicantPath("/dashboard/partner-applications"), false);
assert.equal(isAdminOnlySidebarHref("/dashboard/partner-applications"), true);
assert.equal(isAdminOnlySidebarHref("/partner-apply"), false);

assert.equal(isViewerAllowedApiMutation("/api/account/password"), true);
assert.equal(isViewerAllowedApiMutation("/api/public/partner-applications"), true);
assert.equal(isViewerAllowedApiMutation("/api/partners/bulk"), false);

assert.equal(isAdminOnlyApiPath("/api/partners/bulk", "DELETE"), true);
assert.equal(isAdminOnlyApiPath("/api/account/password", "POST"), false);
assert.equal(isAdminOnlyApiPath("/api/admin/users", "GET"), true);
assert.equal(isAdminOnlyApiPath("/api/admin/users/bulk", "POST"), true);
assert.equal(isAdminOnlyApiPath("/api/admin/partner-applications", "GET"), true);
assert.equal(isAdminOnlyApiPath("/api/public/partner-applications", "POST"), false);
assert.equal(isAdminOnlyApiPath("/api/import/jobs", "GET"), true);
assert.equal(isAdminOnlyApiPath("/api/partners/search", "GET"), false);
assert.equal(isAdminOnlyApiPath("/api/contacts/abc", "PATCH"), true);
assert.equal(isAdminOnlyApiPath("/api/contacts/abc", "GET"), false);
assert.equal(isAdminOnlyApiPath("/api/partners/documents/abc", "DELETE"), true);
assert.equal(isAdminOnlyApiPath("/api/admin/users/bulk", "POST"), true);

assert.equal(
  canChangeAccountRole({
    actorUserId: "admin-1",
    targetUserId: "admin-1",
    currentRole: "admin",
    nextRole: "viewer",
    adminCount: 3
  }).ok,
  false
);
assert.equal(
  canDeleteAccount({
    actorUserId: "admin-1",
    targetUserId: "admin-1",
    targetRole: "admin",
    adminCount: 3
  }).ok,
  false
);
assert.equal(
  canChangeAccountRole({
    actorUserId: "admin-1",
    targetUserId: "admin-2",
    currentRole: "admin",
    nextRole: "viewer",
    adminCount: 1
  }).ok,
  false
);
assert.equal(
  canDeleteAccount({
    actorUserId: "admin-1",
    targetUserId: "admin-2",
    targetRole: "admin",
    adminCount: 1
  }).ok,
  false
);
assert.equal(
  canChangeAccountRole({
    actorUserId: "admin-1",
    targetUserId: "viewer-1",
    currentRole: "viewer",
    nextRole: "admin",
    adminCount: 1
  }).ok,
  true
);

assert.equal(process.env.NODE_ENV === "production" ? isDevAdminBypassEnabled() : isDevAdminBypassEnabled(), process.env.ENABLE_DEV_ADMIN_BYPASS === "true" && process.env.NODE_ENV !== "production");

console.log("OK: auth roles tests passed");
