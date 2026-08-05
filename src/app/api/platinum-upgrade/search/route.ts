import { NextResponse } from "next/server";
import { requireUser, unauthorizedJson } from "@/lib/auth/require-user";
import {
  fetchPartnerForPlatinumUpgrade,
  searchPartnersForPlatinumUpgrade
} from "@/lib/platinum-upgrade/search";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return unauthorizedJson(auth.message);

    const url = new URL(request.url);
    const partnerId = url.searchParams.get("partnerId")?.trim();
    if (partnerId) {
      const partner = await fetchPartnerForPlatinumUpgrade(partnerId);
      if (!partner) {
        return NextResponse.json(
          { ok: false, message: "파트너를 찾을 수 없습니다." },
          { status: 404 }
        );
      }
      return NextResponse.json({ ok: true, partner });
    }

    const q = url.searchParams.get("q") ?? "";
    const limitRaw = Number(url.searchParams.get("limit") ?? "15");
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 30) : 15;
    const partners = await searchPartnersForPlatinumUpgrade(q, limit);
    return NextResponse.json({ ok: true, partners });
  } catch (error) {
    const message = error instanceof Error ? error.message : "검색 실패";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
