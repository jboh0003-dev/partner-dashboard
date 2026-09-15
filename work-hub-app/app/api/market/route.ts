import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const headers = {
  'user-agent': 'Mozilla/5.0 WorkHub/1.0',
  accept: 'application/json,text/plain,*/*',
};

async function getJson(url: string) {
  const res = await fetch(url, { headers, cache: 'no-store' });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

export async function GET() {
  try {
    const [kospiRt, fxRaw, topRaw] = await Promise.all([
      getJson('https://polling.finance.naver.com/api/realtime/domestic/index/KOSPI'),
      getJson('https://api.stock.naver.com/marketindex/exchange/FX_USDKRW/prices?page=1&pageSize=1'),
      getJson('https://m.stock.naver.com/api/stocks/marketValue/KOSPI?page=1&pageSize=10'),
    ]);

    const kospi = kospiRt?.datas?.[0] ?? kospiRt?.result?.datas?.[0] ?? kospiRt;
    const fx = Array.isArray(fxRaw) ? fxRaw[0] : fxRaw?.result?.[0] ?? fxRaw?.result ?? fxRaw;
    const stocks = (topRaw?.stocks ?? []).map((s: any, index: number) => ({
      rank: index + 1,
      code: s.itemCode,
      name: s.stockName,
      price: s.closePrice,
      change: s.fluctuationsRatio,
      marketValue: s.marketValue,
      volume: s.accumulatedTradingVolume,
      highlighted: s.itemCode === '005380' || s.stockName === '현대차',
    }));

    const hyundai = stocks.find((s: any) => s.highlighted) ?? null;

    return NextResponse.json({
      ok: true,
      updatedAt: new Date().toISOString(),
      kospi: {
        value: kospi?.closePrice ?? kospi?.close ?? null,
        change: kospi?.fluctuationsRatio ?? kospi?.changeRate ?? null,
        diff: kospi?.compareToPreviousClosePrice ?? null,
      },
      usdkrw: {
        value: fx?.closePrice ?? fx?.close ?? null,
        change: fx?.fluctuationsRatio ?? fx?.changeRate ?? null,
        tradedAt: fx?.localTradedAt ?? null,
      },
      stocks,
      hyundai,
      source: 'NAVER Finance JSON endpoints',
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    console.error('market api error', error);
    return NextResponse.json({ ok: false, message: '실시간 시세를 불러오지 못했습니다.' }, { status: 502 });
  }
}
