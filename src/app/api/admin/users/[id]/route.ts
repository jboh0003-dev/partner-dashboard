import { NextResponse } from "next/server";
import { z } from "zod";
import { canChangeAccountRole, canDeleteAccount } from "@/lib/auth/account-guards";
import { forbiddenJson, requireAdmin } from "@/lib/auth/require-admin";
import { unauthorizedJson } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const PatchSchema = z.object({
  role: z.enum(["viewer", "admin"])
});

async function countAdmins(supabase: ReturnType<typeof createAdminClient>) {
  const { count, error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function PATCH(request: Request, context: Ctx) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.status === 401 ? unauthorizedJson(auth.message) : forbiddenJson(auth.message);
  }
  if (!auth.userId) {
    return unauthorizedJson("로그인이 필요합니다. 다시 로그인해주세요.");
  }

  const { id } = await context.params;
  const json = await request.json().catch(() => null);
  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "역할이 올바르지 않습니다." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: target, error } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ ok: false, message: "계정을 확인하지 못했습니다." }, { status: 500 });
  }
  if (!target) {
    return NextResponse.json({ ok: false, message: "계정을 찾을 수 없습니다." }, { status: 404 });
  }

  let adminCount = 0;
  try {
    adminCount = await countAdmins(supabase);
  } catch {
    return NextResponse.json({ ok: false, message: "계정 역할을 변경하지 못했습니다." }, { status: 500 });
  }

  const allowed = canChangeAccountRole({
    actorUserId: auth.userId,
    targetUserId: String(target.id),
    currentRole: target.role ? String(target.role) : null,
    nextRole: parsed.data.role,
    adminCount
  });
  if (!allowed.ok) {
    return NextResponse.json({ ok: false, message: allowed.message }, { status: 403 });
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ role: parsed.data.role })
    .eq("id", id);
  if (updateError) {
    return NextResponse.json({ ok: false, message: "계정 역할을 변경하지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: Ctx) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.status === 401 ? unauthorizedJson(auth.message) : forbiddenJson(auth.message);
  }
  if (!auth.userId) {
    return unauthorizedJson("로그인이 필요합니다. 다시 로그인해주세요.");
  }

  const { id } = await context.params;
  const supabase = createAdminClient();
  const { data: target, error } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ ok: false, message: "계정을 확인하지 못했습니다." }, { status: 500 });
  }
  if (!target) {
    return NextResponse.json({ ok: false, message: "계정을 찾을 수 없습니다." }, { status: 404 });
  }

  let adminCount = 0;
  try {
    adminCount = await countAdmins(supabase);
  } catch {
    return NextResponse.json({ ok: false, message: "계정을 삭제하지 못했습니다." }, { status: 500 });
  }

  const allowed = canDeleteAccount({
    actorUserId: auth.userId,
    targetUserId: String(target.id),
    targetRole: target.role ? String(target.role) : null,
    adminCount
  });
  if (!allowed.ok) {
    return NextResponse.json({ ok: false, message: allowed.message }, { status: 403 });
  }

  const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(id);
  if (deleteAuthError) {
    return NextResponse.json({ ok: false, message: "계정을 삭제하지 못했습니다." }, { status: 500 });
  }

  const { error: deleteProfileError } = await supabase.from("profiles").delete().eq("id", id);
  if (deleteProfileError) {
    return NextResponse.json(
      { ok: false, message: "인증 계정은 삭제됐지만 프로필 정리에 실패했습니다." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
