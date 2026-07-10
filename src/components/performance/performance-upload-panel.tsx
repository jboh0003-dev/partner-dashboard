"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FileSpreadsheet, Loader2, UploadCloud } from "lucide-react";
import type { PartnerPerformanceAnalysisResult } from "@/lib/imports/partner-performance";
import type { PipelineDuplicateMode } from "@/lib/performance/snapshot-persistence";
import { formatCount, formatEok, formatMillion } from "@/lib/performance/format";
import { HorizontalBarChart } from "@/components/dashboard/bar-chart";

type TabKey =
  | "summary"
  | "win_forecast"
  | "new_reg"
  | "top_win"
  | "top_new"
  | "top_revenue"
  | "review"
  | "raw";

type SnapshotMeta = {
  snapshot_date: string;
  snapshot_label: string;
  date_source: string;
  duplicate_exists: boolean;
  existing_versions: number[];
};

export function PerformanceUploadPanel() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<PartnerPerformanceAnalysisResult | null>(null);
  const [snapshotMeta, setSnapshotMeta] = useState<SnapshotMeta | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [duplicateMode, setDuplicateMode] = useState<PipelineDuplicateMode>("replace");
  const [tab, setTab] = useState<TabKey>("summary");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const reviewRows = useMemo(
    () => analysis?.inventory_rows.filter((row) => row.match_status === "review") ?? [],
    [analysis]
  );

  async function uploadTempFile(selected: File): Promise<string | null> {
    const formData = new FormData();
    formData.set("file", selected);
    formData.set("import_type", "partner_pipeline");
    const response = await fetch("/api/import/temp-file", { method: "POST", body: formData });
    const json = (await response.json().catch(() => null)) as {
      ok?: boolean;
      storage_path?: string;
    } | null;
    if (!response.ok || !json?.ok) return null;
    return json.storage_path ?? null;
  }

  async function handleAnalyze() {
    if (!file) {
      setError("엑셀 파일을 선택해 주세요.");
      return;
    }
    setLoading(true);
    setError(null);
    setSaveMessage(null);
    setStoragePath(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/import/partners/performance/analyze", {
        method: "POST",
        body: formData
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.message ?? "분석 실패");
      setAnalysis({
        summary: json.summary,
        inventory_rows: json.inventory_rows,
        revenue_rows: json.revenue_rows,
        win_forecast_top10: json.win_forecast_top10,
        new_reg_top10: json.new_reg_top10,
        revenue_top10: json.revenue_top10
      });
      setSnapshotMeta(json.snapshot_meta as SnapshotMeta);
      setFileName(file.name);
      setDuplicateMode(
        (json.snapshot_meta as SnapshotMeta)?.duplicate_exists ? "replace" : "replace"
      );
      setTab("summary");
    } catch (err) {
      setError(err instanceof Error ? err.message : "분석 실패");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!analysis || !fileName || !file) return;
    if (!analysis.summary.can_save) {
      setError(analysis.summary.save_blockers.join(" / "));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let path = storagePath;
      if (!path) {
        path = await uploadTempFile(file);
        setStoragePath(path);
      }

      const response = await fetch("/api/import/partners/performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_name: fileName,
          snapshot_date: analysis.summary.snapshot_date,
          snapshot_label: analysis.summary.snapshot_label,
          duplicate_mode: duplicateMode,
          storage_path: path,
          summary: {
            total_pipeline_amount_million: analysis.summary.win_forecast_total_amount_million,
            total_pipeline_count: analysis.summary.win_forecast_total_count,
            partner_pipeline_amount_million: analysis.summary.win_forecast_partner_amount_million,
            partner_pipeline_count: analysis.summary.win_forecast_partner_count,
            new_total_pipeline_amount_million: analysis.summary.new_reg_total_amount_million,
            new_total_pipeline_count: analysis.summary.new_reg_total_count,
            new_partner_pipeline_amount_million: analysis.summary.new_reg_partner_amount_million,
            new_partner_pipeline_count: analysis.summary.new_reg_partner_count
          },
          inventory_rows: analysis.inventory_rows,
          revenue_rows: analysis.revenue_rows
        })
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.message ?? "저장 실패");
      setSaveMessage(
        `저장 완료 — ${json.snapshot_action} (v${json.snapshot_version}), 생성 ${json.created}건, 업데이트 ${json.updated}건, 검토 ${json.review}건` +
          (json.is_current ? " · 현재 대시보드 기준 스냅샷" : "")
      );
      router.push("/dashboard/performance");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="ui-card p-6">
        <h2 className="text-lg font-bold text-slate-900">파트너 실적/파이프라인 업로드</h2>
        <p className="mt-1 text-sm text-slate-600">
          파이프라인은 월별 스냅샷으로 누적 저장됩니다. 과거 스냅샷은 삭제되지 않으며, 대시보드는
          최신 기준일 스냅샷을 표시합니다.
        </p>
        <label className="mt-5 block rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
          <span className="text-sm font-semibold text-slate-800">실적/파이프라인 엑셀</span>
          <input
            type="file"
            accept=".xlsx,.xls"
            className="mt-2 block w-full text-sm"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setAnalysis(null);
              setSnapshotMeta(null);
              setStoragePath(null);
            }}
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => void handleAnalyze()} disabled={loading} className="ui-btn-accent inline-flex items-center gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            분석
          </button>
          <button type="button" onClick={() => void handleSave()} disabled={!analysis || saving} className="ui-btn-primary inline-flex items-center gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            저장
          </button>
          <Link href="/dashboard/performance" className="ui-btn-secondary">
            실적/파이프라인 보기
          </Link>
        </div>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        {saveMessage ? <p className="mt-3 text-sm text-emerald-700">{saveMessage}</p> : null}
      </div>

      {analysis ? (
        <>
          {snapshotMeta?.duplicate_exists ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
              <p className="font-semibold">동일 기준일·파일명 스냅샷이 이미 있습니다.</p>
              <p className="mt-1 text-xs text-amber-800">
                기존 버전: v{snapshotMeta.existing_versions.join(", v")} · 기본값은 기존 스냅샷 교체입니다.
              </p>
              <div className="mt-3 flex flex-wrap gap-4">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="duplicate_mode"
                    checked={duplicateMode === "replace"}
                    onChange={() => setDuplicateMode("replace")}
                  />
                  기존 스냅샷 교체
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="duplicate_mode"
                    checked={duplicateMode === "new_version"}
                    onChange={() => setDuplicateMode("new_version")}
                  />
                  새 버전으로 저장
                </label>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["스냅샷 기준일", analysis.summary.snapshot_date ?? "-"],
              ["2026 수주예상 파트너", `${formatEok(analysis.summary.win_forecast_partner_amount_million)} / ${formatCount(analysis.summary.win_forecast_partner_count)}`],
              ["2026 신규등록 파트너", `${formatEok(analysis.summary.new_reg_partner_amount_million)} / ${formatCount(analysis.summary.new_reg_partner_count)}`],
              ["2025 파트너 매출", `${formatEok(analysis.summary.revenue_partner_amount_million)} / ${formatCount(analysis.summary.revenue_partner_count)}`],
              ["매칭 성공", `${analysis.summary.partner_match_matched}건`],
              ["매칭 검토", `${analysis.summary.partner_match_review}건`],
              ["원천 행", `${analysis.summary.inventory_row_count}건`],
              ["저장 가능", analysis.summary.can_save ? "예" : "아니오"]
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
              </div>
            ))}
          </div>

          {analysis.summary.validation_warnings.length > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-semibold">검증 참고</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {analysis.summary.validation_warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {!analysis.summary.can_save ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {analysis.summary.save_blockers.join(" / ")}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {(
              [
                ["summary", "Executive Summary"],
                ["win_forecast", "수주예상 파이프라인"],
                ["new_reg", "신규등록 파이프라인"],
                ["top_win", "수주예상 Top 10"],
                ["top_new", "신규등록 Top 10"],
                ["top_revenue", "매출 Top 10"],
                ["review", `검토 필요 (${reviewRows.length})`],
                ["raw", "원천 데이터"]
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={tab === key ? "rounded-lg bg-okestro-600 px-3 py-2 text-sm font-semibold text-white" : "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "summary" ? (
            <div className="grid gap-4 xl:grid-cols-2">
              <SummaryCard title="2026 수주예상 파트너 파이프라인" amount={analysis.summary.win_forecast_partner_amount_million} count={analysis.summary.win_forecast_partner_count} total={analysis.summary.win_forecast_total_amount_million} />
              <SummaryCard title="2026 신규등록 파트너 파이프라인" amount={analysis.summary.new_reg_partner_amount_million} count={analysis.summary.new_reg_partner_count} total={analysis.summary.new_reg_total_amount_million} />
            </div>
          ) : null}

          {tab === "top_win" ? (
            <HorizontalBarChart
              data={analysis.win_forecast_top10.map((row) => ({
                label: row.partner_name,
                value: row.amount_million
              }))}
            />
          ) : null}
          {tab === "top_new" ? (
            <HorizontalBarChart
              data={analysis.new_reg_top10.map((row) => ({
                label: row.partner_name,
                value: row.amount_million
              }))}
            />
          ) : null}
          {tab === "top_revenue" ? (
            <HorizontalBarChart
              data={analysis.revenue_top10.map((row) => ({
                label: row.partner_name,
                value: row.product_revenue_million
              }))}
            />
          ) : null}

          {tab === "review" ? <OpportunityTable rows={reviewRows} /> : null}
          {tab === "win_forecast" ? (
            <OpportunityTable
              rows={analysis.inventory_rows.filter(
                (row) => row.is_product_revenue && row.is_partner_deal && row.expected_win_year?.toUpperCase() === "FY26"
              )}
            />
          ) : null}
          {tab === "new_reg" ? (
            <OpportunityTable
              rows={analysis.inventory_rows.filter(
                (row) =>
                  row.is_product_revenue &&
                  row.is_partner_deal &&
                  String(row.project_registered_year ?? "").startsWith("2026")
              )}
            />
          ) : null}
          {tab === "raw" ? <OpportunityTable rows={analysis.inventory_rows.slice(0, 200)} /> : null}
        </>
      ) : null}
    </div>
  );
}

function SummaryCard({
  title,
  amount,
  count,
  total
}: {
  title: string;
  amount: number;
  count: number;
  total: number;
}) {
  const share = total > 0 ? Math.round((amount / total) * 1000) / 10 : 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{formatEok(amount)}</p>
      <p className="mt-1 text-sm text-slate-600">{formatCount(count)} · {formatMillion(amount)}</p>
      <p className="mt-2 text-xs text-slate-500">전체 대비 약 {share}%</p>
    </div>
  );
}

function OpportunityTable({
  rows
}: {
  rows: Array<{
    partner_name: string | null;
    customer_name: string | null;
    project_name: string | null;
    project_code: string;
    expected_win_year: string | null;
    win_probability_label: string | null;
    product_amount_million: number | null;
    division: string | null;
    match_reason: string | null;
  }>;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3 text-left">파트너</th>
            <th className="px-4 py-3 text-left">고객사</th>
            <th className="px-4 py-3 text-left">프로젝트</th>
            <th className="px-4 py-3 text-left">코드</th>
            <th className="px-4 py-3 text-left">예상수주</th>
            <th className="px-4 py-3 text-left">확도</th>
            <th className="px-4 py-3 text-right">제품합계</th>
            <th className="px-4 py-3 text-left">본부</th>
            <th className="px-4 py-3 text-left">검토</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={`${row.project_code}-${row.partner_name}`}>
              <td className="px-4 py-2">{row.partner_name ?? "-"}</td>
              <td className="px-4 py-2">{row.customer_name ?? "-"}</td>
              <td className="px-4 py-2">{row.project_name ?? "-"}</td>
              <td className="px-4 py-2">{row.project_code}</td>
              <td className="px-4 py-2">{row.expected_win_year ?? "-"}</td>
              <td className="px-4 py-2">{row.win_probability_label ?? "-"}</td>
              <td className="px-4 py-2 text-right">{row.product_amount_million ?? "-"}</td>
              <td className="px-4 py-2">{row.division ?? "-"}</td>
              <td className="px-4 py-2 text-xs text-amber-700">{row.match_reason ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
