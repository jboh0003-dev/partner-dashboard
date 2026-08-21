import Link from "next/link";
import { ExternalLink, Plus } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApplicationAdminTable } from "@/components/partner-applications/application-admin-table";
import { CopyApplyLinkButton } from "@/components/partner-applications/copy-apply-link-button";
import { latestPreReviewFromEvents, type PreReviewResult } from "@/lib/partner-applications/pre-review";
import { DB_STATUS_FILTER_LABEL } from "@/lib/partner-applications/status-display";
import type { ApplicationStatus } from "@/lib/partner-applications/types";
import { requireAdminPage } from "@/lib/auth/require-admin-page";

export const dynamic = "force-dynamic";

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
  await requireAdminPage();
  const supabase = createAdminClient();
  let query = supabase
    .from("partner_applications")
    .select(
      "id, application_number, status, company_name, business_registration_number, applicant_name, contact_name, submitted_at, created_at, missing_required_count, approved_partner_id"
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

  const [{ count: totalCount }, { count: revisionCount }, { count: reviewCount }, { count: approvedCount }, { count: rejectedCount }] =
    await Promise.all([
      supabase.from("partner_applications").select("id", { count: "exact", head: true }),
      supabase.from("partner_applications").select("id", { count: "exact", head: true }).eq("status", "revision_requested"),
      supabase
        .from("partner_applications")
        .select("id", { count: "exact", head: true })
        .in("status", ["submitted", "under_review"]),
      supabase.from("partner_applications").select("id", { count: "exact", head: true }).in("status", ["approved", "contracted"]),
      supabase.from("partner_applications").select("id", { count: "exact", head: true }).eq("status", "rejected")
    ]);
  const ids = (data ?? []).map((row) => row.id);
  const reviewById = new Map<string, PreReviewResult | null>();
  if (ids.length) {
    const { data: events } = await supabase
      .from("partner_application_events")
      .select("application_id, event_type, payload, created_at")
      .in("application_id", ids)
      .in("event_type", ["ai_pre_review", "ai_pre_review_started"])
      .order("created_at", { ascending: false });
    const grouped = new Map<string, Array<{ event_type?: unknown; payload?: unknown; created_at?: unknown }>>();
    for (const ev of events ?? []) {
      const appId = String(ev.application_id);
      const list = grouped.get(appId) ?? [];
      list.push(ev);
      grouped.set(appId, list);
    }
    for (const id of ids) {
      reviewById.set(id, latestPreReviewFromEvents(grouped.get(id) ?? []));
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="ui-page-title">파트너 신청 관리</h1>
          <p className="ui-page-desc">
            제출·작성 중 신청서를 검토하고, 테스트 찌꺼기는 관리자가 직접 삭제할 수 있습니다. 승인으로 만든 파트너 DB는 신청서 삭제와 분리됩니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CopyApplyLinkButton />
          <Link
            href="/partner-apply"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <Plus size={16} />
            신규 파트너 신청
            <ExternalLink size={14} />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ["전체 신청", totalCount ?? 0],
          ["보완 필요", revisionCount ?? 0],
          ["관리자 검토 대기", reviewCount ?? 0],
          ["승인", approvedCount ?? 0],
          ["반려", rejectedCount ?? 0]
        ].map(([label, value]) => (
          <div key={String(label)} className="ui-kpi">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{Number(value).toLocaleString("ko-KR")}</p>
          </div>
        ))}
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
          {(Object.entries(DB_STATUS_FILTER_LABEL) as Array<[ApplicationStatus, string]>).map(([k, v]) => (
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
          신청 목록을 불러올 수 없습니다. 잠시 후 다시 시도하거나 관리자에게 문의해 주세요.
          <br />
          {error.message}
        </p>
      ) : null}

      <ApplicationAdminTable
        rows={(data ?? []).map((row) => ({
          id: String(row.id),
          application_number: String(row.application_number),
          company_name: row.company_name ? String(row.company_name) : null,
          business_registration_number: row.business_registration_number
            ? String(row.business_registration_number)
            : null,
          applicant_name: row.applicant_name ? String(row.applicant_name) : null,
          contact_name: row.contact_name ? String(row.contact_name) : null,
          submitted_at: row.submitted_at ? String(row.submitted_at) : null,
          created_at: row.created_at ? String(row.created_at) : null,
          status: String(row.status),
          missing_required_count: row.missing_required_count != null ? Number(row.missing_required_count) : 0,
          approved_partner_id: row.approved_partner_id ? String(row.approved_partner_id) : null
        }))}
        reviewById={Object.fromEntries(
          ids.map((id) => [id, reviewById.get(id) ?? null])
        )}
      />
    </div>
  );
}
