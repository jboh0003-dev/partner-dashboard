/**
 * 로그인 후 redirect 파라미터 검증 (open redirect 방지)
 */

const FALLBACK_PATH = "/dashboard";

/** 내부 상대 경로만 허용. 외부 URL·프로토콜 상대 URL 거부 */
export function getSafeRedirectPath(
  value: string | string[] | null | undefined,
  fallback: string = FALLBACK_PATH
): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || typeof raw !== "string") return fallback;

  let decoded = raw.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    return fallback;
  }

  if (!decoded.startsWith("/")) return fallback;
  if (decoded.startsWith("//")) return fallback;
  if (decoded.includes("://")) return fallback;
  if (/[\r\n\\]/.test(decoded)) return fallback;

  // /login 자체로 루프 방지
  if (decoded === "/login" || decoded.startsWith("/login?")) {
    return fallback;
  }

  return decoded;
}

export function buildLoginRedirectUrl(nextPath: string): string {
  const safe = getSafeRedirectPath(nextPath);
  const params = new URLSearchParams({ redirect: safe });
  return `/login?${params.toString()}`;
}
