import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import postgres from "postgres";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const COOKIE = "__Host-connect_continuity";
const LIFETIME = 8 * 60 * 60;
const PROJECT = "mtpnkedvqenddwciazce";
const failures = new Map<string, { count: number; until: number }>();
let db: ReturnType<typeof postgres> | null = null;
const hash = (value: string) => createHash("sha256").update(value).digest();
const equal = (a: string, b: string) => timingSafeEqual(hash(a), hash(b));
const signature = (value: string, secret: string) => createHmac("sha256", secret).update(value).digest("base64url");
function authorized(request: NextRequest, secret: string) {
  try {
    const token = request.cookies.get(COOKIE)?.value || "";
    if (token.length > 1024) return false;
    const parts = token.split(".");
    if (parts.length !== 2 || !equal(parts[1], signature(parts[0], secret))) return false;
    const value = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    const now = Math.floor(Date.now() / 1000);
    return value.audience === "partner-connect-continuity" && Number.isInteger(value.exp) && value.exp > now && value.exp <= now + LIFETIME;
  } catch { return false; }
}
function secured(response: NextResponse, nonce?: string) {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Vary", "Cookie");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Frame-Options", "DENY");
  if (nonce) response.headers.set("Content-Security-Policy", `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`);
  return response;
}
const answer = (value: unknown, status = 200) => secured(NextResponse.json(value, { status }));
function sessionSecret() {
  const secret = process.env.CONNECT_SESSION_SECRET || "";
  const expected = process.env.CONNECT_ACCESS_CODE_SHA256 || "";
  return { secret, expected, ready: secret.length >= 48 && /^[0-9a-f]{64}$/.test(expected) };
}
function sameOrigin(request: NextRequest) {
  try { return new URL(request.headers.get("origin") || "").host === request.headers.get("host"); } catch { return false; }
}
function connect() {
  if (db) return db;
  const raw = process.env.CONNECT_DATABASE_URL;
  if (!raw) throw new Error("DATABASE_NOT_CONFIGURED");
  const url = new URL(raw);
  const user = decodeURIComponent(url.username);
  const correctHost = url.hostname === `db.${PROJECT}.supabase.co` || (/^aws-[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname) && user.endsWith(`.${PROJECT}`));
  if (!correctHost || !["postgres:", "postgresql:"].includes(url.protocol) || url.pathname !== "/postgres") throw new Error("DATABASE_URL_INVALID");
  for (const key of ["sslmode", "ssl", "sslcert", "sslkey", "sslrootcert"]) url.searchParams.delete(key);
  db = postgres(url.toString(), {
    max: 1, idle_timeout: 5, connect_timeout: 5, prepare: false,
    ssl: process.env.CONNECT_DB_CA_PEM ? { rejectUnauthorized: true, ca: process.env.CONNECT_DB_CA_PEM } : { rejectUnauthorized: true },
    connection: { statement_timeout: 5000, application_name: "partner-connect-continuity" },
    onnotice: () => undefined
  });
  return db;
}
async function read(kind: string, params: URLSearchParams): Promise<unknown> {
  const q = (params.get("q") || "").slice(0, 100);
  const page = Math.max(1, Math.min(1000, Number.parseInt(params.get("page") || "1", 10) || 1));
  const id = params.get("id") || "";
  if (["partner", "contacts"].includes(kind) && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error("INVALID_ID");
  // All SQL is fixed and parameterized. This endpoint never performs writes.
  return connect().begin("read only", async tx => {
    if (kind === "summary") {
      const rows = await tx.unsafe("select now() as checked_at, (select count(*)::int from public.partners where deleted_at is null and coalesce(is_active,true)) as partners, (select count(*)::int from public.partner_contacts where deleted_at is null) as contacts, (select count(*)::int from public.trainings where deleted_at is null) as trainings");
      return rows[0];
    }
    if (kind === "partners") {
      const where = "deleted_at is null and coalesce(is_active,true) and ($1='' or company_name ilike '%'||$1||'%')";
      const rows = await tx.unsafe(`select id,company_name,grade,grade_override,region,employee_count,engineer_count from public.partners where ${where} order by company_name,id limit $2 offset $3`, [q, 50, (page - 1) * 50]);
      const total = await tx.unsafe(`select count(*)::int as n from public.partners where ${where}`, [q]);
      return { rows, page, total: total[0].n, limit: 50 };
    }
    if (kind === "partner") {
      const rows = await tx.unsafe("select id,company_name,grade,grade_override,region,employee_count,engineer_count,contract_start_date,contract_end_date,ceo_name,address,website,main_phone,status from public.partners where id=$1::uuid and deleted_at is null", [id]);
      return rows[0] || null;
    }
    if (kind === "contacts") {
      const rows = await tx.unsafe("select id,name,department,position,role_type,email,phone,is_primary from public.partner_contacts where partner_id=$1::uuid and deleted_at is null order by is_primary desc nulls last,name,id limit 200", [id]);
      return { rows };
    }
    if (kind === "trainings") {
      const where = "deleted_at is null and ($1='' or training_name ilike '%'||$1||'%' or coalesce(product_name,'') ilike '%'||$1||'%')";
      const rows = await tx.unsafe(`select id,training_name,training_type,product_name,start_date,end_date from public.trainings where ${where} order by start_date desc nulls last,id limit $2 offset $3`, [q, 50, (page - 1) * 50]);
      const total = await tx.unsafe(`select count(*)::int as n from public.trainings where ${where}`, [q]);
      return { rows, page, total: total[0].n, limit: 50 };
    }
    throw new Error("UNKNOWN_VIEW");
  });
}
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return answer({ ok: false, code: "ORIGIN_REJECTED" }, 403);
  const cfg = sessionSecret();
  if (!cfg.ready) return answer({ ok: false, code: "ACCESS_NOT_CONFIGURED" }, 503);
  const mode = request.nextUrl.searchParams.get("mode");
  if (mode === "logout") {
    const response = answer({ ok: true });
    response.cookies.set(COOKIE, "", { path: "/", httpOnly: true, secure: true, sameSite: "strict", maxAge: 0 });
    return response;
  }
  if (mode !== "login") return answer({ ok: false, code: "METHOD_NOT_ALLOWED" }, 405);
  const key = hash(request.headers.get("x-vercel-forwarded-for") || "unknown").toString("hex");
  const now = Date.now();
  const previous = failures.get(key);
  if (previous && previous.until > now && previous.count >= 8) return answer({ ok: false, code: "RATE_LIMITED" }, 429);
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 1024) return answer({ ok: false, code: "INVALID_REQUEST" }, 400);
    const value = JSON.parse(raw);
    const code = typeof value.code === "string" ? value.code.trim() : "";
    if (!code || code.length > 128 || !equal(hash(code).toString("hex"), cfg.expected)) {
      failures.set(key, { count: previous && previous.until > now ? previous.count + 1 : 1, until: previous && previous.until > now ? previous.until : now + 600000 });
      if (failures.size > 2000) for (const [k, v] of failures) if (v.until < now) failures.delete(k);
      return answer({ ok: false, code: "INVALID_ACCESS_CODE" }, 401);
    }
    failures.delete(key);
    const payload = Buffer.from(JSON.stringify({ audience: "partner-connect-continuity", exp: Math.floor(now / 1000) + LIFETIME })).toString("base64url");
    const response = answer({ ok: true });
    response.cookies.set(COOKIE, `${payload}.${signature(payload, cfg.secret)}`, { path: "/", httpOnly: true, secure: true, sameSite: "strict", maxAge: LIFETIME });
    return response;
  } catch { return answer({ ok: false, code: "INVALID_REQUEST" }, 400); }
}
export async function GET(request: NextRequest) {
  const cfg = sessionSecret();
  const mode = request.nextUrl.searchParams.get("mode") || "page";
  const configured = Boolean(process.env.CONNECT_DATABASE_URL);
  if (mode === "health") return answer({ ok: true, build: "connect-continuity-20261026-1", authConfigured: cfg.ready, databaseConfigured: configured });
  if (!cfg.ready) return answer({ ok: false, code: "ACCESS_NOT_CONFIGURED" }, 503);
  const signedIn = authorized(request, cfg.secret);
  if (mode === "data") {
    if (!signedIn) return answer({ ok: false, code: "AUTH_REQUIRED" }, 401);
    const kind = request.nextUrl.searchParams.get("kind") || "summary";
    if (!["summary", "partners", "partner", "contacts", "trainings"].includes(kind)) return answer({ ok: false, code: "UNKNOWN_VIEW" }, 400);
    try { return answer({ ok: true, readOnly: true, data: await read(kind, request.nextUrl.searchParams) }); }
    catch (error) {
      const message = error instanceof Error ? error.message : "";
      const code = ["DATABASE_NOT_CONFIGURED", "DATABASE_URL_INVALID", "INVALID_ID"].includes(message) ? message : "DATABASE_CONNECTION_FAILED";
      console.error("Continuity request failed", code);
      return answer({ ok: false, code }, code === "INVALID_ID" ? 400 : 503);
    }
  }
  if (mode !== "page") return answer({ ok: false, code: "UNKNOWN_VIEW" }, 400);
  const nonce = randomBytes(18).toString("base64");
  return secured(new NextResponse(pageHtml(nonce, signedIn, configured), { headers: { "Content-Type": "text/html; charset=utf-8" } }), nonce);
}
function pageHtml(nonce: string, signedIn: boolean, configured: boolean) {
  const setup = `<section class="setup"><h2>원본 DB 연결 설정이 필요합니다.</h2><p>임시 접속은 가능하지만, 아직 원본 자료를 읽을 연결정보가 설정되지 않았습니다. 자료가 없는 것으로 표시하지 않습니다.</p><ol><li>Supabase의 <b>partner-dashboard → Connect → Transaction pooler</b>에서 연결 문자열을 확인합니다.</li><li>Vercel의 <b>partner-dashboard → Settings → Environment Variables</b>에서 <code>CONNECT_DATABASE_URL</code>을 Production 환경의 비밀변수로 추가합니다.</li><li>DB 비밀번호를 연결 문자열에 반영하고 재배포합니다. 비밀번호는 채팅에 보내지 마세요.</li></ol><p class="muted">DB 연결은 아직 검증되지 않았습니다. 연결 실패 시 호스트·비밀번호·SSL 인증서 설정을 확인해야 합니다.</p></section>`;
  const login = `<main class="login-shell"><section class="login"><small>OKESTRO · CONTINUITY</small><h1>Partner <em>Connect</em></h1><p>Supabase 로그인과 분리된 임시 조회 공간입니다.</p><form id="loginForm"><label for="code">임시 접속 코드</label><input id="code" type="password" autocomplete="current-password" required maxlength="128"><div id="error" role="alert"></div><button id="loginButton" class="primary">들어가기</button></form><p class="muted">기존 비밀번호 대신 별도로 전달받은 임시 코드를 입력하세요. 이 화면에는 회사 데이터가 포함되어 있지 않습니다.</p></section></main>`;
  const browser = `<div class="stats"><div><span>파트너</span><strong id="partnersCount">—</strong></div><div><span>인력</span><strong id="contactsCount">—</strong></div><div><span>교육</span><strong id="trainingsCount">—</strong></div></div><section class="card"><div class="toolbar"><nav><button data-tab="partners" class="active">파트너</button><button data-tab="trainings">교육</button></nav><form id="searchForm"><input id="search" maxlength="100" aria-label="검색" placeholder="회사명 또는 교육명 검색"><button class="primary">검색</button></form></div><div class="table-wrap"><table><thead id="head"></thead><tbody id="rows"></tbody></table></div><div class="pager"><span id="pageInfo"></span><button id="prev">이전</button><button id="next">다음</button></div></section><dialog id="detail"><header><h2 id="detailTitle">상세</h2><button id="closeDetail">닫기</button></header><div id="detailBody"></div></dialog>`;
  const workspace = `<header><div class="brand">Partner <em>Connect</em></div><div><span class="tag">임시 · 읽기 전용</span><button id="logout">나가기</button></div></header><main class="container"><div class="notice">이 경로는 조회만 제공합니다. 수정·삭제·계약서 다운로드는 제공하지 않습니다.<div id="connection" class="muted">${configured ? "DB 연결 확인 중" : "DB 연결 미설정"}</div></div><div id="error" role="alert"></div>${configured ? browser : setup}</main>`;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Partner Connect · 임시 조회</title><style nonce="${nonce}">
*{box-sizing:border-box}body{margin:0;background:#f6f8fc;color:#17263e;font:14px -apple-system,BlinkMacSystemFont,"Segoe UI","Malgun Gothic",sans-serif}button,input{font:inherit}button{border:1px solid #d4dfed;border-radius:8px;background:#fff;color:#395273;padding:10px 14px;cursor:pointer}button:disabled{opacity:.4;cursor:default}input{border:1px solid #cad8eb;border-radius:8px;padding:12px;outline:none;min-width:0}input:focus{border-color:#316fe4}.primary{background:#2563dc;border-color:#2563dc;color:#fff;font-weight:700}.login-shell{min-height:100vh;display:grid;place-items:center;padding:24px}.login{width:min(440px,100%);padding:36px;background:#fff;border:1px solid #dce5f1;border-radius:20px;box-shadow:0 18px 50px #1c38620d}.login h1{font-size:28px;letter-spacing:-1px}.login small{font-weight:800;color:#3766b9;letter-spacing:1.5px;font-size:10px}em{font-style:normal;color:#2463dc}.login p{line-height:1.8;color:#6e819e}.login label{display:block;font-size:12px;font-weight:700;margin:25px 0 9px}.login input,.login .primary{width:100%}.login .primary{margin:16px 0}.muted{font-size:12px;color:#7589a5;line-height:1.8}.login .muted{padding-top:14px;border-top:1px solid #edf1f7}header{display:flex;align-items:center;justify-content:space-between;gap:20px;background:#fff;padding:22px max(22px,calc((100vw - 1250px)/2));border-bottom:1px solid #e0e7f1}.brand{font-size:24px;font-weight:800;letter-spacing:-.8px}.tag{font-size:11px;padding:6px 10px;background:#edf3ff;border:1px solid #dbe7fa;border-radius:7px;margin-right:12px}.container{max-width:1294px;margin:auto;padding:26px 22px}.notice{border:1px solid #d4e2fa;background:#edf3ff;padding:15px 18px;border-radius:12px;font-size:13px;line-height:1.8}.setup{margin-top:22px;padding:28px;border:1px solid #dce5f1;border-radius:14px;background:#fff;line-height:1.9}.setup h2{font-size:22px}.setup li{margin:15px 0}code{font-size:12px}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:15px;margin:20px 0}.stats>div{background:#fff;border:1px solid #dfe7f2;border-radius:12px;padding:20px}.stats span{display:block;color:#6f829f;font-size:12px}.stats strong{display:block;font-size:32px;margin-top:6px}.card{background:#fff;border:1px solid #dfe7f2;border-radius:13px;overflow:hidden}.toolbar{display:flex;justify-content:space-between;align-items:center;gap:15px;flex-wrap:wrap;padding:18px}.toolbar nav{display:flex;gap:6px}.toolbar nav button{border:0;background:#f0f4fa}.toolbar nav .active{background:#e4edff;color:#205ccc;font-weight:700}.toolbar form{display:flex;gap:7px}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;text-align:left;white-space:nowrap}th{font-size:11px;color:#6f829d;background:#f7faff;padding:13px 18px}td{border-top:1px solid #edf1f7;padding:13px 18px;font-size:13px}.link{padding:0;border:0;background:none;color:#255dcc;font-weight:700}.pager{padding:16px;display:flex;justify-content:flex-end;align-items:center;gap:9px;border-top:1px solid #e5ebf5;font-size:12px}.empty{text-align:center;white-space:normal;padding:50px 20px;color:#7c8ea8}#error:not(:empty){margin:15px 0;border:1px solid #f1ced6;border-radius:9px;padding:12px;color:#a8293c;background:#fff2f4;line-height:1.7}dialog{padding:0;border:1px solid #d6e1ef;border-radius:15px;width:min(960px,calc(100vw - 28px));box-shadow:0 20px 100px #14315d44}dialog::backdrop{background:#16284266}dialog header{padding:20px}dialog h2{margin:0;font-size:21px}#detailBody{padding:22px;max-height:73vh;overflow:auto}.facts{display:grid;grid-template-columns:1fr 1fr;gap:14px 26px}.facts>div{border-bottom:1px solid #edf1f7;padding-bottom:12px;overflow-wrap:anywhere}.facts dt{font-size:11px;color:#7a8eaa;margin-bottom:7px}.facts dd{margin:0;line-height:1.7}h3{font-size:15px;margin-top:25px}@media(max-width:620px){.brand{font-size:19px}.tag{display:none}header{padding:16px}.container{padding:17px}.stats{gap:8px}.stats>div{padding:13px}.stats strong{font-size:26px}.toolbar form{width:100%}.toolbar input{flex:1;width:100px}.facts{grid-template-columns:1fr}.login{padding:27px}}
</style></head><body>${signedIn ? workspace : login}<script nonce="${nonce}">
'use strict';
const signedIn=${JSON.stringify(signedIn)},configured=${JSON.stringify(configured)},endpoint='/continuity';
const $=id=>document.getElementById(id);
async function api(mode,args={},body){const r=await fetch(endpoint+'?'+new URLSearchParams({mode,...args}),{method:body?'POST':'GET',cache:'no-store',credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{})});const x=await r.json();if(!r.ok||!x.ok)throw Object.assign(new Error(x.code||'REQUEST_FAILED'),{status:r.status,code:x.code});return Object.hasOwn(x,'data')?x.data:x;}
function errorText(e){if(e.code==='INVALID_ACCESS_CODE')return '접속 코드가 일치하지 않습니다.';if(e.code==='RATE_LIMITED')return '시도 횟수를 초과했습니다. 10분 후 다시 시도하세요.';if(e.code==='DATABASE_NOT_CONFIGURED')return 'DB 연결 설정이 아직 필요합니다.';if(e.code==='DATABASE_CONNECTION_FAILED'||e.code==='DATABASE_URL_INVALID')return '원본 DB에 연결하지 못했습니다. 연결 문자열·비밀번호·SSL 인증서를 확인해야 합니다.';return '요청을 처리하지 못했습니다.';}
const login=$('loginForm');
if(login)login.onsubmit=async e=>{e.preventDefault();$('error').textContent='';$('loginButton').disabled=true;try{await api('login',{}, {code:$('code').value});location.replace(endpoint);}catch(e){$('error').textContent=errorText(e);$('loginButton').disabled=false;}};
if(signedIn){$('logout').onclick=async()=>{try{await api('logout',{},{});location.replace(endpoint);}catch(e){$('error').textContent=errorText(e);}};}
if(signedIn&&configured){
let kind='partners',page=1,q='',serial=0;
const val=x=>x===null||x===undefined||x===''?'—':String(x);
const date=x=>x?String(x).slice(0,10):'—';
function cell(tr,value){const td=document.createElement('td');td.textContent=val(value);tr.appendChild(td);return td;}
function empty(text){$('rows').replaceChildren();const tr=document.createElement('tr'),td=cell(tr,text);td.colSpan=5;td.className='empty';$('rows').appendChild(tr);}
async function load(){const current=++serial;$('error').textContent='';empty('자료를 불러오는 중입니다.');$('prev').disabled=true;$('next').disabled=true;const titles=kind==='partners'?['파트너명','등급','지역','직원수','엔지니어수']:['교육명','제품','구분','시작일','종료일'];$('head').replaceChildren();const tr=document.createElement('tr');titles.forEach(x=>{const th=document.createElement('th');th.textContent=x;tr.appendChild(th);});$('head').appendChild(tr);try{const data=await api('data',{kind,q,page:String(page)});if(current!==serial)return;$('rows').replaceChildren();for(const x of data.rows){const row=document.createElement('tr');if(kind==='partners'){const td=cell(row,'');td.textContent='';const b=document.createElement('button');b.className='link';b.textContent=x.company_name;b.onclick=()=>detail(x.id);td.appendChild(b);[x.grade_override||x.grade,x.region,x.employee_count,x.engineer_count].forEach(v=>cell(row,v));}else [x.training_name,x.product_name,x.training_type,date(x.start_date),date(x.end_date)].forEach(v=>cell(row,v));$('rows').appendChild(row);}if(!data.rows.length)empty('검색 결과가 없습니다.');$('pageInfo').textContent='총 '+data.total+'건 · '+page+' / '+Math.max(1,Math.ceil(data.total/50));$('prev').disabled=page<=1;$('next').disabled=page*50>=data.total;}catch(e){if(current!==serial)return;if(e.status===401){location.replace(endpoint);return;}$('error').textContent=errorText(e);empty('자료를 조회하지 못했습니다.');}}
async function detail(id){$('detailTitle').textContent='상세';$('detailBody').textContent='불러오는 중';$('detail').showModal();try{const [p,c]=await Promise.all([api('data',{kind:'partner',id}),api('data',{kind:'contacts',id})]);$('detailBody').replaceChildren();if(!p){$('detailBody').textContent='파트너를 찾지 못했습니다.';return;}$('detailTitle').textContent=p.company_name;const dl=document.createElement('dl');dl.className='facts';for(const [label,value] of [['등급',p.grade_override||p.grade],['지역',p.region],['대표자',p.ceo_name],['전화',p.main_phone],['직원수',p.employee_count],['엔지니어수',p.engineer_count],['계약 시작일',date(p.contract_start_date)],['계약 종료일',date(p.contract_end_date)],['주소',p.address],['홈페이지',p.website]]){const group=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=val(value);group.append(dt,dd);dl.appendChild(group);}$('detailBody').appendChild(dl);const heading=document.createElement('h3');heading.textContent='인력';$('detailBody').appendChild(heading);const wrap=document.createElement('div');wrap.className='table-wrap';const table=document.createElement('table'),head=document.createElement('thead'),tr=document.createElement('tr');['이름','부서','직위','이메일','전화'].forEach(x=>{const th=document.createElement('th');th.textContent=x;tr.appendChild(th);});head.appendChild(tr);table.appendChild(head);const body=document.createElement('tbody');for(const x of c.rows){const tr=document.createElement('tr');[x.name,x.department,x.position,x.email,x.phone].forEach(v=>cell(tr,v));body.appendChild(tr);}table.appendChild(body);wrap.appendChild(table);$('detailBody').appendChild(wrap);const hint=document.createElement('p');hint.className='muted';hint.textContent=c.rows.length?'인력은 파트너당 최대 200건까지 표시됩니다.':'등록된 인력이 없습니다.';$('detailBody').appendChild(hint);}catch(e){$('detailBody').textContent=errorText(e);}}
$('closeDetail').onclick=()=>$('detail').close();$('searchForm').onsubmit=e=>{e.preventDefault();q=$('search').value.trim();page=1;load();};document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{kind=b.dataset.tab;q='';page=1;$('search').value='';document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));load();});$('prev').onclick=()=>{page--;load();};$('next').onclick=()=>{page++;load();};api('data',{kind:'summary'}).then(x=>{$('partnersCount').textContent=x.partners;$('contactsCount').textContent=x.contacts;$('trainingsCount').textContent=x.trainings;$('connection').textContent='원본 DB 조회 연결됨';}).catch(e=>{$('connection').textContent=errorText(e);});load();
}
</script></body></html>`;
}
