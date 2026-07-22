/**
 * auth redirect / open-redirect 방지 단위 테스트
 * 실행: npx tsx scripts/test-auth-redirect.ts
 */
import { buildLoginRedirectUrl, getSafeRedirectPath } from "../src/lib/auth/redirect";
import { mapAuthErrorMessage } from "../src/lib/auth/errors";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(getSafeRedirectPath("/dashboard/upload") === "/dashboard/upload", "internal ok");
assert(getSafeRedirectPath("%2Fdashboard%2Fupload") === "/dashboard/upload", "encoded ok");
assert(getSafeRedirectPath("https://evil.com") === "/dashboard", "external blocked");
assert(getSafeRedirectPath("//evil.com") === "/dashboard", "protocol-relative blocked");
assert(getSafeRedirectPath("/\\evil") === "/dashboard", "backslash blocked");
assert(getSafeRedirectPath("/login") === "/dashboard", "login loop blocked");
assert(getSafeRedirectPath(null) === "/dashboard", "null fallback");
assert(
  buildLoginRedirectUrl("/dashboard/upload") ===
    "/login?redirect=%2Fdashboard%2Fupload",
  "login redirect url"
);

assert(
  mapAuthErrorMessage({ message: "Invalid login credentials" }).includes("이메일"),
  "invalid credentials mapped"
);
assert(
  mapAuthErrorMessage({ message: "Email not confirmed" }).includes("이메일 인증"),
  "email not confirmed mapped"
);

console.log("OK: auth redirect / error mapping tests passed");
