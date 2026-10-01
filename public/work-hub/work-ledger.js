(() => {
  'use strict';

  const STORE_KEY = 'workLedgerV1';
  const ROOT_MONTHLY_ID = 'workhub-monthly-root';
  const ROOT_HISTORY_ID = 'workhub-history-root';
  const NAV_MONTHLY_ID = 'workhub-monthly-nav';
  const NAV_HISTORY_ID = 'workhub-history-nav';

  const TREE = [
    {
      area: '전사 파트너 매출/사업기회',
      goals: [
        { goal: '파트너 매출(전체)', roles: ['파트너 영업기회 등록 및 관리', '파트너 지원 (영업자료, 제작물 등)'] },
        { goal: '파트너 사업기회(전체)', roles: ['Biz 미팅 (파이프라인, Co-MKT 협의)', 'Alliance Biz'] },
      ],
    },
    {
      area: '광역 비즈니스',
      goals: [
        { goal: '광역 매출', roles: ['지역 세일즈/기술파트너 확대', '수요예보 분석 등 영업기회 지원', '지역 세미나/간담회 지원'] },
      ],
    },
    {
      area: '파트너 관리 및 강화',
      goals: [
        { goal: '플래티넘/기술 파트너 readiness', roles: ['파트너 정책 및 교육과정 수립', 'Platinum/기술 파트너 선발(장비/인력 투자협의)'] },
        { goal: '플래티넘 파트너 PoC 활성화', roles: ['파트너 PoC 리소스(일정/장비/인력) 관리', '파트너/영업본부 연결관리'] },
        { goal: '신규 파트너 계약', roles: ['파트너십 안내 및 협의', '계약 프로세스 진행', '파트너 현황 최신화 (기본정보, 여신정보 등)'] },
        { goal: '파트너 교육', roles: ['교육 모니터링 및 개선 협의(w/아카데미)', '파트너 교육참여독려 (플래티넘/골드 중점)', '신규 파트너 온보딩 교육', '파트너 교육이력관리'] },
        { goal: '채널 마케팅', roles: ['오케스트로 주관 파트너 대상행사', '파트너 Co-MKT 행사', 'Alliance Co-MKT 행사', '기타 협력사 MDF 관리 등'] },
      ],
    },
    {
      area: '전사 전략업무',
      goals: [
        { goal: '조달 등록 및 관리', roles: ['조달 수요 파악 (w/영업본부)', '조달 전략 (w/기획팀, 영업본부)', '조달 등록 및 관리'] },
      ],
    },
    {
      area: '기타',
      goals: [
        { goal: 'AI 업무 효율화', roles: ['AI를 활용한 업무 효율화 방안'] },
        { goal: '기타', roles: ['기타 업무'] },
      ],
    },
  ];

  function boot() {
    if (window.__workhubLedgerLoaded) return;
    if (typeof S === 'undefined' || typeof render !== 'function' || typeof save !== 'function' || typeof mon !== 'function' || typeof add !== 'function') {
      window.setTimeout(boot, 120);
      return;
    }
    window.__workhubLedgerLoaded = true;

    const nav = document.querySelector('.nav');
    const main = document.querySelector('.main');
    const appRoot = document.getElementById('root');
    const pageTitle = document.getElementById('pageTitle');
    const addGlobal = document.getElementById('addGlobal');
    if (!nav || !main || !appRoot || !pageTitle) return;

    let weekStart = mon(today());
    let monthCursor = today().slice(0, 7);
    let historyYear = Number(today().slice(0, 4));
    let historyMonth = 'all';
    let historyArea = 'all';
    let specialView = '';

    function ensureLedger() {
      S.settings = S.settings || {};
      const current = S.settings[STORE_KEY] && typeof S.settings[STORE_KEY] === 'object' ? S.settings[STORE_KEY] : {};
      current.version = 1;
      if (!Array.isArray(current.monthlyPlans)) current.monthlyPlans = [];
      if (!Array.isArray(current.events)) current.events = [];
      if (!Array.isArray(current.archivedTasks)) current.archivedTasks = [];
      S.settings[STORE_KEY] = current;
      return current;
    }

    function ledger() { return ensureLedger(); }
    function nowIso() { return new Date().toISOString(); }
    function makeId(prefix='ledger') { return `${prefix}-${typeof uid === 'function' ? uid() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`; }
    function escapeHtml(value) { return typeof esc === 'function' ? esc(value) : String(value ?? '').replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c])); }
    function monthLabel(value) { const [y,m] = value.split('-'); return `${y}년 ${Number(m)}월`; }
    function shiftMonth(value, delta) {
      const [y,m] = value.split('-').map(Number);
      const d = new Date(y, m - 1 + delta, 1, 12);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    }
    function formatDate(value) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return '-';
      const d = new Date(`${value}T12:00:00`);
      return `${d.getMonth()+1}/${d.getDate()}`;
    }
    function areaNode(area) { return TREE.find(node => node.area === area) || TREE[TREE.length - 1]; }
    function goalsFor(area) { return areaNode(area).goals.map(x => x.goal); }
    function rolesFor(area, goal) {
      const found = areaNode(area).goals.find(x => x.goal === goal);
      return found ? found.roles : areaNode(area).goals.flatMap(x => x.roles);
    }
    function allAreas() {
      const fromTasks = S.workItems.map(taskArea);
      const fromPlans = ledger().monthlyPlans.map(x => x.area || '기타');
      return [...new Set([...TREE.map(x => x.area), ...fromTasks, ...fromPlans, '기타'])].filter(Boolean);
    }
    function inferArea(task) {
      if (task.ledgerArea) return task.ledgerArea;
      const text = `${task.category || ''} ${task.title || ''}`.toLowerCase();
      if (/조달|나라장터|식별번호|비올라|viola|contrabass|수의시담|계약보증/.test(text)) return '전사 전략업무';
      if (/파트너|교육|계약|mdf|플래티넘|골드|온보딩|cxms|행사|모객|부속합의/.test(text)) return '파트너 관리 및 강화';
      if (/광역|지역 세일즈|수요예보|지역 세미나/.test(text)) return '광역 비즈니스';
      if (/파이프라인|영업기회|biz|alliance|제안자료|제안서/.test(text)) return '전사 파트너 매출/사업기회';
      return task.category && task.category !== '기타' ? task.category : '기타';
    }
    function taskArea(task) { return task.ledgerArea || inferArea(task); }
    function taskGoal(task) { return task.ledgerGoal || ''; }
    function taskRole(task) { return task.ledgerRole || ''; }
    function datesOfWeek(start) { return Array.from({length:5}, (_,i) => add(start, i)); }
    function weekdayName(date) { return ['일','월','화','수','목','금','토'][new Date(`${date}T12:00:00`).getDay()]; }
    function taskDailyState(task, date) {
      const raw = task.dailyChecks?.[date];
      return typeof raw === 'string' ? raw : raw?.status || '';
    }
    function addEvent(event) {
      const store = ledger();
      store.events.push({ id: makeId('event'), at: nowIso(), ...event });
      if (store.events.length > 2500) store.events = store.events.slice(-2500);
    }
    function archiveTask(task, reason='delete') {
      const store = ledger();
      store.archivedTasks.push({ ...JSON.parse(JSON.stringify(task)), archivedAt: nowIso(), archivedReason: reason });
      if (store.archivedTasks.length > 1200) store.archivedTasks = store.archivedTasks.slice(-1200);
    }
    function inDisplayedWeek(task) {
      if (task.scope === 'daily') return task.target >= weekStart && task.target <= add(weekStart, 6);
      if (task.scope === 'weekly') return mon(task.target || weekStart) === weekStart;
      if (task.scope === 'monthly') return (task.target || '').slice(0,7) === weekStart.slice(0,7);
      return false;
    }
    function tasksForWeek() { return S.workItems.filter(inDisplayedWeek); }
    function statusText(status) { return ({todo:'시작 전',doing:'진행 중',done:'완료',blocked:'이슈'}[status] || status || '시작 전'); }
    function statusMark(status) { return ({todo:'○',doing:'△',done:'✓',blocked:'!'}[status] || '○'); }

    const style = document.createElement('style');
    style.id = 'workhub-ledger-style';
    style.textContent = `
      .ledger-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:0 0 14px}.ledger-metric{border:1px solid var(--line);border-radius:7px;background:var(--card);padding:13px 15px}.ledger-metric span{display:block;color:var(--muted);font-size:11px;font-weight:800}.ledger-metric strong{display:block;margin-top:4px;font:700 26px Georgia,serif;color:var(--brand)}
      .ledger-week{border:1px solid var(--line);border-radius:7px;background:var(--card);overflow:hidden;margin-bottom:16px}.ledger-week-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:15px 17px;border-top:4px double #ad8c5f;border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--card) 92%,#cdb88f)}.ledger-week-title b{font:600 22px Georgia,'Noto Serif KR',serif}.ledger-week-title span{display:block;margin-top:3px;color:var(--muted);font-size:11px}.ledger-week-nav{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.ledger-week-nav button{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:5px;padding:7px 10px;font-size:11px;font-weight:800;cursor:pointer}.ledger-week-nav button:hover{border-color:#ad8c5f;color:var(--brand)}
      .ledger-top-quick{display:grid;grid-template-columns:210px minmax(250px,1fr) 145px auto;gap:8px;padding:12px 14px;border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--card) 95%,#d5c3a2)}.ledger-top-quick select,.ledger-top-quick input{min-width:0;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:5px;padding:10px 11px;font-size:13px}.ledger-top-quick button{border:1px solid #6b343e;background:#723841;color:#fff8ec;border-radius:5px;padding:9px 14px;font-size:12px;font-weight:900;cursor:pointer}
      .ledger-area{border-top:1px solid var(--line)}.ledger-area:first-of-type{border-top:0}.ledger-area>summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 16px;cursor:pointer;background:var(--card)}.ledger-area>summary::-webkit-details-marker{display:none}.ledger-area>summary b{font-size:15px}.ledger-area>summary span{min-width:28px;height:24px;display:grid;place-items:center;border:1px solid var(--line);border-radius:4px;color:var(--brand);font-size:11px;font-weight:900}.ledger-area[open]>summary{background:color-mix(in srgb,var(--card) 88%,#c6ad7a);border-bottom:1px solid var(--line)}.ledger-area-body{padding:10px 12px 14px}.ledger-area-quick{display:grid;grid-template-columns:180px minmax(240px,1fr) 140px auto;gap:7px;margin-bottom:10px}.ledger-area-quick select,.ledger-area-quick input{min-width:0;border:1px solid var(--line);border-radius:5px;background:var(--card);color:var(--ink);padding:8px 9px;font-size:12px}.ledger-area-quick button{border:1px solid var(--line);border-radius:5px;background:#f4ead9;color:#6d4630;font-size:11px;font-weight:900;cursor:pointer}
      .ledger-grid{min-width:980px}.ledger-grid-head,.ledger-task-row{display:grid;grid-template-columns:minmax(310px,1fr) repeat(5,62px) 210px;gap:5px;align-items:stretch}.ledger-grid-head{padding:0 6px 6px;color:var(--muted);font-size:10px;font-weight:900;text-align:center}.ledger-grid-head>div:first-child{text-align:left;padding-left:9px}.ledger-task-row{margin:6px 0;padding:7px;border:1px solid var(--line);border-left:4px solid #a98a61;border-radius:6px;background:var(--card);transition:.12s}.ledger-task-row:hover{border-color:#b29369}.ledger-task-row.is-done{background:color-mix(in srgb,var(--card) 88%,#b8cfaf);border-left-color:#718b6b}.ledger-task-row.is-blocked{background:color-mix(in srgb,var(--card) 88%,#e3bd9f);border-left-color:#a76b5f}.ledger-task-main{min-width:0;padding:3px 7px}.ledger-task-main strong{display:block;font-size:14px;line-height:1.45;word-break:keep-all;overflow-wrap:anywhere}.ledger-task-meta{display:flex;gap:5px;flex-wrap:wrap;margin-top:5px}.ledger-task-meta span{border:1px solid var(--line);border-radius:999px;padding:3px 6px;color:var(--muted);font-size:9px}.ledger-task-meta span.primary{color:#70424a;background:#f1e5dc}.ledger-day{border:1px solid var(--line);border-radius:5px;background:color-mix(in srgb,var(--card) 96%,#cdb98f);color:var(--muted);font-size:18px;font-weight:900;cursor:pointer;min-height:48px}.ledger-day:hover{border-color:#ad8c5f}.ledger-day.doing{background:#f1ead7;color:#91733e;border-color:#c6a66a}.ledger-day.done{background:#e4eee0;color:#567153;border-color:#8ba183}.ledger-day.today{box-shadow:inset 0 0 0 2px #723841}.ledger-task-actions{display:flex;align-items:center;justify-content:flex-end;gap:5px;flex-wrap:wrap;padding:3px}.ledger-task-actions button{border:1px solid var(--line);border-radius:5px;background:var(--card);color:var(--ink);padding:6px 7px;font-size:10px;font-weight:800;cursor:pointer}.ledger-task-actions .ledger-status{color:var(--brand)}.ledger-task-actions .ledger-carry{background:#f4ead9;color:#6d4630}.ledger-empty{padding:18px;text-align:center;color:var(--muted);font-size:11px}.ledger-scroll{overflow-x:auto;padding-bottom:3px}
      .ledger-special{max-width:1900px;margin:0 auto;padding:22px 32px 54px}.ledger-special[hidden]{display:none!important}.ledger-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;padding:20px 22px;border:1px solid var(--line);border-top:4px double #af8b53;border-radius:6px;background:linear-gradient(135deg,color-mix(in srgb,var(--card) 90%,#c3a46d),var(--card))}.ledger-hero h2{margin:4px 0 6px;font:600 30px Georgia,'Noto Serif KR',serif}.ledger-hero p{margin:0;color:var(--muted);font-size:13px}.ledger-kicker{font-size:10px;letter-spacing:2.5px;color:var(--muted);font-weight:900}.ledger-controls{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.ledger-controls button,.ledger-controls select{border:1px solid var(--line);border-radius:5px;background:var(--card);color:var(--ink);padding:8px 10px;font-size:11px;font-weight:800}.ledger-controls b{min-width:105px;text-align:center;font:600 16px Georgia,serif}
      .monthly-form{display:grid;grid-template-columns:220px 220px 260px minmax(260px,1fr) auto;gap:8px;margin:14px 0;padding:13px;border:1px solid var(--line);border-radius:6px;background:var(--card)}.monthly-form select,.monthly-form input{min-width:0;border:1px solid var(--line);border-radius:5px;background:var(--card);color:var(--ink);padding:9px 10px;font-size:12px}.monthly-form button{border:1px solid #6b343e;border-radius:5px;background:#723841;color:#fff8ec;padding:9px 14px;font-size:12px;font-weight:900}.monthly-groups{display:flex;flex-direction:column;gap:12px}.monthly-group{border:1px solid var(--line);border-radius:6px;background:var(--card);overflow:hidden}.monthly-group-head{display:flex;justify-content:space-between;align-items:center;padding:11px 14px;background:color-mix(in srgb,var(--card) 89%,#c3aa77);border-bottom:1px solid var(--line)}.monthly-group-head b{font-size:15px}.monthly-group-head span{font-size:10px;color:var(--muted)}.monthly-row{display:grid;grid-template-columns:210px 250px minmax(260px,1fr) 150px 300px;gap:8px;align-items:center;padding:10px 13px;border-top:1px solid var(--line)}.monthly-row:first-child{border-top:0}.monthly-row small{color:var(--muted);font-size:10px;line-height:1.4}.monthly-row strong{font-size:13px;line-height:1.45}.monthly-status{display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:900}.monthly-status i{width:8px;height:8px;border-radius:50%;background:#b79f77}.monthly-status.doing i{background:#b38b42}.monthly-status.done i{background:#718b6b}.monthly-actions{display:flex;justify-content:flex-end;gap:5px;flex-wrap:wrap}.monthly-actions button{border:1px solid var(--line);border-radius:5px;background:var(--card);color:var(--ink);padding:6px 8px;font-size:10px;font-weight:800;cursor:pointer}.monthly-actions .to-week{background:#f4ead9;color:#6d4630}.monthly-empty{padding:34px;text-align:center;color:var(--muted);font-size:12px}
      .history-summary{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:6px;margin:14px 0}.history-month{border:1px solid var(--line);border-radius:5px;background:var(--card);padding:9px 7px;text-align:center;cursor:pointer}.history-month.active{border-color:#9d6a72;background:#f1e5e4}.history-month b{display:block;font:700 16px Georgia,serif}.history-month span{display:block;margin-top:2px;color:var(--muted);font-size:9px}.history-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:12px 0}.history-metric{padding:12px 14px;border:1px solid var(--line);border-radius:6px;background:var(--card)}.history-metric span{display:block;color:var(--muted);font-size:10px}.history-metric strong{font:700 24px Georgia,serif;color:var(--brand)}.history-group{border:1px solid var(--line);border-radius:6px;background:var(--card);margin:10px 0;overflow:hidden}.history-group>summary{list-style:none;padding:12px 14px;cursor:pointer;background:color-mix(in srgb,var(--card) 91%,#c5aa77);font-weight:900}.history-group>summary::-webkit-details-marker{display:none}.history-area{padding:11px 13px;border-top:1px solid var(--line)}.history-area:first-of-type{border-top:0}.history-area h4{margin:0 0 8px;font-size:13px;color:var(--brand)}.history-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;padding:8px 0;border-top:1px dashed var(--line)}.history-item:first-of-type{border-top:0}.history-item strong{font-size:12px}.history-item small{display:block;color:var(--muted);font-size:9px;margin-top:3px}.history-item em{font-style:normal;color:var(--muted);font-size:10px;white-space:nowrap}.history-copy{border:1px solid #6b343e!important;background:#723841!important;color:#fff8ec!important}
      #${NAV_MONTHLY_ID}.active,#${NAV_HISTORY_ID}.active{background:#81525a!important;border-color:#c09a68!important;color:#fff7e5!important;box-shadow:inset 3px 0 #e4c693}
      @media(max-width:1200px){.monthly-form{grid-template-columns:1fr 1fr}.monthly-form button{grid-column:span 2}.monthly-row{grid-template-columns:170px 210px minmax(230px,1fr);}.monthly-row>.monthly-status,.monthly-row>.monthly-actions{grid-column:auto}.history-summary{grid-template-columns:repeat(6,minmax(0,1fr))}}
      @media(max-width:900px){.ledger-metrics,.history-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.ledger-top-quick,.ledger-area-quick{grid-template-columns:1fr 1fr}.ledger-top-quick button,.ledger-area-quick button{grid-column:span 2}.ledger-special{padding:16px 14px 42px}.ledger-hero{align-items:flex-start;flex-direction:column}.monthly-form{grid-template-columns:1fr}.monthly-form button{grid-column:auto}.monthly-row{grid-template-columns:1fr}.monthly-actions{justify-content:flex-start}.history-summary{grid-template-columns:repeat(4,minmax(0,1fr))}}
    `;
    document.head.appendChild(style);

    function createNav() {
      if (document.getElementById(NAV_MONTHLY_ID)) return;
      const reportButton = nav.querySelector('button[data-view="report"]');
      const monthly = document.createElement('button');
      monthly.id = NAV_MONTHLY_ID;
      monthly.type = 'button';
      monthly.innerHTML = '▣ <span>월간계획</span>';
      const history = document.createElement('button');
      history.id = NAV_HISTORY_ID;
      history.type = 'button';
      history.innerHTML = '◫ <span>업무이력</span>';
      nav.insertBefore(monthly, reportButton || null);
      if (reportButton?.nextSibling) nav.insertBefore(history, reportButton.nextSibling); else nav.appendChild(history);
      monthly.onclick = () => enterSpecial('monthly');
      history.onclick = () => enterSpecial('history');
    }

    function createRoots() {
      if (!document.getElementById(ROOT_MONTHLY_ID)) {
        const el = document.createElement('section');
        el.id = ROOT_MONTHLY_ID;
        el.className = 'ledger-special';
        el.hidden = true;
        main.appendChild(el);
      }
      if (!document.getElementById(ROOT_HISTORY_ID)) {
        const el = document.createElement('section');
        el.id = ROOT_HISTORY_ID;
        el.className = 'ledger-special';
        el.hidden = true;
        main.appendChild(el);
      }
    }

    function leaveSpecial() {
      if (!specialView) return;
      specialView = '';
      const monthRoot = document.getElementById(ROOT_MONTHLY_ID);
      const historyRoot = document.getElementById(ROOT_HISTORY_ID);
      if (monthRoot) monthRoot.hidden = true;
      if (historyRoot) historyRoot.hidden = true;
      document.getElementById(NAV_MONTHLY_ID)?.classList.remove('active');
      document.getElementById(NAV_HISTORY_ID)?.classList.remove('active');
      appRoot.hidden = false;
      if (addGlobal) addGlobal.hidden = false;
    }

    function enterSpecial(type) {
      if (specialView !== type) {
        specialView = '';
        const dashboardButton = nav.querySelector('button[data-view="dashboard"]');
        dashboardButton?.click();
      }
      specialView = type;
      presentSpecial();
      window.scrollTo({top:0,behavior:'smooth'});
    }

    function presentSpecial() {
      createRoots();
      const monthRoot = document.getElementById(ROOT_MONTHLY_ID);
      const historyRoot = document.getElementById(ROOT_HISTORY_ID);
      appRoot.hidden = true;
      if (addGlobal) addGlobal.hidden = true;
      [...nav.querySelectorAll('button')].forEach(btn => btn.classList.remove('active'));
      if (specialView === 'monthly') {
        pageTitle.textContent = '월간계획';
        document.getElementById(NAV_MONTHLY_ID)?.classList.add('active');
        monthRoot.hidden = false;
        historyRoot.hidden = true;
        renderMonthly();
      } else if (specialView === 'history') {
        pageTitle.textContent = '업무이력';
        document.getElementById(NAV_HISTORY_ID)?.classList.add('active');
        monthRoot.hidden = true;
        historyRoot.hidden = false;
        renderHistory();
      }
    }

    nav.addEventListener('click', event => {
      const button = event.target instanceof Element ? event.target.closest('button') : null;
      if (!button || button.id === NAV_MONTHLY_ID || button.id === NAV_HISTORY_ID) return;
      leaveSpecial();
    }, true);

    function classificationOptions(area, selected='') {
      return `<option value="">목표 선택 (선택)</option>${goalsFor(area).map(goal => `<option value="${escapeHtml(goal)}" ${goal===selected?'selected':''}>${escapeHtml(goal)}</option>`).join('')}`;
    }

    function newWeeklyTask({ title, area='기타', goal='', role='', dueDate='', target=weekStart, monthlyPlanId='' }) {
      const normalizedTarget = dueDate ? mon(dueDate) : mon(target || today());
      const item = {
        id: makeId('work'), title, category: goal || area || '기타', scope: 'weekly', target: normalizedTarget,
        dueDate: dueDate || '', status: 'todo', note: '', issueNote: '', createdAt: today(), updatedAt: today(), completedAt: null,
        ledgerArea: area || '기타', ledgerGoal: goal || '', ledgerRole: role || '', monthlyPlanId: monthlyPlanId || '', dailyChecks: {},
      };
      S.workItems.push(item);
      addEvent({type:'created', workItemId:item.id, title:item.title, area:item.ledgerArea, goal:item.ledgerGoal, role:item.ledgerRole, date:today()});
      save('업무를 추가했습니다.');
      render();
      return item;
    }

    function dailyButton(task, date) {
      const state = taskDailyState(task, date);
      const mark = state === 'done' ? '✓' : state === 'doing' ? '△' : '·';
      return `<button type="button" class="ledger-day ${state} ${date===today()?'today':''}" data-ledger-day="1" data-id="${escapeHtml(task.id)}" data-date="${date}" title="${date} ${state ? statusText(state) : '진행 체크'}">${mark}</button>`;
    }

    function taskRow(task, weekDates) {
      const area = taskArea(task), goal = taskGoal(task), role = taskRole(task);
      const due = task.dueDate ? `Due ${formatDate(task.dueDate)}` : '';
      return `<div class="ledger-task-row ${task.status==='done'?'is-done':''} ${task.status==='blocked'?'is-blocked':''}">
        <div class="ledger-task-main"><strong>${escapeHtml(task.title)}</strong><div class="ledger-task-meta"><span class="primary">${escapeHtml(goal || area)}</span>${role?`<span>${escapeHtml(role)}</span>`:''}${due?`<span>${due}</span>`:''}</div></div>
        ${weekDates.map(date => dailyButton(task,date)).join('')}
        <div class="ledger-task-actions"><button type="button" class="ledger-status" data-ledger-status="1" data-id="${escapeHtml(task.id)}">${statusMark(task.status)} ${statusText(task.status)}</button><button type="button" data-ledger-classify="1" data-id="${escapeHtml(task.id)}">분류</button>${task.status!=='done'?`<button type="button" class="ledger-carry" data-act="carryWeekV2" data-id="${escapeHtml(task.id)}">차주 →</button>`:''}<button type="button" data-act="edit" data-id="${escapeHtml(task.id)}">수정</button></div>
      </div>`;
    }

    function areaSection(area, items, weekDates) {
      const open = items.length > 0 || area === '기타';
      return `<details class="ledger-area" ${open?'open':''}><summary><b>${escapeHtml(area)}</b><span>${items.length}</span></summary><div class="ledger-area-body">
        <form class="ledger-area-quick" data-ledger-area-quick="1" data-area="${escapeHtml(area)}"><select name="goal">${classificationOptions(area)}</select><input name="title" placeholder="${escapeHtml(area)} 업무 추가 · Enter"><input name="dueDate" type="date" title="Due Date (선택)"><button>+ 추가</button></form>
        <div class="ledger-scroll"><div class="ledger-grid"><div class="ledger-grid-head"><div>금주 주요 업무</div>${weekDates.map(date=>`<div>${weekdayName(date)}<br>${formatDate(date)}</div>`).join('')}<div>상태 · 관리</div></div>${items.length?items.map(task=>taskRow(task,weekDates)).join(''):'<div class="ledger-empty">이번 주 등록된 업무가 없습니다.</div>'}</div></div>
      </div></details>`;
    }

    const previousDashboard = dashboard;
    dashboard = function () {
      const legacy = previousDashboard();
      const holder = document.createElement('div');
      holder.innerHTML = legacy;
      holder.querySelector('.metrics')?.remove();
      holder.querySelector('.dashboard')?.remove();

      const items = tasksForWeek();
      const weekDates = datesOfWeek(weekStart);
      const done = items.filter(x=>x.status==='done').length;
      const doing = items.filter(x=>x.status==='doing').length;
      const blocked = items.filter(x=>x.status==='blocked').length;
      const dayChecks = items.reduce((sum,task)=>sum+weekDates.filter(date=>taskDailyState(task,date)).length,0);
      const groupedAreas = allAreas();
      const sections = groupedAreas.map(area => areaSection(area, items.filter(task=>taskArea(task)===area), weekDates)).join('');
      const range = `${formatDate(weekStart)} ~ ${formatDate(add(weekStart,4))}`;
      const current = mon(today()) === weekStart;

      const head = `<div class="ledger-metrics"><div class="ledger-metric"><span>주간 업무</span><strong>${items.length}</strong></div><div class="ledger-metric"><span>완료</span><strong>${done}</strong></div><div class="ledger-metric"><span>진행 / 이슈</span><strong>${doing + blocked}</strong></div><div class="ledger-metric"><span>일일 체크</span><strong>${dayChecks}</strong></div></div>
      <section class="ledger-week"><div class="ledger-week-head"><div class="ledger-week-title"><b>${current?'이번 주 일계표':'주간 일계표'}</b><span>${range} · 큰 업무영역별로 주간업무를 적고 월~금 진행을 체크합니다.</span></div><div class="ledger-week-nav"><button type="button" data-ledger-week-nav="prev">← 이전주</button><button type="button" data-ledger-week-nav="today">이번주</button><button type="button" data-ledger-week-nav="next">차주 →</button></div></div>
      <form class="ledger-top-quick" id="ledgerTopQuick"><select name="area">${allAreas().map(area=>`<option value="${escapeHtml(area)}">${escapeHtml(area)}</option>`).join('')}</select><input name="title" placeholder="빠른 추가 · 예: 파트너 안내하기"><input name="dueDate" type="date" title="Due Date (선택)"><button>+ 추가</button></form>${sections}</section>`;
      return head + holder.innerHTML;
    };

    const previousBind = bind;
    bind = function () {
      previousBind();
      bindDashboardLedger();
    };

    function bindDashboardLedger() {
      document.querySelectorAll('[data-ledger-week-nav]').forEach(btn => btn.onclick = () => {
        const action = btn.dataset.ledgerWeekNav;
        weekStart = action === 'prev' ? add(weekStart,-7) : action === 'next' ? add(weekStart,7) : mon(today());
        render();
      });
      const topQuick = document.getElementById('ledgerTopQuick');
      if (topQuick) topQuick.onsubmit = event => {
        event.preventDefault();
        const title = topQuick.elements.title.value.trim();
        if (!title) return;
        newWeeklyTask({title,area:topQuick.elements.area.value||'기타',dueDate:topQuick.elements.dueDate.value||'',target:weekStart});
      };
      document.querySelectorAll('[data-ledger-area-quick]').forEach(form => form.onsubmit = event => {
        event.preventDefault();
        const title = form.elements.title.value.trim();
        if (!title) return;
        newWeeklyTask({title,area:form.dataset.area||'기타',goal:form.elements.goal.value||'',dueDate:form.elements.dueDate.value||'',target:weekStart});
      });
      document.querySelectorAll('[data-ledger-day]').forEach(btn => btn.onclick = () => cycleDaily(btn.dataset.id, btn.dataset.date));
      document.querySelectorAll('[data-ledger-classify]').forEach(btn => btn.onclick = () => openClassification(btn.dataset.id));
      document.querySelectorAll('[data-ledger-status]').forEach(btn => btn.onclick = () => cycleStatus(btn.dataset.id));
    }

    function cycleDaily(id, date) {
      const task = S.workItems.find(x=>x.id===id);
      if (!task) return;
      task.dailyChecks = task.dailyChecks && typeof task.dailyChecks === 'object' ? task.dailyChecks : {};
      const current = taskDailyState(task,date);
      const next = current === '' ? 'doing' : current === 'doing' ? 'done' : '';
      if (next) task.dailyChecks[date] = {status:next,at:nowIso()}; else delete task.dailyChecks[date];
      task.updatedAt = today();
      addEvent({type:'daily-check',workItemId:task.id,title:task.title,area:taskArea(task),goal:taskGoal(task),role:taskRole(task),date,status:next||'clear'});
      save();
      render();
    }

    function cycleStatus(id) {
      const task = S.workItems.find(x=>x.id===id);
      if (!task) return;
      const order = ['todo','doing','done'];
      const idx = order.indexOf(task.status);
      const next = order[(idx < 0 ? 0 : idx + 1) % order.length];
      setStatus(id,next);
    }

    function openClassification(id) {
      const task = S.workItems.find(x=>x.id===id);
      if (!task) return;
      const currentArea = taskArea(task);
      const currentGoal = taskGoal(task);
      const currentRole = taskRole(task);
      document.getElementById('modalRoot').innerHTML = `<div class="modalbg"><div class="modal"><h2>업무 분류</h2><div class="field"><label>큰 업무영역</label><select id="ledgerClassArea">${allAreas().map(area=>`<option value="${escapeHtml(area)}" ${area===currentArea?'selected':''}>${escapeHtml(area)}</option>`).join('')}</select></div><div class="field"><label>목표</label><select id="ledgerClassGoal"></select></div><div class="field"><label>주요 역할</label><input id="ledgerClassRole" class="input" list="ledgerRoleList" value="${escapeHtml(currentRole)}"><datalist id="ledgerRoleList"></datalist></div><div class="modalactions"><button class="btn" id="ledgerClassCancel">취소</button><button class="btn primary" id="ledgerClassSave">저장</button></div></div></div>`;
      const areaEl = document.getElementById('ledgerClassArea');
      const goalEl = document.getElementById('ledgerClassGoal');
      const roleEl = document.getElementById('ledgerClassRole');
      const roleList = document.getElementById('ledgerRoleList');
      const refresh = () => {
        const area = areaEl.value;
        goalEl.innerHTML = classificationOptions(area, goalEl.value || currentGoal);
        roleList.innerHTML = rolesFor(area, goalEl.value).map(role=>`<option value="${escapeHtml(role)}"></option>`).join('');
      };
      areaEl.onchange = () => { goalEl.innerHTML = classificationOptions(areaEl.value); refresh(); };
      goalEl.onchange = refresh;
      refresh();
      document.getElementById('ledgerClassCancel').onclick = () => document.getElementById('modalRoot').innerHTML='';
      document.getElementById('ledgerClassSave').onclick = () => {
        task.ledgerArea = areaEl.value || '기타';
        task.ledgerGoal = goalEl.value || '';
        task.ledgerRole = roleEl.value.trim();
        task.category = task.ledgerGoal || task.ledgerArea;
        task.updatedAt = today();
        addEvent({type:'classify',workItemId:task.id,title:task.title,area:task.ledgerArea,goal:task.ledgerGoal,role:task.ledgerRole,date:today()});
        save('업무 분류를 저장했습니다.');
        document.getElementById('modalRoot').innerHTML='';
        render();
      };
    }

    function planGroups(plans) {
      const map = new Map();
      plans.forEach(plan => {
        const area = plan.area || '기타';
        if (!map.has(area)) map.set(area, []);
        map.get(area).push(plan);
      });
      return map;
    }

    function planStatusText(status) { return ({planned:'계획',doing:'진행 중',done:'완료'}[status] || '계획'); }
    function renderMonthly() {
      const rootEl = document.getElementById(ROOT_MONTHLY_ID);
      if (!rootEl) return;
      const plans = ledger().monthlyPlans.filter(plan => plan.month === monthCursor);
      const groups = planGroups(plans);
      const doing = plans.filter(x=>x.status==='doing').length;
      const done = plans.filter(x=>x.status==='done').length;
      const linked = plans.reduce((sum,p)=>sum+(Array.isArray(p.weeklyIds)?p.weeklyIds.length:0),0);
      const groupHtml = [...groups.entries()].map(([area,rows]) => `<section class="monthly-group"><div class="monthly-group-head"><b>${escapeHtml(area)}</b><span>${rows.length}건</span></div><div>${rows.map(plan=>`<div class="monthly-row"><small>${escapeHtml(plan.goal||'-')}</small><small>${escapeHtml(plan.role||'-')}</small><strong>${escapeHtml(plan.title)}</strong><span class="monthly-status ${plan.status}"><i></i>${planStatusText(plan.status)}</span><div class="monthly-actions"><button type="button" data-plan-status="${escapeHtml(plan.id)}">상태변경</button><button type="button" class="to-week" data-plan-week="${escapeHtml(plan.id)}" data-offset="0">이번주 등록</button><button type="button" class="to-week" data-plan-week="${escapeHtml(plan.id)}" data-offset="7">차주 등록</button><button type="button" data-plan-edit="${escapeHtml(plan.id)}">수정</button><button type="button" data-plan-delete="${escapeHtml(plan.id)}">삭제</button></div></div>`).join('')}</div></section>`).join('');
      rootEl.innerHTML = `<div class="ledger-hero"><div><div class="ledger-kicker">MONTHLY PLAN · ${escapeHtml(monthCursor)}</div><h2>월간계획</h2><p>엑셀에서 쓰던 구분 → 목표 → 주요 역할 → 월간 업무 구조를 그대로 이어갑니다.</p></div><div class="ledger-controls"><button type="button" data-month-nav="prev">←</button><b>${monthLabel(monthCursor)}</b><button type="button" data-month-nav="next">→</button><button type="button" data-month-nav="today">이번달</button></div></div><div class="history-metrics"><div class="history-metric"><span>월간 업무</span><strong>${plans.length}</strong></div><div class="history-metric"><span>진행 중</span><strong>${doing}</strong></div><div class="history-metric"><span>완료</span><strong>${done}</strong></div><div class="history-metric"><span>주간 전환</span><strong>${linked}</strong></div></div><form class="monthly-form" id="monthlyPlanForm"><select name="area">${allAreas().map(area=>`<option value="${escapeHtml(area)}">${escapeHtml(area)}</option>`).join('')}</select><select name="goal"></select><input name="role" list="monthlyRoleList" placeholder="주요 역할 (선택)"><datalist id="monthlyRoleList"></datalist><input name="title" required placeholder="월간 업무 · 예: 10월 파트너 정기교육 운영"><button>+ 월간업무</button></form><div class="monthly-groups">${groupHtml || '<div class="monthly-empty">이달 월간 업무가 없습니다. 위에서 먼저 한 줄 추가해보세요.</div>'}</div>`;
      bindMonthly();
    }

    function bindMonthly() {
      document.querySelectorAll('[data-month-nav]').forEach(btn => btn.onclick = () => {
        monthCursor = btn.dataset.monthNav === 'prev' ? shiftMonth(monthCursor,-1) : btn.dataset.monthNav === 'next' ? shiftMonth(monthCursor,1) : today().slice(0,7);
        renderMonthly();
      });
      const form = document.getElementById('monthlyPlanForm');
      if (form) {
        const area = form.elements.area, goal = form.elements.goal, role = form.elements.role;
        const roleList = document.getElementById('monthlyRoleList');
        const refresh = () => {
          const selected = goal.value;
          goal.innerHTML = classificationOptions(area.value, selected);
          roleList.innerHTML = rolesFor(area.value, goal.value).map(x=>`<option value="${escapeHtml(x)}"></option>`).join('');
        };
        area.onchange = () => { goal.innerHTML = classificationOptions(area.value); refresh(); };
        goal.onchange = refresh;
        refresh();
        form.onsubmit = event => {
          event.preventDefault();
          const title = form.elements.title.value.trim();
          if (!title) return;
          const plan = {id:makeId('plan'),month:monthCursor,area:area.value||'기타',goal:goal.value||'',role:role.value.trim(),title,status:'planned',weeklyIds:[],createdAt:nowIso(),updatedAt:nowIso()};
          ledger().monthlyPlans.push(plan);
          addEvent({type:'monthly-created',monthlyPlanId:plan.id,title:plan.title,area:plan.area,goal:plan.goal,role:plan.role,date:`${monthCursor}-01`});
          save('월간 업무를 추가했습니다.');
          renderMonthly();
        };
      }
      document.querySelectorAll('[data-plan-status]').forEach(btn => btn.onclick = () => {
        const plan = ledger().monthlyPlans.find(x=>x.id===btn.dataset.planStatus); if(!plan)return;
        const order=['planned','doing','done']; plan.status=order[(order.indexOf(plan.status)+1)%order.length]; plan.updatedAt=nowIso();
        addEvent({type:'monthly-status',monthlyPlanId:plan.id,title:plan.title,area:plan.area,status:plan.status,date:`${plan.month}-01`}); save(); renderMonthly();
      });
      document.querySelectorAll('[data-plan-week]').forEach(btn => btn.onclick = () => {
        const plan = ledger().monthlyPlans.find(x=>x.id===btn.dataset.planWeek); if(!plan)return;
        const target = add(mon(today()),Number(btn.dataset.offset||0));
        const task = newWeeklyTask({title:plan.title,area:plan.area,goal:plan.goal,role:plan.role,target,monthlyPlanId:plan.id});
        plan.weeklyIds = Array.isArray(plan.weeklyIds) ? plan.weeklyIds : []; plan.weeklyIds.push(task.id); plan.status = plan.status==='planned'?'doing':plan.status; plan.updatedAt=nowIso();
        addEvent({type:'monthly-to-week',monthlyPlanId:plan.id,workItemId:task.id,title:plan.title,area:plan.area,date:target}); save();
        specialView='monthly'; presentSpecial(); toast(`${Number(btn.dataset.offset||0)?'차주':'이번 주'} 업무로 등록했습니다.`);
      });
      document.querySelectorAll('[data-plan-delete]').forEach(btn => btn.onclick = () => {
        const plan = ledger().monthlyPlans.find(x=>x.id===btn.dataset.planDelete); if(!plan)return;
        if(!confirm(`“${plan.title}” 월간 업무를 삭제할까요?`))return;
        addEvent({type:'monthly-deleted',monthlyPlanId:plan.id,title:plan.title,area:plan.area,date:`${plan.month}-01`});
        ledger().monthlyPlans = ledger().monthlyPlans.filter(x=>x.id!==plan.id); save('월간 업무를 삭제했습니다.'); renderMonthly();
      });
      document.querySelectorAll('[data-plan-edit]').forEach(btn => btn.onclick = () => openPlanEditor(btn.dataset.planEdit));
    }

    function openPlanEditor(id) {
      const plan = ledger().monthlyPlans.find(x=>x.id===id); if(!plan)return;
      document.getElementById('modalRoot').innerHTML = `<div class="modalbg"><div class="modal"><h2>월간 업무 수정</h2><div class="field"><label>업무명</label><input id="planEditTitle" class="input" value="${escapeHtml(plan.title)}"></div><div class="field"><label>큰 업무영역</label><select id="planEditArea">${allAreas().map(area=>`<option value="${escapeHtml(area)}" ${area===plan.area?'selected':''}>${escapeHtml(area)}</option>`).join('')}</select></div><div class="field"><label>목표</label><input id="planEditGoal" class="input" value="${escapeHtml(plan.goal||'')}"></div><div class="field"><label>주요 역할</label><input id="planEditRole" class="input" value="${escapeHtml(plan.role||'')}"></div><div class="modalactions"><button class="btn" id="planEditCancel">취소</button><button class="btn primary" id="planEditSave">저장</button></div></div></div>`;
      document.getElementById('planEditCancel').onclick=()=>document.getElementById('modalRoot').innerHTML='';
      document.getElementById('planEditSave').onclick=()=>{
        plan.title=document.getElementById('planEditTitle').value.trim()||plan.title; plan.area=document.getElementById('planEditArea').value||'기타'; plan.goal=document.getElementById('planEditGoal').value.trim(); plan.role=document.getElementById('planEditRole').value.trim(); plan.updatedAt=nowIso();
        save('월간 업무를 수정했습니다.'); document.getElementById('modalRoot').innerHTML=''; renderMonthly();
      };
    }

    function allHistoryTasks() {
      const archived = ledger().archivedTasks.map(x=>({...x,__archived:true}));
      const active = S.workItems.map(x=>({...x,__archived:false}));
      const byId = new Map();
      [...archived,...active].forEach(task=>byId.set(task.id,task));
      return [...byId.values()];
    }

    function taskDatesInYear(task, year) {
      const dates = [];
      if (task.completedAt?.startsWith(`${year}-`)) dates.push(task.completedAt);
      Object.keys(task.dailyChecks||{}).forEach(date=>{ if(date.startsWith(`${year}-`)) dates.push(date); });
      if (task.createdAt?.startsWith(`${year}-`)) dates.push(task.createdAt);
      return dates;
    }

    function renderHistory() {
      const rootEl = document.getElementById(ROOT_HISTORY_ID); if(!rootEl)return;
      const tasks = allHistoryTasks();
      const taskYears = tasks.flatMap(task => [task.createdAt, task.completedAt, ...Object.keys(task.dailyChecks||{})]).map(value => Number(String(value||'').slice(0,4))).filter(Number.isFinite);
      const years = [...new Set([Number(today().slice(0,4)), ...taskYears, ...ledger().events.map(e=>Number(String(e.date||e.at||'').slice(0,4))).filter(Number.isFinite), ...ledger().monthlyPlans.map(p=>Number(p.month?.slice(0,4))).filter(Number.isFinite)])].filter(Boolean).sort((a,b)=>b-a);
      if (!years.includes(historyYear)) years.push(historyYear);
      const areas = allAreas();
      const monthStats = Array.from({length:12},(_,i)=>{
        const key=`${historyYear}-${String(i+1).padStart(2,'0')}`;
        const completed=tasks.filter(t=>t.completedAt?.startsWith(key)).length;
        const checks=tasks.reduce((sum,t)=>sum+Object.keys(t.dailyChecks||{}).filter(d=>d.startsWith(key)).length,0);
        return {key,completed,checks};
      });
      const monthMatch = date => historyMonth==='all' || String(date||'').startsWith(`${historyYear}-${historyMonth}`);
      const areaMatch = task => historyArea==='all' || taskArea(task)===historyArea;
      const relevant = tasks.filter(task=>areaMatch(task) && taskDatesInYear(task,historyYear).some(monthMatch));
      const completedCount = relevant.filter(t=>t.completedAt && monthMatch(t.completedAt)).length;
      const checkCount = relevant.reduce((sum,t)=>sum+Object.keys(t.dailyChecks||{}).filter(d=>d.startsWith(`${historyYear}-`)&&monthMatch(d)).length,0);
      const planCount = ledger().monthlyPlans.filter(p=>p.month?.startsWith(`${historyYear}-`)&&(historyMonth==='all'||p.month.endsWith(`-${historyMonth}`))&&(historyArea==='all'||p.area===historyArea)).length;
      const eventCount = ledger().events.filter(e=>String(e.date||e.at||'').startsWith(`${historyYear}-`)&&monthMatch(e.date||e.at)&& (historyArea==='all'||!e.area||e.area===historyArea)).length;

      const monthsToRender = historyMonth==='all' ? Array.from({length:12},(_,i)=>String(i+1).padStart(2,'0')) : [historyMonth];
      const detail = monthsToRender.map(mm=>{
        const key=`${historyYear}-${mm}`;
        const monthTasks = tasks.filter(task=>areaMatch(task) && (task.completedAt?.startsWith(key)||Object.keys(task.dailyChecks||{}).some(d=>d.startsWith(key))));
        const grouped = new Map();
        monthTasks.forEach(task=>{ const area=taskArea(task); if(!grouped.has(area))grouped.set(area,[]); grouped.get(area).push(task); });
        const areasHtml=[...grouped.entries()].map(([area,rows])=>`<div class="history-area"><h4>${escapeHtml(area)}</h4>${rows.map(task=>{ const checks=Object.entries(task.dailyChecks||{}).filter(([d])=>d.startsWith(key)); const done=task.completedAt?.startsWith(key)?`완료 ${formatDate(task.completedAt)}`:''; const latest=checks.sort(([a],[b])=>b.localeCompare(a))[0]; const progress=checks.length?`일일체크 ${checks.length}회${latest?` · 최근 ${formatDate(latest[0])} ${statusText(typeof latest[1]==='string'?latest[1]:latest[1]?.status)}`:''}`:''; return `<div class="history-item"><div><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(taskGoal(task)||taskArea(task))}${taskRole(task)?` · ${escapeHtml(taskRole(task))}`:''}${task.__archived?' · 삭제된 업무':''}</small></div><em>${[done,progress].filter(Boolean).join(' · ')||'기록 있음'}</em></div>`;}).join('')}</div>`).join('');
        const monthPlans=ledger().monthlyPlans.filter(p=>p.month===key&&(historyArea==='all'||p.area===historyArea));
        const plansHtml=monthPlans.length?`<div class="history-area"><h4>월간계획</h4>${monthPlans.map(p=>`<div class="history-item"><div><strong>${escapeHtml(p.title)}</strong><small>${escapeHtml(p.area)}${p.goal?` · ${escapeHtml(p.goal)}`:''}</small></div><em>${planStatusText(p.status)}</em></div>`).join('')}</div>`:'';
        if(!areasHtml&&!plansHtml)return '';
        return `<details class="history-group" ${historyMonth!=='all'||key===today().slice(0,7)?'open':''}><summary>${historyYear}년 ${Number(mm)}월 · 완료 ${monthStats[Number(mm)-1].completed} · 체크 ${monthStats[Number(mm)-1].checks}</summary>${areasHtml}${plansHtml}</details>`;
      }).join('');

      rootEl.innerHTML=`<div class="ledger-hero"><div><div class="ledger-kicker">WORK HISTORY · ARCHIVE</div><h2>업무이력</h2><p>주간업무의 일일 체크, 완료 기록, 월간계획을 월·연도별로 다시 봅니다.</p></div><div class="ledger-controls"><select id="historyYear">${years.sort((a,b)=>b-a).map(y=>`<option value="${y}" ${y===historyYear?'selected':''}>${y}년</option>`).join('')}</select><select id="historyMonth"><option value="all" ${historyMonth==='all'?'selected':''}>전체 월</option>${Array.from({length:12},(_,i)=>String(i+1).padStart(2,'0')).map(mm=>`<option value="${mm}" ${mm===historyMonth?'selected':''}>${Number(mm)}월</option>`).join('')}</select><select id="historyArea"><option value="all" ${historyArea==='all'?'selected':''}>전체 업무영역</option>${areas.map(area=>`<option value="${escapeHtml(area)}" ${area===historyArea?'selected':''}>${escapeHtml(area)}</option>`).join('')}</select><button type="button" class="history-copy" id="historyCopy">회고용 복사</button></div></div><div class="history-summary">${monthStats.map((m,i)=>`<button type="button" class="history-month ${historyMonth===String(i+1).padStart(2,'0')?'active':''}" data-history-month="${String(i+1).padStart(2,'0')}"><b>${i+1}</b><span>완료 ${m.completed} · 체크 ${m.checks}</span></button>`).join('')}</div><div class="history-metrics"><div class="history-metric"><span>완료 업무</span><strong>${completedCount}</strong></div><div class="history-metric"><span>일일 체크</span><strong>${checkCount}</strong></div><div class="history-metric"><span>월간 업무</span><strong>${planCount}</strong></div><div class="history-metric"><span>변경 기록</span><strong>${eventCount}</strong></div></div>${detail||'<div class="monthly-empty">선택한 기간의 업무이력이 없습니다.</div>'}`;
      bindHistory();
    }

    function bindHistory() {
      const year=document.getElementById('historyYear'), month=document.getElementById('historyMonth'), area=document.getElementById('historyArea');
      if(year)year.onchange=()=>{historyYear=Number(year.value);renderHistory();};
      if(month)month.onchange=()=>{historyMonth=month.value;renderHistory();};
      if(area)area.onchange=()=>{historyArea=area.value;renderHistory();};
      document.querySelectorAll('[data-history-month]').forEach(btn=>btn.onclick=()=>{historyMonth=historyMonth===btn.dataset.historyMonth?'all':btn.dataset.historyMonth;renderHistory();});
      const copy=document.getElementById('historyCopy'); if(copy)copy.onclick=()=>copyHistorySummary();
    }

    function copyHistorySummary() {
      const tasks=allHistoryTasks().filter(task=>historyArea==='all'||taskArea(task)===historyArea);
      const monthPrefix=historyMonth==='all'?`${historyYear}-`:`${historyYear}-${historyMonth}`;
      const relevant=tasks.filter(task=>(task.completedAt||'').startsWith(monthPrefix)||Object.keys(task.dailyChecks||{}).some(d=>d.startsWith(monthPrefix)));
      const grouped=new Map();
      relevant.forEach(task=>{const area=taskArea(task);if(!grouped.has(area))grouped.set(area,[]);grouped.get(area).push(task);});
      const lines=[`${historyYear}년${historyMonth==='all'?'':` ${Number(historyMonth)}월`} 업무 정리`,''];
      for(const [area,rows] of grouped){lines.push(`[${area}]`);rows.forEach(task=>{const checks=Object.keys(task.dailyChecks||{}).filter(d=>d.startsWith(monthPrefix)).length;lines.push(`- ${task.title}${task.completedAt?.startsWith(monthPrefix)?` (완료 ${task.completedAt})`:checks?` (진행기록 ${checks}회)`:''}`);});lines.push('');}
      const plans=ledger().monthlyPlans.filter(p=>p.month?.startsWith(monthPrefix)&&(historyArea==='all'||p.area===historyArea));
      if(plans.length){lines.push('[월간계획]');plans.forEach(p=>lines.push(`- ${p.title} · ${planStatusText(p.status)}`));}
      navigator.clipboard.writeText(lines.join('\n')).then(()=>toast('회고용 업무 정리를 복사했습니다.'));
    }

    const previousSetStatus = setStatus;
    setStatus = function(id,status){
      const task=S.workItems.find(x=>x.id===id); const before=task?.status;
      if(task && status!=='blocked' && before!==status) addEvent({type:'status',workItemId:task.id,title:task.title,area:taskArea(task),goal:taskGoal(task),role:taskRole(task),date:today(),from:before,to:status});
      previousSetStatus(id,status);
    };

    del = function(id){
      const task=S.workItems.find(x=>x.id===id); if(!task)return;
      if(!confirm(`“${task.title}” 업무를 삭제할까요?`))return;
      archiveTask(task,'delete'); addEvent({type:'deleted',workItemId:task.id,title:task.title,area:taskArea(task),goal:taskGoal(task),role:taskRole(task),date:today()});
      S.workItems=S.workItems.filter(x=>x.id!==id); save('업무는 삭제했지만 이력에는 보관했습니다.'); render();
    };

    const previousRender = render;
    render = function(){
      previousRender();
      ensureLedger();
      if(specialView) presentSpecial();
    };

    createNav();
    createRoots();
    ensureLedger();
    render();
  }

  boot();
})();
