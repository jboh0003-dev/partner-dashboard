import { createClient } from "@supabase/supabase-js";

async function main() {
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: docs } = await s
    .from("partner_policy_documents")
    .select("id,policy_title,version_label,effective_date,source_file_name,is_current,status,storage_path")
    .order("created_at", { ascending: false });
  console.log("docs", JSON.stringify(docs, null, 2));

  const target =
    docs?.find((d) => d.source_file_name?.includes("260623")) ??
    docs?.find((d) => d.is_current) ??
    docs?.[0];
  if (!target) return;

  const { data: chunks } = await s
    .from("partner_policy_chunks")
    .select("id,slide_number,section_title,category,content")
    .eq("policy_document_id", target.id)
    .order("slide_number")
    .limit(5);

  for (const c of chunks ?? []) {
    console.log("--- chunk", c.slide_number, c.section_title, c.category);
    console.log(String(c.content).slice(0, 400));
  }

  const all = await s.from("partner_policy_chunks").select("content").eq("policy_document_id", target.id);
  const xmlCount = (all.data ?? []).filter((c) =>
    /<a:|<p:|<r:|xmlns|cNvPr|defRPr|solidFill|schemeClr|tblPr|tabLst|endParaRPr/i.test(String(c.content))
  ).length;
  console.log("total chunks", all.data?.length, "xml chunks", xmlCount);
}

main();
