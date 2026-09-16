"use client";

import { useEffect, useRef } from "react";

const STATUSES = [
  { value: "todo", icon: "○", label: "예정", cls: "todo" },
  { value: "doing", icon: "△", label: "진행", cls: "doing" },
  { value: "done", icon: "✓", label: "완료", cls: "done" },
  { value: "blocked", icon: "!", label: "이슈", cls: "blocked" },
  { value: "failed", icon: "×", label: "못함", cls: "failed" },
] as const;

type MarketStock = {
  rank?: number | null;
  symbol?: string;
  code?: string;
  name?: string;
  price?: number | null;
  changePct?: number | null;
  marketValue?: string | number | null;
};

type MarketPayload = {
  ok?: boolean;
  updatedAt?: string;
  source?: string;
  kospi?: { price?: number | null; changePct?: number | null };
  usdkrw?: { price?: number | null; changePct?: number | null };
  stocks?: MarketStock[];
  hyundai?: MarketStock | null;
  message?: string;
};

export default function WorkHubPage() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const observerRef = useRef<MutationObserver | null>(null);
  const patchTimerRef = useRef<number | null>(null);
  const marketTimerRef = useRef<number | null>(null);
  const marketRef = useRef<MarketPayload | null>(null);

  useEffect(() => {
    document.title = "Work Hub";
    loadMarket();
    marketTimerRef.current = window.setInterval(loadMarket, 60000);
    return () => {
      observerRef.current?.disconnect();
      if (patchTimerRef.current) window.clearTimeout(patchTimerRef.current);
      if (marketTimerRef.current) window.clearInterval(marketTimerRef.current);
    };
  }, []);

  async function loadMarket() {
    try {
      const res = await fetch("/api/public/work-hub-market", { cache: "no-store" });
      marketRef.current = await res.json();
    } catch {
      marketRef.current = { ok: false, message: "시세 연결 실패" };
    }
    renderMarket();
  }

  function fmtNum(value?: number | null, digits = 0) {
    if (typeof value !== "number" || Number.isNaN(value)) return "-";
    return value.toLocaleString("ko-KR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  function fmtPct(value?: number | null) {
    if (typeof value !== "number" || Number.isNaN(value)) return "-";
    return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
  }

  function closeMarket(doc: Document) {
    doc.querySelector("#wh-market-panel")?.classList.remove("expanded");
    doc.querySelector("#wh-market-backdrop")?.remove();
    doc.body.classList.remove("wh-market-open");
    const button = doc.querySelector<HTMLButtonElement>("#wh-market-expand");
    if (button) button.textContent = "⤢";
  }

  function toggleMarket(doc: Document) {
    const panel = doc.querySelector<HTMLElement>("#wh-market-panel");
    if (!panel) return;
    if (panel.classList.contains("expanded")) {
      closeMarket(doc);
      return;
    }
    panel.classList.add("expanded");
    doc.body.classList.add("wh-market-open");
    const button = panel.querySelector<HTMLButtonElement>("#wh-market-expand");
    if (button) button.textContent = "✕";
    const backdrop = doc.createElement("div");
    backdrop.id = "wh-market-backdrop";
    backdrop.addEventListener("click", () => closeMarket(doc));
    doc.body.appendChild(backdrop);
  }

  function renderMarket() {
    const doc = frameRef.current?.contentDocument;
    const panel = doc?.querySelector<HTMLElement>("#wh-market-panel");
    if (!doc || !panel) return;
    const expanded = panel.classList.contains("expanded");
    const data = marketRef.current;
    const stocks = data?.stocks ?? [];
    const hyundai = data?.hyundai ?? stocks.find((s) => s.name === "현대차") ?? null;
    const updated = data?.updatedAt
      ? new Date(data.updatedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
      : "-";
    const cls = (v?: number | null) => (typeof v === "number" && v > 0 ? "up" : typeof v === "number" && v < 0 ? "down" : "flat");

    panel.innerHTML = `
      <div class="wh-market-head">
        <div><b>MARKET BOARD</b><span>${updated} · 60초 자동 갱신</span></div>
        <div class="wh-market-tools"><button id="wh-market-refresh" type="button" title="새로고침">↻</button><button id="wh-market-expand" type="button" title="시황판 확대">${expanded ? "✕" : "⤢"}</button></div>
      </div>
      <div class="wh-index-grid">
        <div class="wh-index"><span>KOSPI</span><strong>${fmtNum(data?.kospi?.price, 2)}</strong><em class="${cls(data?.kospi?.changePct)}">${fmtPct(data?.kospi?.changePct)}</em></div>
        <div class="wh-index"><span>USD / KRW</span><strong>₩${fmtNum(data?.usdkrw?.price, 2)}</strong><em class="${cls(data?.usdkrw?.changePct)}">${fmtPct(data?.usdkrw?.changePct)}</em></div>
      </div>
      ${hyundai ? `<div class="wh-hyundai"><div><span>FEATURED PLAYER</span><b>현대차</b></div><strong>${fmtNum(hyundai.price)}</strong><em class="${cls(hyundai.changePct)}">${fmtPct(hyundai.changePct)}</em></div>` : ""}
      <div class="wh-stock-title"><b>KOSPI 시총 TOP 10</b><span>${data?.source ?? "LIVE DATA"}</span></div>
      <div class="wh-stock-list">${stocks.length ? stocks.map((s, i) => `
        <div class="wh-stock ${s.name === "현대차" ? "focus" : ""}">
          <span class="rank">${s.rank ?? i + 1}</span><b>${s.name ?? "-"}</b><span class="price">${fmtNum(s.price)}</span><em class="${cls(s.changePct)}">${fmtPct(s.changePct)}</em>
        </div>`).join("") : `<div class="wh-market-empty">${data?.message ?? "시장 데이터 불러오는 중…"}</div>`}</div>
      <div class="wh-market-note">실제 외부 시세 데이터를 서버에서 조회합니다. 제공처 정책에 따라 시세가 지연될 수 있습니다.</div>`;

    panel.querySelector<HTMLButtonElement>("#wh-market-refresh")?.addEventListener("click", loadMarket);
    panel.querySelector<HTMLButtonElement>("#wh-market-expand")?.addEventListener("click", () => toggleMarket(doc));
  }

  function installThemeButton(doc: Document) {
    const head = doc.querySelector<HTMLElement>(".headright");
    if (!head) return;
    let button = doc.querySelector<HTMLButtonElement>("#wh-theme-toggle");
    if (!button) {
      button = doc.createElement("button");
      button.id = "wh-theme-toggle";
      button.type = "button";
      button.className = "wh-theme-toggle";
      head.insertBefore(button, head.firstChild);
      button.addEventListener("click", () => {
        const dark = !doc.body.classList.contains("wh-dark");
        doc.body.classList.toggle("wh-dark", dark);
        localStorage.setItem("workhub_theme", dark ? "dark" : "light");
        button!.textContent = dark ? "☀ 라이트" : "☾ 다크";
      });
    }
    const dark = localStorage.getItem("workhub_theme") === "dark";
    doc.body.classList.toggle("wh-dark", dark);
    button.textContent = dark ? "☀ 라이트" : "☾ 다크";
  }

  function ensureStatusBar(doc: Document, select: HTMLSelectElement, allowed = STATUSES.map((s) => s.value)) {
    select.style.display = "none";
    const key = select.id || select.dataset.statusId || "status";
    let bar = select.nextElementSibling as HTMLElement | null;
    if (!bar || bar.dataset.whFor !== key) {
      bar = doc.createElement("div");
      bar.className = "wh-statusbar";
      bar.dataset.whFor = key;
      select.insertAdjacentElement("afterend", bar);
      STATUSES.filter((s) => allowed.includes(s.value)).forEach((status) => {
        const button = doc.createElement("button");
        button.type = "button";
        button.className = `wh-statusbtn ${status.cls}`;
        button.dataset.value = status.value;
        button.textContent = `${status.icon} ${status.label}`;
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          select.value = status.value;
          select.dispatchEvent(new Event("change", { bubbles: true }));
        });
        bar!.appendChild(button);
      });
    }
    bar.querySelectorAll<HTMLButtonElement>(".wh-statusbtn").forEach((button) => {
      button.classList.toggle("active", button.dataset.value === select.value);
    });
  }

  function patchReport(doc: Document) {
    const textarea = doc.querySelector<HTMLTextAreaElement>("#reportText");
    if (!textarea || textarea.dataset.whMail === "1") return;
    textarea.dataset.whMail = "1";
    const raw = textarea.value;
    const last = raw.match(/1\. 지난주 한 일[^\n]*\n([\s\S]*?)\n\n2\./)?.[1]?.trim() || "- 없음";
    const current = raw.match(/2\. 이번주 할 일[^\n]*\n([\s\S]*?)\n\n3\./)?.[1]?.trim() || "- 없음";
    const next = raw.match(/3\. 다음주 할 일[^\n]*\n([\s\S]*)$/)?.[1]?.trim() || "- 없음";
    textarea.value = [
      "안녕하세요, 금주 주간 리포트 보고드립니다.",
      "",
      "1. 파트너 현황",
      "계약 완료 파트너 수 : 직접 입력",
      "협의 중인 파트너 : 직접 입력",
      "신청서 수취 : 직접 입력",
      "",
      "2. 업무 현황",
      last.replace(/^- ✓ /gm, "- "),
      "",
      "3. 차주 주요 일정 및 계획",
      next.replace(/^- /gm, "- "),
      "",
      "[참고 · 이번주 진행 중]",
      current,
    ].join("\n");
  }

  function patchFrame() {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;
    doc.title = "Work Hub";

    const brand = doc.querySelector<HTMLElement>(".brand");
    if (brand) brand.innerHTML = 'Work Hub<small>MY WORKSPACE</small>';
    doc.querySelectorAll<HTMLButtonElement>(".nav button").forEach((button) => {
      button.style.display = ["dashboard", "planner", "report"].includes(button.dataset.view || "") ? "" : "none";
    });

    if (!doc.getElementById("work-hub-v3-style")) {
      const style = doc.createElement("style");
      style.id = "work-hub-v3-style";
      style.textContent = `
        :root{--wh-bg:#f3f6fb;--wh-card:#fff;--wh-ink:#132034;--wh-muted:#708096;--wh-line:#dfe6ef;--wh-blue:#3154f4}
        body{background:var(--wh-bg)!important;color:var(--wh-ink)!important;transition:.18s ease}.side{width:180px!important;background:linear-gradient(180deg,#0b1423,#12213a)!important;padding:28px 14px!important}.brand{font-size:24px!important}.brand small{font-size:9px!important;letter-spacing:1.8px!important;margin-top:6px!important}.nav button{font-size:14px!important;padding:14px 13px!important}.main{margin-left:180px!important;width:calc(100% - 180px)!important}header{height:82px!important;padding:0 26px!important;background:rgba(243,246,251,.94)!important;border-color:var(--wh-line)!important}header p{display:none!important}header h1{font-size:27px!important}.wrap{max-width:none!important;padding:18px 22px 30px!important}.hero{display:none!important}.saved{font-size:11px!important}.wh-theme-toggle{border:1px solid var(--wh-line);background:var(--wh-card);color:var(--wh-ink);padding:9px 11px;border-radius:10px;font-size:12px;font-weight:850;cursor:pointer}.metrics{grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:10px!important;margin-bottom:12px!important}.metric{padding:14px 16px!important;border:1px solid var(--wh-line)!important;background:var(--wh-card)!important;box-shadow:none!important}.metric span{font-size:11px!important;color:var(--wh-muted)!important}.metric strong{font-size:27px!important}.wh-dashboard-layout{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:14px;align-items:start}.wh-work-area{min-width:0}.board{grid-template-columns:.68fr 1.75fr .68fr!important;gap:11px!important}.col{min-height:530px!important;background:var(--wh-card)!important;border:1px solid var(--wh-line)!important;border-radius:16px!important;box-shadow:0 8px 26px rgba(16,24,40,.04)!important}.col:nth-child(2){border:2px solid #bfc9ff!important;box-shadow:0 16px 42px rgba(49,84,244,.11)!important}.colhead h3{font-size:17px!important}.col:nth-child(2) .colhead h3{font-size:24px!important;color:#2340af!important}.colhead p{font-size:11px!important}.count{font-size:11px!important;padding:6px 9px!important}.col:nth-child(2) .count{background:#e8edff!important;color:#3154d7!important}.quick input{font-size:14px!important;height:43px!important}.quick .btn{height:43px!important;font-size:16px!important}.task-list{padding:2px 10px 14px!important}.col:nth-child(2) .task-list{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.col:nth-child(2) .task{margin:0!important;min-width:0}.task{padding:13px!important;border-radius:12px!important;border-color:var(--wh-line)!important;background:var(--wh-card)!important}.tasktitle{font-size:15px!important;line-height:1.35!important}.col:nth-child(2) .tasktitle{font-size:17px!important}.iconbtn{font-size:11px!important}.chip{font-size:11px!important;padding:5px 7px!important}.statusrow{margin-top:10px!important}.statusrow>span:first-child{display:none!important}.statusrow select{display:none!important}.wh-statusbar{display:flex;gap:5px;flex-wrap:wrap;align-items:center;width:100%}.wh-statusbtn{border:1px solid #d8e0eb;background:var(--wh-card);color:#667085;border-radius:8px;padding:7px 9px;font-size:11px;font-weight:900;cursor:pointer;line-height:1;white-space:nowrap}.wh-statusbtn.todo.active{background:#edf1f6;color:#485467}.wh-statusbtn.doing.active{background:#fff5df;border-color:#ebce8a;color:#9a650d}.wh-statusbtn.done.active{background:#e8f8f1;border-color:#91d6bd;color:#087954}.wh-statusbtn.blocked.active{background:#fff0e5;border-color:#efb992;color:#aa5720}.wh-statusbtn.failed.active{background:#ffeded;border-color:#eda8ac;color:#b63c42}.panel,.reportbox{background:var(--wh-card)!important;border-color:var(--wh-line)!important}.workrow b{font-size:15px!important}.workrow p,.note{font-size:11px!important}.reportitem{font-size:13px!important}.reporttext{font-size:14px!important;background:var(--wh-card)!important;color:var(--wh-ink)!important}
        #wh-market-panel{position:sticky;top:98px;background:linear-gradient(180deg,#0b1423,#101d32);color:#eef4ff;border:1px solid #233551;border-radius:18px;padding:16px;min-height:520px;max-height:calc(100vh - 120px);overflow:auto;box-shadow:0 16px 44px rgba(8,17,31,.16);z-index:10}.wh-market-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:13px}.wh-market-head>div:first-child{display:flex;flex-direction:column}.wh-market-head b{font-size:16px;font-style:italic;letter-spacing:.8px}.wh-market-head span{font-size:9px;color:#7f91ac;margin-top:2px}.wh-market-tools{display:flex;gap:6px!important}.wh-market-tools button{border:1px solid #2b405d;background:#14233a;color:#dbe7fa;border-radius:9px;width:34px;height:34px;cursor:pointer;font-size:15px}.wh-index-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.wh-index{background:#132239;border:1px solid #273c58;border-radius:12px;padding:12px}.wh-index span{display:block;font-size:9px;color:#8395af}.wh-index strong{display:block;font-size:19px;margin:5px 0}.wh-index em,.wh-stock em,.wh-hyundai em{font-style:normal}.up{color:#ff6b72!important}.down{color:#61a7ff!important}.flat{color:#98a7ba!important}.wh-hyundai{margin:10px 0;background:linear-gradient(135deg,#25396d,#172952);border:1px solid #4969d9;border-radius:13px;padding:13px;display:grid;grid-template-columns:1fr auto;gap:3px 10px;align-items:center}.wh-hyundai div{grid-row:1/3}.wh-hyundai span{display:block;font-size:8px;color:#91a8ff;letter-spacing:1.2px}.wh-hyundai b{display:block;font-size:17px;margin-top:2px}.wh-hyundai strong{font-size:20px}.wh-stock-title{display:flex;justify-content:space-between;align-items:center;padding:8px 2px}.wh-stock-title b{font-size:12px}.wh-stock-title span{font-size:8px;color:#6e819d}.wh-stock{display:grid;grid-template-columns:24px 1fr 82px 54px;gap:6px;align-items:center;padding:10px 5px;border-top:1px solid #1f3048}.wh-stock .rank{font-size:11px;color:#61728c;font-weight:900}.wh-stock b{font-size:12px}.wh-stock .price{text-align:right;font-size:12px;font-weight:850}.wh-stock em{text-align:right;font-size:11px}.wh-stock.focus{background:#19294b;border-radius:8px;padding-left:7px;padding-right:7px}.wh-market-note{font-size:8px;color:#62738d;line-height:1.5;margin-top:9px}.wh-market-empty{padding:40px 10px;text-align:center;color:#72839e}.wh-market-open{overflow:hidden!important}#wh-market-backdrop{position:fixed;inset:0;background:rgba(3,8,18,.72);backdrop-filter:blur(5px);z-index:9997}#wh-market-panel.expanded{position:fixed!important;inset:4vh 5vw!important;z-index:9998!important;max-height:none!important;min-height:0!important;padding:24px!important;border-radius:22px!important;overflow:auto!important;box-shadow:0 30px 90px rgba(0,0,0,.55)!important}#wh-market-panel.expanded .wh-market-head b{font-size:26px}#wh-market-panel.expanded .wh-market-head span{font-size:12px}#wh-market-panel.expanded .wh-market-tools button{width:42px;height:42px;font-size:20px}#wh-market-panel.expanded .wh-index-grid{grid-template-columns:repeat(2,280px);justify-content:start}#wh-market-panel.expanded .wh-index strong{font-size:30px}#wh-market-panel.expanded .wh-hyundai{max-width:568px;padding:18px}#wh-market-panel.expanded .wh-hyundai b{font-size:22px}#wh-market-panel.expanded .wh-hyundai strong{font-size:28px}#wh-market-panel.expanded .wh-stock-list{display:grid;grid-template-columns:1fr 1fr;gap:0 22px;margin-top:8px}#wh-market-panel.expanded .wh-stock{padding:15px 8px}#wh-market-panel.expanded .wh-stock b,#wh-market-panel.expanded .wh-stock .price{font-size:16px}#wh-market-panel.expanded .wh-stock em{font-size:14px}
        body.wh-dark{--wh-bg:#07111f;--wh-card:#0e1a2b;--wh-ink:#eef4ff;--wh-muted:#8798b0;--wh-line:#233650;background:radial-gradient(circle at 55% -20%,rgba(49,84,244,.18),transparent 38%),#07111f!important}body.wh-dark header{background:rgba(7,17,31,.93)!important}body.wh-dark .col:nth-child(2){border-color:#4864ff!important;box-shadow:0 18px 52px rgba(0,0,0,.28)!important}body.wh-dark .col:nth-child(2) .colhead h3{color:#9fb1ff!important}body.wh-dark .chip{background:#17263c!important;color:#9aaac0!important}body.wh-dark .chip.cat{background:#1a2c5b!important;color:#9fb2ff!important}body.wh-dark .btn{background:#14243a!important;color:#eaf1ff!important;border-color:#2b405b!important}body.wh-dark .btn.primary{background:#3154f4!important;border-color:#5570ff!important}body.wh-dark input,body.wh-dark textarea,body.wh-dark select{background:#091421!important;color:#eef4ff!important;border-color:#2b3d55!important}body.wh-dark .saved{background:#0c2a22!important;border-color:#1d5543!important;color:#5fe0aa!important}body.wh-dark .wh-theme-toggle{background:#14243a;color:#eef4ff;border-color:#2b405b}
        @media(min-width:1900px){.col:nth-child(2) .task-list{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:1400px){.wh-dashboard-layout{grid-template-columns:minmax(0,1fr) 300px}.board{grid-template-columns:.72fr 1.55fr .72fr!important}.col:nth-child(2) .task-list{grid-template-columns:1fr}.tasktitle{font-size:14px!important}}@media(max-width:1150px){.wh-dashboard-layout{grid-template-columns:1fr}#wh-market-panel{position:static;max-height:none}.board{grid-template-columns:1fr!important}.col:nth-child(2){order:-1}.col:nth-child(2) .task-list{grid-template-columns:repeat(2,minmax(0,1fr))}.metrics{grid-template-columns:repeat(3,minmax(0,1fr))!important}}@media(max-width:760px){.side{width:72px!important}.main{margin-left:72px!important;width:calc(100% - 72px)!important}.brand small,.nav button span{display:none!important}.brand{font-size:15px!important}.wrap{padding:12px!important}.metrics{grid-template-columns:1fr 1fr!important}.col:nth-child(2) .task-list{grid-template-columns:1fr}.wh-theme-toggle{font-size:0}.wh-theme-toggle::after{content:'☾';font-size:16px}}
      `;
      doc.head.appendChild(style);
    }

    installThemeButton(doc);
    doc.querySelectorAll<HTMLSelectElement>("select[data-status-id]").forEach((select) => ensureStatusBar(doc, select));
    const plannerStatus = doc.querySelector<HTMLSelectElement>("#plannerStatus");
    if (plannerStatus) ensureStatusBar(doc, plannerStatus, ["todo", "doing", "blocked"]);
    const modalStatus = doc.querySelector<HTMLSelectElement>("#taskStatus");
    if (modalStatus) ensureStatusBar(doc, modalStatus);

    const root = doc.querySelector<HTMLElement>("#root");
    const dashboardActive = doc.querySelector<HTMLButtonElement>('.nav button[data-view="dashboard"]')?.classList.contains("active");
    if (root && dashboardActive && !root.querySelector(".wh-dashboard-layout")) {
      const layout = doc.createElement("div");
      layout.className = "wh-dashboard-layout";
      const work = doc.createElement("div");
      work.className = "wh-work-area";
      [...root.children].forEach((child) => work.appendChild(child));
      const market = doc.createElement("aside");
      market.id = "wh-market-panel";
      layout.append(work, market);
      root.appendChild(layout);
    }

    patchReport(doc);
    renderMarket();
  }

  function handleLoad() {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;
    patchFrame();
    observerRef.current?.disconnect();
    observerRef.current = new MutationObserver(() => {
      if (patchTimerRef.current) window.clearTimeout(patchTimerRef.current);
      patchTimerRef.current = window.setTimeout(patchFrame, 0);
    });
    observerRef.current.observe(doc.body, { childList: true, subtree: true });
  }

  return <iframe ref={frameRef} src="/dayflow/index.html" title="Work Hub" onLoad={handleLoad} style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", border: 0, zIndex: 9999, background: "#f3f6fb" }} />;
}
