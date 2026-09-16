(() => {
  if (typeof S === 'undefined' || typeof render !== 'function') return;

  document.title = '워크허브';
  const brand = document.querySelector('.brand');
  if (brand) brand.innerHTML = '워크허브<small>MY WORKSPACE</small>';

  STATUS.todo = ['○','시작 전'];
  STATUS.doing = ['△','진행 중'];
  STATUS.done = ['✓','완료'];
  STATUS.blocked = ['!','이슈'];
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
    .carry-btn{border:1px solid #b9c8ff;background:#edf1ff;color:#314ec4;border-radius:8px;padding:6px 9px;font-size:12px;font-weight:900;cursor:pointer}
    .dark .carry-btn{background:#19295a;border-color:#4058a8;color:#b9c8ff}
    .task.blocked{background:color-mix(in srgb,#fff0df 62%,var(--card));border-color:#e2aa72}
    .dark .task.blocked{background:#342417;border-color:#76502e}
    .issue-modal textarea{min-height:130px;resize:vertical}
  `;
  if (!document.getElementById(style.id)) document.head.appendChild(style);

  function issueEditor(t) {
    if (!t) return;
    $('#modalRoot').innerHTML = `<div class="modalbg issue-modal"><div class="modal"><h2>이슈 내용</h2><div class="field"><label>이슈 / 지연 사유</label><textarea id="issueText" placeholder="예: 법무 검토 대기, 담당자 회신 대기 등">${esc(t.issueNote||'')}</textarea></div><div class="modalactions"><button class="btn" id="issueCancel">취소</button><button class="btn primary" id="issueSave">이슈로 저장</button></div></div></div>`;
    $('#issueCancel').onclick = () => $('#modalRoot').innerHTML='';
    $('#issueSave').onclick = () => {
      const text = $('#issueText').value.trim();
      if (!text) { toast('이슈 내용을 입력해주세요.'); return; }
      t.status = 'blocked';
      t.issueNote = text;
      t.updatedAt = today();
      t.completedAt = null;
      save('이슈로 저장했습니다.');
      $('#modalRoot').innerHTML='';
      render();
    };
  }

  setStatus = function(id,status){
    const t = S.workItems.find(x=>x.id===id);
    if (!t) return;
    if (status === 'blocked') { issueEditor(t); return; }
    t.status = status;
    t.updatedAt = today();
    t.completedAt = status === 'done' ? (t.completedAt || today()) : null;
    save();
    render();
  };

  task = function(t, compact=false){
    const statusEntries = [['todo',STATUS.todo],['doing',STATUS.doing],['done',STATUS.done],['blocked',STATUS.blocked]];
    const issue = t.status==='blocked' && t.issueNote ? `<div class="issue-note">! ${esc(t.issueNote)}</div>` : '';
    const carry = t.status==='done' ? '' : `<button class="carry-btn" data-act="carryNext" data-id="${t.id}">차주 →</button>`;
    return `<div class="task ${stateClass(t.status)}"><div class="tasktop"><button class="check" data-act="toggleDone" data-id="${t.id}">${t.status==='done'?'✓':'✓'}</button><div class="tasktitle">${esc(t.title)}</div><div class="taskactions">${carry}<button class="icon" data-act="edit" data-id="${t.id}">수정</button><button class="icon" data-act="delete" data-id="${t.id}">삭제</button></div></div><div class="meta"><span class="chip cat">${esc(t.category||'기타')}</span><span class="chip">${t.scope==='daily'?'일간':t.scope==='weekly'?'주간':'월간'}</span><span class="chip">${esc(t.target||'')}</span></div><div class="statusbar">${statusEntries.map(([k,v])=>`<button class="status ${k} ${t.status===k?'active':''}" data-act="status" data-id="${t.id}" data-status="${k}">${v[0]} ${v[1]}</button>`).join('')}</div>${issue}</div>`;
  };

  const oldAct = act;
  act = function(b){
    if (b.dataset.act === 'carryNext') {
      const t = S.workItems.find(x=>x.id===b.dataset.id);
      if (!t) return;
      const base = t.scope==='daily' ? t.target : (t.scope==='weekly' ? t.target : mon(today()));
      t.carriedFrom = t.target;
      t.carriedAt = today();
      t.scope = 'weekly';
      t.target = add(mon(base || today()), 7);
      t.status = 'todo';
      t.completedAt = null;
      t.issueNote = '';
      t.updatedAt = today();
      save('차주로 넘겼습니다.');
      render();
      return;
    }
    oldAct(b);
  };

  openEditor = function(t){
    if(!t)return;
    $('#modalRoot').innerHTML=`<div class="modalbg" id="modalBg"><div class="modal"><h2>업무 수정</h2><div class="field"><label>업무명</label><input id="eTitle" class="input" value="${esc(t.title)}"></div><div class="field"><label>구분</label><input id="eCat" class="input" value="${esc(t.category||'기타')}"></div><div class="field"><label>메모</label><textarea id="eNote" rows="3">${esc(t.note||'')}</textarea></div><div class="field"><label>이슈 내용</label><textarea id="eIssue" rows="3" placeholder="이슈 상태일 때 사유를 입력">${esc(t.issueNote||'')}</textarea></div><div class="statusbar" style="margin:10px 0 0">${Object.entries(STATUS).map(([k,v])=>`<button class="status ${k} ${t.status===k?'active':''}" data-edit-status="${k}">${v[0]} ${v[1]}</button>`).join('')}</div><div class="modalactions"><button class="btn" id="cancelEdit">취소</button><button class="btn primary" id="saveEdit">저장</button></div></div></div>`;
    let ns=t.status;
    $$('[data-edit-status]').forEach(b=>b.onclick=()=>{$$('[data-edit-status]').forEach(x=>x.classList.remove('active'));b.classList.add('active');ns=b.dataset.editStatus});
    $('#cancelEdit').onclick=()=>$('#modalRoot').innerHTML='';
    $('#saveEdit').onclick=()=>{
      const issueText=$('#eIssue').value.trim();
      if(ns==='blocked'&&!issueText){toast('이슈 내용을 입력해주세요.');return;}
      t.title=$('#eTitle').value.trim()||t.title;
      t.category=$('#eCat').value.trim()||'기타';
      t.note=$('#eNote').value.trim();
      t.issueNote=issueText;
      t.status=ns;
      t.completedAt=ns==='done'?(t.completedAt||today()):null;
      t.updatedAt=today();
      save('저장했습니다.');
      $('#modalRoot').innerHTML='';
      render();
    };
  };

  const oldDashboard = dashboard;
  dashboard = function(){
    return oldDashboard().replaceAll('이슈·대기','이슈');
  };

  render();
})();