"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FileSpreadsheet, Loader2, UploadCloud } from "lucide-react";
import type {
  TechPartnerAnalysisResult,
  TechPartnerParticipantRecord
} from "@/lib/imports/tech-partner-training";
import {
  buildBeomilCorrectionOverrides,
  getBeomilReviewDisplay,
  isBeomilCompany
} from "@/lib/imports/tech-partner-beomil";
import {
  isParticipantNoExamRow,
  isParticipantReviewRow
} from "@/lib/imports/tech-partner-training";
import { TechPartnerParticipantsCopyTable } from "@/components/trainings/tech-partner-participants-copy-table";

type TabKey = "partners" | "participants" | "review" | "no_exam";

export function TechPartnerUploadPanel() {
  const [examFile, setExamFile] = useState<File | null>(null);
  const [rosterFile, setRosterFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<TechPartnerAnalysisResult | null>(null);
  const [overrides, setOverrides] = useState<Record<string, Partial<TechPartnerParticipantRecord>>>({});
  const [tab, setTab] = useState<TabKey>("partners");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const participants = useMemo(() => {
    if (!analysis) return [];
    return analysis.participants.map((row) => ({
      ...row,
      ...overrides[row.key]
    }));
  }, [analysis, overrides]);

  async function handleAnalyze() {
    if (!examFile || !rosterFile) {
      setError("두 파일을 모두 선택해 주세요.");
      return;
    }
    setLoading(true);
    setError(null);
    setSaveMessage(null);
    try {
      const formData = new FormData();
      formData.append("exam_file", examFile);
      formData.append("roster_file", rosterFile);
      const response = await fetch("/api/import/trainings/tech-partner/analyze", {
        method: "POST",
        body: formData
      });
      const json = await response.json();
      if (!response.ok || !json.ok) {
        throw new Error(json.message ?? "분석 실패");
      }
      setAnalysis({
        summary: json.summary,
        participants: json.participants,
        partner_summaries: json.partner_summaries
      });
      setOverrides({});
      setTab("partners");
    } catch (err) {
      setError(err instanceof Error ? err.message : "분석 실패");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!analysis || !examFile || !rosterFile) return;

    if (!analysis.summary.analysis_valid) {
      setError(
        analysis.summary.analysis_error ??
          "분석 결과가 비정상입니다. 출석부/시험결과 매칭 로직을 확인해 주세요."
      );
      return;
    }

    setSaving(true);
    setError(null);
    setSaveMessage(null);
    try {
      const payload = {
        exam_file_name: examFile.name,
        roster_file_name: rosterFile.name,
        participants: participants.map((row) => ({
          ...row,
          match_action:
            row.match_action === "exclude"
              ? "exclude"
              : row.correction_applied || row.match_action === "ready"
                ? "ready"
                : row.match_action
        }))
      };
      const response = await fetch("/api/import/trainings/tech-partner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await response.json();
      if (!response.ok || !json.ok) {
        throw new Error(json.message ?? "저장 실패");
      }
      setSaveMessage(
        `저장 완료 — 생성 ${json.created}건, 업데이트 ${json.updated}건, 검토 ${json.review}건, 제외 ${json.skipped}건`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  function setPartnerOverride(key: string, partnerId: string, partnerName: string) {
    setOverrides((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        matched_partner_id: partnerId,
        matched_partner_name: partnerName,
        match_status: "matched",
        match_action: "ready",
        review_reason: null
      }
    }));
  }

  function excludeParticipant(key: string) {
    setOverrides((prev) => ({
      ...prev,
      [key]: { ...prev[key], match_action: "exclude" }
    }));
  }

  function applyBeomilCorrection() {
    if (!analysis) return;
    const correction = buildBeomilCorrectionOverrides(analysis.participants);
    setOverrides((prev) => {
      const next = { ...prev };
      for (const [key, patch] of Object.entries(correction)) {
        next[key] = { ...prev[key], ...patch };
      }
      return next;
    });
  }

  const reviewRows = participants.filter((p) => isParticipantReviewRow(p));
  const noExamRows = participants.filter((p) => isParticipantNoExamRow(p));
  const hasBeomilReview = reviewRows.some(
    (row) => isBeomilCompany(row.company_name) && row.review_category === "beomil_manual"
  );
  const beomilCorrected = reviewRows.some(
    (row) => isBeomilCompany(row.company_name) && row.correction_applied
  );

  return (
    <div className="space-y-6">
      <div className="ui-card p-6">
        <h2 className="text-lg font-bold text-slate-900">기술파트너 교육 업로드</h2>
        <p className="mt-1 text-sm text-slate-600">
          시험결과 파일과 교육생 관리대장을 함께 업로드하면 파트너·참석자 매칭 후 교육 이력에 반영됩니다.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="block rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
            <span className="text-sm font-semibold text-slate-800">시험결과 파일</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="mt-2 block w-full text-sm"
              onChange={(e) => setExamFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <label className="block rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
            <span className="text-sm font-semibold text-slate-800">교육생 관리대장</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="mt-2 block w-full text-sm"
              onChange={(e) => setRosterFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleAnalyze()}
            disabled={loading}
            className="ui-btn-accent inline-flex items-center gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            분석
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!analysis || saving || analysis?.summary.analysis_valid === false}
            className="ui-btn-primary inline-flex items-center gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            저장
          </button>
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        {saveMessage ? <p className="mt-3 text-sm text-emerald-700">{saveMessage}</p> : null}
      </div>

      {analysis ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["교육명", analysis.summary.training_name],
              ["교육기간", `${analysis.summary.start_date} ~ ${analysis.summary.end_date}`],
              ["등록 인원", `${analysis.summary.registered_count}명`],
              ["실제 참석자", `${analysis.summary.attended_count}명`],
              ["미참석자", `${analysis.summary.no_show_count}명`],
              ["시험 응시자", `${analysis.summary.exam_taken_count}명`],
              ["정상 매칭", `${analysis.summary.normal_match_count}명`],
              ["검토 필요", `${analysis.summary.review_count}명`],
              ["시험결과만", `${analysis.summary.result_only_count}명`],
              ["출석부만", `${analysis.summary.roster_only_count}명`],
              ["파트너 수", `${analysis.summary.partner_count}곳`]
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
              </div>
            ))}
          </div>

          {!analysis.summary.analysis_valid ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {analysis.summary.analysis_error ??
                "분석 결과가 비정상입니다. 저장할 수 없습니다."}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {(
              [
                ["partners", "파트너별 요약"],
                ["participants", "참석자별 결과"],
                ["review", `검토 필요 (${reviewRows.length})`],
                ["no_exam", `미응시/결과 없음 (${noExamRows.length})`]
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={[
                  "rounded-lg px-3 py-2 text-sm font-semibold",
                  tab === key
                    ? "bg-okestro-600 text-white"
                    : "border border-slate-200 bg-white text-slate-700"
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            {tab === "partners" ? (
              <table className="min-w-full text-sm select-none">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">파트너사</th>
                    <th className="px-4 py-3 text-right">등록</th>
                    <th className="px-4 py-3 text-right">참석</th>
                    <th className="px-4 py-3 text-right">미참석</th>
                    <th className="px-4 py-3 text-right">응시</th>
                    <th className="px-4 py-3 text-right">평균 총점</th>
                    <th className="px-4 py-3 text-right">평균 환산</th>
                    <th className="px-4 py-3 text-center">검토</th>
                    <th className="px-4 py-3 text-left">상세</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analysis.partner_summaries.map((row) => (
                    <tr key={row.company_name}>
                      <td className="px-4 py-3 font-medium">{row.company_name}</td>
                      <td className="px-4 py-3 text-right">{row.registered_count}</td>
                      <td className="px-4 py-3 text-right">{row.attended_count}</td>
                      <td className="px-4 py-3 text-right">{row.no_show_count}</td>
                      <td className="px-4 py-3 text-right">{row.exam_taken_count}</td>
                      <td className="px-4 py-3 text-right">{row.avg_total_score ?? "-"}</td>
                      <td className="px-4 py-3 text-right">{row.avg_converted_score ?? "-"}</td>
                      <td className="px-4 py-3 text-center">{row.needs_review ? "Y" : "-"}</td>
                      <td className="px-4 py-3">
                        {row.partner_id ? (
                          <Link
                            href={`/dashboard/partners/${row.partner_id}?tab=trainings`}
                            className="text-okestro-600 hover:underline"
                          >
                            파트너 상세
                          </Link>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>

          {tab === "participants" ? (
            <TechPartnerParticipantsCopyTable rows={participants} />
          ) : null}
          {tab === "review" ? (
            <div className="space-y-3">
              {hasBeomilReview ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <p className="font-semibold">범일정보 이지환 / 김동현 수동 보정</p>
                  <p className="mt-1 text-xs">
                    교육팀 확인에 따른 이름 변경·참석기간 분리가 필요합니다. 보정 적용 후 저장할 수
                    있습니다.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={applyBeomilCorrection}
                      className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                    >
                      범일정보 보정 적용
                    </button>
                    {beomilCorrected ? (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                        보정 완료
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <TechPartnerParticipantsCopyTable
                rows={reviewRows}
                showReviewActions
                onPartnerOverride={setPartnerOverride}
                onExclude={excludeParticipant}
                getReviewDisplay={getBeomilReviewDisplay}
              />
            </div>
          ) : null}
          {tab === "no_exam" ? (
            <TechPartnerParticipantsCopyTable rows={noExamRows} />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
