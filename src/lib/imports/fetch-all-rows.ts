import type { SupabaseClient } from "@supabase/supabase-js";

/** PostgREST 기본 1000행 제한을 넘는 전체 조회 */
export async function fetchAllRows<T extends Record<string, unknown>>(
  queryFactory: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  for (;;) {
    const to = from + pageSize - 1;
    const { data, error } = await queryFactory(from, to);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

export async function fetchAllPartners(supabase: SupabaseClient) {
  return fetchAllRows<{ id: string; company_name: string; external_no: string | null }>((from, to) =>
    supabase
      .from("partners")
      .select("id, company_name, external_no")
      .is("deleted_at", null)
      .range(from, to)
  );
}

export async function fetchAllCanonicalContacts(supabase: SupabaseClient) {
  return fetchAllRows<Record<string, unknown>>((from, to) =>
    supabase
      .from("partner_contacts")
      .select(
        "id, partner_id, name, department, position, role_type, role_raw, email, phone, is_primary, is_contract_contact, is_active, in_current_full_db, deleted_at, merged_into_contact_id, review_required, review_reason, source_file, created_at"
      )
      .is("deleted_at", null)
      .is("merged_into_contact_id", null)
      .range(from, to)
  );
}
