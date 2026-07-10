import { NextResponse } from "next/server";
import { searchPartnersGlobal } from "@/lib/partners/global-search";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const limitRaw = Number(url.searchParams.get("limit") ?? "10");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 20) : 10;

  const partners = await searchPartnersGlobal(q, limit);
  return NextResponse.json({ partners });
}
