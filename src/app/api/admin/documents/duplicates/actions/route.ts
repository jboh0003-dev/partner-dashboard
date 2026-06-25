import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  hideDocumentAsDuplicate,
  markDocumentNotDuplicate,
  markDocumentRepresentative
} from "@/lib/data/document-duplicates";

const BodySchema = z.object({
  action: z.enum(["representative", "hide_duplicate", "not_duplicate"]),
  document_id: z.string().uuid(),
  duplicate_of: z.string().uuid().optional()
});

export async function POST(request: Request) {
  try {
    const body = BodySchema.parse(await request.json());

    if (body.action === "representative") {
      await markDocumentRepresentative(body.document_id);
    } else if (body.action === "hide_duplicate") {
      if (!body.duplicate_of) {
        throw new Error("duplicate_of가 필요합니다.");
      }
      await hideDocumentAsDuplicate(body.document_id, body.duplicate_of);
    } else {
      await markDocumentNotDuplicate(body.document_id);
    }

    revalidatePath("/dashboard/documents");
    revalidatePath("/dashboard/documents/duplicates");
    revalidatePath("/dashboard/partners", "layout");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "중복 처리 실패"
      },
      { status: 400 }
    );
  }
}
