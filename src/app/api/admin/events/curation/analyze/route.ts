import { NextResponse } from "next/server";
import { scanEventFiles, type ScannedEventFile } from "@/lib/events/event-curation-scan";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { files?: ScannedEventFile[] };
    const files = body.files ?? [];

    if (files.length === 0) {
      return NextResponse.json({ error: "스캔할 파일 목록이 없습니다." }, { status: 400 });
    }

    const result = scanEventFiles(files);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "행사 파일 분석에 실패했습니다." },
      { status: 500 }
    );
  }
}
