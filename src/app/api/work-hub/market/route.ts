import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const WATCHLIST = [
  { symbol: "005930.KS", name: "삼성전자" },
  { symbol: "000660.KS", name: "SK하이닉스" },
  { symbol: "373220.KS", name: "LG에너지솔루션" },
  { symbol: "207940.KS", name: "삼성바이오로직스" },
  { symbol: "005380.KS", name: "현대차" },
  { symbol: "005935.KS", name: "삼성전자우" },
  { symbol: "068270.KS", name: "셀트리온" },
  { symbol: "000270.KS", name: "기아" },
  { symbol: "105560.KS", name: "KB금융" },
  { symbol: "035420.KS", name: "NAVER" },
] as const;

async function fetchChart(symbol: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d&includePrePost=false`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json,text/plain,*/*",
    },
  });
  if (!res.ok) throw new Error(`market fetch failed: ${symbol} ${res.status}`);
  const body = await res.json();
  const result = body?.chart?.result?.[0];
  const meta = result?.meta ?? {};
  const closes: Array<number | null> = result?.indicators?.quote?.[0]?.close ?? [];
  const lastClose = [...closes].reverse().find((v) => typeof v === "number") ?? meta.regularMarketPrice ?? null;
  const prev = meta.chartPreviousClose ?? meta.previousClose ?? null;
  const change = typeof lastClose === "number" && typeof prev === "number" ? lastClose - prev : null;
  const changePct = typeof change === "number" && typeof prev === "number" && prev !== 0 ? (change / prev) * 100 : null;
  return {
    symbol,
    price: lastClose,
    previousClose: prev,
    change,
    changePct,
    currency: meta.currency ?? null,
    marketState: meta.marketState ?? null,
    exchangeName: meta.exchangeName ?? null,
  };
}

export async function GET() {
  try {
    const [kospi, usdkrw, ...stocks] = await Promise.all([
      fetchChart("^KS11"),
      fetchChart("KRW=X"),
      ...WATCHLIST.map(async (item) => ({ ...item, ...(await fetchChart(item.symbol)) })),
    ]);

    return NextResponse.json(
      {
        ok: true,
        updatedAt: new Date().toISOString(),
        kospi,
        usdkrw,
        stocks,
        note: "시장 데이터는 제공처 사정에 따라 지연될 수 있습니다.",
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("[work-hub market]", error);
    return NextResponse.json(
      { ok: false, message: "시장 데이터를 불러오지 못했습니다." },
      { status: 502, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
