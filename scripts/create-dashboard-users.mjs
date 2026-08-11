import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.NEW_DASHBOARD_USER_PASSWORD;

if (!url || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 없습니다.");
}

if (!password) {
  throw new Error("NEW_DASHBOARD_USER_PASSWORD 환경변수를 지정해 주세요.");
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const emails = ["wj.park@okestro.com", "tw.kim2@okestro.com"];

for (const email of emails) {
  const { data: existing, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  });

  if (listError) throw listError;
  const user = existing.users.find((entry) => entry.email?.toLowerCase() === email.toLowerCase());

  if (user) {
    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true
    });
    if (error) throw error;
    console.log(`updated: ${email}`);
    continue;
  }

  const { error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });
  if (error) throw error;
  console.log(`created: ${email}`);
}
