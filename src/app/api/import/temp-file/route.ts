import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadTempImportFile } from "@/lib/imports/import-logs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const importType = String(formData.get("import_type") ?? "import").trim() || "import";

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, message: "업로드 파일이 없습니다." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const storagePath = await uploadTempImportFile(supabase, file, file.name, importType);

    return NextResponse.json({ ok: true, storage_path: storagePath });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "임시 파일 업로드 실패"
      },
      { status: 400 }
    );
  }
}
