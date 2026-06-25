import { NextResponse } from "next/server";
import {
  buildDocumentResponseHeaders,
  downloadPartnerDocumentBlob,
  fetchPartnerDocumentRecord
} from "@/lib/documents/server-access";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const wantsJson =
      new URL(request.url).searchParams.get("format") === "json" ||
      request.headers.get("accept")?.includes("application/json");

    const { document, error } = await fetchPartnerDocumentRecord(id);
    if (!document) {
      return NextResponse.json({ ok: false, message: error ?? "문서를 찾을 수 없습니다." }, { status: 404 });
    }

    const { blob, error: downloadError } = await downloadPartnerDocumentBlob(document);
    if (!blob) {
      return NextResponse.json(
        { ok: false, message: downloadError ?? "파일을 불러오지 못했습니다." },
        { status: 404 }
      );
    }

    if (wantsJson) {
      return NextResponse.json({
        ok: true,
        url: `/api/partners/documents/${id}/download`,
        filename: document.original_filename ?? document.file_name
      });
    }

    return new NextResponse(blob, {
      headers: buildDocumentResponseHeaders(document, "attachment")
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "다운로드 실패"
      },
      { status: 400 }
    );
  }
}
