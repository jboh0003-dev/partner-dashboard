import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  cancelStaleImportJobs,
  isStaleImportJob,
  listRecentImportJobs,
  type ImportJobRow
} from "@/lib/imports/import-jobs";
import { FULL_SYNC_IMPORT_TYPE } from "@/lib/imports/partner-contacts-sync";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const importType = searchParams.get("import_type") ?? FULL_SYNC_IMPORT_TYPE;
    const supabase = createAdminClient();

    const staleCancelled = await cancelStaleImportJobs(supabase, importType).catch(() => 0);
    const jobs = await listRecentImportJobs(supabase, { importType, limit: 15 });

    const enriched = jobs.map((job) => ({
      ...job,
      is_stale: isStaleImportJob(job)
    }));

    const active = enriched.filter(
      (job) => job.status === "processing" || job.status === "pending"
    );

    return NextResponse.json({
      ok: true,
      import_type: importType,
      active_jobs: active,
      jobs: enriched,
      stale_cancelled: staleCancelled
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "import job 조회 실패"
      },
      { status: 400 }
    );
  }
}

export type { ImportJobRow };
