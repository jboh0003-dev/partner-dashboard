/**
 * 잘못 저장된 담당자 이름(O/Y 등 계약담당자 플래그) 정리
 *
 * Usage:
 *   npm run cleanup:contacts:invalid-names:dry
 *   npm run cleanup:contacts:invalid-names:delete
 *
 * 실제 soft-delete는 CONFIRM_DELETE=true 일 때만 실행됩니다.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isFlagLikeContactName } from "../src/lib/excel/parse-partner-contacts";

const PAGE_SIZE = 1000;
const OUTPUT_DIR = resolve(process.cwd(), "scripts", "output");

type ContactRow = {
  id: string;
  partner_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source_file: string | null;
  deleted_at: string | null;
  is_active: boolean | null;
  partner: { company_name: string; external_no: string | null } | null;
};

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx < 0) continue;
      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // optional
  }
}

function createAdminSupabase(): SupabaseClient {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function fetchAllContacts(supabase: SupabaseClient): Promise<ContactRow[]> {
  const rows: ContactRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("partner_contacts")
      .select(
        "id, partner_id, name, email, phone, source_file, deleted_at, is_active, partner:partners(company_name, external_no)"
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(error.message);
    const batch = (data ?? []) as unknown as ContactRow[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

async function main() {
  const confirmDelete = process.env.CONFIRM_DELETE === "true";
  const supabase = createAdminSupabase();
  const contacts = await fetchAllContacts(supabase);

  const candidates = contacts.filter((contact) => isFlagLikeContactName(contact.name));

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const reportPath = resolve(
    OUTPUT_DIR,
    `invalid-contact-names-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        scanned: contacts.length,
        candidates: candidates.length,
        confirm_delete: confirmDelete,
        rows: candidates.map((row) => ({
          id: row.id,
          partner_id: row.partner_id,
          partner_no: row.partner?.external_no ?? null,
          company_name: row.partner?.company_name ?? null,
          name: row.name,
          email: row.email,
          phone: row.phone,
          source_file: row.source_file
        }))
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(`스캔: ${contacts.length}건`);
  console.log(`잘못된 이름 후보: ${candidates.length}건`);
  console.log(`리포트: ${reportPath}`);

  if (candidates.length === 0) {
    console.log("정리할 row가 없습니다.");
    return;
  }

  if (!confirmDelete) {
    console.log("dry-run 모드입니다. soft-delete 하려면 CONFIRM_DELETE=true 로 다시 실행하세요.");
    return;
  }

  const now = new Date().toISOString();
  let updated = 0;

  for (const row of candidates) {
    const { error } = await supabase
      .from("partner_contacts")
      .update({
        deleted_at: now,
        is_active: false,
        memo: `[auto-cleanup ${now}] invalid contact name "${row.name}" (계약담당자 플래그 오인식)`
      })
      .eq("id", row.id)
      .is("deleted_at", null);

    if (error) throw new Error(error.message);
    updated += 1;
  }

  console.log(`soft-delete 완료: ${updated}건`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
