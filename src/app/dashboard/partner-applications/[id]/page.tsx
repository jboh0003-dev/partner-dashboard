"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { AiPreReviewPanel } from "@/components/partner-applications/ai-pre-review-panel";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ApplicationEventLog } from "@/components/partner-applications/application-event-log";
import { ApplicationProcessSteps } from "@/components/partner-applications/application-process-steps";
import { ApplicationReviewBody } from "@/components/partner-applications/application-review-body";
import { ApplicationStatusBadge } from "@/components/partner-applications/application-status-badge";
import {
  formatAdminDate,
  mergeApplicationForm,
  type ApplicationEventRow
} from "@/lib/partner-applications/admin-display";
import { sanitizePreReviewForDisplay, type PreReviewResult } from "@/lib/partner-applications/pre-review";

type Detail = {
  application: Record<string, unknown>;
  people: Array<Record<string, unknown>>;
  customers: Array<Record<string, unknown>>;
  equipment: Array<Record<string, unknown>>;
  engineers: Array<Record<string, unknown>>;
  documents: Array<Record<string, unknown>>;
  events: ApplicationEventRow[];
  draft_saved_count?: number;
  draft_events?: ApplicationEventRow[];
  pre_review?: PreReviewResult | null;
};

export default function PartnerApplicationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [grade, setGrade] = useState("silver");
  const [contractStart, setContractStart] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [memo, setMemo] = useState("");
  const [pending, startTransition] = useTransition();
  const [duplicate, setDuplicate] = useState<{
    id: string;
    company_name: string;
  } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const autoReviewTried = useRef(false);

  function load() {
    startTransition(async () => {
      const res = await fetch(`/api/admin/partner-applications/${params.id}`);
      const json = await res.json();
      if (!json.ok) {
        setError(json.message || "조회 실패");
        return;
      }
      setData(json);
      setMemo(String(json.application.admin_memo || ""));
    });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  useEffect(() => {
    if (!data || autoReviewTried.current) return;
    const status = String(data.application.status);
    if (!["submitted", "under_review"].includes(status)) return;
    if (data.pre_review && data.pre_review.status !== "running") return;
    autoReviewTried.current = true;
    void runAction("pre_review");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  async function runAction(action: string, body: Record<string, unknown> = {}, confirmDup = false) {
    setError(null);
    const payload = {
      ...body,
      confirm_duplicate: confirmDup || undefined,
      existing_partner_id: confirmDup && duplicate ? duplicate.id : undefined
    };
    const res = await fetch(`/api/admin/partner-applications/${params.id}/actions?action=${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!json.ok) {
      if (json.duplicate) {
        setDuplicate(json.duplicate);
        setError(json.message);
        return;
      }
      setError(json.message || "처리 실패");
      return;
    }
    if (action === "approve" && json.partner_id) {
      router.push(`/dashboard/partners/${json.partner_id}`);
      return;
    }
    setDuplicate(null);
    load();
  }

  function runDelete() {
    startTransition(async () => {
      const res = await fetch(`/api/admin/partner-applications/${params.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.ok) {
        setError(json.message || "삭제 실패");
        setDeleteOpen(false);
        return;
      }
      router.push("/dashboard/partner-applications");
    });
  }

  if (!data) {
    return <div className="p-6 text-sm text-slate-600">{error || "불러오는 중…"}</div>;
  }

  const app = data.application;
  const form = mergeApplicationForm(app.form_payload, {
    people: data.people,
    customers: data.customers,
    equipment: data.equipment,
    engineers: data.engineers
  });
  const dbStatus = String(app.status);
  const preReview = sanitizePreReviewForDisplay(data.pre_review ?? null);
  const submittedAt = app.submitted_at || app.created_at;
  const companyName = String(app.company_name || form.company.company_name || "파트너 신청");

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/dashboard/partner-applications" className="text-sm text-blue-700">
            ← 파트너 신청 관리
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">{companyName}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            className="rounded-lg border px-3 py-2 text-sm"
            href={`/api/admin/partner-applications/${params.id}/excel`}
          >
            신청서 Excel 다운로드
          </a>
          <button
            type="button"
            className="rounded-lg border px-3 py-2 text-sm"
            onClick={() => void runAction("under_review")}
            disabled={pending}
          >
            관리자 검토 시작
          </button>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">신청 기본정보</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-slate-500">기업명</dt>
            <dd className="mt-0.5 text-sm font-medium text-slate-900">{companyName}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">신청번호</dt>
            <dd className="mt-0.5 text-sm text-slate-900">{String(app.application_number || "—")}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">신청일</dt>
            <dd className="mt-0.5 text-sm text-slate-900">{formatAdminDate(submittedAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">현재상태</dt>
            <dd className="mt-1">
              <ApplicationStatusBadge dbStatus={dbStatus} preReview={preReview} showAiMark />
            </dd>
          </div>
        </dl>
      </section>

      <ApplicationProcessSteps dbStatus={dbStatus} preReview={preReview} />

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {duplicate ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
          같은 이름의 기존 파트너가 있습니다: {duplicate.company_name}
          <button
            type="button"
            className="ml-3 rounded bg-amber-800 px-2 py-1 text-white"
            onClick={() =>
              void runAction(
                "approve",
                { grade, contract_start_date: contractStart },
                true
              )
            }
          >
            기존 파트너에 연결하여 승인
          </button>
        </div>
      ) : null}

      <AiPreReviewPanel
        review={preReview}
        pending={pending}
        onRerun={() => void runAction("pre_review")}
      />

      <ApplicationReviewBody form={form} documents={data.documents} />

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-900">관리자 최종검토</h2>
        <p className="text-xs text-slate-500">파트너 등급과 계약일은 여기서 결정합니다. AI 사전검토는 참고용입니다.</p>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-sm font-medium text-slate-800">최종 등록 정보</p>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <label className="text-sm">
              파트너 등급
              <select
                className="ml-2 rounded border px-2 py-1"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
              >
                <option value="silver">실버</option>
                <option value="gold">골드</option>
                <option value="platinum">플래티넘</option>
              </select>
            </label>
            <label className="text-sm">
              계약일
              <input
                type="date"
                className="ml-2 rounded border px-2 py-1"
                value={contractStart}
                onChange={(e) => setContractStart(e.target.value)}
              />
            </label>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700"
            onClick={() => setDeleteOpen(true)}
          >
            신청서 삭제
          </button>
          <button
            type="button"
            disabled={pending}
            className="rounded-lg bg-emerald-700 px-3 py-2 text-sm text-white"
            onClick={() =>
              void runAction("approve", {
                grade,
                contract_start_date: contractStart
              })
            }
          >
            승인
          </button>
          <input
            className="min-w-[240px] flex-1 rounded border px-3 py-2 text-sm"
            placeholder="보완/반려 사유"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            type="button"
            className="rounded-lg border px-3 py-2 text-sm"
            onClick={() => void runAction("revise", { reason })}
          >
            보완요청
          </button>
          <button
            type="button"
            className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700"
            onClick={() => void runAction("reject", { reason })}
          >
            반려
          </button>
        </div>
        <div className="flex gap-2">
          <textarea
            className="min-h-20 flex-1 rounded border px-3 py-2 text-sm"
            placeholder="관리자 메모"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
          <button
            type="button"
            className="rounded-lg border px-3 py-2 text-sm"
            onClick={() => void runAction("memo", { memo })}
          >
            메모 저장
          </button>
        </div>
        {app.approved_partner_id ? (
          <Link
            className="inline-block text-sm text-blue-700 underline"
            href={`/dashboard/partners/${String(app.approved_partner_id)}`}
          >
            등록된 파트너로 이동
          </Link>
        ) : null}
      </section>

      <ApplicationEventLog
        events={data.events}
        draftSavedCount={data.draft_saved_count}
        draftEvents={data.draft_events}
      />

      <ConfirmDialog
        open={deleteOpen}
        title="신청서 삭제"
        message={
          app.approved_partner_id
            ? "신청서와 첨부파일을 삭제합니다. 이미 등록된 파트너는 삭제되지 않습니다."
            : "신청서와 첨부파일을 삭제합니다. 작성 중·테스트 신청도 여기서 정리할 수 있습니다."
        }
        confirmLabel="삭제"
        danger
        loading={pending}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={runDelete}
      />
    </div>
  );
}
