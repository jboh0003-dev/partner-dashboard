"use client";

import { useEffect, useRef } from "react";

const STATUSES = [
  { value: "todo", icon: "○", label: "예정", cls: "todo" },
  { value: "doing", icon: "△", label: "진행", cls: "doing" },
  { value: "done", icon: "✓", label: "완료", cls: "done" },
  { value: "blocked", icon: "!", label: "이슈", cls: "blocked" },
  { value: "failed", icon: "×", label: "못함", cls: "failed" },
] as const;

type MarketPayload = {
  ok?: boolean;
  updatedAt?: string;
  kospi?: { price?: number; changePct?: number };
  usdkrw?: { price?: number; changePct?: number };
  stocks?: Array<{ symbol: string; name: string; price?: number; changePct?: number }>;
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
      const res = await fetch("/api/work-hub/market", { cache: "no-store" });
      if (!res.ok) return;
      marketRef.current = await res.json();
      renderMarket();
    } catch {
      // market panel keeps its last successful snapshot
    }
  }

  function fmtNum(value?: number, digits = 0) {
    if (typeof value !== "number" || Number.isNaN(value)) return "-";
    return value.toLocaleString("ko-KR", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }

  function fmtPct(value?: number) {
    if (typeof value !== "number" || Number.isNaN(value)) return "-";
    return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
  }

  function renderMarket() {
    const doc = frameRef.current?.contentDocument;
    const panel = doc?.querySelector<HTMLElement>("#wh-market-panel");
    if (!doc || !panel) return;
    const data = marketRef.current;
    const stocks = data?.stocks ?? [];
    const hyundai = stocks.find((s) => s.name === "현대차");
    const updated = data?.updatedAt
      ? new Date(data.updatedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
      : "-";

    panel.innerHTML = `
      <div class="wh-market-head">
        <div><b>MARKET</b><span>${updated} 갱신</span></div>
        <button id="wh-market-refresh" type="button">↻</button>
      </div>
      <div class="wh-index-grid">
        <div class="wh-index"><span>KOSPI</span><strong>${fmtNum(data?.kospi?.price, 2)}</strong><em class="${(data?.kospi?.changePct ?? 0) >= 0 ? "up" : "down"}">${fmtPct(data?.kospi?.changePct)}</em></div>
        <div class="wh-index"><span>USD/KRW</span><strong>₩${fmtNum(data?.usdkrw?.price, 2)}</strong><em class="${(data?.usdkrw?.changePct ?? 0) >= 0 ? "up" : "down"}">${fmtPct(data?.usdkrw?.changePct)}</em></div>
      </div>
      ${hyundai ? `<div class="wh-hyundai"><div><span>FOCUS</span><b>현대차</b></div><strong>${fmtNum(hyundai.price)}</strong><em class="${(hyundai.changePct ?? 0) >= 0 ? "up" : "down"}">${fmtPct(hyundai.changePct)}</em></div>` : ""}
      <div class="wh-stock-title"><b>국내 주요 10종목</b><span>60초 자동 갱신</span></div>
      <div class="wh-stock-list">
        ${stocks.map((s, i) => `<div class="wh-stock ${s.name === "현대차" ? "focus" : ""}"><span class="rank">${i + 1}</span><b>${s.name}</b><span class="price">${fmtNum(s.price)}</span><em class="${(s.changePct ?? 0) >= 0 ? "up" : "down"}">${fmtPct(s.changePct)}</em></div>`).join("") || '<div class="wh-market-empty">시장 데이터 불러오는 중...</div>'}
      </div>
      <div class="wh-market-note">※ 시세는 데이터 제공처 사정에 따라 지연될 수 있습니다.</div>
    `;
    panel.querySelector<HTMLButtonElement>("#wh-market-refresh")?.addEventListener("click", loadMarket);
  }

  function patchFrame() {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;
    doc.title = "Work Hub";

    const brand = doc.querySelector<HTMLElement>(".brand");
    if (brand) brand.innerHTML = 'Work Hub<small>MY WORKSPACE</small>';

    doc.querySelectorAll<HTMLButtonElement>(".nav button").forEach((button) => {
      const v = button.dataset.view;
      button.style.display = ["dashboard", "planner", "report"].includes(v || "") ? "" : "none";
    });

    if (!doc.getElementById("work-hub-v2-style")) {
      const style = doc.createElement("style");
      style.id = "work-hub-v2-style";
      style.textContent = `
        :root{--wh-navy:#111827;--wh-blue:#4f63e9;--wh-sky:#edf3ff;--wh-red:#d64b4b;--wh-green:#16865f}
        body{background:linear-gradient(180deg,#f7f9fd 0%,#f4f6fb 100%)!important}
        .side{width:176px!important;padding:26px 12px!important;background:linear-gradient(180deg,#0c1424,#111d32)!important}
        .brand{font-size:21px!important;letter-spacing:-.4px!important}.brand small{letter-spacing:1.6px!important;font-size:8px!important;margin-top:7px!important}
        .nav button{font-size:12px!important;padding:13px 12px!important;margin:5px 0!important}
        .main{margin-left:176px!important;width:calc(100% - 176px)!important}
        header{height:76px!important;padding:0 24px!important;background:rgba(247,249,253,.92)!important;backdrop-filter:blur(12px)}
        header p{display:none!important}header h1{font-size:22px!important;letter-spacing:-.6px!important}
        .wrap{max-width:none!important;padding:18px 22px 26px!important}
        .hero{display:none!important}
        .metrics{grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:8px!important;margin-bottom:11px!important}
        .metric{padding:12px 14px!important;border-radius:12px!important;box-shadow:none!important}.metric strong{font-size:21px!important}.metric span{font-size:9px!important}
        .wh-dashboard-layout{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:14px;align-items:start}
        .wh-work-area{min-width:0}
        .board{grid-template-columns:.72fr 1.65fr .72fr!important;gap:10px!important}
        .board .col{min-height:500px!important;border-radius:16px!important;padding:14px!important;box-shadow:0 8px 28px rgba(16,24,40,.045)!important}
        .board .col:nth-child(2){border:1px solid #cfd8ff!important;background:linear-gradient(180deg,#fff,#fbfcff)!important;box-shadow:0 13px 38px rgba(79,99,233,.11)!important}
        .board .col:nth-child(2) .colhead h3{font-size:18px!important;color:#253b95!important}.board .col:nth-child(2) .count{background:#e9edff!important;color:#4054cb!important;font-weight:900!important}
        .colhead h3{font-size:13px!important}.colhead p{font-size:9px!important}.count{font-size:9px!important}
        .task{padding:10px!important;border-radius:10px!important}.tasktitle{font-size:11px!important}.meta{margin-top:5px!important}
        .quick input{height:36px!important}.quick .btn{height:36px!important}
        .wh-statusbar{display:flex;gap:4px;flex-wrap:wrap;align-items:center;width:100%}
        .wh-statusbtn{border:1px solid #e0e5ec;background:#fff;color:#667085;border-radius:7px;padding:5px 7px;font-size:9px;font-weight:800;cursor:pointer;line-height:1;white-space:nowrap;transition:.12s ease}
        .wh-statusbtn:hover{transform:translateY(-1px);border-color:#b8c0ce}.wh-statusbtn.todo.active{background:#eef1f5;border-color:#cbd2dc;color:#596273}.wh-statusbtn.doing.active{background:#fff6e5;border-color:#efd297;color:#a66c0f}.wh-statusbtn.done.active{background:#e9f8f2;border-color:#9edbc6;color:#0c8258}.wh-statusbtn.blocked.active{background:#fff2e9;border-color:#efbf9f;color:#b55d23}.wh-statusbtn.failed.active{background:#fff0f0;border-color:#efb0b0;color:#bb4040}
        .statusrow>span:first-child{display:none!important}.statusrow select{display:none!important}
        #wh-market-panel{position:sticky;top:92px;background:#0f172a;color:#e5e7eb;border-radius:17px;padding:14px;min-height:500px;box-shadow:0 14px 38px rgba(15,23,42,.16)}
        .wh-market-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.wh-market-head>div{display:flex;flex-direction:column}.wh-market-head b{font-size:13px;letter-spacing:1.2px}.wh-market-head span{font-size:8px;color:#8190aa;margin-top:2px}.wh-market-head button{border:0;background:#1e293b;color:#cbd5e1;border-radius:8px;width:28px;height:28px;cursor:pointer}
        .wh-index-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.wh-index{background:#182235;border:1px solid #26344d;border-radius:11px;padding:10px}.wh-index span{display:block;font-size:8px;color:#8190aa}.wh-index strong{display:block;font-size:14px;margin:4px 0}.wh-index em,.wh-stock em,.wh-hyundai em{font-style:normal;font-size:9px}.up{color:#ff6868!important}.down{color:#6ca8ff!important}
        .wh-hyundai{margin:9px 0;background:linear-gradient(135deg,#2d3766,#1d2851);border:1px solid #5363b0;border-radius:12px;padding:11px;display:grid;grid-template-columns:1fr auto;gap:4px 10px;align-items:center}.wh-hyundai div{grid-row:1/3}.wh-hyundai span{display:block;font-size:7px;color:#9dadff;letter-spacing:1px}.wh-hyundai b{display:block;font-size:13px;margin-top:2px}.wh-hyundai strong{font-size:15px;text-align:right}
        .wh-stock-title{display:flex;justify-content:space-between;align-items:center;padding:8px 2px 6px}.wh-stock-title b{font-size:10px}.wh-stock-title span{font-size:7px;color:#6f809c}.wh-stock{display:grid;grid-template-columns:20px 1fr 72px 48px;align-items:center;gap:5px;padding:8px 4px;border-top:1px solid #1e2a40;font-size:9px}.wh-stock .rank{color:#63728b}.wh-stock b{font-size:9px}.wh-stock .price{text-align:right;color:#e5e7eb}.wh-stock em{text-align:right}.wh-stock.focus{background:#182346;border-radius:7px;border-top-color:transparent;padding-left:6px;padding-right:6px}.wh-market-note{font-size:7px;color:#65758e;line-height:1.4;margin-top:9px}.wh-market-empty{padding:30px 0;text-align:center;color:#718096;font-size:9px}
        .plannerhead,.panel{box-shadow:none!important}.reportgrid{gap:10px!important}.reportbox{min-height:190px!important}
        @media(max-width:1180px){.wh-dashboard-layout{grid-template-columns:1fr}.board{grid-template-columns:.8fr 1.5fr .8fr!important}#wh-market-panel{position:static}.metrics{grid-template-columns:repeat(3,1fr)!important}}
        @media(max-width:850px){.board{grid-template-columns:1fr!important}.board .col:nth-child(2){order:-1}.side{width:70px!important}.main{margin-left:70px!important;width:calc(100% - 70px)!important}}
      `;
      doc.head.appendChild(style);
    }

    const ensureStatusBar = (select: HTMLSelectElement, allowed = STATUSES.map((s) => s.value)) => {
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
          button.innerHTML = `${status.icon} ${status.label}`;
          button.onclick = (event) => {
            event.preventDefault();
            event.stopPropagation();
            select.value = status.value;
            select.dispatchEvent(new Event("change", { bubbles: true }));
          };
          bar!.appendChild(button);
        });
      }
      bar.querySelectorAll<HTMLButtonElement>(".wh-statusbtn").forEach((button) => button.classList.toggle("active", button.dataset.value === select.value));
    };

    doc.querySelectorAll<HTMLSelectElement>("select[data-status-id]").forEach((select) => ensureStatusBar(select));
    const plannerStatus = doc.querySelector<HTMLSelectElement>("#plannerStatus");
    if (plannerStatus) ensureStatusBar(plannerStatus, ["todo", "doing", "blocked"]);
    const modalStatus = doc.querySelector<HTMLSelectElement>("#taskStatus");
    if (modalStatus) ensureStatusBar(modalStatus);

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

    patchReportCopy(doc);
    renderMarket();
  }

  function patchReportCopy(doc: Document) {
    const textarea = doc.querySelector<HTMLTextAreaElement>("#reportText");
    if (!textarea || textarea.dataset.whPatched === "1") return;
    textarea.dataset.whPatched = "1";
    const raw = textarea.value;
    const blocks = raw.split(/\n\s*\n/);
    const last = blocks.find((b) => b.includes("지난주"))?.split("\n").slice(1).filter(Boolean) ?? [];
    const current = blocks.find((b) => b.includes("이번주"))?.split("\n").slice(1).filter(Boolean) ?? [];
    const next = blocks.find((b) => b.includes("다음주"))?.split("\n").slice(1).filter(Boolean) ?? [];
    const clean = (items: string[]) => items.map((s, i) => `${i + 1})${s.replace(/^[-✓○△!× ]+/, "").trim()}`).join("\n") || "1) 없음";
    textarea.value = `이사님, 금주 주간 리포트 보고드립니다.\n\n1. 파트너 현황\n\n계약 완료 파트너 수 : \n협의 중인 파트너 : \n신청서 수취 : \n\n2. 업무 현황\n\n${clean(last)}\n\n3. 차주 주요 일정 및 계획\n\n${clean(next.length ? next : current)}\n\n감사합니다.`;
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
    observerRef.current.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  }

  return (
    <iframe
      ref={frameRef}
      src="/dayflow/index.html"
      title="Work Hub"
      onLoad={handleLoad}
      style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", border: 0, zIndex: 9999, background: "#f5f7fb" }}
    />
  );
}
