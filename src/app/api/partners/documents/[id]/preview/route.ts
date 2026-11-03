import { NextResponse } from "next/server";
import { isPreviewableDocument } from "@/lib/documents/display";
import {
  buildDocumentResponseHeaders,
  downloadPartnerDocumentBlob,
  fetchPartnerDocumentRecord
} from "@/lib/documents/server-access";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { document, error } = await fetchPartnerDocumentRecord(id);

    if (!document) {
      return NextResponse.json({ ok: false, message: error ?? "문서를 찾을 수 없습니다." }, { status: 404 });
    }

    if (!isPreviewableDocument(document)) {
      return NextResponse.json(
        {
          ok: false,
          previewable: false,
          message: "이 파일 형식은 미리보기를 지원하지 않습니다. 원본 파일로 확인해 주세요."
        },
        { status: 415 }
      );
    }

    const { blob, error: downloadError } = await downloadPartnerDocumentBlob(document);
    if (!blob) {
      return NextResponse.json(
        { ok: false, message: downloadError ?? "파일을 불러오지 못했습니다." },
        { status: 404 }
      );
    }

    return new NextResponse(blob.stream(), {
      headers: buildDocumentResponseHeaders(document, "inline")
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "미리보기 실패"
      },
      { status: 400 }
    );
  }
}
