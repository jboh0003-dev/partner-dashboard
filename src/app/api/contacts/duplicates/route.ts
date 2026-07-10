import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { mergeContactsIntoMaster } from "@/lib/contacts/contact-merge";
import {
  classifyDuplicateGroup,
  pickDuplicateMasterId,
  type DuplicateContactRecord
} from "@/lib/contacts/duplicate-merge";
import { pickCanonicalContact } from "@/lib/contacts/contact-merge";
import { fetchDuplicateGroups } from "@/lib/contacts/duplicate-groups";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const result = await fetchDuplicateGroups(supabase);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "중복 후보 조회 실패" },
      { status: 400 }
    );
  }
}

const BulkAutoMergeSchema = z.object({
  person_keys: z.array(z.string()).optional()
});

export async function POST(request: Request) {
  try {
    const body = BulkAutoMergeSchema.parse(await request.json().catch(() => ({})));
    const supabase = createAdminClient();
    const result = await fetchDuplicateGroups(supabase);

    const targetGroups = body.person_keys?.length
      ? result.auto.filter((group) => body.person_keys!.includes(group.person_key))
      : result.auto;

    let mergedGroups = 0;
    let mergedContacts = 0;
    const errors: string[] = [];

    for (const group of targetGroups) {
      const master = pickCanonicalContact(group.members);
      const masterId = master.id;
      const secondaryIds = group.members.filter((member) => member.id !== masterId).map((m) => m.id);
      if (secondaryIds.length === 0) continue;

      try {
        const mergeResult = await mergeContactsIntoMaster(
          supabase,
          masterId,
          secondaryIds,
          "bulk_auto_merge"
        );
        mergedGroups += 1;
        mergedContacts += mergeResult.merged_ids.length;
        await supabase
          .from("partner_contacts")
          .update({ review_required: false, review_reason: null })
          .eq("id", masterId);
      } catch (mergeError) {
        errors.push(
          `${group.company_name} ${group.name}: ${
            mergeError instanceof Error ? mergeError.message : "병합 실패"
          }`
        );
      }
    }

    revalidatePath("/dashboard/contacts");

    return NextResponse.json({
      ok: errors.length === 0,
      merged_groups: mergedGroups,
      merged_contacts: mergedContacts,
      errors
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "일괄 병합 실패" },
      { status: 400 }
    );
  }
}

const DuplicateActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("merge"),
    master_id: z.string().uuid(),
    secondary_ids: z.array(z.string().uuid()).min(1)
  }),
  z.object({
    action: z.literal("keep_separate"),
    contact_ids: z.array(z.string().uuid()).min(1)
  })
]);

export async function PATCH(request: Request) {
  try {
    const body = DuplicateActionSchema.parse(await request.json());
    const supabase = createAdminClient();

    if (body.action === "merge") {
      const mergeResult = await mergeContactsIntoMaster(
        supabase,
        body.master_id,
        body.secondary_ids,
        "manual_merge"
      );
      await supabase
        .from("partner_contacts")
        .update({ review_required: false, review_reason: null, merge_keep_separate: false })
        .eq("id", body.master_id);

      revalidatePath("/dashboard/contacts");
      return NextResponse.json({
        ok: true,
        merged_ids: mergeResult.merged_ids
      });
    }

    const { error } = await supabase
      .from("partner_contacts")
      .update({
        merge_keep_separate: true,
        review_required: false,
        review_reason: "별도 인물로 유지",
        updated_at: new Date().toISOString()
      })
      .in("id", body.contact_ids);

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/contacts");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "처리 실패" },
      { status: 400 }
    );
  }
}
