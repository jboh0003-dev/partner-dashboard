import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SoccerGame = {
  id: string;
  league: string;
  leagueName: string;
  date: string;
  state: "pre" | "in" | "post";
  detail: string;
  home: { name: string; abbr?: string; score?: number | null; logo?: string | null };
  away: { name: string; abbr?: string; score?: number | null; logo?: string | null };
  koreanPlayers?: string[];
};

const TEAM_NAMES: Record<string,string> = {
  OB: "두산", LG: "LG", LT: "롯데", SK: "SSG", HH: "한화", SS: "삼성",
  HT: "KIA", NC: "NC", KT: "KT", WO: "키움",
};

const KOREAN_WATCH = [
  { player: "손흥민", team: "Los Angeles FC", aliases: ["Los Angeles FC", "LAFC"] },
  { player: "김민재", team: "Bayern Munich", aliases: ["Bayern Munich", "Bayern München", "Bayern"] },
  { player: "이강인", team: "Atletico Madrid", aliases: ["Atletico Madrid", "Atlético Madrid", "Atletico"] },
  { player: "황희찬", team: "Schalke 04", aliases: ["Schalke 04", "Schalke"] },
  { player: "황인범", team: "FC Porto", aliases: ["FC Porto", "Porto"] },
] as const;

const SOCCER_LEAGUES = [
  ["eng.1", "EPL"],
  ["usa.1", "MLS"],
  ["ger.1", "Bundesliga"],
  ["esp.1", "LaLiga"],
  ["por.1", "Primeira Liga"],
  ["uefa.champions", "UCL"],
] as const;

function seoulDate(offsetDays = 0) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(Date.now() + offsetDays * 86400000));
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function compact(d: string) { return d.replaceAll("-", ""); }
async function getJson(url: string, headers?: Record<string,string>) {
  const res = await fetch(url, { cache: "no-store", headers });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

function parseSoccerEvent(event: any, league: string, leagueName: string): SoccerGame | null {
  const comp = event?.competitions?.[0];
  if (!comp) return null;
  const home = comp.competitors?.find((c: any) => c.homeAway === "home");
  const away = comp.competitors?.find((c: any) => c.homeAway === "away");
  if (!home || !away) return null;
  const status = comp.status ?? event.status;
  const num = (v: any) => v == null || v === "" ? null : Number(v);
  const game: SoccerGame = {
    id: String(event.id), league, leagueName, date: event.date,
    state: status?.type?.state === "in" ? "in" : status?.type?.state === "post" ? "post" : "pre",
    detail: status?.type?.shortDetail ?? status?.type?.detail ?? "",
    home: { name: home.team?.displayName ?? home.team?.shortDisplayName ?? "-", abbr: home.team?.abbreviation, score: num(home.score), logo: home.team?.logo ?? null },
    away: { name: away.team?.displayName ?? away.team?.shortDisplayName ?? "-", abbr: away.team?.abbreviation, score: num(away.score), logo: away.team?.logo ?? null },
  };
  const players = KOREAN_WATCH.filter(w => w.aliases.some(a => game.home.name.includes(a) || game.away.name.includes(a))).map(w => w.player);
  if (players.length) game.koreanPlayers = players;
  return game;
}

async function fetchLeagueWindow(slug: string, name: string) {
  const base = `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard`;
  const seed = await getJson(base);
  const from = seoulDate(-3), to = seoulDate(7);
  const calendar: string[] = Array.isArray(seed?.leagues?.[0]?.calendar) ? seed.leagues[0].calendar : [];
  const dates = [...new Set(calendar.map((x: string) => String(x).slice(0,10)).filter((d: string) => d >= from && d <= to))];
  const payloads = await Promise.allSettled(dates.map(d => getJson(`${base}?dates=${compact(d)}`)));
  const games = payloads.flatMap(r => r.status === "fulfilled" ? (r.value?.events ?? []) : [])
    .map((e: any) => parseSoccerEvent(e, slug, name)).filter(Boolean) as SoccerGame[];
  return games.filter((g, i, arr) => arr.findIndex(x => x.id === g.id) === i);
}

async function fetchSoccer() {
  const results = await Promise.allSettled(SOCCER_LEAGUES.map(([slug,name]) => fetchLeagueWindow(slug,name)));
  const all = results.flatMap(r => r.status === "fulfilled" ? r.value : []);
  const epl = all.filter(g => g.league === "eng.1").sort((a,b) => a.date.localeCompare(b.date));
  const chelsea = epl.filter(g => g.home.name.includes("Chelsea") || g.away.name.includes("Chelsea"));
  const korean = all.filter(g => (g.koreanPlayers?.length ?? 0) > 0)
    .filter((g, i, arr) => arr.findIndex(x => x.id === g.id) === i)
    .sort((a,b) => a.date.localeCompare(b.date));
  return { epl, chelsea, korean };
}

async function fetchKbo() {
  const from = seoulDate(-3), to = seoulDate(1);
  const url = `https://api-gw.sports.naver.com/schedule/games?fields=basic,schedule,baseball&categoryId=kbo&fromDate=${from}&toDate=${to}&size=500`;
  const raw = await getJson(url, {
    "User-Agent": "Mozilla/5.0 WorkHub/1.0",
    Referer: "https://m.sports.naver.com/kbaseball/schedule/index",
    Accept: "application/json",
  });
  const games = raw?.result?.games ?? raw?.games ?? [];
  const status = (code: any, info: any) => {
    const s = String(code ?? "0").toUpperCase();
    const text = String(info ?? "").trim();
    const normalized = text.toLowerCase();
    if (/우천취소|경기취소|취소|cancel|노게임/.test(normalized)) return "cancelled";
    if (/연기|postpon/.test(normalized)) return "postponed";
    if (s === "1" || s === "LIVE") return "live";
    if (s === "3" || s === "RESULT") return "final";
    if (s === "4" || s === "CANCEL") return "cancelled";
    if (s === "5" || s === "POSTPONED") return "postponed";
    return "scheduled";
  };
  const parsed = games.map((g: any) => {
    const gameDateTime = String(g.gameDateTime ?? "");
    const date = gameDateTime.slice(0,10) || seoulDate();
    const homeCode = String(g.homeTeamCode ?? g.homeTeamId ?? "");
    const awayCode = String(g.awayTeamCode ?? g.awayTeamId ?? "");
    return {
      id: String(g.gameId ?? ""), date,
      time: gameDateTime.slice(11,16) || "-",
      stadium: String(g.stadium ?? g.stadiumName ?? ""),
      homeCode, awayCode,
      home: String(g.homeTeamName ?? TEAM_NAMES[homeCode] ?? homeCode ?? "-"),
      away: String(g.awayTeamName ?? TEAM_NAMES[awayCode] ?? awayCode ?? "-"),
      homeScore: g.homeTeamScore != null ? Number(g.homeTeamScore) : null,
      awayScore: g.awayTeamScore != null ? Number(g.awayTeamScore) : null,
      status: status(g.statusCode, g.statusInfo),
      statusInfo: String(g.statusInfo ?? ""),
      cancelReason: String(g.cancelReason ?? g.gameCancelReason ?? g.cancelInfo ?? ""),
      gameId: String(g.gameId ?? ""),
    };
  }).sort((a: any,b: any) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  const isLotte = (g: any) => g.homeCode === "LT" || g.awayCode === "LT" || g.home.includes("롯데") || g.away.includes("롯데");
  const favoriteFirst = (list: any[]) => [...list].sort((a,b) => {
    const af = isLotte(a) ? 0 : 1, bf = isLotte(b) ? 0 : 1;
    return af - bf || String(a.time).localeCompare(String(b.time));
  });
  const todayKey = seoulDate();
  const yesterdayKey = seoulDate(-1);
  const tomorrowKey = seoulDate(1);
  const lotte = parsed.filter(isLotte);
  const lottePast = lotte.filter((g: any) => g.date < todayKey).sort((a:any,b:any) => b.date.localeCompare(a.date));
  const lotteToday = lotte.filter((g: any) => g.date === todayKey);
  const lotteNext = lotte.filter((g: any) => g.date > todayKey && !["cancelled","postponed"].includes(g.status))
    .sort((a:any,b:any) => a.date.localeCompare(b.date));
  return {
    games: parsed,
    lotte,
    days: {
      yesterday: { date: yesterdayKey, games: favoriteFirst(parsed.filter((g:any) => g.date === yesterdayKey)) },
      today: { date: todayKey, games: favoriteFirst(parsed.filter((g:any) => g.date === todayKey)) },
      tomorrow: { date: tomorrowKey, games: favoriteFirst(parsed.filter((g:any) => g.date === tomorrowKey)) },
    },
    lotteSummary: {
      previous: lottePast[0] ?? null,
      today: lotteToday[0] ?? null,
      next: lotteNext[0] ?? null,
    },
  };
}

export async function GET() {
  const [kboRes, soccerRes] = await Promise.allSettled([fetchKbo(), fetchSoccer()]);
  const kbo = kboRes.status === "fulfilled" ? kboRes.value : {
    games: [], lotte: [], days: {
      yesterday: { date: seoulDate(-1), games: [] },
      today: { date: seoulDate(), games: [] },
      tomorrow: { date: seoulDate(1), games: [] },
    },
    lotteSummary: { previous: null, today: null, next: null },
  };
  const soccer = soccerRes.status === "fulfilled" ? soccerRes.value : { epl: [], chelsea: [], korean: [] };
  return NextResponse.json({
    ok: kboRes.status === "fulfilled" || soccerRes.status === "fulfilled",
    updatedAt: new Date().toISOString(),
    kbo: kbo.games,
    kboDays: kbo.days,
    favorites: { lotte: kbo.lotte, lotteSummary: kbo.lotteSummary, chelsea: soccer.chelsea },
    soccer,
    sources: { kbo: "NAVER Sports", soccer: "ESPN Scoreboard" },
    favoriteTeams: { baseball: "롯데 자이언츠", football: "Chelsea" },
    koreanWatch: KOREAN_WATCH.map(({player,team}) => ({player,team})),
  }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
