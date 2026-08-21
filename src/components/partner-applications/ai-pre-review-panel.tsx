import { Sparkles } from "lucide-react";
import type { PreReviewFinding, PreReviewResult } from "@/lib/partner-applications/pre-review";
import { findingSectionId } from "@/lib/partner-applications/admin-display";

function FindingItem({ item }: { item: PreReviewFinding }) {
  const sectionId = findingSectionId(item);
  return (
    <li>
      <span className="font-medium text-slate-800">{item.label}</span>
      {item.comparison?.length ? (
        <ul className="mt-1 space-y-0.5 pl-1 text-xs text-slate-600">
          {item.comparison.map((row) => (
            <li key={row.label}>
              {row.label}: {row.value || "미입력"}
            </li>
          ))}
        </ul>
      ) : null}
      {item.detail ? <p className="mt-0.5 text-xs text-slate-500">{item.detail}</p> : null}
      {sectionId ? (
        <a href={`#${sectionId}`} className="mt-1 inline-block text-xs text-blue-700 underline">
          내용 확인
        </a>
      ) : null}
    </li>
  );
}

function FindingList({
  title,
  items,
  empty,
  marker,
  markerClass
}: {
  title: string;
  items: PreReviewFinding[];
  empty?: string;
  marker: string;
  markerClass: string;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {items.length === 0 ? (
        empty ? <p className="mt-1 text-xs text-slate-400">{empty}</p> : null
      ) : (
        <ul className="mt-1 space-y-2 text-sm text-slate-700">
          {items.map((item) => (
            <li key={item.id} className="flex gap-1.5">
              <span className={`${markerClass} shrink-0`}>{marker}</span>
              <FindingItem item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AiPreReviewPanel({
  review,
  onRerun,
  pending
}: {
  review: PreReviewResult | null;
  onRerun: () => void;
  pending?: boolean;
}) {
  const ok = review?.findings.filter((f) => f.severity === "ok") ?? [];
  const needsFix = review?.findings.filter((f) => f.severity === "needs_fix") ?? [];
  const adminCheck = review?.findings.filter((f) => f.severity === "admin_check") ?? [];

  const overallLabel =
    review?.status === "running"
      ? "검토 중"
      : review?.status === "failed"
        ? "관리자 확인 필요"
        : review?.overall === "needs_fix"
          ? "보완 필요"
          : review?.overall === "admin_check"
            ? "관리자 확인 필요"
            : review
              ? "정상"
              : "미검토";

  return (
    <section className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-white to-indigo-50/40 p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-indigo-50 to-okestro-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-800 ring-1 ring-indigo-100">
              <Sparkles size={12} />
              AI Agent 사전검토
            </span>
            <h2 className="font-semibold text-slate-900">AI Agent 사전검토</h2>
            {review?.status === "completed" && review.overall === "ok" ? (
              <span className="ui-badge-success">AI 분석 완료</span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-slate-600">결과: {overallLabel}</p>
          {review?.reviewed_at ? (
            <p className="text-xs text-slate-400">
              {new Date(review.reviewed_at).toLocaleString("ko-KR")}
              {" · 참고용 사전검토 · 최종 판단은 관리자"}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className="rounded-lg border border-indigo-200 px-3 py-1.5 text-sm text-indigo-800"
          onClick={onRerun}
          disabled={pending}
        >
          다시 검토
        </button>
      </div>

      {!review ? (
        <p className="mt-3 text-sm text-slate-500">아직 AI 사전검토가 실행되지 않았습니다.</p>
      ) : null}

      {review?.status === "failed" ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          AI 검토를 완료하지 못했습니다. 관리자가 신청 내용을 직접 확인해 주세요.
        </p>
      ) : null}

      {review ? (
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <FindingList title="정상" items={ok} marker="✓" markerClass="text-emerald-600" empty="해당 항목 없음" />
          <FindingList title="보완 필요" items={needsFix} marker="!" markerClass="text-amber-600" empty="없음" />
          <FindingList
            title="관리자 확인 필요"
            items={adminCheck}
            marker="!"
            markerClass="text-indigo-600"
            empty="없음"
          />
        </div>
      ) : null}
    </section>
  );
}
