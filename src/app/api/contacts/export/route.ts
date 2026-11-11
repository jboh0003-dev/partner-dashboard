import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCachedViewerAuthContext } from "@/lib/auth/require-admin";
import {
  fetchContactsList, fetchBouncedContactIds, normalizeContactsRoleFilter
} from "@/lib/contacts/contacts-list-query";
import { parseContactListView } from "@/lib/contacts/contact-views";
import {
  buildPartnerDbWorkbook, type PartnerDbMetadata
} from "@/lib/contacts/partner-db-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await getCachedViewerAuthContext();
    if (!auth.user) {
      return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
    }
    const params = request.nextUrl.searchParams;
    const view = parseContactListView(params.get("view"));
    const supabase = createAdminClient();
    const bouncedContactIds = view === "bounced" ? await fetchBouncedContactIds(supabase) : undefined;
    const input = {
      view,
      q: params.get("q") || undefined,
      role: normalizeContactsRoleFilter(params.get("role")),
      position: params.get("position") || undefined,
      partnerId: params.get("partnerId") || undefined,
      regionGroup: params.get("regionGroup") || undefined,
      region: params.get("region") || undefined,
      bouncedContactIds
    };
    const [list, partnersRes, focalRes] = await Promise.all([
      fetchContactsList(supabase, input),
      supabase.from("partners").select("id,external_no,grade,grade_original,grade_override,grade_change_raw,contract_start_date,contract_contact_name,region_group")
        .is("deleted_at", null).or("is_active.is.null,is_active.eq.true").limit(5000),
      supabase.from("partner_contacts").select("id").eq("is_primary", true).eq("is_active", true)
        .is("deleted_at", null).is("merged_into_contact_id", null).limit(5000)
    ]);
    if (list.error) throw new Error(list.error);
    if (partnersRes.error) throw new Error(partnersRes.error.message);
    if (focalRes.error) throw new Error(focalRes.error.message);
    const partners = new Map<string, PartnerDbMetadata>(
      ((partnersRes.data ?? []) as PartnerDbMetadata[]).map(p => [p.id, p])
    );
    const focalIds = new Set<string>((focalRes.data ?? []).map(r => String(r.id)));
    const workbook = buildPartnerDbWorkbook(list.rows, partners, focalIds);
    const bytes = await workbook.xlsx.writeBuffer();
    const body = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(body).set(bytes);
    const filename = "PartnerConnect_파트너DB_인력현황_" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + ".xlsx";
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename*=UTF-8''" + encodeURIComponent(filename),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "인력 엑셀 다운로드 실패" },
      { status: 500 }
    );
  }
}
