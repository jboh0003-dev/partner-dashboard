import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const headers = {
  "user-agent": "Mozilla/5.0 WorkHub/1.0",
  accept: "application/json,text/plain,*/*",
};

async function getJson(url: string) {
  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/,/g, "").replace(/%/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET() {
  try {
    const [kospiRaw, fxRaw, topRaw, hyundaiRaw] = await Promise.all([
      getJson("https://polling.finance.naver.com/api/realtime/domestic/index/KOSPI"),
      getJson("https://api.stock.naver.com/marketindex/exchange/FX_USDKRW/prices?page=1&pageSize=1"),
      getJson("https://m.stock.naver.com/api/stocks/marketValue/KOSPI?page=1&pageSize=10"),
      getJson("https://m.stock.naver.com/api/stock/005380/basic"),
    ]);

    const kospi = kospiRaw?.datas?.[0] ?? kospiRaw?.result?.datas?.[0] ?? kospiRaw;
    const fx = Array.isArray(fxRaw) ? fxRaw[0] : fxRaw?.result?.[0] ?? fxRaw?.result ?? fxRaw;
    const topStocks = Array.isArray(topRaw?.stocks) ? topRaw.stocks : [];

    const stocks = topStocks.map((s: any, index: number) => ({
      rank: index + 1,
      symbol: `${s.itemCode ?? ""}.KS`,
      code: s.itemCode ?? "",
      name: s.stockName ?? s.itemName ?? "-",
      price: num(s.closePrice ?? s.currentPrice),
      changePct: num(s.fluctuationsRatio ?? s.changeRate),
      marketValue: s.marketValue ?? null,
    }));

    const hyundai = {
      rank: null,
      symbol: "005380.KS",
      code: "005380",
      name: "현대차",
      price: num(hyundaiRaw?.closePrice ?? hyundaiRaw?.currentPrice),
      changePct: num(hyundaiRaw?.fluctuationsRatio ?? hyundaiRaw?.changeRate),
      marketValue: hyundaiRaw?.marketValue ?? null,
    };

    return NextResponse.json(
      {
        ok: true,
        updatedAt: new Date().toISOString(),
        source: "NAVER Finance JSON",
        kospi: {
          price: num(kospi?.closePrice ?? kospi?.close),
          changePct: num(kospi?.fluctuationsRatio ?? kospi?.changeRate),
        },
        usdkrw: {
          price: num(fx?.closePrice ?? fx?.close),
          changePct: num(fx?.fluctuationsRatio ?? fx?.changeRate),
        },
        stocks,
        hyundai,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("[work-hub-market]", error);
    return NextResponse.json(
      { ok: false, message: "실시간 시장 데이터를 불러오지 못했습니다." },
      { status: 502, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
