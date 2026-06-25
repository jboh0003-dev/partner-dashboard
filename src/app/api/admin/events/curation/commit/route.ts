import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  enrichEventRowFromSourcePath,
  resolvePartnerEventId,
  type PartnerEventCache
} from "@/lib/events/event-commit";
import { legacyUploadStatusFromFileStatus } from "@/lib/events/event-document-types";
import {
  buildEventStoragePath,
  createEventUploadBatchId,
  ensureEventDocumentsBucket,
  EVENT_DOCUMENTS_BUCKET
} from "@/lib/events/event-storage";
import type { EventCurationReviewRow } from "@/types/event";

type CommitPayload = {
  rows: EventCurationReviewRow[];
  targetEventId?: string | null;
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const payloadRaw = formData.get("payload");
    if (typeof payloadRaw !== "string") {
      return NextResponse.json({ error: "payload가 필요합니다." }, { status: 400 });
    }

    const payload = JSON.parse(payloadRaw) as CommitPayload;
    const rows = (payload.rows ?? [])
      .filter((row) => row.uploadSelected === true)
      .map(enrichEventRowFromSourcePath);

    if (rows.length === 0) {
      return NextResponse.json({ error: "저장할 파일을 선택해 주세요." }, { status: 400 });
    }

    const supabase = createAdminClient();
    await ensureEventDocumentsBucket();

    const eventCache: PartnerEventCache = new Map();
    const uploadBatchId = createEventUploadBatchId();
    let createdEvents = 0;
    let uploadedDocs = 0;
    let addedToExistingEvents = 0;
    let skippedDuplicates = 0;
    let versionUpdates = 0;
    let failedUploads = 0;
    const failures: Array<{ filename: string; message: string }> = [];

    const uniqueByFolder = new Map<string, EventCurationReviewRow>();
    for (const row of rows) {
      if (!uniqueByFolder.has(row.eventFolderName)) {
        uniqueByFolder.set(row.eventFolderName, row);
      }
    }

    for (const sampleRow of uniqueByFolder.values()) {
      const resolved = await resolvePartnerEventId(
        supabase,
        sampleRow,
        eventCache,
        payload.targetEventId
      );
      if ("error" in resolved) {
        failures.push({
          filename: sampleRow.eventFolderName,
          message: resolved.error
        });
      } else if (resolved.created) {
        createdEvents += 1;
      }
    }

    for (const row of rows) {
      try {
        let resolved = eventCache.get(row.eventFolderName);
        if (!resolved) {
          const next = await resolvePartnerEventId(
            supabase,
            row,
            eventCache,
            payload.targetEventId
          );
          if ("error" in next) {
            failedUploads += 1;
            failures.push({
              filename: row.originalFilename,
              message: next.error
            });
            continue;
          }
          resolved = next;
        }

        const eventId = resolved.eventId;
        if (!eventId) {
          failedUploads += 1;
          failures.push({
            filename: row.originalFilename,
            message: "event_id를 확인할 수 없습니다."
          });
          continue;
        }

        const file =
          formData.get(`file:${row.rowId}`) ??
          formData.get(`file:${row.sourcePath}`);
        if (!(file instanceof File)) {
          failedUploads += 1;
          failures.push({
            filename: row.originalFilename,
            message: "업로드 파일을 찾을 수 없습니다."
          });
          continue;
        }

        const { data: existingDocs } = await supabase
          .from("partner_event_documents")
          .select("id, file_size, file_status, is_representative")
          .eq("event_id", eventId)
          .eq("source_path", row.sourcePath)
          .order("uploaded_at", { ascending: false });

        const exactMatch = (existingDocs ?? []).find(
          (doc) => Number(doc.file_size) === Number(row.fileSize ?? 0)
        );

        if (exactMatch) {
          skippedDuplicates += 1;
          await supabase.from("partner_event_curation_items").insert({
            event_id: eventId,
            source_folder_name: row.eventFolderName,
            source_path: row.sourcePath,
            original_filename: row.originalFilename,
            file_extension: row.fileExtension,
            file_size: row.fileSize,
            document_type: row.documentType,
            file_status: "duplicate",
            upload_status: legacyUploadStatusFromFileStatus("duplicate", false),
            exclude_reason: "동일 source_path·파일 크기 중복",
            display_name: row.displayName,
            version_label: row.versionLabel,
            is_representative: false,
            upload_selected: true,
            visibility: row.visibility,
            committed_at: new Date().toISOString()
          });
          continue;
        }

        const storagePath = buildEventStoragePath(
          uploadBatchId,
          row.fileExtension,
          row.originalFilename
        );
        const buffer = Buffer.from(await file.arrayBuffer());
        const { error: uploadError } = await supabase.storage
          .from(EVENT_DOCUMENTS_BUCKET)
          .upload(storagePath, buffer, { contentType: file.type || undefined });

        if (uploadError) {
          failedUploads += 1;
          failures.push({
            filename: row.originalFilename,
            message: uploadError.message
          });
          continue;
        }

        const priorVersions = (existingDocs ?? []).filter(
          (doc) => Number(doc.file_size) !== Number(row.fileSize ?? 0)
        );
        if (priorVersions.length > 0) {
          for (const prior of priorVersions) {
            if (prior.file_status === "representative" || prior.is_representative) {
              await supabase
                .from("partner_event_documents")
                .update({
                  file_status: "old_version",
                  is_representative: false,
                  upload_status: legacyUploadStatusFromFileStatus("old_version", false)
                })
                .eq("id", prior.id);
              versionUpdates += 1;
            }
          }
        }

        const uploadStatus = legacyUploadStatusFromFileStatus(row.fileStatus, row.isRepresentative);
        const { error: docError } = await supabase.from("partner_event_documents").insert({
          event_id: eventId,
          document_type: row.documentType,
          display_name: row.displayName,
          original_file_name: row.originalFilename,
          storage_path: storagePath,
          file_extension: row.fileExtension,
          file_size: row.fileSize,
          version_label: row.versionLabel,
          is_representative: row.isRepresentative,
          is_active: row.fileStatus !== "excluded",
          is_internal: row.fileStatus === "internal" || row.visibility === "admin_only",
          is_duplicate: row.fileStatus === "duplicate",
          exclude_reason: row.excludeReason,
          file_status: row.fileStatus,
          upload_status: uploadStatus,
          source_path: row.sourcePath,
          visibility: row.visibility
        });

        if (docError) {
          failedUploads += 1;
          failures.push({
            filename: row.originalFilename,
            message: docError.message
          });
          continue;
        }

        uploadedDocs += 1;
        if (resolved.existedBefore) {
          addedToExistingEvents += 1;
        }

        await supabase.from("partner_event_curation_items").insert({
          event_id: eventId,
          source_folder_name: row.eventFolderName,
          source_path: row.sourcePath,
          original_filename: row.originalFilename,
          file_extension: row.fileExtension,
          file_size: row.fileSize,
          document_type: row.documentType,
          file_status: row.fileStatus,
          upload_status: uploadStatus,
          exclude_reason: row.excludeReason,
          display_name: row.displayName,
          version_label: row.versionLabel,
          is_representative: row.isRepresentative,
          upload_selected: true,
          visibility: row.visibility,
          committed_at: new Date().toISOString()
        });
      } catch (rowError) {
        failedUploads += 1;
        failures.push({
          filename: row.originalFilename,
          message: rowError instanceof Error ? rowError.message : "저장 중 오류"
        });
      }
    }

    return NextResponse.json({
      ok: true,
      createdEvents,
      addedToExistingEvents,
      uploadedDocs,
      failedUploads,
      skippedDuplicates,
      versionUpdates,
      totalSelected: rows.length,
      failures
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "행사 자료 등록에 실패했습니다." },
      { status: 500 }
    );
  }
}
