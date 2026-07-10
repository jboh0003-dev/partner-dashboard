import Link from "next/link";
import { ContactsReviewPanel, type ReviewContactRow } from "@/components/contacts/contacts-review-panel";
import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import { isSamplePartnerName } from "@/lib/partners/sample-filter";

export const dynamic = "force-dynamic";

export default async function ContactsReviewPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("partner_contacts")
    .select(
      "id, partner_id, name, email, phone, review_reason, partner:partners(company_name, external_no)"
    )
    .eq("review_required", true)
    .is("deleted_at", null)
    .is("merged_into_contact_id", null)
    .order("updated_at", { ascending: false });

  const rows: ReviewContactRow[] = ((data ?? []) as Array<{
    id: string;
    partner_id: string;
    name: string;
    email: string | null;
    phone: string | null;
    review_reason: string | null;
    partner:
      | { company_name: string; external_no: string | null }
      | Array<{ company_name: string; external_no: string | null }>
      | null;
  }>)
    .map((row) => {
      const partner = Array.isArray(row.partner) ? row.partner[0] : row.partner;
      return {
        id: row.id,
        partner_id: row.partner_id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        review_reason: row.review_reason,
        company_name: partner?.company_name ?? "-",
        partner_no: partner?.external_no ?? null
      };
    })
    .filter((row) => !isSamplePartnerName(row.company_name));

  return (
    <>
      <PageHeader
        title="담당자 검토"
        description="전체DB 업로드에서 누락되었거나 자동 매칭이 어려운 담당자를 검토합니다."
      />

      <div className="mb-4">
        <Link href="/dashboard/contacts" className="text-sm text-okestro-600 hover:underline">
          ← 인력/담당자 목록
        </Link>
      </div>

      {error ? (
        <p className="text-sm text-rose-600">{error.message}</p>
      ) : (
        <ContactsReviewPanel rows={rows} />
      )}
    </>
  );
}
