import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  draft: "작성중",
  submitted: "제출",
  under_review: "검토중",
  revision_requested: "보완요청",
  approved: "승인",
  rejected: "반려",
  contracted: "계약"
};

type Search = {
  status?: string;
  q?: string;
};

export default async function PartnerApplicationsAdminPage({
  searchParams
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const supabase = createAdminClient();
  let query = supabase
    .from("partner_applications")
    .select(
      "id, application_number, status, company_name, business_registration_number, applicant_name, contact_name, submitted_at, created_at, missing_required_count, technical_collaboration_requested"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (sp.status) query = query.eq("status", sp.status);
  if (sp.q?.trim()) {
    const q = sp.q.trim();
    query = query.or(
      `company_name.ilike.%${q}%,business_registration_number.ilike.%${q}%,application_number.ilike.%${q}%`
    );
  }

  const { data, error } = await query;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">파트너 등록</h1>
        <p className="mt-1 text-sm text-slate-600">
          외부 신청 포털 제출 건을 검토·승인합니다. 승인 전까지 partners DB에 반영되지 않습니다.
        </p>
      </div>

      <form className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={sp.q || ""}
          placeholder="기업명 / 사업자번호 / 신청번호"
          className="rounded-lg border px-3 py-2 text-sm"
        />
        <select name="status" defaultValue={sp.status || ""} className="rounded-lg border px-3 py-2 text-sm">
          <option value="">전체 상태</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white">
          필터
        </button>
      </form>

      {error ? (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          신청 테이블을 조회할 수 없습니다. migration 043을 Supabase에 적용했는지 확인하세요.
          <br />
          {error.message}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2">신청번호</th>
              <th className="px-3 py-2">기업명</th>
              <th className="px-3 py-2">사업자등록번호</th>
              <th className="px-3 py-2">신청자</th>
              <th className="px-3 py-2">신청일</th>
              <th className="px-3 py-2">상태</th>
              <th className="px-3 py-2">누락</th>
              <th className="px-3 py-2">기술협력</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-3 py-2">
                  <Link className="text-blue-700 underline" href={`/dashboard/partner-applications/${row.id}`}>
                    {row.application_number}
                  </Link>
                </td>
                <td className="px-3 py-2">{row.company_name || "-"}</td>
                <td className="px-3 py-2">{row.business_registration_number || "-"}</td>
                <td className="px-3 py-2">{row.applicant_name || row.contact_name || "-"}</td>
                <td className="px-3 py-2">
                  {row.submitted_at
                    ? new Date(row.submitted_at).toLocaleDateString("ko-KR")
                    : "-"}
                </td>
                <td className="px-3 py-2">{STATUS_LABEL[row.status] || row.status}</td>
                <td className="px-3 py-2">{row.missing_required_count}</td>
                <td className="px-3 py-2">{row.technical_collaboration_requested ? "Y" : "-"}</td>
              </tr>
            ))}
            {!data?.length && !error ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                  신청 내역이 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
