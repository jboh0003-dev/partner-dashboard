import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    if (!process.env[t.slice(0, i)]) process.env[t.slice(0, i)] = t.slice(i + 1);
  }
}

async function main() {
  loadEnv();
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: doc } = await s.from("partner_policy_documents").select("id").eq("is_current", true).single();
  const { data } = await s.from("partner_policy_chunks").select("slide_number,section_title,category,content").eq("policy_document_id", doc!.id);
  for (const c of data ?? []) {
    const text = String(c.content);
    if (/platinum|gold|silver|service|level\s*2|매출\s*목표|10억/i.test(text)) {
      console.log("---", c.slide_number, c.category, c.section_title);
      console.log(text.slice(0, 500));
    }
  }
  for (const c of data ?? []) {
    const text = String(c.content);
    if (/deal\s*report|영업기회\s*등록|conflict|영업우선권/i.test(text)) {
      console.log("DEAL ---", c.slide_number, c.category, c.section_title);
      console.log(text.slice(0, 400));
    }
  }
}

main();
