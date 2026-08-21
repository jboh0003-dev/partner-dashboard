import { NextResponse } from "next/server";
import { z } from "zod";
import {
  classifyInternalUserBulkRows,
  parseInternalUserBulkText,
  summarizeBulkRows,
  type BulkClassifiedRow
} from "@/lib/auth/internal-users-bulk";
import { bulkPasswordPolicyMessage, isPasswordPolicyError } from "@/lib/auth/password-policy";
import { forbiddenJson, requireAdmin } from "@/lib/auth/require-admin";
import { unauthorizedJson } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const BodySchema = z.object({
  dry_run: z.boolean(),
  text: z.string(),
  password: z.string().optional()
});

type AuthAdmin = ReturnType<typeof createAdminClient>;

async function listAllAuthUsers(supabase: AuthAdmin) {
  const users: Array<{ id: string; email: string | null }> = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const batch = data.users ?? [];
    for (const user of batch) {
      users.push({ id: user.id, email: user.email ?? null });
    }
    if (batch.length < 200) break;
  }
  return users;
}

async function loadExistingMaps(supabase: AuthAdmin) {
  const [{ data: profiles, error: profileError }, authUsers] = await Promise.all([
    supabase.from("profiles").select("id, email"),
    listAllAuthUsers(supabase)
  ]);
  if (profileError) throw new Error(profileError.message);

  const authByEmail = new Map<string, string>();
  for (const user of authUsers) {
    const email = user.email?.trim().toLowerCase();
    if (email) authByEmail.set(email, user.id);
  }
  const profileEmails = new Set<string>();
  const profileIds = new Set<string>();
  for (const row of profiles ?? []) {
    profileIds.add(String(row.id));
    if (row.email) profileEmails.add(String(row.email).trim().toLowerCase());
  }
  return { authByEmail, profileEmails, profileIds };
}

async function createAuthAndProfile(
  supabase: AuthAdmin,
  row: BulkClassifiedRow,
  password: string
) {
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: row.email,
    password,
    email_confirm: true,
    user_metadata: row.name ? { name: row.name } : undefined
  });
  if (createError || !created.user) {
    return { ok: false as const, error: createError };
  }
  const userId = created.user.id;
  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      email: row.email,
      name: row.name,
      role: row.role
    },
    { onConflict: "id" }
  );
  if (profileError) {
    await supabase.auth.admin.deleteUser(userId);
    return { ok: false as const, error: profileError };
  }
  return { ok: true as const, userId };
}

async function createProfileOnly(supabase: AuthAdmin, row: BulkClassifiedRow) {
  if (!row.authUserId) {
    return { ok: false as const, message: "Auth 사용자를 찾지 못했습니다." };
  }
  const { error } = await supabase.from("profiles").upsert(
    {
      id: row.authUserId,
      email: row.email,
      name: row.name,
      role: row.role
    },
    { onConflict: "id" }
  );
  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const };
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
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "입력값을 확인해 주세요." }, { status: 400 });
  }

  const rows = parseInternalUserBulkText(parsed.data.text);
  if (!rows.length) {
    return NextResponse.json({ ok: false, message: "등록할 사용자를 입력해 주세요." }, { status: 400 });
  }

  const supabase = createAdminClient();
  let existing;
  try {
    existing = await loadExistingMaps(supabase);
  } catch {
    return NextResponse.json({ ok: false, message: "계정 목록을 불러오지 못했습니다." }, { status: 500 });
  }

  const classified = classifyInternalUserBulkRows(rows, existing);
  const summary = summarizeBulkRows(classified);

  if (parsed.data.dry_run) {
    return NextResponse.json({
      ok: true,
      dry_run: true,
      summary,
      items: classified.map((row) => ({
        lineNumber: row.lineNumber,
        email: row.email,
        name: row.name,
        role: row.role,
        action: row.action,
        message: row.error
      }))
    });
  }

  const password = parsed.data.password ?? "";
  if (!password) {
    return NextResponse.json({ ok: false, message: "초기 비밀번호를 입력해 주세요." }, { status: 400 });
  }

  const results: Array<{
    email: string;
    name: string | null;
    role: string;
    status: "created" | "profile_created" | "skipped" | "failed" | "cancelled";
    message: string | null;
  }> = [];
  let aborted = false;
  let abortMessage: string | null = null;

  for (const row of classified) {
    if (aborted) {
      if (row.action === "existing") {
        results.push({
          email: row.email,
          name: row.name,
          role: row.role,
          status: "skipped",
          message: "기존 계정"
        });
        continue;
      }
      if (row.action === "error") {
        results.push({
          email: row.email,
          name: row.name,
          role: row.role,
          status: "failed",
          message: row.error
        });
        continue;
      }
      results.push({
        email: row.email,
        name: row.name,
        role: row.role,
        status: "cancelled",
        message: abortMessage
      });
      continue;
    }
    if (row.action === "error") {
      results.push({
        email: row.email,
        name: row.name,
        role: row.role,
        status: "failed",
        message: row.error
      });
      continue;
    }
    if (row.action === "existing") {
      results.push({
        email: row.email,
        name: row.name,
        role: row.role,
        status: "skipped",
        message: "기존 계정"
      });
      continue;
    }
    if (row.action === "create_profile") {
      const created = await createProfileOnly(supabase, row);
      results.push({
        email: row.email,
        name: row.name,
        role: row.role,
        status: created.ok ? "profile_created" : "failed",
        message: created.ok ? "프로필 생성" : created.message
      });
      continue;
    }

    const created = await createAuthAndProfile(supabase, row, password);
    if (created.ok) {
      results.push({
        email: row.email,
        name: row.name,
        role: row.role,
        status: "created",
        message: "생성 완료"
      });
      continue;
    }
    if (isPasswordPolicyError(created.error)) {
      aborted = true;
      abortMessage = bulkPasswordPolicyMessage(password);
      results.push({
        email: row.email,
        name: row.name,
        role: row.role,
        status: "failed",
        message: abortMessage
      });
      continue;
    }
    results.push({
      email: row.email,
      name: row.name,
      role: row.role,
      status: "failed",
      message: created.error?.message || "계정을 만들지 못했습니다."
    });
  }

  return NextResponse.json({
    ok: !aborted,
    dry_run: false,
    aborted,
    message: abortMessage,
    summary: {
      created: results.filter((row) => row.status === "created").length,
      profile_created: results.filter((row) => row.status === "profile_created").length,
      skipped: results.filter((row) => row.status === "skipped").length,
      failed: results.filter((row) => row.status === "failed").length,
      cancelled: results.filter((row) => row.status === "cancelled").length
    },
    items: results
  });
}
