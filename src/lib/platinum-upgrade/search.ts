import { PARTNER_GRADE_LABEL } from "@/lib/constants";
import {
  getDisplayPartnerGrade,
  getDisplayPartnerGradeLabel
} from "@/lib/partners/grade";
import { formatPartnerNo } from "@/lib/partners/partner-no";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeBusinessNumber } from "@/lib/partner-match";
import {
  FORMAL_COMPANY_NAME_SOURCE_LABEL,
  resolveFormalCompanyNameForPartner,
  resolveFormalCompanyNameFromSources,
  type DocumentNameRow,
  type FormalCompanyNameSource
} from "@/lib/platinum-upgrade/formal-company-name";

export type PlatinumUpgradeSearchHit = {
  id: string;
  /** DB 표시명 */
  company_name: string;
  /** 문서용 정식 상호 (자동 입력 기본값) */
  legal_company_name: string;
  legal_company_name_source: FormalCompanyNameSource;
  legal_company_name_source_label: string;
  business_number: string | null;
  ceo_name: string | null;
  grade: string;
  grade_label: string;
  is_platinum: boolean;
  external_no: string | null;
  partner_no: string;
  score: number;
};

function scoreText(text: string | null | undefined, query: string): number {
  const normalized = (text ?? "").trim().toLowerCase();
  const q = query.trim().toLowerCase();
  if (!normalized || !q) return 0;
  if (normalized === q) return 100;
  if (normalized.startsWith(q)) return 85;
  if (normalized.includes(q)) return 70;
  return 0;
}

export async function searchPartnersForPlatinumUpgrade(
  query: string,
  limit = 15
): Promise<PlatinumUpgradeSearchHit[]> {
  const q = query.trim();
  if (!q) return [];

  const supabase = createAdminClient();
  const safeQ = q.replace(/[%_,.()]/g, " ").trim();
  if (!safeQ) return [];
  const pattern = `%${safeQ}%`;
  const digits = normalizeBusinessNumber(q) ?? "";
  const orParts = [
    `company_name.ilike.${pattern}`,
    `contract_display_name.ilike.${pattern}`,
    `business_number.ilike.${pattern}`
  ];
  if (digits.length >= 5) {
    orParts.push(`business_number.ilike.%${digits}%`);
  }

  const { data, error } = await supabase
    .from("partners")
    .select(
      "id, company_name, contract_display_name, business_number, ceo_name, grade, grade_override, grade_change_raw, grade_original, external_no, is_active, deleted_at"
    )
    .is("deleted_at", null)
    .neq("is_active", false)
    .or(orParts.join(","))
    .limit(40);
  if (error) throw new Error(error.message);

  const partnerIds = (data ?? []).map((row) => String(row.id));
  const docsByPartner = new Map<string, DocumentNameRow[]>();

  if (partnerIds.length > 0) {
    const { data: documents, error: docsError } = await supabase
      .from("partner_documents")
      .select(
        "partner_id, document_type, extracted_partner_name, partner_name_raw, original_filename, source_file, display_name, created_at"
      )
      .in("partner_id", partnerIds)
      .is("deleted_at", null)
      .eq("is_active", true)
      .in("document_type", [
        "business_registration",
        "partner_contract",
        "partner_application"
      ])
      .order("created_at", { ascending: false })
      .limit(200);
    if (docsError) throw new Error(docsError.message);

    for (const doc of documents ?? []) {
      const partnerId = String(doc.partner_id);
      const bucket = docsByPartner.get(partnerId) ?? [];
      bucket.push({
        document_type: doc.document_type ? String(doc.document_type) : null,
        extracted_partner_name: doc.extracted_partner_name
          ? String(doc.extracted_partner_name)
          : null,
        partner_name_raw: doc.partner_name_raw ? String(doc.partner_name_raw) : null,
        original_filename: doc.original_filename ? String(doc.original_filename) : null,
        source_file: doc.source_file ? String(doc.source_file) : null,
        display_name: doc.display_name ? String(doc.display_name) : null,
        created_at: doc.created_at ? String(doc.created_at) : null
      });
      docsByPartner.set(partnerId, bucket);
    }
  }

  const results: PlatinumUpgradeSearchHit[] = [];

  for (const row of data ?? []) {
    const company = String(row.company_name ?? "");
    const contractName = row.contract_display_name
      ? String(row.contract_display_name)
      : null;
    const bn = row.business_number ? String(row.business_number) : null;
    const bnDigits = normalizeBusinessNumber(bn);
    const score = Math.max(
      scoreText(company, q),
      scoreText(contractName, q),
      scoreText(bn, q),
      digits ? scoreText(bnDigits, digits) : 0,
      scoreText(row.external_no ? String(row.external_no) : null, q)
    );
    if (score === 0) continue;

    const partnerId = String(row.id);
    const formal = resolveFormalCompanyNameFromSources({
      partner: row,
      documents: docsByPartner.get(partnerId) ?? []
    });
    if (!formal.name) continue;

    const grade = getDisplayPartnerGrade(row);
    results.push({
      id: partnerId,
      company_name: company,
      legal_company_name: formal.name,
      legal_company_name_source: formal.source,
      legal_company_name_source_label: FORMAL_COMPANY_NAME_SOURCE_LABEL[formal.source],
      business_number: bn,
      ceo_name: row.ceo_name ? String(row.ceo_name) : null,
      grade,
      grade_label:
        getDisplayPartnerGradeLabel(row) || PARTNER_GRADE_LABEL[grade] || grade,
      is_platinum: grade === "platinum",
      external_no: row.external_no ? String(row.external_no) : null,
      partner_no: formatPartnerNo(row),
      score
    });
  }

  return results
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.company_name.localeCompare(b.company_name, "ko");
    })
    .slice(0, limit);
}

export async function fetchPartnerForPlatinumUpgrade(partnerId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("partners")
    .select(
      "id, company_name, contract_display_name, business_number, ceo_name, grade, grade_override, grade_change_raw, grade_original, external_no, is_active, deleted_at"
    )
    .eq("id", partnerId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const formal = await resolveFormalCompanyNameForPartner(supabase, partnerId, data);
  if (!formal?.name) return null;

  const grade = getDisplayPartnerGrade(data);
  return {
    id: String(data.id),
    company_name: String(data.company_name ?? ""),
    legal_company_name: formal.name,
    legal_company_name_source: formal.source,
    legal_company_name_source_label: FORMAL_COMPANY_NAME_SOURCE_LABEL[formal.source],
    business_number: data.business_number ? String(data.business_number) : null,
    ceo_name: data.ceo_name ? String(data.ceo_name) : null,
    grade,
    grade_label: getDisplayPartnerGradeLabel(data),
    is_platinum: grade === "platinum",
    external_no: data.external_no ? String(data.external_no) : null,
    partner_no: formatPartnerNo(data)
  };
}
