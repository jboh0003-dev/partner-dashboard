import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  formatBytes,
  runPartnerDocumentsAudit
} from "@/lib/storage/partner-documents-audit";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const supabase = createAdminClient();
    const summary = await runPartnerDocumentsAudit(supabase);

    return NextResponse.json({
      ok: true,
      summary: {
        ...summary,
        // UI용 요약 — 전체 items는 별도 download
        items: undefined,
        items_count: summary.items.length,
        totals_label: {
          storage: formatBytes(summary.totals.storage_bytes),
          reclaim: formatBytes(summary.estimated_reclaim_bytes)
        },
        by_classification_label: Object.fromEntries(
          Object.entries(summary.by_classification).map(([k, v]) => [
            k,
            { count: v.count, bytes: v.bytes, label: formatBytes(v.bytes) }
          ])
        ),
        by_document_type: summary.by_document_type.map((row) => ({
          ...row,
          bytes_label: formatBytes(row.bytes)
        }))
      },
      full: summary
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Storage 진단 실패"
      },
      { status: 500 }
    );
  }
}
