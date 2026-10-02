import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Holiday = {
  date: string;
  localName?: string;
  name?: string;
  global?: boolean;
  counties?: string[] | null;
  launchYear?: number | null;
  types?: string[];
};

const KO_NAMES: Record<string,string> = {
  "New Year's Day": "신정",
  "Korean New Year": "설날",
  "Seollal": "설날",
  "Independence Movement Day": "삼일절",
  "Children's Day": "어린이날",
  "Buddha's Birthday": "부처님오신날",
  "Memorial Day": "현충일",
  "Liberation Day": "광복절",
  "Chuseok": "추석",
  "National Foundation Day": "개천절",
  "Hangul Day": "한글날",
  "Christmas Day": "성탄절"
};

export async function GET(req: NextRequest) {
  const yearParam = Number(req.nextUrl.searchParams.get("year"));
  const year = Number.isInteger(yearParam) && yearParam >= 2020 && yearParam <= 2035
    ? yearParam
    : new Date().getFullYear();

  try {
    const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/KR`, {
      headers: { Accept: "application/json", "User-Agent": "WorkHub/1.0" },
      next: { revalidate: 60 * 60 * 12 }
    });
    if (!res.ok) throw new Error(`Holiday API ${res.status}`);
    const data = (await res.json()) as Holiday[];
    const holidays = data.map((h) => ({
      date: h.date,
      name: KO_NAMES[h.name || ""] || h.localName || h.name || "공휴일",
      sourceName: h.name || "",
      localName: h.localName || "",
      types: h.types || []
    }));
    return NextResponse.json(
      { ok: true, year, holidays, source: "Nager.Date" },
      { headers: { "Cache-Control": "public, s-maxage=43200, stale-while-revalidate=86400" } }
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, year, holidays: [], error: error instanceof Error ? error.message : "holiday fetch failed" },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}
