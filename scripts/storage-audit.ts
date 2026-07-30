/**
 * Storage 진단 dry-run
 * 실행: npm run storage:audit
 * 실제 삭제 없음. scripts/output/storage-audit-*.json|csv 생성
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  formatBytes,
  runPartnerDocumentsAudit,
  type AuditItem
} from "../src/lib/storage/partner-documents-audit";

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx < 0) continue;
      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // optional
  }
}

function csvEscape(value: string | number | boolean | null | undefined): string {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function writeItemsCsv(path: string, rows: AuditItem[]) {
  const headers = [
    "classification",
    "deletable",
    "reason",
    "storage_path",
    "document_id",
    "partner_id",
    "partner_name",
    "document_type",
    "size_bytes",
    "created_at",
    "keep_path"
  ];
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      [
        row.classification,
        row.deletable,
        row.reason,
        row.storage_path,
        row.document_id,
        row.partner_id,
        row.partner_name,
        row.document_type,
        row.size_bytes,
        row.created_at,
        row.keep_path ?? ""
      ]
        .map(csvEscape)
        .join(",")
    )
  ];
  writeFileSync(path, lines.join("\n"), "utf8");
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요");
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  console.log("[storage:audit] scanning partner-documents…");
  const summary = await runPartnerDocumentsAudit(supabase);

  const outDir = resolve(process.cwd(), "scripts", "output");
  mkdirSync(outDir, { recursive: true });
  const stamp = summary.generated_at.replace(/[:.]/g, "-");
  const jsonPath = resolve(outDir, `storage-audit-${stamp}.json`);
  const csvPath = resolve(outDir, `storage-audit-${stamp}.csv`);
  const manifestPath = resolve(outDir, `storage-cleanup-candidates-${stamp}.json`);

  writeFileSync(jsonPath, JSON.stringify(summary, null, 2), "utf8");
  writeItemsCsv(csvPath, summary.items);
  writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        generated_at: summary.generated_at,
        bucket: summary.bucket,
        note: "승인 후 npm run storage:cleanup -- --manifest=<이 파일> 로만 삭제",
        paths: summary.safe_delete_candidates
          .map((item) => item.storage_path)
          .filter(Boolean)
      },
      null,
      2
    ),
    "utf8"
  );

  console.log("\n=== Storage audit (dry-run) ===");
  console.log(`files: ${summary.totals.storage_files}`);
  console.log(`size:  ${formatBytes(summary.totals.storage_bytes)}`);
  console.log(`db docs: ${summary.totals.db_documents}`);
  console.log("\nby classification:");
  for (const [key, value] of Object.entries(summary.by_classification)) {
    if (value.count === 0) continue;
    console.log(`  ${key}: ${value.count} / ${formatBytes(value.bytes)}`);
  }
  console.log("\nby document_type (top):");
  for (const row of summary.by_document_type.slice(0, 10)) {
    console.log(`  ${row.label}: ${row.count} / ${formatBytes(row.bytes)}`);
  }
  console.log(
    `\nsafe delete candidates: ${summary.safe_delete_candidates.length} / ${formatBytes(summary.estimated_reclaim_bytes)}`
  );
  console.log(`\nwrote:\n  ${jsonPath}\n  ${csvPath}\n  ${manifestPath}`);
  console.log("\nNo files were deleted.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
