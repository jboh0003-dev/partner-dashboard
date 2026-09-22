(() => {
  if (typeof S === 'undefined' || typeof render !== 'function') return;

  document.title = '워크허브';
  const brand = document.querySelector('.brand');
  if (brand) brand.innerHTML = '워크허브<small>MY WORKSPACE</small>';

  STATUS.todo = ['○', '시작 전'];
  STATUS.doing = ['△', '진행 중'];
  STATUS.done = ['✓', '완료'];
  STATUS.blocked = ['!', '이슈'];
  delete STATUS.failed;

  let migrated = false;
  S.workItems.forEach(t => {
    if (t.status === 'failed') {
      t.status = 'blocked';
      t.issueNote = t.issueNote || '기존 못함 상태에서 이슈로 전환됨';
      t.completedAt = null;
      migrated = true;
    }
  });
  if (migrated) save();

  const style = document.createElement('style');
  style.id = 'workhub-workflow-style';
  style.textContent = `
    .issue-note{margin:10px 0 0 43px;padding:10px 12px;border-radius:10px;background:#fff3e8;border:1px solid #e8b27e;color:#9a4c17;font-size:13px;font-weight:750;line-height:1.45}
    .dark .issue-note{background:#3a2516;border-color:#80502c;color:#ffc18f}
    .carry-btn{border:1px solid #b9c8ff;background:#edf1ff;color:#314ec4;border-radius:8px;padding:6px 9px;font-size:12px;font-weight:900;cursor:pointer;white-space:nowrap}
    .carry-btn:hover{background:#dde5ff;border-color:#8fa4f4}
    .carry-btn:focus-visible{outline:3px solid #8da3f3;outline-offset:2px}
    .dark .carry-btn{background:#19295a;border-color:#4058a8;color:#b9c8ff}
    .carry-history-chip{background:#f0ebff!important;color:#6842a6!important}
    .dark .carry-history-chip{background:#30234f!important;color:#d6c0ff!important}
    .task.blocked{background:color-mix(in srgb,#fff0df 62%,var(--card));border-color:#e2aa72}
    .dark .task.blocked{background:#342417;border-color:#76502e}
    .issue-modal textarea{min-height:130px;resize:vertical}
    .workflow-undo{position:fixed;right:18px;bottom:18px;z-index:10001;display:flex;align-items:center;gap:12px;max-width:min(460px,calc(100vw - 36px));padding:12px 14px;border:1px solid #667dd5;border-radius:10px;background:#17213d;color:#fff;box-shadow:0 18px 50px rgba(0,0,0,.28);font-size:13px;font-weight:800}
    .workflow-undo span{min-width:0;line-height:1.4}.workflow-undo button{flex:0 0 auto;border:1px solid #aebcff;background:#fff;color:#314ec4;border-radius:7px;padding:7px 10px;font-weight:900;cursor:pointer}
  `;
  if (!document.getElementById(style.id)) document.head.appendChild(style);

  let undoTimer = null;

  function issueEditor(t) {
    if (!t) return;
    $('#modalRoot').innerHTML = `<div class="modalbg issue-modal"><div class="modal"><h2>이슈 내용</h2><div class="field"><label>이슈 / 지연 사유</label><textarea id="issueText" placeholder="예: 법무 검토 대기, 담당자 회신 대기 등">${esc(t.issueNote || '')}</textarea></div><div class="modalactions"><button class="btn" id="issueCancel">취소</button><button class="btn primary" id="issueSave">이슈로 저장</button></div></div></div>`;
    $('#issueCancel').onclick = () => $('#modalRoot').innerHTML = '';
    $('#issueSave').onclick = () => {
      const text = $('#issueText').value.trim();
      if (!text) {
        toast('이슈 내용을 입력해주세요.');
        return;
      }
      t.status = 'blocked';
      t.issueNote = text;
      t.updatedAt = today();
      t.completedAt = null;
      save('이슈로 저장했습니다.');
      $('#modalRoot').innerHTML = '';
      render();
    };
  }

  setStatus = function (id, status) {
    const t = S.workItems.find(x => x.id === id);
    if (!t) return;
    if (status === 'blocked') {
      issueEditor(t);
      return;
    }
    t.status = status;
    t.updatedAt = today();
    t.completedAt = status === 'done' ? (t.completedAt || today()) : null;
    save();
    render();
  };

  function targetLabel(value) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return fmt(value);
    if (/^\d{4}-\d{2}$/.test(value || '')) {
      const [year, month] = value.split('-');
      return `${year}.${Number(month)}`;
    }
    return value || '미정';
  }

  function nextWeekDestination(t) {
    const hasDateTarget = /^\d{4}-\d{2}-\d{2}$/.test(t.target || '');
    const hasDueDate = /^\d{4}-\d{2}-\d{2}$/.test(t.dueDate || '');

    if (t.scope === 'daily' && hasDateTarget) {
      return {
        scope: 'daily',
        target: add(t.target, 7),
        dueDate: hasDueDate ? add(t.dueDate, 7) : (t.dueDate || ''),
      };
    }

    if (t.scope === 'weekly' && hasDateTarget) {
      return {
        scope: 'weekly',
        target: add(mon(t.target), 7),
        dueDate: hasDueDate ? add(t.dueDate, 7) : (t.dueDate || ''),
      };
    }

    return {
      scope: 'weekly',
      target: add(mon(today()), 7),
      dueDate: hasDueDate ? add(t.dueDate, 7) : (t.dueDate || ''),
    };
  }

  function carriedChip(t) {
    if (!t.carriedAt || !t.carriedFromTarget) return '';
    return `<span class="chip carry-history-chip" title="${esc(t.carriedAt)}에 차주로 이동">↗ ${targetLabel(t.carriedFromTarget)} → ${targetLabel(t.target)}</span>`;
  }

  task = function (t, compact = false) {
    const statusEntries = [
      ['todo', STATUS.todo],
      ['doing', STATUS.doing],
      ['done', STATUS.done],
      ['blocked', STATUS.blocked],
    ];
    const issue = t.status === 'blocked' && t.issueNote
      ? `<div class="issue-note">! ${esc(t.issueNote)}</div>`
      : '';
    const destination = nextWeekDestination(t);
    const carry = t.status === 'done'
      ? ''
      : `<button class="carry-btn" data-act="carryWeekV2" data-id="${t.id}" title="${targetLabel(destination.target)}로 이동">차주로 이동 →</button>`;

    return `<div class="task ${stateClass(t.status)}"><div class="tasktop"><button class="check" data-act="toggleDone" data-id="${t.id}">${t.status === 'done' ? '✓' : '✓'}</button><div class="tasktitle">${esc(t.title)}</div><div class="taskactions">${carry}<button class="icon" data-act="edit" data-id="${t.id}">수정</button><button class="icon" data-act="delete" data-id="${t.id}">삭제</button></div></div><div class="meta"><span class="chip cat">${esc(t.category || '기타')}</span><span class="chip">${t.scope === 'daily' ? '일간' : t.scope === 'weekly' ? '주간' : '월간'}</span><span class="chip">${esc(t.target || '')}</span>${carriedChip(t)}</div><div class="statusbar">${statusEntries.map(([k, v]) => `<button class="status ${k} ${t.status === k ? 'active' : ''}" data-act="status" data-id="${t.id}" data-status="${k}">${v[0]} ${v[1]}</button>`).join('')}</div>${issue}</div>`;
  };

  function snapshotTask(t) {
    return JSON.parse(JSON.stringify(t));
  }

  function restoreTask(t, previous) {
    Object.keys(t).forEach(key => delete t[key]);
    Object.assign(t, previous);
  }

  function showUndo(t, previous, historyId, destination) {
    window.clearTimeout(undoTimer);
    document.getElementById('workflowUndo')?.remove();

    const bar = document.createElement('div');
    bar.id = 'workflowUndo';
    bar.className = 'workflow-undo';
    bar.setAttribute('role', 'status');
    bar.innerHTML = `<span>“${esc(t.title)}”을(를) ${targetLabel(destination.target)}로 이동했습니다.</span><button type="button">실행 취소</button>`;
    document.body.appendChild(bar);

    const close = () => {
      window.clearTimeout(undoTimer);
      bar.remove();
    };

    bar.querySelector('button').onclick = () => {
      restoreTask(t, previous);
      S.history = Array.isArray(S.history) ? S.history.filter(entry => entry.id !== historyId) : [];
      save();
      render();
      close();
      toast('차주 이동을 취소했습니다.');
    };

    undoTimer = window.setTimeout(close, 7000);
  }

  function moveToNextWeek(t) {
    if (!t || t.status === 'done') return;

    const previous = snapshotTask(t);
    const destination = nextWeekDestination(t);
    const historyId = `carry-${uid()}`;

    t.carriedFrom = previous.target || '';
    t.carriedFromScope = previous.scope || '';
    t.carriedFromTarget = previous.target || '';
    t.carriedAt = today();
    t.scope = destination.scope;
    t.target = destination.target;
    if ('dueDate' in t || destination.dueDate) t.dueDate = destination.dueDate;
    t.updatedAt = today();

    if (!Array.isArray(S.history)) S.history = [];
    S.history.push({
      id: historyId,
      type: 'carry-next-week',
      workItemId: t.id,
      title: t.title,
      at: new Date().toISOString(),
      from: {
        scope: previous.scope || '',
        target: previous.target || '',
        dueDate: previous.dueDate || '',
        status: previous.status || 'todo',
      },
      to: {
        scope: destination.scope,
        target: destination.target,
        dueDate: destination.dueDate || '',
        status: t.status,
      },
    });

    save();
    render();
    showUndo(t, previous, historyId, destination);
  }

  const oldAct = act;
  act = function (b) {
    if (b.dataset.act === 'carryWeekV2') {
      moveToNextWeek(S.workItems.find(x => x.id === b.dataset.id));
      return;
    }
    oldAct(b);
  };

  openEditor = function (t) {
    if (!t) return;
    $('#modalRoot').innerHTML = `<div class="modalbg" id="modalBg"><div class="modal"><h2>업무 수정</h2><div class="field"><label>업무명</label><input id="eTitle" class="input" value="${esc(t.title)}"></div><div class="field"><label>구분</label><input id="eCat" class="input" value="${esc(t.category || '기타')}"></div><div class="field"><label>메모</label><textarea id="eNote" rows="3">${esc(t.note || '')}</textarea></div><div class="field"><label>이슈 내용</label><textarea id="eIssue" rows="3" placeholder="이슈 상태일 때 사유를 입력">${esc(t.issueNote || '')}</textarea></div><div class="statusbar" style="margin:10px 0 0">${Object.entries(STATUS).map(([k, v]) => `<button class="status ${k} ${t.status === k ? 'active' : ''}" data-edit-status="${k}">${v[0]} ${v[1]}</button>`).join('')}</div><div class="modalactions"><button class="btn" id="cancelEdit">취소</button><button class="btn primary" id="saveEdit">저장</button></div></div></div>`;
    let ns = t.status;
    $$('[data-edit-status]').forEach(b => b.onclick = () => {
      $$('[data-edit-status]').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      ns = b.dataset.editStatus;
    });
    $('#cancelEdit').onclick = () => $('#modalRoot').innerHTML = '';
    $('#saveEdit').onclick = () => {
      const issueText = $('#eIssue').value.trim();
      if (ns === 'blocked' && !issueText) {
        toast('이슈 내용을 입력해주세요.');
        return;
      }
      t.title = $('#eTitle').value.trim() || t.title;
      t.category = $('#eCat').value.trim() || '기타';
      t.note = $('#eNote').value.trim();
      t.issueNote = issueText;
      t.status = ns;
      t.completedAt = ns === 'done' ? (t.completedAt || today()) : null;
      t.updatedAt = today();
      save('저장했습니다.');
      $('#modalRoot').innerHTML = '';
      render();
    };
  };

  const oldDashboard = dashboard;
  dashboard = function () {
    return oldDashboard().replaceAll('이슈·대기', '이슈');
  };

  render();
})();
