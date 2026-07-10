/**
 * partner_id + 이름 기준 중복 contact 병합
 *
 * Usage:
 *   npm run merge:contacts:dry
 *   npm run merge:contacts:run
 *
 * 실제 병합은 CONFIRM_MERGE=true 일 때만 실행됩니다.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { mergeContactsIntoMaster, pickCanonicalContact } from "../src/lib/contacts/contact-merge";
import { buildPersonKey, normalizePersonName } from "../src/lib/contacts/person-key";

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

async function main() {
  loadEnvLocal();
  const confirm = process.env.CONFIRM_MERGE === "true";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env missing");

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: contacts, error } = await supabase
    .from("partner_contacts")
    .select("id, partner_id, name, email, phone, is_primary, is_contract_contact, created_at, merged_into_contact_id")
    .is("deleted_at", null)
    .is("merged_into_contact_id", null);

  if (error) throw new Error(error.message);

  const groups = new Map<string, typeof contacts>();
  for (const contact of contacts ?? []) {
    const personKey = buildPersonKey(contact.partner_id as string, contact.name as string);
    const list = groups.get(personKey) ?? [];
    list.push(contact);
    groups.set(personKey, list);
  }

  const duplicateGroups = [...groups.entries()].filter(([, members]) => members.length > 1);

  console.log(`스캔: ${contacts?.length ?? 0}건`);
  console.log(`중복 그룹: ${duplicateGroups.length}건`);

  for (const [key, members] of duplicateGroups) {
    const canonical = pickCanonicalContact(members);
    const secondaries = members.filter((m) => m.id !== canonical.id);
    console.log(
      `- ${key} · ${normalizePersonName(canonical.name)} · master=${canonical.id} · merge ${secondaries.length}건`
    );

    if (confirm) {
      await mergeContactsIntoMaster(
        supabase,
        canonical.id as string,
        secondaries.map((m) => m.id as string),
        "merge_duplicate_contacts_script"
      );
    }
  }

  if (!confirm) {
    console.log("dry-run입니다. 병합하려면 CONFIRM_MERGE=true 로 다시 실행하세요.");
  } else {
    console.log("병합 완료");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
