/**
 * 계정 역할/삭제 가드. 이메일이 아니라 profiles.role / user id 기준.
 * 기존 계정을 일괄 변경하지 않는다. 개별 변경만 이 규칙을 따른다.
 */

export function canChangeAccountRole(params: {
  actorUserId: string;
  targetUserId: string;
  currentRole: string | null | undefined;
  nextRole: string;
  adminCount: number;
}): { ok: true } | { ok: false; message: string } {
  const currentIsAdmin = params.currentRole === "admin";
  const nextIsAdmin = params.nextRole === "admin";

  if (params.actorUserId === params.targetUserId && currentIsAdmin && !nextIsAdmin) {
    return { ok: false, message: "자신의 관리자 권한은 변경할 수 없습니다." };
  }

  if (currentIsAdmin && !nextIsAdmin && params.adminCount <= 1) {
    return { ok: false, message: "마지막 관리자 계정은 역할을 변경할 수 없습니다." };
  }

  return { ok: true };
}

export function canDeleteAccount(params: {
  actorUserId: string;
  targetUserId: string;
  targetRole: string | null | undefined;
  adminCount: number;
}): { ok: true } | { ok: false; message: string } {
  if (params.actorUserId === params.targetUserId) {
    return { ok: false, message: "자신의 계정은 삭제할 수 없습니다." };
  }

  if (params.targetRole === "admin" && params.adminCount <= 1) {
    return { ok: false, message: "마지막 관리자 계정은 삭제할 수 없습니다." };
  }

  return { ok: true };
}
