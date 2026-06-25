import { NextResponse } from "next/server";
import {
  createEventDocumentSignedUrl,
  fetchPartnerEventDocumentRecord,
  getEventDocumentDownloadFileName
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

    const { url, error: signError } = await createEventDocumentSignedUrl(document, "attachment");
    if (!url) {
      return NextResponse.json(
        { ok: false, message: signError ?? "다운로드 URL 생성에 실패했습니다." },
        { status: 500 }
      );
    }

    if (wantsJson) {
      return NextResponse.json({
        ok: true,
        url,
        filename: getEventDocumentDownloadFileName(document)
      });
    }

    return NextResponse.redirect(url);
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "다운로드 실패" },
      { status: 400 }
    );
  }
}
