import { NextResponse } from "next/server";
import { searchPartnersForEventLink } from "@/lib/data/event-partners";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const partners = await searchPartnersForEventLink(q, 20);
  return NextResponse.json({ partners });
}
