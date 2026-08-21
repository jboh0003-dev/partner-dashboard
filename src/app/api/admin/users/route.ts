import { NextResponse } from "next/server";
import { z } from "zod";
import { forbiddenJson, requireAdmin } from "@/lib/auth/require-admin";
import { unauthorizedJson } from "@/lib/auth/require-user";
import { passwordPolicyMessage } from "@/lib/auth/password-policy";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const CreateSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  role: z.enum(["viewer", "admin"]).default("viewer"),
  password: z.string().min(1)
});

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.status === 401 ? unauthorizedJson(auth.message) : forbiddenJson(auth.message);
  }
  if (!auth.userId) {
    return unauthorizedJson("로그인이 필요합니다. 다시 로그인해주세요.");
  }

  const supabase = createAdminClient();
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, email, name, role, created_at")
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ ok: false, message: "계정 목록을 불러오지 못했습니다." }, { status: 500 });
  }

  const lastSignIn = new Map<string, string | null>();
  try {
    const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
    for (const user of data.users ?? []) {
      lastSignIn.set(user.id, user.last_sign_in_at ?? null);
    }
  } catch {
    // last_sign_in 없어도 목록은 표시
  }

  const users = (profiles ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    created_at: row.created_at,
    last_sign_in_at: lastSignIn.get(String(row.id)) ?? null,
    status: "활성"
  }));

  return NextResponse.json({ ok: true, users, current_user_id: auth.userId });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.status === 401 ? unauthorizedJson(auth.message) : forbiddenJson(auth.message);
  }
  if (!auth.userId) {
    return unauthorizedJson("로그인이 필요합니다. 다시 로그인해주세요.");
  }

  const json = await request.json().catch(() => null);
  const parsed = CreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "이름, 이메일, 역할, 초기 비밀번호를 확인해 주세요." }, { status: 400 });
  }

  const { name, email, role, password } = parsed.data;
  const supabase = createAdminClient();

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name }
  });

  if (createError || !created.user) {
    const policy = passwordPolicyMessage(createError);
    if (policy) {
      return NextResponse.json({ ok: false, message: policy }, { status: 400 });
    }
    return NextResponse.json(
      { ok: false, message: "계정을 만들지 못했습니다. 이메일 중복 여부를 확인해 주세요." },
      { status: 400 }
    );
  }

  const userId = created.user.id;
  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      email,
      name,
      role
    },
    { onConflict: "id" }
  );

  if (profileError) {
    await supabase.auth.admin.deleteUser(userId);
    return NextResponse.json(
      { ok: false, message: "계정 프로필을 저장하지 못해 생성을 취소했습니다." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, user_id: userId });
}
