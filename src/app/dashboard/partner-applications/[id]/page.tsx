"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

type Detail = {
  application: Record<string, unknown>;
  people: Array<Record<string, unknown>>;
  customers: Array<Record<string, unknown>>;
  equipment: Array<Record<string, unknown>>;
  engineers: Array<Record<string, unknown>>;
  documents: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
};

export default function PartnerApplicationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [grade, setGrade] = useState("silver");
  const [contractStart, setContractStart] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [reason, setReason] = useState("");
  const [memo, setMemo] = useState("");
  const [pending, startTransition] = useTransition();
  const [duplicate, setDuplicate] = useState<{
    id: string;
    company_name: string;
  } | null>(null);

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

  async function runAction(
    action: string,
    body: Record<string, unknown> = {},
    confirmDup = false
  ) {
    setError(null);
    const payload = {
      ...body,
      confirm_duplicate: confirmDup || undefined,
      existing_partner_id: confirmDup && duplicate ? duplicate.id : undefined
    };
    const res = await fetch(
      `/api/admin/partner-applications/${params.id}/actions?action=${action}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    );
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

  if (!data) {
    return (
      <div className="p-6 text-sm text-slate-600">{error || "불러오는 중…"}</div>
    );
  }

  const app = data.application;
  const form = (app.form_payload || {}) as Record<string, unknown>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/dashboard/partner-applications" className="text-sm text-blue-700">
            ← 목록
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">{String(app.company_name || "신청 상세")}</h1>
          <p className="text-sm text-slate-600">
            {String(app.application_number)} · {String(app.status)}
          </p>
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
            검토 시작
          </button>
        </div>
      </div>

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {duplicate ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
          기존 파트너: {duplicate.company_name}
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

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-4 text-sm">
          <h2 className="font-semibold">기업 / 담당자</h2>
          <pre className="mt-2 overflow-auto whitespace-pre-wrap text-xs text-slate-700">
            {JSON.stringify(
              {
                company: (form as { company?: unknown }).company,
                contact: (form as { contact?: unknown }).contact,
                flags: (form as { flags?: unknown }).flags
              },
              null,
              2
            )}
          </pre>
        </div>
        <div className="rounded-xl border bg-white p-4 text-sm">
          <h2 className="font-semibold">전담인원 / 고객 / 장비</h2>
          <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap text-xs text-slate-700">
            {JSON.stringify(
              {
                people: data.people,
                customers: data.customers,
                equipment: data.equipment,
                engineers: data.engineers
              },
              null,
              2
            )}
          </pre>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold">첨부파일</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {data.documents.map((doc) => (
            <li key={String(doc.id)}>
              {String(doc.document_type)} · {String(doc.file_name)}{" "}
              {doc.is_active ? "" : "(비활성) "}
              {doc.signed_url ? (
                <a className="text-blue-700 underline" href={String(doc.signed_url)} target="_blank" rel="noreferrer">
                  열기
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border bg-white p-4 space-y-3">
        <h2 className="font-semibold">검토 액션</h2>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="text-sm">
            등급
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
            승인 → partners 등록
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
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
            등록된 파트너로 이동 (계약서 생성 가능)
          </Link>
        ) : null}
      </section>

      <section className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold">이력</h2>
        <ul className="mt-2 space-y-1 text-xs text-slate-600">
          {data.events.map((ev) => (
            <li key={String(ev.id)}>
              {String(ev.created_at)} · {String(ev.event_type)} · {String(ev.message || "")}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
