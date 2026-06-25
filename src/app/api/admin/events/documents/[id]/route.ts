import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { legacyUploadStatusFromFileStatus } from "@/lib/events/event-document-types";
import type { EventFileStatus } from "@/lib/events/event-document-types";

type PatchBody = {
  isRepresentative?: boolean;
  fileStatus?: EventFileStatus;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as PatchBody;
    const supabase = createAdminClient();

    const { data: doc, error: fetchError } = await supabase
      .from("partner_event_documents")
      .select("id, event_id, file_status")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !doc) {
      return NextResponse.json({ error: "문서를 찾을 수 없습니다." }, { status: 404 });
    }

    const nextRepresentative = body.isRepresentative;
    const currentStatus = (doc.file_status ?? "normal") as EventFileStatus;
    const nextStatus: EventFileStatus =
      body.fileStatus ??
      (nextRepresentative === true
        ? "representative"
        : nextRepresentative === false && currentStatus === "representative"
          ? "normal"
          : currentStatus);

    const { error } = await supabase
      .from("partner_event_documents")
      .update({
        is_representative: nextRepresentative ?? nextStatus === "representative",
        file_status: nextStatus,
        upload_status: legacyUploadStatusFromFileStatus(
          nextStatus,
          nextRepresentative ?? nextStatus === "representative"
        )
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id, fileStatus: nextStatus });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "문서 수정에 실패했습니다." },
      { status: 500 }
    );
  }
}
