/* Work Atlas: the existing private workspace, rendered as a navigable 3D desk. */
(() => {
  'use strict';
  if (window.__workAtlasLoaded || !window.WorkAtlasModel || typeof S === 'undefined') return;
  window.__workAtlasLoaded = true;
  const M = window.WorkAtlasModel;
  const options = { query: '', category: '', period: 'all', stage: '' };
  let mode = matchMedia('(prefers-reduced-motion: reduce), (max-width: 700px)').matches ? 'flow' : 'space';
  let selectedId = '', angle = -5, zoom = 1, pageSize = 4, resizeObserver;
  let boardOpen = false;
  const oldDashboard = dashboard;
  const dashboardNav = document.querySelector('.nav [data-view="dashboard"]');
  if (dashboardNav) {
    dashboardNav.innerHTML = '◈ <span>업무 아틀라스</span>';
    dashboardNav.setAttribute('aria-label', '업무 아틀라스');
    dashboardNav.title = '업무 아틀라스';
  }
  const escape = value => esc(value);
  const label = item => M.stages.find(s => s.id === M.stage(item)).label;
  const button = (action, text, extra = '') => `<button type="button" class="btn" data-atlas="${action}" ${extra}>${text}</button>`;
  const all = () => S.workItems || [];
  const dateLabel = item => M.due(item) ? `${M.due(item).slice(5).replace('-', '.')} ${item.dueDate ? '마감' : '계획 종료'}` : '일정 미정';

  function card(item, index) {
    const state = M.stage(item), pending = M.waiting(item, all()).length;
    const overdue = state !== 'done' && M.due(item) && M.due(item) < today();
    return `<button type="button" class="atlas-node ${selectedId === item.id ? 'is-selected' : ''}" data-atlas="select" data-id="${escape(item.id)}" data-state="${state}" aria-pressed="${selectedId === item.id}" style="--row:${index}">
      <span class="atlas-node-top"><span>${escape(item.category || '기타')}</span><span>${M.stages.find(s => s.id === state).icon}</span></span>
      <strong>${escape(item.title)}</strong><span class="atlas-node-foot"><span class="${overdue ? 'is-overdue' : ''}">${dateLabel(item)}</span><span>${pending ? `선행 대기 ${pending}` : state === 'expected' ? '검토 전' : state === 'done' ? '완료됨' : state === 'blocked' ? '이슈 확인' : '실행 가능'}</span></span>
    </button>`;
  }
  function scene(items) {
    const stages = options.stage ? M.stages.filter(s => s.id === options.stage) : M.stages;
    const rows = Math.max(2, ...stages.map(s => Math.min(pageSize, items.filter(t => M.stage(t) === s.id).length)));
    const width = stages.length * 252 + 28, height = rows * 126 + 138;
    const positions = new Map();
    const columns = stages.map((stage, col) => {
      const list = items.filter(t => M.stage(t) === stage.id);
      list.slice(0, pageSize).forEach((item, row) => positions.set(item.id, { x: 28 + col * 252, y: 74 + row * 126 }));
      return `<section class="atlas-column" style="--stage-color:${stage.color};left:${28 + col * 252}px;width:220px" aria-label="${stage.label}">
        <div class="atlas-column-head"><span>${stage.icon} ${stage.label}</span><b>${list.length}</b></div>
        ${list.slice(0, pageSize).map(card).join('')}${!list.length ? '<div class="atlas-vacant">아직 등록된 업무가 없습니다</div>' : ''}
        ${list.length > pageSize ? button('more', `+ ${list.length - pageSize}개 더 보기`, 'aria-label="업무 더 보기"') : ''}</section>`;
    }).join('');
    const edges = [];
    for (const item of items) for (const dep of M.dependencies(item)) {
      const from = positions.get(dep), to = positions.get(item.id);
      if (!from || !to) continue;
      const forward = to.x > from.x;
      const x1 = from.x + (forward ? 220 : 0), x2 = to.x + (forward ? 0 : 220);
      const y1 = from.y + 51, y2 = to.y + 51;
      const bend = forward ? 20 : -28;
      const d = from.x === to.x
        ? `M ${from.x + 220} ${y1} C ${from.x + 244} ${y1}, ${to.x + 244} ${y2}, ${to.x + 220} ${y2}`
        : `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
      edges.push(`<path d="${d}" class="${selectedId === item.id || selectedId === dep ? 'is-linked' : ''}" marker-end="url(#atlas-arrow)"/>`);
    }
    return `<div class="atlas-viewport ${mode === 'space' ? 'is-3d' : ''}" id="atlasViewport" tabindex="0" role="region" aria-label="업무 흐름 보드. 업무 카드를 선택하면 상세 정보를 확인할 수 있습니다.">
      <div class="atlas-scene-wrap" style="width:${width}px;height:${height}px"><div class="atlas-scene" id="atlasScene" style="width:${width}px;height:${height}px;--angle:${angle}deg;--zoom:${zoom}">
      <div class="atlas-world"><div class="atlas-floor" aria-hidden="true"><span>WORK ATLAS / PRIVATE STUDIO</span></div>
      <svg class="atlas-edges" width="${width}" height="${height}" aria-hidden="true"><defs><marker id="atlas-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="#ddc491"/></marker></defs>${edges.join('')}</svg>${columns}</div></div></div>
      ${!items.length ? '<div class="atlas-empty">조건에 맞는 업무가 없습니다. 필터를 초기화하거나 새 업무를 추가해 보세요.</div>' : ''}</div>`;
  }
  function timeline(items) {
    const groups = new Map();
    for (const item of items) { const date = M.due(item) || '일정 미정'; if (!groups.has(date)) groups.set(date, []); groups.get(date).push(item); }
    return `<div class="atlas-timeline">${[...groups].map(([date, tasks]) => `<section><div class="atlas-time-label"><span>${date === '일정 미정' ? '미정' : escape(date.slice(5).replace('-', '.'))}</span><small>${date === '일정 미정' ? '날짜 지정 필요' : escape(date.slice(0, 4))}</small></div><div class="atlas-time-tasks">${tasks.map(card).join('')}</div></section>`).join('') || '<div class="atlas-empty">표시할 업무가 없습니다.</div>'}</div>`;
  }
  function detail() {
    const item = all().find(t => t.id === selectedId);
    const stats = M.summary(all(), today());
    if (!item) return `<div class="atlas-detail-intro"><span class="atlas-eyebrow">NEXT ACTION</span><h3>지금, 어디부터<br> 시작할까요?</h3><p>업무를 선택하면 선행 관계와 다음 행동을 확인할 수 있습니다.</p></div>
      <div class="atlas-next"><span class="atlas-eyebrow">바로 시작할 수 있는 업무</span>${stats.ready.slice(0, 3).map(t => `<button type="button" data-atlas="select" data-id="${escape(t.id)}"><span>${escape(t.title)}</span><b>↗</b></button>`).join('') || '<p>선행 업무를 마치거나 새 할 일을 추가해 주세요.</p>'}</div>
      <div class="atlas-explainer"><b>예상 업무는 어떻게 관리하나요?</b><p>가능성이 있는 일을 먼저 등록하고, 일정과 선행 업무를 검토한 뒤 ‘할 일로 확정’을 눌러 주세요.</p></div>`;
    const deps = M.dependencies(item), waiting = M.waiting(item, all());
    return `<span class="atlas-eyebrow">TASK DETAILS</span><div class="atlas-detail-title"><span class="atlas-status" data-state="${M.stage(item)}">${label(item)}</span>${button('deselect', '×', 'aria-label="업무 선택 해제"')}</div><h3>${escape(item.title)}</h3>
      <dl><div><dt>업무 구분</dt><dd>${escape(item.category || '기타')}</dd></div><div><dt>계획 / 마감</dt><dd>${escape(M.due(item) || '미정')}</dd></div><div><dt>현재 상태</dt><dd>${waiting.length ? `선행 업무 ${waiting.length}건 대기` : '선행 대기 없음'}</dd></div></dl>
      ${item.note ? `<p class="atlas-note">${escape(item.note)}</p>` : ''}${item.issueNote && M.stage(item) === 'blocked' ? `<p class="atlas-warning">${escape(item.issueNote)}</p>` : ''}
      <div class="atlas-dependency"><h4>선행 업무 <small>${deps.length}</small></h4>${deps.map(id => { const dep = all().find(t => t.id === id); return dep ? `<button type="button" data-atlas="select" data-id="${escape(id)}">${dep.status === 'done' ? '✓' : '○'} ${escape(dep.title)}</button>` : '<p class="atlas-warning">삭제된 선행 업무 · 연결을 수정해 주세요.</p>'; }).join('') || '<p>연결된 선행 업무가 없습니다.</p>'}</div>
      <div class="atlas-detail-actions">${M.stage(item) === 'expected' ? button('confirm', '할 일로 확정 →', 'data-primary="true"') : item.status !== 'done' ? button('advance', item.status === 'doing' ? '완료 처리 ✓' : '업무 시작 →', 'data-primary="true"') : button('reopen', '다시 할 일로')}${button('edit', '업무 · 연결 수정')}</div>
      <p class="atlas-small">${waiting.length ? '선행 업무가 남아 있습니다. 상태 변경 시 확인합니다.' : '변경 내용은 기존 업무보드와 함께 저장됩니다.'}</p>`;
  }
  function markup() {
    const items = M.filter(all(), options, today()), stats = M.summary(all(), today());
    const categories = [...new Set(all().map(t => t.category || '기타'))].sort();
    return `<section class="work-atlas" id="workAtlas" aria-label="3D 업무 아틀라스">
      <div class="atlas-hero"><div><div class="atlas-eyebrow">THE WORK ATELIER <span>✦</span> 나만의 업무 작업실</div><h1>생각에서 실행으로,<br class="atlas-mobile-break"> 업무의 흐름을 그리다.</h1><p>흩어진 계획을 연결하고, 지금 해야 할 일을 선명하게.</p></div><div class="atlas-hero-actions">${button('create-expected', '◇ 예상 업무 추가')}${button('create', '+ 해야 할 일', 'data-primary="true"')}</div></div>
      <div class="atlas-metrics"><button type="button" data-atlas="metric" data-stage="expected"><span>검토할 예상 업무</span><strong>${stats.expected}<small>건</small></strong></button><button type="button" data-atlas="metric" data-stage="todo"><span>해야 할 일</span><strong>${all().filter(t => M.stage(t) === 'todo').length}<small>건</small></strong></button><button type="button" data-atlas="overdue"><span>일정 점검 필요</span><strong>${stats.overdue}<small>건</small></strong></button><button type="button" data-atlas="metric" data-stage="done"><span>쌓아온 완료 기록</span><strong>${stats.done}<small>건</small></strong></button></div>
      <div class="atlas-workspace"><div class="atlas-main"><div class="atlas-toolbar"><div class="atlas-modes" role="group" aria-label="시각화 방식">${[['space','◈ 3D 공간'],['flow','▦ 흐름도'],['timeline','☷ 타임라인']].map(([id,text]) => button('mode', text, `data-mode="${id}" aria-pressed="${mode === id}"`)).join('')}</div><span class="atlas-total" role="status">${items.length} / ${all().length}건 표시</span></div>
      <form class="atlas-filters" id="atlasFilters"><label class="atlas-search"><span class="sr-only">업무 검색</span><input name="query" type="search" value="${escape(options.query)}" placeholder="업무명, 구분, 메모 검색"><button type="submit" aria-label="검색">⌕</button></label><label><span class="sr-only">업무 구분</span><select name="category"><option value="">모든 구분</option>${categories.map(c => `<option ${options.category === c ? 'selected' : ''} value="${escape(c)}">${escape(c)}</option>`).join('')}</select></label><label><span class="sr-only">기간</span><select name="period">${[['all','전체 기간'],['week','오늘부터 7일'],['overdue','일정 초과']].map(([id,text])=>`<option value="${id}" ${options.period === id ? 'selected' : ''}>${text}</option>`).join('')}</select></label><label><span class="sr-only">업무 상태</span><select name="stage"><option value="">모든 상태</option>${M.stages.map(s=>`<option value="${s.id}" ${options.stage === s.id ? 'selected' : ''}>${s.label}</option>`).join('')}</select></label>${button('reset', '초기화')}</form>
      ${mode === 'timeline' ? timeline(items) : scene(items)}
      <div class="atlas-scene-footer">${mode !== 'timeline' ? '<span class="atlas-pan-hint">↔ 좌우로 밀어 모든 단계를 확인하세요.</span>' : ''}<span><i></i> 실선 화살표: 직접 연결한 선행 → 후속 업무</span><div class="atlas-camera">${mode === 'space' ? `${button('rotate-left','↶','aria-label="왼쪽으로 회전"')}${button('rotate-right','↷','aria-label="오른쪽으로 회전"')}${button('zoom-out','−','aria-label="축소"')}${button('zoom-in','+','aria-label="확대"')}${button('camera-reset','시점 초기화')}` : '<span>카드를 눌러 상세 보기</span>'}</div></div></div>
      <aside class="atlas-detail" id="atlasDetail" aria-label="선택한 업무 상세">${detail()}</aside></div>
      <div class="atlas-bottom"><span>✦ 업무의 다음 장을 준비하는 공간</span><span>예상은 계획으로, 계획은 실행으로.</span></div>
    </section>`;
  }
  dashboard = function () {
    return markup() + `<details class="atlas-existing" ${boardOpen ? 'open' : ''}><summary>기존 업무보드 · 캘린더 펼치기</summary>${oldDashboard()}</details>`;
  };
  function focusSelected() {
    const active = document.activeElement;
    return active?.closest('#workAtlas') ? { action: active.dataset.atlas, id: active.dataset.id, mode: active.dataset.mode } : null;
  }
  function refresh() {
    const focus = focusSelected();
    render();
    if (focus) {
      const target = [...document.querySelectorAll('#workAtlas [data-atlas]')].find(el => el.dataset.atlas === focus.action && el.dataset.id === focus.id && el.dataset.mode === focus.mode);
      target?.focus({ preventScroll: true });
    }
  }
  function applyCamera() {
    const scene = document.getElementById('atlasScene');
    if (scene) { scene.style.setProperty('--angle', angle + 'deg'); scene.style.setProperty('--zoom', zoom); }
  }
  function fitScene() {
    const viewport = document.getElementById('atlasViewport'), scene = document.getElementById('atlasScene');
    if (!viewport || !scene) return;
    const width = parseFloat(scene.style.width), height = parseFloat(scene.style.height);
    const scale = Math.min(1, Math.max(.75, (viewport.clientWidth - 48) / width));
    scene.style.setProperty('--fit', scale);
    const wrap = scene.parentElement;
    wrap.style.width = `${width * scale}px`;
    wrap.style.height = `${height * scale}px`;
  }
  const previousRender = render;
  render = function () { previousRender(); bindAtlas(); };
  function bindAtlas() {
    resizeObserver?.disconnect();
    const root = document.getElementById('workAtlas');
    if (!root) return;
    if (!document.getElementById('root').hidden && view === 'dashboard') document.getElementById('pageTitle').textContent = '업무 아틀라스';
    const existing = document.querySelector('.atlas-existing');
    if (existing) existing.ontoggle = () => { boardOpen = existing.open; };
    root.querySelectorAll('[data-atlas]').forEach(el => el.onclick = () => handle(el));
    const form = root.querySelector('#atlasFilters');
    form.onsubmit = event => { event.preventDefault(); applyFilters(form); };
    form.querySelectorAll('select').forEach(el => el.onchange = () => applyFilters(form));
    fitScene();
    if (typeof ResizeObserver !== 'undefined') { resizeObserver = new ResizeObserver(fitScene); const viewport = root.querySelector('#atlasViewport'); if (viewport) resizeObserver.observe(viewport); }
  }
  function applyFilters(form) {
    const values = new FormData(form);
    for (const key of Object.keys(options)) options[key] = String(values.get(key) || '');
    refresh();
  }
  function handle(el) {
    const action = el.dataset.atlas, item = all().find(t => t.id === selectedId);
    if (action === 'select') {
      selectedId = el.dataset.id;
      refresh();
      if (matchMedia('(max-width:1500px)').matches) document.getElementById('atlasDetail')?.scrollIntoView({ block:'nearest', behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      return;
    }
    if (action === 'deselect') { selectedId = ''; refresh(); return; }
    if (action === 'mode') { mode = el.dataset.mode; refresh(); return; }
    if (action === 'reset') { Object.assign(options, { query:'', category:'', period:'all', stage:'' }); refresh(); return; }
    if (action === 'metric') { Object.assign(options, { query:'', category:'', period:'all', stage:el.dataset.stage }); refresh(); return; }
    if (action === 'overdue') { Object.assign(options, { query:'', category:'', period:'overdue', stage:'' }); refresh(); return; }
    if (action === 'more') { pageSize += 6; refresh(); return; }
    if (action.startsWith('rotate-')) { angle = Math.max(-15, Math.min(15, angle + (action === 'rotate-left' ? -5 : 5))); applyCamera(); return; }
    if (action.startsWith('zoom-')) { zoom = Math.max(.8, Math.min(1.3, zoom + (action === 'zoom-in' ? .1 : -.1))); applyCamera(); return; }
    if (action === 'camera-reset') { angle = -5; zoom = 1; applyCamera(); return; }
    if (action === 'create' || action === 'create-expected') { editor(null, action === 'create-expected'); return; }
    if (!item) return;
    if (action === 'edit') { editor(item); return; }
    if (['advance','confirm','reopen'].includes(action)) {
      if (action === 'advance' && M.waiting(item, all()).length && !window.confirm('아직 완료되지 않은 선행 업무가 있습니다. 그래도 상태를 변경할까요?')) return;
      item.intent = 'committed';
      setStatus(item.id, action === 'advance' ? item.status === 'doing' ? 'done' : 'doing' : 'todo');
    }
  }
  function editor(item, expected = false) {
    const id = item?.id || uid();
    const deps = item ? M.dependencies(item) : [];
    const dialog = document.createElement('dialog');
    dialog.className = 'atlas-dialog';
    dialog.setAttribute('aria-labelledby', 'atlasEditorTitle');
    dialog.innerHTML = `<form id="atlasEditor"><div class="atlas-dialog-heading"><span class="atlas-eyebrow">PLAN YOUR NEXT CHAPTER</span><h2 id="atlasEditorTitle">${item ? '업무와 연결 수정' : expected ? '예상 업무를 기록하세요' : '새로운 할 일'}</h2></div>
      <label>업무명<input name="title" required maxlength="240" value="${escape(item?.title || '')}" placeholder="예: 파트너 제안서 검토"></label><div class="atlas-form-row"><label>업무 구분<input name="category" maxlength="80" value="${escape(item?.category || '')}" placeholder="파트너 / 조달 / 행사"></label><label>마감일 <small>선택</small><input name="dueDate" type="date" value="${escape(item?.dueDate || '')}"></label></div>
      <label>단계<select name="stage">${M.stages.map(s => `<option value="${s.id}" ${s.id === (item ? M.stage(item) : expected ? 'expected' : 'todo') ? 'selected' : ''}>${s.label}</option>`).join('')}</select></label>
      <label>메모 / 이슈 사유<textarea name="note" rows="3" maxlength="4000" placeholder="예상 업무의 발생 조건이나 다음 행동을 적어 주세요.">${escape(item?.status === 'blocked' ? item.issueNote || item.note || '' : item?.note || '')}</textarea></label>
      <fieldset><legend>선행 업무 연결 <small>여러 개 선택 가능</small></legend><p>이 업무를 시작하기 전에 끝나야 하는 업무를 선택하세요.</p><div class="atlas-dep-options">${all().filter(t => t.id !== id).map(t => `<label><input type="checkbox" name="deps" value="${escape(t.id)}" ${deps.includes(t.id) ? 'checked' : ''}><span>${escape(t.title)} <small>${label(t)}</small></span></label>`).join('') || '<p>먼저 다른 업무를 등록하면 연결할 수 있습니다.</p>'}</div></fieldset>
      <p class="atlas-form-error" role="alert"></p><div class="atlas-dialog-actions"><button type="button" class="btn" id="atlasCancel">취소</button><button type="submit" class="btn primary">${item ? '변경 저장' : '업무 추가'}</button></div></form>`;
    document.body.appendChild(dialog);
    dialog.querySelector('#atlasCancel').onclick = () => dialog.close();
    dialog.onclose = () => { dialog.remove(); document.querySelector('#workAtlas [data-atlas="edit"], #workAtlas [data-atlas="create"]')?.focus({preventScroll:true}); };
    dialog.querySelector('form').onsubmit = event => {
      event.preventDefault();
      const values = new FormData(event.currentTarget), title = String(values.get('title') || '').trim();
      const nextDeps = values.getAll('deps').map(String), state = String(values.get('stage')), note = String(values.get('note') || '').trim();
      const error = message => { dialog.querySelector('.atlas-form-error').textContent = message; };
      if (!title) return error('업무명을 입력해 주세요.');
      if (nextDeps.some(dep => !M.canLink(all(), id, dep))) return error('업무가 서로 기다리는 순환 연결은 만들 수 없습니다. 선행 업무를 다시 선택해 주세요.');
      if (state === 'blocked' && !note) return error('이슈 · 대기 상태는 사유를 입력해 주세요.');
      const dueDate = String(values.get('dueDate') || '');
      if (dueDate && !M.validDate(dueDate)) return error('올바른 마감일을 입력해 주세요.');
      const target = item || { id, scope:'weekly', target:mon(dueDate || today()), createdAt:today() };
      Object.assign(target, { title, category:String(values.get('category') || '').trim() || '기타', dueDate, dependsOn:nextDeps, intent:state === 'expected' ? 'expected' : 'committed', status:state === 'expected' ? 'todo' : state, updatedAt:today(), completedAt:state === 'done' ? item?.completedAt || today() : null });
      if (state === 'blocked') target.issueNote = note; else target.note = note;
      if (!item) all().push(target);
      selectedId = id;
      save('업무를 저장했습니다.');
      dialog.close();
      refresh();
    };
    dialog.showModal();
  }
  const originalTask = task;
  task = function (item, compact) {
    const html = originalTask(item, compact);
    return M.stage(item) === 'expected' ? html.replace('<div class="meta">', '<div class="meta"><span class="chip">◇ 예상 · 검토 전</span>') : html;
  };
  window.addEventListener('pagehide', () => resizeObserver?.disconnect(), { once:true });
  render();
})();
