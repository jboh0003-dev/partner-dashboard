import { NextResponse } from "next/server";
import {
  createEventDocumentSignedUrl,
  fetchPartnerEventDocumentRecord,
  isPreviewableEventDocument
} from "@/lib/events/event-document-access";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const wantsJson =
      new URL(request.url).searchParams.get("format") === "json" ||
      request.headers.get("accept")?.includes("application/json");

    const { document, error } = await fetchPartnerEventDocumentRecord(id);
    if (!document) {
      return NextResponse.json({ ok: false, message: error ?? "문서를 찾을 수 없습니다." }, { status: 404 });
    }

    if (!isPreviewableEventDocument(document)) {
      return NextResponse.json(
        {
          ok: false,
          previewable: false,
          message: "이 파일 형식은 다운로드 후 확인해 주세요."
        },
        { status: 415 }
      );
    }

    const { url, error: signError } = await createEventDocumentSignedUrl(document, "inline");
    if (!url) {
      return NextResponse.json(
        { ok: false, message: signError ?? "미리보기 URL 생성에 실패했습니다." },
        { status: 500 }
      );
    }

    if (wantsJson) {
      return NextResponse.json({
        ok: true,
        previewable: true,
        url,
        extension: document.file_extension
      });
    }

    return NextResponse.redirect(url);
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "미리보기 실패" },
      { status: 400 }
    );
  }
}
