import * as XLSX from "xlsx";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parsePartnerPerformanceWorkbook } from "@/lib/excel/parse-partner-performance";
import { analyzePartnerPerformanceUpload } from "@/lib/imports/partner-performance";
import { TEMP_IMPORTS_BUCKET } from "@/lib/imports/import-logs";
import { resolvePipelineSnapshotDate } from "@/lib/performance/snapshot-date";
import { findExistingPipelineSnapshots } from "@/lib/performance/snapshot-persistence";

export const MAX_PIPELINE_IMPORT_BYTES = 40 * 1024 * 1024;

export function validatePipelineImportName(fileName: string) {
  const trimmed = fileName.trim();
  const extension = trimmed.split(".").pop()?.toLowerCase();
  if (!trimmed || !["xlsx", "xls"].includes(extension ?? "")) {
    throw new Error("실적/파이프라인 파일은 .xlsx 또는 .xls만 업로드할 수 있습니다.");
  }
  return extension as "xlsx" | "xls";
}

export function assertPipelineStoragePath(storagePath: string, userId: string) {
  const safeOwner = userId.replace(/[^0-9a-f-]/gi, "");
  if (!/^[0-9a-f-]{36}$/i.test(safeOwner) || !new RegExp(
    "^partner_pipeline/" + safeOwner + "/[0-9a-f-]{36}\\.(xlsx|xls)$", "i"
  ).test(storagePath)) {
    throw new Error("업로드 파일 경로가 유효하지 않거나 접근 권한이 없습니다.");
  }
  return storagePath;
}

export async function analyzeStoredPipelineFile(
  supabase: SupabaseClient,
  storagePath: string,
  originalName: string,
  userId: string
) {
  assertPipelineStoragePath(storagePath, userId);
  validatePipelineImportName(originalName);
  const { data: blob, error: downloadError } = await supabase.storage
    .from(TEMP_IMPORTS_BUCKET).download(storagePath);
  if (downloadError || !blob) {
    throw new Error(downloadError?.message ?? "업로드된 파일을 읽지 못했습니다. 다시 선택해 주세요.");
  }
  if (blob.size <= 0 || blob.size > MAX_PIPELINE_IMPORT_BYTES) {
    throw new Error("Excel 파일 크기가 허용 범위(40MB 이내)를 벗어났습니다.");
  }
  const workbook = XLSX.read(await blob.arrayBuffer(), { type: "array", cellDates: true });
  const parsed = parsePartnerPerformanceWorkbook(workbook, originalName);
  const resolved = resolvePipelineSnapshotDate(originalName, {
    sheetLabel: parsed.snapshot_label
  });
  const snapshotDate = parsed.snapshot_date ?? resolved.snapshot_date;
  const snapshotLabel = parsed.snapshot_label ?? resolved.snapshot_label;
  const [{ data: partners, error: partnersError }, { data: aliases, error: aliasesError }, existing] =
    await Promise.all([
      supabase.from("partners").select("id, company_name, business_number").is("deleted_at", null),
      supabase.from("partner_aliases").select("partner_id, alias_name, normalized_alias"),
      findExistingPipelineSnapshots(supabase, snapshotDate, originalName).catch(() => [])
    ]);
  if (partnersError) throw new Error(partnersError.message);
  if (aliasesError) throw new Error(aliasesError.message);

  const analysis = analyzePartnerPerformanceUpload({
    inventory_rows: parsed.inventory_rows,
    revenue_rows: parsed.revenue_rows,
    snapshot_date: snapshotDate,
    snapshot_label: snapshotLabel,
    summary_validation: parsed.summary_validation,
    partners: (partners ?? []).map((partner) => ({
      id: String(partner.id),
      company_name: String(partner.company_name),
      business_number: partner.business_number ? String(partner.business_number) : null
    })),
    aliases: (aliases ?? []).map((alias) => ({
      partner_id: String(alias.partner_id),
      alias_name: String(alias.alias_name),
      normalized_alias: String(alias.normalized_alias)
    })),
    required_columns_found: parsed.required_columns_found,
    parse_errors: parsed.parse_errors
  });
  return {
    parsed,
    analysis,
    snapshotMeta: {
      snapshot_date: snapshotDate,
      snapshot_label: snapshotLabel,
      date_source: parsed.snapshot_date ? "sheet_or_filename" : resolved.source,
      duplicate_exists: existing.length > 0,
      existing_versions: existing.map((snapshot) => snapshot.version)
    }
  };
}

/** Keep review candidates plus the first 200 source rows, but never send the
 * complete workbook/raw_json back over Vercel's 4.5MB response limit. */
export function pipelinePreviewRows(
  rows: Awaited<ReturnType<typeof analyzeStoredPipelineFile>>["analysis"]["inventory_rows"]
) {
  const selected = new Map<string, (typeof rows)[number]>();
  for (const row of rows.slice(0, 200)) {
    selected.set(row.row_number + "|" + row.project_code, row);
  }
  for (const row of rows) {
    if (selected.size >= 350) break;
    if (row.match_status === "review" || !row.matched_partner_id) {
      selected.set(row.row_number + "|" + row.project_code, row);
    }
  }
  return Array.from(selected.values()).map(({ raw_json: _raw, ...row }) => row);
}
