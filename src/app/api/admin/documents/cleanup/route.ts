import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  buildDuplicateCleanupPlan,
  deletePartnerDocumentHard,
  summarizeCleanupPlan
} from "@/lib/documents/document-lifecycle";
import { createAdminClient } from "@/lib/supabase/admin";

async function fetchCleanupDocuments() {
  const supabase = createAdminClient();
  const { data: documents, error: documentError } = await supabase
    .from("partner_documents")
    .select(
      "id, partner_id, document_type, storage_path, file_path, file_size, original_filename, display_name, file_name, created_at, received_date, is_active, is_duplicate, partners(company_name)"
    )
    .is("deleted_at", null);

  if (documentError) throw new Error(documentError.message);

  return (documents ?? []).map((row) => {
    const partner = row.partners as { company_name?: string } | null;
    return {
      id: String(row.id),
      partner_id: String(row.partner_id),
      document_type: row.document_type as string | null,
      storage_path: row.storage_path as string | null,
      file_path: row.file_path as string | null,
      file_size: row.file_size as number | null,
      original_filename: row.original_filename as string | null,
      display_name: row.display_name as string | null,
      file_name: row.file_name as string | null,
      created_at: String(row.created_at),
      received_date: row.received_date as string | null,
      is_active: row.is_active as boolean | null,
      is_duplicate: row.is_duplicate as boolean | null,
      partner_name: partner?.company_name ?? ""
    };
  });
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const documents = await fetchCleanupDocuments();
    const plan = buildDuplicateCleanupPlan(documents);
    const summary = summarizeCleanupPlan(plan);

    const url = new URL(request.url);
    if (url.searchParams.get("export") === "json") {
      return NextResponse.json({
        ok: true,
        generated_at: new Date().toISOString(),
        summary,
        plan,
        remove_targets: plan.flatMap((group) =>
          group.remove.map((item) => ({
            partner_id: group.partner_id,
            partner_name: group.partner_name,
            document_type: group.document_type,
            document_id: item.id,
            filename: item.filename,
            storage_path: item.storage_path,
            file_size: item.file_size,
            created_at: item.created_at
          }))
        )
      });
    }

    return NextResponse.json({ ok: true, summary, plan });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "중복 정리 미리보기 실패"
      },
      { status: 400 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { confirm?: boolean };
    if (!body.confirm) {
      return NextResponse.json(
        { ok: false, message: "정리 실행을 위해 confirm: true 가 필요합니다." },
        { status: 400 }
      );
    }

    const documents = await fetchCleanupDocuments();
    const plan = buildDuplicateCleanupPlan(documents);
    const summary = summarizeCleanupPlan(plan);

    const supabase = createAdminClient();
    const deletedIds: string[] = [];
    const deletedStorage: string[] = [];
    const errors: string[] = [];
    const affectedPartnerIds = new Set<string>();

    for (const group of plan) {
      affectedPartnerIds.add(group.partner_id);
      for (const target of group.remove) {
        const result = await deletePartnerDocumentHard(supabase, target.id);
        if (result.ok) {
          deletedIds.push(target.id);
          deletedStorage.push(...result.deletedStorage);
        } else {
          errors.push(...result.errors);
          console.error("[document-cleanup] delete failed", {
            documentId: target.id,
            partnerId: group.partner_id,
            errors: result.errors,
            deletedStorage: result.deletedStorage
          });
        }
      }
    }

    revalidatePath("/dashboard/documents");
    revalidatePath("/dashboard/documents/duplicates");
    revalidatePath("/dashboard/partners", "layout");
    for (const partnerId of affectedPartnerIds) {
      revalidatePath(`/dashboard/partners/${partnerId}`);
    }

    return NextResponse.json({
      ok: errors.length === 0,
      summary,
      result: {
        deleted_document_count: deletedIds.length,
        deleted_storage_count: deletedStorage.length,
        deleted_ids: deletedIds,
        deleted_storage_paths: deletedStorage,
        errors
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "중복 정리 실행 실패"
      },
      { status: 400 }
    );
  }
}
