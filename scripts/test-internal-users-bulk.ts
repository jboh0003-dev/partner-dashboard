/**
 * 사내 사용자 일괄등록 파서/분류 (no DB).
 * 실행: npx tsx scripts/test-internal-users-bulk.ts
 */
import assert from "node:assert/strict";
import { isAdminOnlyApiPath } from "../src/lib/auth/roles";
import {
  classifyInternalUserBulkRows,
  INTERNAL_USER_BULK_PRESET,
  isOkestroEmail,
  parseInternalUserBulkText,
  summarizeBulkRows
} from "../src/lib/auth/internal-users-bulk";
import {
  bulkPasswordPolicyMessage,
  isPasswordPolicyError
} from "../src/lib/auth/password-policy";

const parsed = parseInternalUserBulkText(INTERNAL_USER_BULK_PRESET);
assert.equal(parsed.length, 33);
assert.equal(parsed.every((row) => !row.error), true);
assert.equal(parsed[0]?.email, "hj.ko2@okestro.com");
assert.equal(parsed[0]?.role, "admin");
assert.equal(parsed[0]?.name, null);
assert.equal(parsed[1]?.role, "viewer");

const withName = parseInternalUserBulkText("홍길동,sh.kwon@okestro.com,viewer");
assert.equal(withName[0]?.name, "홍길동");
assert.equal(withName[0]?.email, "sh.kwon@okestro.com");

const defaultRole = parseInternalUserBulkText("ck.jeong@okestro.com");
assert.equal(defaultRole[0]?.role, "viewer");

assert.equal(isOkestroEmail("a@okestro.com"), true);
assert.equal(isOkestroEmail("a@gmail.com"), false);
const external = parseInternalUserBulkText("a@gmail.com,viewer");
assert.equal(external[0]?.error?.includes("@okestro.com"), true);

const dup = parseInternalUserBulkText("sh.kwon@okestro.com,viewer\nsh.kwon@okestro.com,admin");
assert.equal(dup[0]?.error, null);
assert.equal(dup[1]?.error?.includes("중복"), true);

const classified = classifyInternalUserBulkRows(parsed, {
  authByEmail: new Map([
    ["jb.oh@okestro.com", "auth-jb"],
    ["hj.ko2@okestro.com", "auth-hj"]
  ]),
  profileEmails: new Set(["jb.oh@okestro.com"]),
  profileIds: new Set(["auth-jb"])
});
const hj = classified.find((row) => row.email === "hj.ko2@okestro.com");
assert.equal(hj?.action, "create_profile");
assert.equal(hj?.role, "admin");
const sh = classified.find((row) => row.email === "sh.kwon@okestro.com");
assert.equal(sh?.action, "create_auth");
assert.equal(sh?.role, "viewer");

const existingBoth = classifyInternalUserBulkRows(parseInternalUserBulkText("jb.oh@okestro.com,viewer"), {
  authByEmail: new Map([["jb.oh@okestro.com", "auth-jb"]]),
  profileEmails: new Set(["jb.oh@okestro.com"]),
  profileIds: new Set(["auth-jb"])
});
assert.equal(existingBoth[0]?.action, "existing");

const summary = summarizeBulkRows(classified);
assert.equal(summary.total, 33);
assert.equal(summary.create_profile, 1);
assert.equal(summary.create_auth, 32);
assert.equal(summary.existing, 0);
assert.equal(summary.errors, 0);

assert.equal(isPasswordPolicyError({ message: "Password should be at least 8 characters" }), true);
assert.equal(
  bulkPasswordPolicyMessage("1234").includes("1234를 사용할 수 없습니다"),
  true
);

assert.equal(isAdminOnlyApiPath("/api/admin/users/bulk", "POST"), true);
assert.equal(isAdminOnlyApiPath("/api/admin/users/bulk", "GET"), true);

console.log("OK: internal users bulk tests passed");
