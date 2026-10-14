"use client";

import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import {
  parseTrainingRegistrationWorkbook,
  type TrainingRegistrationParseResult
} from "@/lib/excel/parse-training-registrations";

type ImportSummary = {
  total: number;
  created_registrations: number;
  updated_registrations: number;
  created_trainings: number;
  created_contacts: number;
  matched_partners: number;
  review: number;
};

export function TrainingRegistrationsUploadSection() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<TrainingRegistrationParseResult | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [reviewRows, setReviewRows] = useState<
    Array<{ row_number: number; company_name: string; attendee_name: string; reason: string }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleFile(selected: File) {
    setFile(selected);
    setSummary(null);
    setReviewRows([]);
    setError(null);
    setParsing(true);

    try {
      const buffer = await selected.arrayBuffer();
      const parsed = parseTrainingRegistrationWorkbook(buffer);
      setParseResult(parsed);
    } catch (err) {
      setParseResult(null);
      setError(err instanceof Error ? err.message : "교육 신청 엑셀 분석에 실패했습니다.");
    } finally {
      setParsing(false);
    }
  }

  async function save() {
    if (!file || !parseResult || saving) return;
    if (parseResult.rows.length === 0) {
      setError("등록할 교육 신청 데이터가 없습니다.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/import/trainings/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_name: file.name,
          rows: parseResult.rows
        })
      });
      const json = await response.json();
      if (!response.ok || !json.ok) {
        throw new Error(json?.message ?? "교육 신청 DB 저장에 실패했습니다.");
      }
      setSummary(json.summary as ImportSummary);
      setReviewRows(json.review_rows ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "교육 신청 DB 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div
        className="cursor-pointer rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center transition hover:border-slate-400"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const dropped = event.dataTransfer.files?.[0];
          if (dropped) void handleFile(dropped);
        }}
      >
        <UploadCloud className="mx-auto text-slate-400" size={34} />
        <div className="mt-3 text-sm font-semibold text-slate-900">
          MS Forms 교육 신청 Excel을 그대로 올리세요
        </div>
        <div className="mt-1 text-xs text-slate-500">
          원본 응답 시트를 자동 탐색하고 교육일자·제품·신청자·회사·직급·직무·연락처·이메일을 정리합니다.
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(event) => {
            const selected = event.target.files?.[0];
            if (selected) void handleFile(selected);
          }}
        />
        {file ? (
          <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-medium text-slate-700">
            <FileSpreadsheet size={14} />
            {file.name}
          </div>
        ) : null}
      </div>

      {parsing ? (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          <Loader2 size={16} className="animate-spin" />
          Forms 원본 시트와 교육 신청 열을 분석하고 있습니다.
        </div>
      ) : null}

      {error ? (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {parseResult ? (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-950">
                  자동 인식 결과
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  원본 시트: {parseResult.sheet_name} · 헤더 {parseResult.header_row}행
                </div>
              </div>
              <div className="text-right text-xs text-slate-500">
                교육 {parseResult.training_headers.length}개 · 신청 {parseResult.rows.length}건
              </div>
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {parseResult.training_headers.map((training) => (
                <div
                  key={training.start_date + "-" + training.header}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"
                >
                  <div className="text-xs font-semibold text-slate-900">
                    {training.product ?? training.training_name}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    {training.start_date}
                  </div>
                </div>
              ))}
            </div>

            {parseResult.warnings.length > 0 ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                {parseResult.warnings.join(" · ")}
              </div>
            ) : null}

            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full min-w-[760px] divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">교육일</th>
                    <th className="px-3 py-2 text-left">교육</th>
                    <th className="px-3 py-2 text-left">회사</th>
                    <th className="px-3 py-2 text-left">이름</th>
                    <th className="px-3 py-2 text-left">직급</th>
                    <th className="px-3 py-2 text-left">이메일</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parseResult.rows.slice(0, 12).map((row) => (
                    <tr key={row.row_number + "-" + row.start_date + "-" + row.training_name}>
                      <td className="px-3 py-2">{row.start_date}</td>
                      <td className="px-3 py-2 font-medium">{row.product ?? row.training_name}</td>
                      <td className="px-3 py-2">{row.company_name}</td>
                      <td className="px-3 py-2">{row.attendee_name}</td>
                      <td className="px-3 py-2">{row.attendee_position ?? "-"}</td>
                      <td className="px-3 py-2">{row.attendee_email ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parseResult.rows.length > 12 ? (
              <div className="mt-2 text-xs text-slate-500">
                미리보기 12건 / 전체 {parseResult.rows.length}건
              </div>
            ) : null}
          </section>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {saving ? "교육 신청 DB 정리 중..." : "교육 신청 DB 반영"}
            </button>
          </div>
        </>
      ) : null}

      {summary ? (
        <section
          className={[
            "rounded-2xl border px-5 py-4",
            summary.review > 0
              ? "border-amber-200 bg-amber-50"
              : "border-emerald-200 bg-emerald-50"
          ].join(" ")}
        >
          <div className="text-sm font-semibold text-slate-950">교육 신청 DB 반영 완료</div>
          <div className="mt-2 text-xs leading-6 text-slate-700">
            신청 {summary.total}건 · 신규 {summary.created_registrations}건 · 갱신{" "}
            {summary.updated_registrations}건 · 교육 회차 자동생성 {summary.created_trainings}건 ·
            신규 인력 보강 {summary.created_contacts}명 · 파트너 매칭 {summary.matched_partners}건
          </div>
          {summary.review > 0 ? (
            <div className="mt-3 text-xs text-amber-900">
              자동 매칭 확인 필요 {summary.review}건
            </div>
          ) : null}
        </section>
      ) : null}

      {reviewRows.length > 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-white p-4">
          <div className="text-sm font-semibold text-slate-900">확인 필요</div>
          <div className="mt-2 space-y-1 text-xs text-slate-600">
            {reviewRows.slice(0, 20).map((row) => (
              <div key={row.row_number + "-" + row.company_name + "-" + row.attendee_name}>
                {row.row_number}행 · {row.company_name} · {row.attendee_name} — {row.reason}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
