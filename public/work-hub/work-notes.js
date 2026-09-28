/* Work Hub scratch notes and calendar drag-and-drop. */
(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else {
    root.WorkHubWorkNotes = api;
    api.boot();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const NOTE_STORE_KEY = 'workNotes';
  const FILTER_STORE_KEY = 'calendarLayers';
  const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
  const WEEKDAYS = { '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6 };
  const BUCKETS = [
    { id: 'inbox', label: '메모함', sub: '날짜를 정하지 않은 메모', icon: '✎' },
    { id: 'last', label: '지난주 한 일', sub: '이전 주로 이동하면 자동 완료', icon: '✓' },
    { id: 'this', label: '이번주 메모', sub: '이번 주에 챙길 내용', icon: '●' },
    { id: 'next', label: '차주 할 일', sub: '다음 주 준비 사항', icon: '→' },
    { id: 'later', label: '이후 일정', sub: '차주 이후에 할 일', icon: '…' },
  ];

  function parseYmd(value) {
    if (!YMD_RE.test(String(value || ''))) return null;
    const [year, month, day] = String(value).split('-').map(Number);
    const date = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return date;
  }

  function formatYmd(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function addDays(value, amount) {
    const date = value instanceof Date ? new Date(value) : parseYmd(value);
    if (!date) return '';
    date.setDate(date.getDate() + Number(amount || 0));
    return formatYmd(date);
  }

  function mondayOf(value) {
    const date = value instanceof Date ? new Date(value) : parseYmd(value);
    if (!date) return '';
    const offset = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - offset);
    return formatYmd(date);
  }

  function weekdayOffset(value) {
    const date = parseYmd(value);
    return date ? (date.getDay() + 6) % 7 : 0;
  }

  function validYmd(value) {
    return Boolean(parseYmd(value));
  }

  function parseNaturalDate(text, todayYmd) {
    const source = String(text || '');
    const base = validYmd(todayYmd) ? todayYmd : formatYmd(new Date());

    const iso = source.match(/\b(20\d{2})[.\/-](\d{1,2})[.\/-](\d{1,2})\b/);
    if (iso) {
      const candidate = `${iso[1]}-${String(Number(iso[2])).padStart(2, '0')}-${String(Number(iso[3])).padStart(2, '0')}`;
      if (validYmd(candidate)) return candidate;
    }

    const monthDay = source.match(/(?:^|\s)(\d{1,2})\s*(?:월|\/|\.)\s*(\d{1,2})\s*(?:일)?/);
    if (monthDay) {
      const baseDate = parseYmd(base);
      let year = baseDate.getFullYear();
      let candidate = `${year}-${String(Number(monthDay[1])).padStart(2, '0')}-${String(Number(monthDay[2])).padStart(2, '0')}`;
      if (validYmd(candidate)) {
        const gap = (parseYmd(candidate) - baseDate) / 86400000;
        if (gap < -120) {
          year += 1;
          candidate = `${year}-${String(Number(monthDay[1])).padStart(2, '0')}-${String(Number(monthDay[2])).padStart(2, '0')}`;
        }
        if (validYmd(candidate)) return candidate;
      }
    }

    if (source.includes('모레')) return addDays(base, 2);
    if (source.includes('내일')) return addDays(base, 1);
    if (source.includes('오늘')) return base;

    const weekDay = source.match(/(지난\s*주|저번\s*주|이번\s*주|다음\s*주|담\s*주|차\s*주)\s*([월화수목금토일])(?:요일)?/);
    if (weekDay) {
      const token = weekDay[1].replace(/\s/g, '');
      const weekOffset = token === '지난주' || token === '저번주' ? -1 : token === '이번주' ? 0 : 1;
      return addDays(mondayOf(base), weekOffset * 7 + WEEKDAYS[weekDay[2]]);
    }

    if (/(다음\s*주|담\s*주|차\s*주)/.test(source)) return addDays(mondayOf(base), 7);
    if (/(지난\s*주|저번\s*주)/.test(source)) return addDays(mondayOf(base), -7);
    if (/이번\s*주/.test(source)) return mondayOf(base);
    return '';
  }

  function bucketForDate(date, todayYmd) {
    if (!validYmd(date)) return 'inbox';
    const week = mondayOf(todayYmd);
    const next = addDays(week, 7);
    const afterNext = addDays(week, 14);
    if (date < week) return 'last';
    if (date < next) return 'this';
    if (date < afterNext) return 'next';
    return 'later';
  }

  function dateForBucket(currentDate, bucket, todayYmd) {
    if (bucket === 'inbox') return '';
    const todayValue = validYmd(todayYmd) ? todayYmd : formatYmd(new Date());
    const reference = validYmd(currentDate) ? currentDate : todayValue;
    const day = weekdayOffset(reference);
    const week = mondayOf(todayValue);
    if (bucket === 'last') return addDays(week, -7 + day);
    if (bucket === 'this') return addDays(week, day);
    if (bucket === 'next') return addDays(week, 7 + day);
    return addDays(week, 14 + day);
  }

  function applyTaskDate(taskInput, date, todayYmd) {
    const task = { ...(taskInput || {}) };
    if (!validYmd(date)) return task;
    const currentWeek = mondayOf(todayYmd);
    const nextWeek = addDays(currentWeek, 7);
    task.dueDate = date;
    if (task.scope === 'daily') task.target = date;
    else {
      task.scope = 'weekly';
      task.target = mondayOf(date);
    }
    if (date < currentWeek) {
      task.status = 'done';
      task.completedAt = date;
    } else if (date >= nextWeek && task.status === 'done') {
      task.status = 'todo';
      task.completedAt = null;
    }
    task.updatedAt = todayYmd;
    task.calendarMovedAt = new Date().toISOString();
    return task;
  }

  function normalizeNote(note, nowIso, makeId) {
    const source = note && typeof note === 'object' ? note : {};
    return {
      id: String(source.id || makeId()),
      body: String(source.body || source.text || ''),
      scheduledDate: validYmd(source.scheduledDate) ? source.scheduledDate : '',
      status: source.status === 'done' ? 'done' : 'open',
      createdAt: String(source.createdAt || nowIso),
      updatedAt: String(source.updatedAt || source.createdAt || nowIso),
    };
  }

  function boot() {
    if (!root.document || root.__workhubNotesLoaded) return;
    root.__workhubNotesLoaded = true;

    const expandedNotes = new Set();
    let notesActive = false;

    function attempt() {
      const document = root.document;
      const nav = document.querySelector('.nav');
      const main = document.querySelector('.main');
      const appRoot = document.getElementById('root');
      const pageTitle = document.getElementById('pageTitle');
      if (!nav || !main || !appRoot || !pageTitle || typeof S === 'undefined' || typeof root.render !== 'function' || typeof root.save !== 'function') {
        root.setTimeout(attempt, 120);
        return;
      }
      if (document.getElementById('workhub-notes-nav')) return;

      const nowIso = () => new Date().toISOString();
      const currentDate = () => typeof root.today === 'function' ? root.today() : formatYmd(new Date());
      const makeId = () => typeof root.uid === 'function'
        ? root.uid()
        : (root.crypto?.randomUUID?.() || `memo-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      const escapeHtml = (value) => typeof root.esc === 'function'
        ? root.esc(String(value ?? ''))
        : String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));

      function ensureState() {
        S.settings = S.settings || {};
        if (!Array.isArray(S.settings[NOTE_STORE_KEY])) S.settings[NOTE_STORE_KEY] = [];
        const seen = new Set();
        S.settings[NOTE_STORE_KEY] = S.settings[NOTE_STORE_KEY]
          .map((note) => normalizeNote(note, nowIso(), makeId))
          .filter((note) => note.body.trim() && !seen.has(note.id) && seen.add(note.id));
        const current = S.settings[FILTER_STORE_KEY];
        S.settings[FILTER_STORE_KEY] = {
          tasks: current?.tasks !== false,
          notes: current?.notes !== false,
          vacations: current?.vacations !== false,
        };
        return S.settings[NOTE_STORE_KEY];
      }

      function notes() {
        return ensureState();
      }

      function filters() {
        ensureState();
        return S.settings[FILTER_STORE_KEY];
      }

      function saveState(message) {
        root.save(message || undefined);
      }

      const style = document.createElement('style');
      style.id = 'workhub-notes-style';
      style.textContent = `
        #workhub-notes-nav.active{background:#81525a!important;border-color:#c09a68!important;color:#fff7e5!important;box-shadow:inset 3px 0 #e4c693}
        .notes-root{max-width:1900px;margin:0 auto;padding:22px 32px 48px}.notes-root[hidden]{display:none!important}
        .memo-hero{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:22px 24px;border:1px solid var(--line);border-top:4px double #af8b53;border-radius:6px;background:linear-gradient(135deg,color-mix(in srgb,var(--card) 88%,#b99d62),var(--card))}
        .memo-kicker{font-size:11px;letter-spacing:3px;color:var(--muted);font-weight:900}.memo-hero h2{font-family:Georgia,'Noto Serif KR',Batang,serif;font-size:30px;margin:5px 0 7px}.memo-hero p{margin:0;color:var(--muted);font-size:14px;line-height:1.55}.memo-count{flex:0 0 auto;border:1px solid #bd9349;background:#fff6d9;color:#765315;border-radius:999px;padding:9px 13px;font-size:12px;font-weight:950}.dark .memo-count{background:#40351c;color:#ffe09a;border-color:#715b2d}
        .memo-composer{margin-top:16px;padding:18px;border:1px solid var(--line);border-radius:7px;background:var(--card);box-shadow:var(--shadow)}.memo-composer textarea{min-height:126px;resize:vertical;font-size:17px;line-height:1.65;border-radius:6px!important}.memo-composer-foot{display:grid;grid-template-columns:minmax(190px,250px) minmax(0,1fr) auto;gap:9px;align-items:center;margin-top:10px}.memo-composer-foot small{color:var(--muted);font-size:11px;line-height:1.4}.memo-composer-foot input{border-radius:5px!important}
        .memo-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin:14px 0}.memo-metric{padding:13px 15px;border:1px solid var(--line);border-radius:6px;background:var(--card)}.memo-metric span{display:block;color:var(--muted);font-size:11px}.memo-metric strong{display:block;margin-top:4px;font:700 24px Georgia,serif;color:var(--brand)}
        .memo-buckets{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px;align-items:start}.memo-bucket{min-height:130px;border:1px solid var(--line);border-top:3px double #b59a72;border-radius:6px;background:var(--card);overflow:hidden}.memo-bucket.drag-over{outline:3px solid #b38b42;outline-offset:3px;background:color-mix(in srgb,var(--card) 88%,#ead9a9)}.memo-bucket-head{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:13px 15px;border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--card) 87%,#c5ac79)}.memo-bucket-head b{font-size:16px}.memo-bucket-head small{display:block;margin-top:3px;color:var(--muted);font-size:10px}.memo-bucket-count{min-width:28px;height:28px;display:grid;place-items:center;border:1px solid var(--line);border-radius:4px;color:var(--brand);font-size:11px;font-weight:900}.memo-list{padding:8px 10px 12px}.memo-empty{padding:25px 12px;text-align:center;color:var(--muted);font-size:11px}
        .memo-card{margin:8px 0;border:1px solid var(--line);border-radius:6px;background:var(--card);overflow:hidden;transition:.12s}.memo-card:hover{border-color:#b69767}.memo-card.done{background:color-mix(in srgb,var(--card) 88%,#b5d2b3)}.memo-card.dragging{opacity:.48}.memo-toggle{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:9px;align-items:center;width:100%;padding:12px;border:0;background:transparent;color:var(--ink);text-align:left;cursor:pointer}.memo-chevron{font-size:14px;color:var(--muted);transition:.15s}.memo-toggle[aria-expanded=true] .memo-chevron{transform:rotate(90deg)}.memo-summary{min-width:0;font-size:14px;font-weight:800;line-height:1.45;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.memo-card.done .memo-summary{text-decoration:line-through;color:var(--muted)}.memo-meta{text-align:right;color:var(--muted);font-size:9px;white-space:nowrap}.memo-meta b{display:block;color:var(--brand);font-size:10px}.memo-edit{padding:0 12px 13px}.memo-edit textarea{min-height:110px;resize:vertical;border-radius:5px!important;font-size:14px;line-height:1.55}.memo-edit-grid{display:grid;grid-template-columns:minmax(160px,220px) minmax(0,1fr);gap:9px;margin-top:9px}.memo-moves{display:flex;gap:6px;flex-wrap:wrap}.memo-moves button,.memo-actions button{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:5px;padding:7px 9px;font-size:10px;font-weight:900;cursor:pointer}.memo-moves button:hover{border-color:#9c7543}.memo-actions{display:flex;justify-content:flex-end;gap:7px;margin-top:10px}.memo-actions .primary{background:var(--brand);border-color:var(--brand);color:#fff}.memo-actions .danger{color:#a33c43;border-color:#d7a3a7}.memo-drag-hint{margin:12px 1px 0;color:var(--muted);font-size:11px}
        .calendar-layers{display:flex;gap:5px;align-items:center;flex-wrap:wrap}.calendar-layer{border:1px solid var(--line);background:var(--card);color:var(--muted);border-radius:5px;padding:7px 9px;font-size:10px;font-weight:900;cursor:pointer}.calendar-layer.active{background:#69404b;color:#fff;border-color:#69404b}.calendar-dnd-hint{margin:6px 0 0;color:#7b6e61;font-size:10px;font-weight:800}.cal-day.drag-over{outline:3px solid #b38b42!important;outline-offset:-2px;background:color-mix(in srgb,var(--card) 78%,#f2dfa5)!important}.cal-workhub-drag-list{display:flex;flex-direction:column;gap:3px;min-width:0}.cal-drag-chip{display:block;max-width:100%;border:0;border-radius:3px;padding:2px 4px;text-align:left;font-size:10px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:grab}.cal-drag-chip:active{cursor:grabbing}.cal-drag-chip.task{background:#e7efff;color:#315b9b}.cal-drag-chip.note{background:#fff0c9;color:#7f5815}.dark .cal-drag-chip.task{background:#1d3451;color:#a8d0ff}.dark .cal-drag-chip.note{background:#493c1d;color:#ffe099}.cal-drag-chip.done{text-decoration:line-through;opacity:.75}.cal-more{font-size:9px;color:var(--muted)}.cal-tooltip.workhub-native-tooltip-hidden{display:none!important}.cal-dnd-tooltip{display:none;position:absolute;left:8px;top:calc(100% - 2px);width:min(390px,80vw);background:#091322;color:#eef4ff;border:1px solid #2b4260;border-radius:10px;padding:10px;box-shadow:0 18px 45px rgba(3,8,15,.34);z-index:101}.cal-day:nth-child(7n+6) .cal-dnd-tooltip,.cal-day:nth-child(7n+7) .cal-dnd-tooltip{left:auto;right:8px}.cal-day:hover .cal-dnd-tooltip{display:block}.cal-dnd-tooltip b{display:block;font-size:11px;margin-bottom:6px}.cal-dnd-tip{padding:5px 0;border-top:1px solid #1f3149;font-size:10px;line-height:1.4}.cal-dnd-tip:first-of-type{border-top:0}.cal-dnd-tip.note{color:#ffe09a}.cal-dnd-tip.vacation{color:#c5bcff}
        .memo-day-list{margin:10px 0}.memo-day-item{padding:10px 11px;border:1px solid #e1c77e;background:#fff9e8;border-radius:8px;margin:7px 0}.dark .memo-day-item{background:#3b321d;border-color:#6f5c2b}.memo-day-item b{display:block;font-size:13px}.memo-day-item small{display:block;margin-top:4px;color:var(--muted);font-size:10px}.memo-day-item button{margin-top:7px}
        @media(max-width:1100px){.memo-buckets{grid-template-columns:1fr}.memo-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(max-width:980px){.notes-root{padding:18px 18px 38px}.memo-composer-foot{grid-template-columns:1fr auto}.memo-composer-foot small{grid-column:1/-1;grid-row:2}.memo-edit-grid{grid-template-columns:1fr}}
        @media(max-width:700px){.cal-workhub-drag-list{display:none}.calendar-layers{width:100%}.memo-hero{align-items:flex-start;flex-direction:column}.memo-metrics{grid-template-columns:1fr 1fr}}
        @media(max-width:620px){.notes-root{padding:14px 12px 32px}.memo-hero{padding:17px}.memo-hero h2{font-size:25px}.memo-composer{padding:13px}.memo-composer-foot{grid-template-columns:1fr}.memo-composer-foot small{grid-column:auto;grid-row:auto}.memo-metrics{grid-template-columns:1fr 1fr}}
      `;
      document.head.appendChild(style);

      const notesDivider = document.createElement('div');
      notesDivider.className = 'nav-divider';
      notesDivider.setAttribute('aria-hidden', 'true');
      notesDivider.innerHTML = '<span>업무 정리</span>';

      const notesButton = document.createElement('button');
      notesButton.id = 'workhub-notes-nav';
      notesButton.type = 'button';
      notesButton.dataset.view = 'work-notes';
      notesButton.innerHTML = '📝 <span>메모장</span>';
      notesButton.setAttribute('aria-controls', 'workhub-notes-root');

      const liveButton = document.getElementById('workhub-live-nav');
      const insertBefore = liveButton?.previousElementSibling?.classList.contains('nav-divider')
        ? liveButton.previousElementSibling
        : liveButton;
      if (insertBefore) {
        nav.insertBefore(notesDivider, insertBefore);
        nav.insertBefore(notesButton, insertBefore);
      } else nav.append(notesDivider, notesButton);

      const notesRoot = document.createElement('div');
      notesRoot.id = 'workhub-notes-root';
      notesRoot.className = 'notes-root';
      notesRoot.hidden = true;
      main.appendChild(notesRoot);

      const addGlobal = document.getElementById('addGlobal');
      const liveRoot = document.getElementById('workhub-live-root');
      const arcadeRoot = document.getElementById('workhub-arcade-root');

      function summary(body) {
        const compact = String(body || '').replace(/\s+/g, ' ').trim();
        return compact.length > 82 ? `${compact.slice(0, 82)}…` : compact;
      }

      function displayDate(value) {
        if (!validYmd(value)) return '날짜 미정';
        const date = parseYmd(value);
        return `${date.getMonth() + 1}/${date.getDate()} (${['일','월','화','수','목','금','토'][date.getDay()]})`;
      }

      function noteCard(note) {
        const open = expandedNotes.has(note.id);
        return `<article class="memo-card ${note.status === 'done' ? 'done' : ''}" data-note-id="${escapeHtml(note.id)}">
          <button type="button" class="memo-toggle" draggable="true" data-note-toggle="${escapeHtml(note.id)}" aria-expanded="${open}">
            <span class="memo-chevron">›</span><span class="memo-summary">${escapeHtml(summary(note.body))}</span>
            <span class="memo-meta"><b>${escapeHtml(displayDate(note.scheduledDate))}</b>${note.status === 'done' ? '완료' : '진행'}</span>
          </button>
          ${open ? `<div class="memo-edit">
            <textarea data-note-body="${escapeHtml(note.id)}">${escapeHtml(note.body)}</textarea>
            <div class="memo-edit-grid">
              <input type="date" data-note-date="${escapeHtml(note.id)}" value="${escapeHtml(note.scheduledDate)}">
              <div class="memo-moves">
                <button type="button" data-note-move="last" data-note-id="${escapeHtml(note.id)}">지난주</button>
                <button type="button" data-note-move="this" data-note-id="${escapeHtml(note.id)}">이번주</button>
                <button type="button" data-note-move="next" data-note-id="${escapeHtml(note.id)}">차주</button>
                <button type="button" data-note-move="inbox" data-note-id="${escapeHtml(note.id)}">날짜 해제</button>
              </div>
            </div>
            <div class="memo-actions">
              <button type="button" data-note-done="${escapeHtml(note.id)}">${note.status === 'done' ? '다시 진행' : '완료 처리'}</button>
              <button type="button" class="danger" data-note-delete="${escapeHtml(note.id)}">삭제</button>
              <button type="button" class="primary" data-note-save="${escapeHtml(note.id)}">저장</button>
            </div>
          </div>` : ''}
        </article>`;
      }

      function renderNotes() {
        const all = notes();
        const groups = Object.fromEntries(BUCKETS.map((bucket) => [bucket.id, []]));
        [...all].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).forEach((note) => {
          groups[bucketForDate(note.scheduledDate, currentDate())].push(note);
        });
        const openCount = all.filter((note) => note.status !== 'done').length;
        const thisCount = groups.this.length;
        const nextCount = groups.next.length;
        const doneCount = all.filter((note) => note.status === 'done').length;

        notesRoot.innerHTML = `<section class="memo-hero">
          <div><div class="memo-kicker">QUICK CAPTURE · WEEKLY MEMORY</div><h2>주절주절 메모장</h2><p>지시받는 내용을 그대로 적으세요. Enter로 저장하고, Shift+Enter로 줄을 바꿉니다. 날짜 표현이 있으면 자동으로 캘린더에 잡힙니다.</p></div>
          <span class="memo-count">메모 ${all.length}개</span>
        </section>
        <section class="memo-composer">
          <textarea id="workMemoInput" placeholder="예: 비올라조달은 식별번호 받고 CXMS 응답 온 뒤 진행. 비올라 자료 준비는 담주목 정도..."></textarea>
          <div class="memo-composer-foot"><input id="workMemoDate" type="date" title="날짜 선택(선택)"><small>날짜를 비우면 ‘오늘·내일·담주목·차주’ 같은 표현을 자동으로 읽습니다.</small><button type="button" class="btn primary" id="workMemoSave">메모 저장</button></div>
        </section>
        <div class="memo-metrics"><div class="memo-metric"><span>진행 메모</span><strong>${openCount}</strong></div><div class="memo-metric"><span>이번주</span><strong>${thisCount}</strong></div><div class="memo-metric"><span>차주</span><strong>${nextCount}</strong></div><div class="memo-metric"><span>완료</span><strong>${doneCount}</strong></div></div>
        <div class="memo-buckets">${BUCKETS.map((bucket) => `<section class="memo-bucket" data-note-bucket="${bucket.id}"><div class="memo-bucket-head"><div><b>${bucket.icon} ${bucket.label}</b><small>${bucket.sub}</small></div><span class="memo-bucket-count">${groups[bucket.id].length}</span></div><div class="memo-list">${groups[bucket.id].length ? groups[bucket.id].map(noteCard).join('') : '<div class="memo-empty">메모를 끌어 이곳에 놓을 수 있습니다.</div>'}</div></section>`).join('')}</div>
        <p class="memo-drag-hint">메모 제목을 끌어서 지난주·이번주·차주 칸으로 옮길 수 있습니다. 캘린더에서도 업무와 메모를 날짜 사이로 이동할 수 있습니다.</p>`;

        const input = notesRoot.querySelector('#workMemoInput');
        const dateInput = notesRoot.querySelector('#workMemoDate');
        const addNote = () => {
          const body = input.value.trim();
          if (!body) return;
          const scheduledDate = dateInput.value || parseNaturalDate(body, currentDate());
          const note = normalizeNote({
            id: makeId(), body, scheduledDate,
            status: scheduledDate && scheduledDate < mondayOf(currentDate()) ? 'done' : 'open',
            createdAt: nowIso(), updatedAt: nowIso(),
          }, nowIso(), makeId);
          notes().push(note);
          expandedNotes.add(note.id);
          input.value = '';
          dateInput.value = '';
          saveState(scheduledDate ? `${displayDate(scheduledDate)} 메모로 저장했습니다.` : '메모를 저장했습니다.');
          root.render();
        };
        notesRoot.querySelector('#workMemoSave').onclick = addNote;
        input.addEventListener('keydown', (event) => {
          if (event.isComposing) return;
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            addNote();
          }
        });

        notesRoot.querySelectorAll('[data-note-toggle]').forEach((button) => {
          button.onclick = () => {
            const id = button.dataset.noteToggle;
            if (expandedNotes.has(id)) expandedNotes.delete(id); else expandedNotes.add(id);
            renderNotes();
          };
          button.addEventListener('dragstart', (event) => {
            const id = button.dataset.noteToggle;
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('application/x-workhub-item', JSON.stringify({ type: 'note', id }));
            event.dataTransfer.setData('text/plain', `note:${id}`);
            button.closest('.memo-card')?.classList.add('dragging');
          });
          button.addEventListener('dragend', () => button.closest('.memo-card')?.classList.remove('dragging'));
        });

        notesRoot.querySelectorAll('[data-note-save]').forEach((button) => button.onclick = () => {
          const note = notes().find((item) => item.id === button.dataset.noteSave);
          if (!note) return;
          const body = notesRoot.querySelector(`[data-note-body="${CSS.escape(note.id)}"]`).value.trim();
          if (!body) { root.toast?.('내용을 입력해주세요.'); return; }
          const date = notesRoot.querySelector(`[data-note-date="${CSS.escape(note.id)}"]`).value || parseNaturalDate(body, currentDate());
          note.body = body;
          note.scheduledDate = date;
          if (date && date < mondayOf(currentDate())) note.status = 'done';
          note.updatedAt = nowIso();
          saveState('메모를 수정했습니다.');
          root.render();
        });

        notesRoot.querySelectorAll('[data-note-delete]').forEach((button) => button.onclick = () => {
          const note = notes().find((item) => item.id === button.dataset.noteDelete);
          if (!note || !root.confirm(`“${summary(note.body)}” 메모를 삭제할까요?`)) return;
          S.settings[NOTE_STORE_KEY] = notes().filter((item) => item.id !== note.id);
          expandedNotes.delete(note.id);
          saveState('메모를 삭제했습니다.');
          root.render();
        });

        notesRoot.querySelectorAll('[data-note-done]').forEach((button) => button.onclick = () => {
          const note = notes().find((item) => item.id === button.dataset.noteDone);
          if (!note) return;
          note.status = note.status === 'done' ? 'open' : 'done';
          note.updatedAt = nowIso();
          saveState(note.status === 'done' ? '완료 처리했습니다.' : '진행 상태로 돌렸습니다.');
          root.render();
        });

        notesRoot.querySelectorAll('[data-note-move]').forEach((button) => button.onclick = () => {
          const note = notes().find((item) => item.id === button.dataset.noteId);
          if (!note) return;
          moveNoteToBucket(note, button.dataset.noteMove);
        });

        notesRoot.querySelectorAll('[data-note-bucket]').forEach((bucket) => {
          bucket.addEventListener('dragover', (event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; bucket.classList.add('drag-over'); });
          bucket.addEventListener('dragleave', (event) => { if (!bucket.contains(event.relatedTarget)) bucket.classList.remove('drag-over'); });
          bucket.addEventListener('drop', (event) => {
            event.preventDefault();
            bucket.classList.remove('drag-over');
            const payload = readDragPayload(event.dataTransfer);
            if (payload?.type !== 'note') return;
            const note = notes().find((item) => item.id === payload.id);
            if (note) moveNoteToBucket(note, bucket.dataset.noteBucket);
          });
        });
      }

      function moveNoteToBucket(note, bucket) {
        note.scheduledDate = dateForBucket(note.scheduledDate, bucket, currentDate());
        note.status = bucket === 'last' ? 'done' : 'open';
        note.updatedAt = nowIso();
        saveState(`${BUCKETS.find((item) => item.id === bucket)?.label || '메모함'}으로 이동했습니다.`);
        root.render();
      }

      function readDragPayload(dataTransfer) {
        try {
          const raw = dataTransfer.getData('application/x-workhub-item');
          if (raw) return JSON.parse(raw);
          const plain = dataTransfer.getData('text/plain');
          const [type, id] = plain.split(':');
          return type && id ? { type, id } : null;
        } catch { return null; }
      }

      function weekdayTokens(title) {
        const text = String(title || '');
        const groups = [...text.matchAll(/\(([^)]*)\)/g)];
        for (const group of groups) {
          const raw = group[1].trim();
          if (!raw) continue;
          const cleaned = raw.replace(/[월화수목금토일\s,\/·&+]/g, '');
          if (cleaned) continue;
          const days = raw.match(/[월화수목금토일]/g) || [];
          if (days.length) return [...new Set(days)];
        }
        return [];
      }

      function normalizedTaskDue(task) {
        if (!validYmd(task?.dueDate)) return '';
        if (task.scope === 'weekly' && validYmd(task.target)) {
          const targetWeek = mondayOf(task.target);
          if (mondayOf(task.dueDate) !== targetWeek) {
            return addDays(targetWeek, weekdayOffset(task.dueDate));
          }
        }
        return task.dueDate;
      }

      function taskDates(task) {
        const dueDate = normalizedTaskDue(task);
        if (dueDate) return [dueDate];
        if (task.scope === 'daily' && validYmd(task.target)) return [task.target];
        const days = weekdayTokens(task.title);
        if (days.length && task.scope === 'weekly' && validYmd(task.target)) {
          const week = mondayOf(task.target);
          return days.map((day) => addDays(week, WEEKDAYS[day]));
        }
        return [];
      }

      function vacationsOn(date) {
        const vacations = Array.isArray(S.settings?.vacations) ? S.settings.vacations : [];
        return vacations.filter((vacation) => {
          const start = validYmd(vacation.startDate || vacation.date) ? (vacation.startDate || vacation.date) : '';
          const end = validYmd(vacation.endDate) ? vacation.endDate : start;
          return start && date >= start && date <= end;
        });
      }

      function moveTaskToDate(task, date) {
        const before = { scope: task.scope, target: task.target, dueDate: task.dueDate, status: task.status, completedAt: task.completedAt };
        Object.assign(task, applyTaskDate(task, date, currentDate()));
        S.history = Array.isArray(S.history) ? S.history : [];
        S.history.push({ id: `calendar-${makeId()}`, type: 'calendar-reschedule', workItemId: task.id, title: task.title, at: nowIso(), from: before, to: { scope: task.scope, target: task.target, dueDate: task.dueDate, status: task.status, completedAt: task.completedAt } });
        const bucket = date < mondayOf(currentDate()) ? '지난주 한 일' : date >= addDays(mondayOf(currentDate()), 7) ? '차주 할 일' : '이번주 할 일';
        saveState(`${bucket}로 이동했습니다.`);
        root.render();
      }

      function moveNoteToDate(note, date) {
        note.scheduledDate = date;
        note.status = date < mondayOf(currentDate()) ? 'done' : 'open';
        note.updatedAt = nowIso();
        saveState(date < mondayOf(currentDate()) ? '지난주 한 일로 이동했습니다.' : date >= addDays(mondayOf(currentDate()), 7) ? '차주 할 일로 이동했습니다.' : '이번주 메모로 이동했습니다.');
        root.render();
      }

      function openNoteEditor(note, defaultDate = '') {
        const isNew = !note;
        const working = note || normalizeNote({ id: makeId(), body: '', scheduledDate: defaultDate, status: 'open', createdAt: nowIso(), updatedAt: nowIso() }, nowIso(), makeId);
        const modalRoot = document.getElementById('modalRoot');
        if (!modalRoot) return;
        modalRoot.innerHTML = `<div class="modalbg"><div class="modal"><h2>${isNew ? '메모 추가' : '메모 수정'}</h2><div class="field"><label>내용</label><textarea id="memoModalBody" rows="7" placeholder="떠오르는 내용을 그대로 적으세요.">${escapeHtml(working.body)}</textarea></div><div class="formgrid"><div class="field"><label>날짜</label><input id="memoModalDate" class="input" type="date" value="${escapeHtml(working.scheduledDate)}"></div><div class="field"><label>상태</label><select id="memoModalStatus"><option value="open" ${working.status !== 'done' ? 'selected' : ''}>진행</option><option value="done" ${working.status === 'done' ? 'selected' : ''}>완료</option></select></div></div><div class="memo-moves" style="margin-top:10px"><button type="button" data-modal-bucket="last">지난주</button><button type="button" data-modal-bucket="this">이번주</button><button type="button" data-modal-bucket="next">차주</button><button type="button" data-modal-bucket="inbox">날짜 해제</button></div><div class="modalactions"><button type="button" class="btn" id="memoModalCancel">취소</button>${isNew ? '' : '<button type="button" class="btn" id="memoModalDelete">삭제</button>'}<button type="button" class="btn primary" id="memoModalSave">저장</button></div></div></div>`;
        const body = modalRoot.querySelector('#memoModalBody');
        const date = modalRoot.querySelector('#memoModalDate');
        const status = modalRoot.querySelector('#memoModalStatus');
        modalRoot.querySelectorAll('[data-modal-bucket]').forEach((button) => button.onclick = () => {
          date.value = dateForBucket(date.value, button.dataset.modalBucket, currentDate());
          status.value = button.dataset.modalBucket === 'last' ? 'done' : 'open';
        });
        modalRoot.querySelector('#memoModalCancel').onclick = () => { modalRoot.innerHTML = ''; };
        modalRoot.querySelector('#memoModalSave').onclick = () => {
          const text = body.value.trim();
          if (!text) { root.toast?.('내용을 입력해주세요.'); return; }
          const selectedDate = date.value || parseNaturalDate(text, currentDate());
          working.body = text;
          working.scheduledDate = selectedDate;
          working.status = status.value === 'done' || (selectedDate && selectedDate < mondayOf(currentDate())) ? 'done' : 'open';
          working.updatedAt = nowIso();
          if (isNew) notes().push(working);
          saveState(isNew ? '메모를 추가했습니다.' : '메모를 수정했습니다.');
          modalRoot.innerHTML = '';
          root.render();
        };
        if (!isNew) modalRoot.querySelector('#memoModalDelete').onclick = () => {
          if (!root.confirm('이 메모를 삭제할까요?')) return;
          S.settings[NOTE_STORE_KEY] = notes().filter((item) => item.id !== working.id);
          saveState('메모를 삭제했습니다.');
          modalRoot.innerHTML = '';
          root.render();
        };
        body.focus();
      }

      function augmentDayModal(date) {
        const modal = document.querySelector('#modalRoot .modal');
        if (!modal || modal.dataset.memoAugmented === date) return;
        modal.dataset.memoAugmented = date;
        const dayNotes = notes().filter((note) => note.scheduledDate === date);
        const list = modal.querySelector('.day-list');
        const block = document.createElement('div');
        block.className = 'memo-day-list';
        block.innerHTML = `<h3 style="margin:12px 0 6px;font-size:15px">메모 ${dayNotes.length}건</h3>${dayNotes.length ? dayNotes.map((note) => `<div class="memo-day-item"><b>${escapeHtml(summary(note.body))}</b><small>${note.status === 'done' ? '완료' : '진행'} · ${escapeHtml(displayDate(note.scheduledDate))}</small><button type="button" class="btn" data-day-note="${escapeHtml(note.id)}">수정</button></div>`).join('') : '<div class="empty" style="padding:15px">이 날짜의 메모가 없습니다.</div>'}`;
        if (list) modal.insertBefore(block, list); else modal.appendChild(block);
        block.querySelectorAll('[data-day-note]').forEach((button) => button.onclick = () => openNoteEditor(notes().find((note) => note.id === button.dataset.dayNote)));
        const actions = modal.querySelector('.modalactions');
        if (actions) {
          const add = document.createElement('button');
          add.type = 'button';
          add.className = 'btn';
          add.textContent = '+ 이 날짜에 메모';
          add.onclick = () => openNoteEditor(null, date);
          actions.insertBefore(add, actions.firstChild);
        }
      }

      function decorateCalendar() {
        ensureState();
        const calendar = document.querySelector('.calendar-card');
        if (!calendar) return;
        const layerState = filters();
        const navBar = calendar.querySelector('.calendar-nav');
        let layerBox = calendar.querySelector('.calendar-layers');
        if (!layerBox && navBar) {
          layerBox = document.createElement('div');
          layerBox.className = 'calendar-layers';
          layerBox.innerHTML = '<button type="button" class="calendar-layer" data-calendar-layer="tasks">업무</button><button type="button" class="calendar-layer" data-calendar-layer="notes">메모</button><button type="button" class="calendar-layer" data-calendar-layer="vacations">휴가</button>';
          navBar.insertBefore(layerBox, navBar.firstChild);
          const heading = calendar.querySelector('.calendar-head>div');
          if (heading && !heading.querySelector('.calendar-dnd-hint')) {
            const hint = document.createElement('p');
            hint.className = 'calendar-dnd-hint';
            hint.textContent = '업무·메모 토글 · 카드를 끌어서 날짜 이동';
            heading.appendChild(hint);
          }
        }
        layerBox?.querySelectorAll('[data-calendar-layer]').forEach((button) => {
          const key = button.dataset.calendarLayer;
          button.classList.toggle('active', Boolean(layerState[key]));
          button.textContent = `${key === 'tasks' ? '업무' : key === 'notes' ? '메모' : '휴가'} ${layerState[key] ? '✓' : ''}`;
          button.onclick = (event) => {
            event.preventDefault();
            event.stopPropagation();
            S.settings[FILTER_STORE_KEY][key] = !S.settings[FILTER_STORE_KEY][key];
            saveState();
            decorateCalendar();
          };
        });

        calendar.querySelectorAll('[data-cal-date]').forEach((day) => {
          const date = day.dataset.calDate;
          const taskItems = S.workItems.filter((task) => taskDates(task).includes(date));
          const noteItems = notes().filter((note) => note.scheduledDate === date);
          const vacationItems = vacationsOn(date);
          let preview = day.querySelector('.cal-preview');
          if (!preview) {
            preview = document.createElement('div');
            preview.className = 'cal-preview';
            const tooltip = day.querySelector('.cal-tooltip');
            day.insertBefore(preview, tooltip || null);
          }
          preview.querySelector('.cal-workhub-drag-list')?.remove();
          [...preview.children].forEach((child) => {
            if (child.classList.contains('vacation-preview')) child.hidden = !layerState.vacations;
            else child.hidden = true;
          });

          const shown = [];
          if (layerState.tasks) taskItems.forEach((task) => shown.push({ type: 'task', id: task.id, label: task.title, done: task.status === 'done' }));
          if (layerState.notes) noteItems.forEach((note) => shown.push({ type: 'note', id: note.id, label: summary(note.body), done: note.status === 'done' }));
          const dragList = document.createElement('div');
          dragList.className = 'cal-workhub-drag-list';
          shown.slice(0, 3).forEach((item) => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = `cal-drag-chip ${item.type} ${item.done ? 'done' : ''}`;
            chip.draggable = true;
            chip.dataset.itemType = item.type;
            chip.dataset.itemId = item.id;
            chip.textContent = `${item.type === 'note' ? '✎' : '•'} ${item.label}`;
            chip.title = `${item.label} · 끌어서 날짜 이동`;
            chip.onclick = (event) => {
              event.stopPropagation();
              if (item.type === 'task') root.openEditor?.(S.workItems.find((task) => task.id === item.id));
              else openNoteEditor(notes().find((note) => note.id === item.id));
            };
            chip.addEventListener('pointerdown', (event) => event.stopPropagation());
            chip.addEventListener('dragstart', (event) => {
              event.stopPropagation();
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('application/x-workhub-item', JSON.stringify({ type: item.type, id: item.id }));
              event.dataTransfer.setData('text/plain', `${item.type}:${item.id}`);
            });
            dragList.appendChild(chip);
          });
          if (shown.length > 3) {
            const more = document.createElement('span');
            more.className = 'cal-more';
            more.textContent = `+${shown.length - 3}건`;
            dragList.appendChild(more);
          }
          preview.appendChild(dragList);

          const visibleCount = (layerState.tasks ? taskItems.length : 0) + (layerState.notes ? noteItems.length : 0) + (layerState.vacations ? vacationItems.length : 0);
          let count = day.querySelector('.cal-count');
          if (visibleCount) {
            if (!count) {
              count = document.createElement('span');
              count.className = 'cal-count';
              day.appendChild(count);
            }
            count.textContent = visibleCount;
            count.hidden = false;
          } else if (count) count.hidden = true;

          const nativeTooltip = day.querySelector('.cal-tooltip');
          if (nativeTooltip) nativeTooltip.classList.add('workhub-native-tooltip-hidden');
          day.querySelector('.cal-dnd-tooltip')?.remove();
          const tips = [];
          if (layerState.vacations) vacationItems.forEach((vacation) => tips.push(`<div class="cal-dnd-tip vacation">휴가 · ${escapeHtml(vacation.title || vacation.type || '휴가')}</div>`));
          if (layerState.tasks) taskItems.forEach((task) => tips.push(`<div class="cal-dnd-tip">업무 · ${escapeHtml(task.title)}</div>`));
          if (layerState.notes) noteItems.forEach((note) => tips.push(`<div class="cal-dnd-tip note">메모 · ${escapeHtml(summary(note.body))}</div>`));
          if (tips.length) {
            const tooltip = document.createElement('div');
            tooltip.className = 'cal-dnd-tooltip';
            tooltip.innerHTML = `<b>${escapeHtml(date)} · ${visibleCount}건</b>${tips.join('')}`;
            day.appendChild(tooltip);
          }

          day.ondragover = (event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; day.classList.add('drag-over'); };
          day.ondragleave = (event) => { if (!day.contains(event.relatedTarget)) day.classList.remove('drag-over'); };
          day.ondrop = (event) => {
            event.preventDefault();
            event.stopPropagation();
            day.classList.remove('drag-over');
            const payload = readDragPayload(event.dataTransfer);
            if (!payload) return;
            if (payload.type === 'task') {
              const task = S.workItems.find((item) => item.id === payload.id);
              if (task) moveTaskToDate(task, date);
            } else if (payload.type === 'note') {
              const note = notes().find((item) => item.id === payload.id);
              if (note) moveNoteToDate(note, date);
            }
          };
          if (!day.dataset.memoClickBound) {
            day.dataset.memoClickBound = '1';
            day.addEventListener('click', (event) => {
              if (event.target.closest('.cal-drag-chip,.cal-dnd-tooltip')) return;
              root.setTimeout(() => augmentDayModal(day.dataset.calDate), 0);
            }, { capture: true });
          }
        });
      }

      function pauseGames() {
        ['runner-pause', 'kart-pause'].forEach((id) => {
          const button = document.getElementById(id);
          if (button && !button.disabled && button.textContent.includes('일시정지')) button.click();
        });
      }

      function presentNotes() {
        if (!notesActive) return;
        appRoot.hidden = true;
        if (liveRoot) liveRoot.hidden = true;
        if (arcadeRoot) arcadeRoot.hidden = true;
        notesRoot.hidden = false;
        document.body.classList.remove('workhub-live-view', 'workhub-arcade-view');
        document.body.classList.add('workhub-special-view', 'workhub-notes-view');
        if (addGlobal) addGlobal.hidden = true;
        pageTitle.textContent = '메모장';
        nav.querySelectorAll('button[data-view]').forEach((button) => button.classList.toggle('active', button === notesButton));
        pauseGames();
        document.getElementById('liveBackdrop')?.remove();
        renderNotes();
      }

      function enterNotes() {
        notesActive = true;
        presentNotes();
        root.scrollTo({ top: 0, behavior: 'smooth' });
      }

      function leaveNotes() {
        if (!notesActive) return;
        notesActive = false;
        notesRoot.hidden = true;
        document.body.classList.remove('workhub-notes-view');
        if (!document.body.classList.contains('workhub-live-view') && !document.body.classList.contains('workhub-arcade-view')) {
          document.body.classList.remove('workhub-special-view');
          appRoot.hidden = false;
          if (addGlobal) addGlobal.hidden = false;
        }
      }

      notesButton.onclick = enterNotes;
      nav.addEventListener('click', (event) => {
        const button = event.target instanceof Element ? event.target.closest('button[data-view]') : null;
        if (!button || button === notesButton) return;
        leaveNotes();
      }, true);

      const previousRender = root.render;
      root.render = function () {
        previousRender();
        ensureState();
        if (notesActive) presentNotes(); else notesRoot.hidden = true;
        root.requestAnimationFrame(decorateCalendar);
      };

      ensureState();
      renderNotes();
      decorateCalendar();
    }

    attempt();
  }

  return {
    parseYmd,
    formatYmd,
    addDays,
    mondayOf,
    parseNaturalDate,
    bucketForDate,
    dateForBucket,
    applyTaskDate,
    normalizeNote,
    boot,
  };
});
