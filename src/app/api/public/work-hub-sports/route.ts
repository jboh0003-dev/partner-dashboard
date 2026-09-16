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
  const from = seoulDate(-2), to = seoulDate(7);
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
  const korean = all.filter(g => (g.koreanPlayers?.length ?? 0) > 0)
    .filter((g, i, arr) => arr.findIndex(x => x.id === g.id) === i)
    .sort((a,b) => a.date.localeCompare(b.date));
  return { epl, korean };
}

async function fetchKbo() {
  const day = seoulDate();
  const url = `https://api-gw.sports.naver.com/schedule/games?fields=basic,schedule,baseball&categoryId=kbo&fromDate=${day}&toDate=${day}&size=500`;
  const raw = await getJson(url, {
    "User-Agent": "Mozilla/5.0 WorkHub/1.0",
    Referer: "https://m.sports.naver.com/kbaseball/schedule/index",
    Accept: "application/json",
  });
  const games = raw?.result?.games ?? raw?.games ?? [];
  const status = (code: any) => {
    const s = String(code ?? "0");
    if (s === "1" || s === "LIVE") return "live";
    if (s === "3" || s === "RESULT") return "final";
    if (s === "4") return "cancelled";
    if (s === "5") return "postponed";
    return "scheduled";
  };
  return games.map((g: any) => ({
    id: String(g.gameId ?? ""), date: day,
    time: String(g.gameDateTime ?? "").slice(11,16) || "-",
    stadium: String(g.stadium ?? g.stadiumName ?? ""),
    homeCode: String(g.homeTeamCode ?? g.homeTeamId ?? ""),
    awayCode: String(g.awayTeamCode ?? g.awayTeamId ?? ""),
    home: String(g.homeTeamName ?? TEAM_NAMES[String(g.homeTeamCode ?? g.homeTeamId ?? "")] ?? g.homeTeamCode ?? "-"),
    away: String(g.awayTeamName ?? TEAM_NAMES[String(g.awayTeamCode ?? g.awayTeamId ?? "")] ?? g.awayTeamCode ?? "-"),
    homeScore: g.homeTeamScore != null ? Number(g.homeTeamScore) : null,
    awayScore: g.awayTeamScore != null ? Number(g.awayTeamScore) : null,
    status: status(g.statusCode),
    statusInfo: String(g.statusInfo ?? ""),
    gameId: String(g.gameId ?? ""),
  }));
}

export async function GET() {
  const [kboRes, soccerRes] = await Promise.allSettled([fetchKbo(), fetchSoccer()]);
  const kbo = kboRes.status === "fulfilled" ? kboRes.value : [];
  const soccer = soccerRes.status === "fulfilled" ? soccerRes.value : { epl: [], korean: [] };
  return NextResponse.json({
    ok: kboRes.status === "fulfilled" || soccerRes.status === "fulfilled",
    updatedAt: new Date().toISOString(),
    kbo,
    soccer,
    sources: { kbo: "NAVER Sports", soccer: "ESPN Scoreboard" },
    koreanWatch: KOREAN_WATCH.map(({player,team}) => ({player,team})),
  }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
