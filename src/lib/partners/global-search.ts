import { PARTNER_GRADE_LABEL } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPartnerNo } from "@/lib/partners/partner-no";

export type GlobalPartnerSearchResult = {
  id: string;
  company_name: string;
  grade: string | null;
  grade_label: string;
  external_no: string | null;
  contact_name: string | null;
  contact_email: string | null;
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

function maxScore(values: Array<string | null | undefined>, query: string): number {
  return values.reduce((max, value) => Math.max(max, scoreText(value, query)), 0);
}

export async function searchPartnersGlobal(
  query: string,
  limit = 10
): Promise<GlobalPartnerSearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  const supabase = createAdminClient();
  const pattern = `%${q}%`;

  const [{ data: partners }, { data: contacts }] = await Promise.all([
    supabase
      .from("partners")
      .select(
        "id, company_name, grade, external_no, sales_owner, contract_contact_name, contract_contact_email, contract_contact_phone"
      )
      .is("deleted_at", null)
      .or(
        `company_name.ilike.${pattern},external_no.ilike.${pattern},sales_owner.ilike.${pattern},contract_contact_name.ilike.${pattern},contract_contact_email.ilike.${pattern},contract_contact_phone.ilike.${pattern}`
      )
      .limit(40),
    supabase
      .from("partner_contacts")
      .select("partner_id, name, email, phone, is_contract_contact, is_primary")
      .eq("is_active", true)
      .is("deleted_at", null)
      .or(`name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`)
      .limit(60)
  ]);

  const partnerMap = new Map<
    string,
    {
      id: string;
      company_name: string;
      grade: string | null;
      external_no: string | null;
      sales_owner: string | null;
      contract_contact_name: string | null;
      contract_contact_email: string | null;
      contract_contact_phone: string | null;
    }
  >();

  for (const partner of partners ?? []) {
    partnerMap.set(String(partner.id), {
      id: String(partner.id),
      company_name: String(partner.company_name),
      grade: partner.grade ? String(partner.grade) : null,
      external_no: partner.external_no ? String(partner.external_no) : null,
      sales_owner: partner.sales_owner ? String(partner.sales_owner) : null,
      contract_contact_name: partner.contract_contact_name
        ? String(partner.contract_contact_name)
        : null,
      contract_contact_email: partner.contract_contact_email
        ? String(partner.contract_contact_email)
        : null,
      contract_contact_phone: partner.contract_contact_phone
        ? String(partner.contract_contact_phone)
        : null
    });
  }

  const contactPartnerIds = [...new Set((contacts ?? []).map((row) => String(row.partner_id)))];
  const missingPartnerIds = contactPartnerIds.filter((id) => !partnerMap.has(id));

  if (missingPartnerIds.length > 0) {
    const { data: linkedPartners } = await supabase
      .from("partners")
      .select(
        "id, company_name, grade, external_no, sales_owner, contract_contact_name, contract_contact_email, contract_contact_phone"
      )
      .in("id", missingPartnerIds)
      .is("deleted_at", null);

    for (const partner of linkedPartners ?? []) {
      partnerMap.set(String(partner.id), {
        id: String(partner.id),
        company_name: String(partner.company_name),
        grade: partner.grade ? String(partner.grade) : null,
        external_no: partner.external_no ? String(partner.external_no) : null,
        sales_owner: partner.sales_owner ? String(partner.sales_owner) : null,
        contract_contact_name: partner.contract_contact_name
          ? String(partner.contract_contact_name)
          : null,
        contract_contact_email: partner.contract_contact_email
          ? String(partner.contract_contact_email)
          : null,
        contract_contact_phone: partner.contract_contact_phone
          ? String(partner.contract_contact_phone)
          : null
      });
    }
  }

  const contactsByPartner = new Map<string, typeof contacts>();
  for (const contact of contacts ?? []) {
    const partnerId = String(contact.partner_id);
    const bucket = contactsByPartner.get(partnerId) ?? [];
    bucket.push(contact);
    contactsByPartner.set(partnerId, bucket);
  }

  const results: GlobalPartnerSearchResult[] = [];

  for (const partner of partnerMap.values()) {
    const partnerContacts = contactsByPartner.get(partner.id) ?? [];
    const contractContact =
      partnerContacts.find((c) => c.is_contract_contact) ??
      partnerContacts.find((c) => c.is_primary) ??
      partnerContacts[0];

    const contactFields = partnerContacts.flatMap((c) => [c.name, c.email, c.phone]);

    const score = Math.max(
      maxScore(
        [
          partner.company_name,
          partner.external_no,
          formatPartnerNo(partner),
          partner.sales_owner,
          partner.contract_contact_name,
          partner.contract_contact_email,
          partner.contract_contact_phone,
          PARTNER_GRADE_LABEL[partner.grade ?? "none"]
        ],
        q
      ),
      maxScore(contactFields, q)
    );

    if (score === 0) continue;

    results.push({
      id: partner.id,
      company_name: partner.company_name,
      grade: partner.grade,
      grade_label: PARTNER_GRADE_LABEL[partner.grade ?? "none"] ?? partner.grade ?? "-",
      external_no: partner.external_no,
      contact_name:
        contractContact?.name ?? partner.contract_contact_name ?? partner.sales_owner ?? null,
      contact_email:
        contractContact?.email ?? partner.contract_contact_email ?? null,
      score
    });
  }

  return results
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.company_name.localeCompare(right.company_name, "ko");
    })
    .slice(0, limit);
}
