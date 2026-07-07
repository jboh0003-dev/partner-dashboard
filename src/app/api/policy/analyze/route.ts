import { NextResponse } from "next/server";
import { POLICY_ALLOWED_EXTENSIONS } from "@/lib/policy/constants";
import { getPolicyFileType, parsePptxBuffer } from "@/lib/policy/parse-pptx";
import { validatePolicyParse } from "@/lib/policy/validate-parse";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, message: "파일이 없습니다." }, { status: 400 });
    }

    const fileType = getPolicyFileType(file.name);
    if (!POLICY_ALLOWED_EXTENSIONS.has(fileType)) {
      return NextResponse.json(
        { ok: false, message: "pptx, pdf, docx 파일만 지원합니다." },
        { status: 400 }
      );
    }

    if (fileType !== "pptx" && fileType !== "ppt") {
      return NextResponse.json({
        ok: true,
        file_name: file.name,
        file_type: fileType,
        file_size: file.size,
        slides: [],
        total_slides: 0,
        total_chunks: 0,
        validation: null,
        warning: "현재 PPTX 텍스트 추출만 지원합니다. PDF/DOCX는 저장만 가능합니다."
      });
    }

    const buffer = await file.arrayBuffer();
    const parsed = await parsePptxBuffer(buffer);
    const validation = validatePolicyParse(parsed.slides);

    return NextResponse.json({
      ok: true,
      file_name: file.name,
      file_type: fileType,
      file_size: file.size,
      total_slides: parsed.total_slides,
      total_chunks: parsed.total_chunks,
      validation,
      slides: parsed.slides.map((slide) => ({
        slide_number: slide.slide_number,
        title: slide.title,
        body_preview: slide.body.slice(0, 300),
        category: slide.category,
        keywords: slide.keywords,
        chunk_count: slide.chunks.length
      })),
      slide_details: parsed.slides
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "분석 실패" },
      { status: 400 }
    );
  }
}
