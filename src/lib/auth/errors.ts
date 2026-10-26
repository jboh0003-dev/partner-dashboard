/** Supabase Auth 오류 → 사용자용 한국어 메시지 */

export function mapAuthErrorMessage(
  error: { message?: string; code?: string; status?: number } | null | undefined,
  fallback = "로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
): string {
  if (!error) return fallback;

  const message = String(error.message ?? "").toLowerCase();
  const code = String(error.code ?? "").toLowerCase();

  if (
    error.status === 402 ||
    /payment required|service restriction|exceed_.*quota|exceeded_.*quota/.test(message) ||
    (message.includes("restricted") && message.includes("quota"))
  ) {
    return "Supabase 서비스 사용량 제한(402)으로 로그인과 데이터 조회가 차단되어 있습니다. 비밀번호 문제가 아니며, 새로고침이나 재로그인만으로 해제되지 않습니다.";
  }

  if (
    code === "invalid_credentials" ||
    message.includes("invalid login credentials") ||
    message.includes("invalid_credentials")
  ) {
    return "이메일 또는 비밀번호를 확인해주세요.";
  }

  if (
    code === "email_not_confirmed" ||
    message.includes("email not confirmed") ||
    message.includes("email_not_confirmed")
  ) {
    return "이메일 인증이 완료되지 않았습니다. 관리자에게 문의해주세요.";
  }

  if (
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("failed to fetch") ||
    code === "unexpected_failure"
  ) {
    return "로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
  }

  if (
    message.includes("session") &&
    (message.includes("expired") || message.includes("not found"))
  ) {
    return "로그인 세션이 만료되었습니다. 다시 로그인해주세요.";
  }

  if (message.includes("too many requests") || code === "over_request_rate_limit") {
    return "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.";
  }

  return fallback;
}

export const SESSION_EXPIRED_MESSAGE =
  "로그인 세션이 만료되었습니다. 다시 로그인해주세요.";
