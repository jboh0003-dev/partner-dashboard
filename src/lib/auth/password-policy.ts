export function isPasswordPolicyError(error: { message?: string } | null): boolean {
  const message = String(error?.message ?? "").toLowerCase();
  if (!message.includes("password")) return false;
  return (
    (message.includes("least") && message.includes("character")) ||
    message.includes("too short") ||
    message.includes("length") ||
    message.includes("weak")
  );
}

export function passwordPolicyMessage(error: { message?: string } | null): string | null {
  if (!isPasswordPolicyError(error)) return null;
  return "현재 비밀번호 정책상 더 긴 초기 비밀번호가 필요합니다.";
}

export function bulkPasswordPolicyMessage(password: string): string {
  return `현재 Supabase 비밀번호 정책상 ${password}를 사용할 수 없습니다.\n더 긴 초기 비밀번호를 입력해주세요.`;
}
