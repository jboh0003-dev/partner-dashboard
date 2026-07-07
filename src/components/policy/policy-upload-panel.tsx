"use client";

import { useMemo, useState } from "react";
import { Loader2, UploadCloud } from "lucide-react";
import type { PolicyAnalyzeSlide, PolicyParseValidation } from "@/types/partner-policy";

type SlideDetail = {
  slide_number: number;
  title: string;
  body: string;
  category: string;
  keywords: string[];
  chunks: Array<{ section_title: string; content: string; keywords: string[] }>;
};

export function PolicyUploadPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [policyTitle, setPolicyTitle] = useState("2026년 OKESTRO Partner Program");
  const [versionLabel, setVersionLabel] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [description, setDescription] = useState("");
  const [changeMemo, setChangeMemo] = useState("");
  const [applyAsCurrent, setApplyAsCurrent] = useState(true);
  const [analysis, setAnalysis] = useState<{
    slides: PolicyAnalyzeSlide[];
    slide_details: SlideDetail[];
    total_slides: number;
    total_chunks: number;
    validation: PolicyParseValidation | null;
    warning?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const categorySummary = useMemo(() => {
    if (!analysis) return [];
    const map = new Map<string, number>();
    for (const slide of analysis.slides) {
      map.set(slide.category, (map.get(slide.category) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [analysis]);

  async function handleAnalyze() {
    if (!file) {
      setError("파일을 선택해 주세요.");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/policy/analyze", { method: "POST", body: formData });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.message ?? "분석 실패");
      setAnalysis({
        slides: json.slides,
        slide_details: json.slide_details ?? [],
        total_slides: json.total_slides,
        total_chunks: json.total_chunks,
        validation: json.validation ?? null,
        warning: json.warning
      });
      if (!versionLabel && file.name.includes("260623")) {
        setVersionLabel("2026.06.23 업데이트");
        setEffectiveDate("2026-06-23");
        setDescription("2026년 파트너 정책 업데이트");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "분석 실패");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!file || !analysis) {
      setError("먼저 분석을 실행해 주세요.");
      return;
    }
    if (!policyTitle.trim() || !versionLabel.trim() || !effectiveDate.trim()) {
      setError("정책명, 버전명, 기준일을 입력해 주세요.");
      return;
    }

    if (analysis.validation && !analysis.validation.can_save) {
      setError(
        analysis.validation.block_reason ??
          "PPTX 텍스트 추출 결과가 비정상입니다. XML 태그가 포함되어 있어 정책 지식으로 저장할 수 없습니다."
      );
      return;
    }

    if (applyAsCurrent) {
      const confirmed = window.confirm(
        "이 정책을 최신 정책으로 적용하시겠습니까?\n기존 최신 정책은 이전 버전으로 보관되며, 오케 AI 검색 기준이 변경됩니다."
      );
      if (!confirmed) return;
    }

    setSaving(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append(
        "metadata",
        JSON.stringify({
          policy_title: policyTitle,
          version_label: versionLabel,
          effective_date: effectiveDate,
          description: description || null,
          change_memo: changeMemo || null,
          apply_as_current: applyAsCurrent,
          slide_details: analysis.slide_details
        })
      );
      const response = await fetch("/api/policy/upload", { method: "POST", body: formData });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.message ?? "저장 실패");
      setMessage(
        `저장 완료 — chunk ${json.chunk_count}건${json.is_current ? " · 최신 정책으로 적용됨" : ""}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="ui-card p-6">
        <h2 className="text-lg font-bold text-slate-900">파트너 정책 업로드</h2>
        <p className="mt-1 text-sm text-slate-600">
          PPT/PDF 정책 파일을 업로드하면 버전별로 보관되고, 최신 정책이 파트너 정책 화면과 오케 AI에 반영됩니다.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-slate-800">정책명</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={policyTitle}
              onChange={(e) => setPolicyTitle(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-800">버전명</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={versionLabel}
              onChange={(e) => setVersionLabel(e.target.value)}
              placeholder="2026.06.23 업데이트"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-800">기준일</span>
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
            />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-semibold text-slate-800">파일</span>
            <input
              type="file"
              accept=".pptx,.ppt,.pdf,.docx,.doc"
              className="mt-1 block w-full text-sm"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-semibold text-slate-800">설명</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-semibold text-slate-800">변경사항 메모</span>
            <textarea
              className="mt-1 min-h-[80px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={changeMemo}
              onChange={(e) => setChangeMemo(e.target.value)}
            />
          </label>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={applyAsCurrent}
            onChange={(e) => setApplyAsCurrent(e.target.checked)}
          />
          최신 정책으로 적용
        </label>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => void handleAnalyze()} disabled={loading} className="ui-btn-accent inline-flex items-center gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            분석
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !analysis || (analysis.validation != null && !analysis.validation.can_save)}
            className="ui-btn-primary inline-flex items-center gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            저장
          </button>
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
      </div>

      {analysis ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ["전체 슬라이드", `${analysis.validation?.total_slides ?? analysis.total_slides}개`],
              ["텍스트 추출 성공", `${analysis.validation?.text_extracted_slides ?? analysis.total_slides}개`],
              ["chunk", `${analysis.validation?.total_chunks ?? analysis.total_chunks}개`],
              ["XML 태그 감지", `${analysis.validation?.xml_tag_chunks ?? 0}개`],
              ["카테고리 분류", `${analysis.validation?.categorized_slides ?? categorySummary.length}개`]
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
              </div>
            ))}
          </div>

          {analysis.validation ? (
            <div
              className={[
                "rounded-xl border px-4 py-3 text-sm",
                analysis.validation.can_save
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-red-200 bg-red-50 text-red-900"
              ].join(" ")}
            >
              {analysis.validation.can_save
                ? "텍스트 추출 검증 통과 — 저장 가능합니다."
                : analysis.validation.block_reason ??
                  "PPTX 텍스트 추출 결과가 비정상입니다. XML 태그가 포함되어 있어 정책 지식으로 저장할 수 없습니다."}
            </div>
          ) : null}

          {analysis.warning ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {analysis.warning}
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">슬라이드</th>
                  <th className="px-4 py-3 text-left">제목</th>
                  <th className="px-4 py-3 text-left">카테고리</th>
                  <th className="px-4 py-3 text-right">chunk</th>
                  <th className="px-4 py-3 text-left">미리보기</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analysis.slides.map((slide) => (
                  <tr key={slide.slide_number}>
                    <td className="px-4 py-2">{slide.slide_number}</td>
                    <td className="px-4 py-2 font-medium">{slide.title}</td>
                    <td className="px-4 py-2">{slide.category}</td>
                    <td className="px-4 py-2 text-right">{slide.chunk_count}</td>
                    <td className="px-4 py-2 text-xs text-slate-600">{slide.body_preview || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
