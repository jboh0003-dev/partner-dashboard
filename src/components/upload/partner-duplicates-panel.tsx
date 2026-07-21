"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PartnerDuplicateReport } from "@/lib/partners/duplicates";

export function PartnerDuplicatesPanel() {
  const [report, setReport] = useState<PartnerDuplicateReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const response = await fetch("/api/partners/duplicates");
        const json = (await response.json()) as {
          ok?: boolean;
          message?: string;
          report?: PartnerDuplicateReport;
        };
        if (cancelled) return;
        if (!response.ok || !json.ok || !json.report) {
          throw new Error(json.message ?? "중복 탐지에 실패했습니다.");
        }
        setReport(json.report);
      } catch (fetchError) {
        if (cancelled) return;
        setError(fetchError instanceof Error ? fetchError.message : "중복 탐지에 실패했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-sm text-slate-500">파트너 중복 후보를 조회 중입니다...</div>
      </section>
    );
  }

  if (error) {
    const needsLogin = error.includes("로그인");
    return (
      <section
        className={`mb-6 rounded-2xl border p-5 shadow-sm ${
          needsLogin ? "border-amber-200 bg-amber-50" : "border-rose-200 bg-rose-50"
        }`}
      >
        <div className={`text-sm ${needsLogin ? "text-amber-950" : "text-rose-700"}`}>
          {needsLogin ? (
            <>
              <div className="font-semibold">로그인이 필요합니다</div>
              <p className="mt-1 text-xs text-amber-900">
                중복 후보 조회는 로그인 후 가능합니다.{" "}
                <Link href="/login" className="font-semibold underline">
                  로그인
                </Link>
              </p>
            </>
          ) : (
            error
          )}
        </div>
      </section>
    );
  }

  if (!report || report.total_groups === 0) {
    return (
      <section className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
        <div className="text-sm font-semibold text-emerald-900">중복 후보 없음</div>
        <p className="mt-1 text-xs text-emerald-800">
          활성 파트너 기준 파트너번호·사업자번호·회사명 중복 그룹이 없습니다.
        </p>
      </section>
    );
  }

  return (
    <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-amber-950">파트너 중복 후보</div>
          <p className="mt-1 text-xs text-amber-900">
            총 {report.total_groups}개 그룹 ·{" "}
            <Link href="/dashboard/partners" className="font-semibold underline">
              파트너 목록
            </Link>
            에서 선택 삭제로 정리할 수 있습니다.
          </p>
        </div>
      </div>

      <DuplicateGroupList title="파트너번호 중복" groups={report.partner_no} />
      <DuplicateGroupList title="사업자번호 중복" groups={report.business_number} />
      <DuplicateGroupList title="회사명(정규화) 중복" groups={report.company_name} />
    </section>
  );
}

function DuplicateGroupList({
  title,
  groups
}: {
  title: string;
  groups: PartnerDuplicateReport["partner_no"];
}) {
  if (groups.length === 0) return null;

  return (
    <div className="mt-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-900">
        {title} ({groups.length})
      </div>
      <div className="space-y-2">
        {groups.slice(0, 8).map((group) => (
          <div
            key={`${group.kind}-${group.key}`}
            className="rounded-xl border border-amber-200/80 bg-white px-3 py-2 text-xs text-slate-700"
          >
            <div className="font-semibold text-slate-900">{group.key}</div>
            <ul className="mt-1 space-y-0.5">
              {group.partners.map((partner) => (
                <li key={partner.id}>
                  <Link
                    href={`/dashboard/partners/${partner.id}`}
                    className="text-okestro-600 hover:underline"
                  >
                    {partner.company_name}
                  </Link>
                  {partner.external_no ? ` · ${partner.external_no}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {groups.length > 8 ? (
          <p className="text-xs text-amber-800">외 {groups.length - 8}개 그룹</p>
        ) : null}
      </div>
    </div>
  );
}
