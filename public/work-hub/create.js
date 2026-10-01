(() => {
  const boot = () => {
    if (typeof S === 'undefined' || typeof addItem !== 'function' || typeof lane !== 'function' || typeof planner !== 'function' || typeof bind !== 'function') {
      window.setTimeout(boot, 120);
      return;
    }
    if (window.__workhubCreateDueLoaded) return;
    window.__workhubCreateDueLoaded = true;

    const style = document.createElement('style');
    style.id = 'workhub-create-due-style';
    style.textContent = `
      .quick{align-items:center;flex-wrap:wrap}
      .quick .quick-title{min-width:180px;flex:1 1 260px}
      .quick .quick-due-wrap{display:flex;align-items:center;gap:6px;flex:0 0 auto;border:1px solid var(--line);background:var(--card);border-radius:10px;padding:0 8px 0 9px;min-height:40px}
      .quick .quick-due-wrap span{font-size:10px;font-weight:850;color:var(--muted);white-space:nowrap}
      .quick .quick-due{width:132px!important;border:0!important;background:transparent!important;padding:8px 0!important;font-size:12px!important;color:var(--ink)!important;box-shadow:none!important}
      .quick .quick-due:focus{outline:none!important}
      .quick .quick-due-wrap:focus-within{border-color:#b38b42;box-shadow:0 0 0 2px rgba(179,139,66,.12)}
      .planneradd{grid-template-columns:minmax(260px,1fr) 150px 150px auto!important}
      .planneradd .due-input{min-width:0}
      .create-hint{font-size:10px;color:var(--muted);margin-top:5px;line-height:1.4}
      @media(max-width:900px){.planneradd{grid-template-columns:1fr 1fr!important}.planneradd .btn{grid-column:span 2}}
      @media(max-width:700px){.quick .quick-title{flex-basis:100%}.quick .quick-due-wrap{flex:1 1 auto}.quick .quick-due{width:100%!important}}
      @media(max-width:620px){.planneradd{grid-template-columns:1fr!important}.planneradd .btn{grid-column:auto}}
    `;
    document.head.appendChild(style);

    const originalAddItem = addItem;
    addItem = function(o){
      const dueDate = o?.dueDate || '';
      originalAddItem(o);
      if (dueDate) {
        const latest = S.workItems[S.workItems.length - 1];
        if (latest) {
          latest.dueDate = dueDate;
          save();
          render();
        }
      }
    };

    lane = function(title,sub,items,focus,target){
      return `<section class="lane ${focus?'focus':''}"><div class="lanehead"><div><h3>${title}</h3><p>${sub}</p></div><span class="count">${items.length}</span></div>${target?`<form class="quick" data-target="${target}"><input class="quick-title" name="title" placeholder="빠르게 할 일 추가 · 예: 파트너 안내하기"><label class="quick-due-wrap" title="Due Date 선택 (선택사항)"><span>Due</span><input class="quick-due" name="dueDate" type="date" aria-label="Due Date 선택"></label><button class="btn primary">+</button></form>`:''}<div class="tasks">${items.length?items.map(x=>task(x)).join(''):'<div class="empty">등록된 업무 없음</div>'}</div></section>`;
    };

    planner = function(){
      let list=S.workItems.filter(x=>x.scope===plannerTab);
      return `<div class="panel"><div class="tabs">${[['daily','일간'],['weekly','주간'],['monthly','월간']].map(([k,l])=>`<button class="${plannerTab===k?'active':''}" data-act="plannerTab" data-tab="${k}">${l}</button>`).join('')}</div><form id="plannerAdd" class="planneradd"><input id="pTitle" class="input" required placeholder="해야 할 일 입력"><input id="pCat" class="input" placeholder="구분"><input id="pDue" class="input due-input" type="date" title="Due Date (선택)"><button class="btn primary">추가</button></form><div class="planlist">${list.length?list.map(x=>task(x)).join(''):'<div class="empty">등록된 계획이 없습니다.</div>'}</div></div>`;
    };

    const originalBind = bind;
    bind = function(){
      originalBind();
      $('form.quick').forEach(f=>f.onsubmit=e=>{
        e.preventDefault();
        const title=f.elements.title.value.trim();
        if(!title)return;
        const dueDate=f.elements.dueDate?.value||'';
        const target=dueDate?mon(dueDate):f.dataset.target;
        addItem({title,target,scope:'weekly',dueDate});
      });
      const pa=$('#plannerAdd');
      if(pa) pa.onsubmit=e=>{
        e.preventDefault();
        const title=$('#pTitle').value.trim();
        if(!title)return;
        const target=plannerTab==='daily'?today():plannerTab==='weekly'?mon(today()):mkey(today());
        addItem({title,category:$('#pCat').value.trim()||'기타',scope:plannerTab,target,dueDate:$('#pDue')?.value||''});
      };
    };

    function openCreate(){
      const week = mon(today());
      $('#modalRoot').innerHTML=`<div class="modalbg"><div class="modal"><h2>할 일 추가</h2><div class="field"><label>업무명</label><input id="cTitle" class="input" placeholder="예: 파트너 교육 현황 보고"></div><div class="formgrid"><div class="field"><label>구분</label><input id="cCat" class="input" placeholder="파트너 / 조달 / 행사 등"></div><div class="field"><label>Due Date</label><input id="cDue" class="input" type="date"></div><div class="field"><label>계획 단위</label><select id="cScope"><option value="weekly" selected>주간</option><option value="daily">일간</option><option value="monthly">월간</option></select></div><div class="field"><label>기준</label><input id="cTarget" class="input" type="date" value="${week}"></div></div><div class="create-hint">빠른 입력은 제목에 (수)처럼 요일만 적어도 해당 주 수요일 일정으로 자동 표시됩니다. 정확한 날짜가 필요할 때만 Due Date를 선택하세요.</div><div class="modalactions"><button class="btn" id="cancelCreate">취소</button><button class="btn primary" id="saveCreate">추가</button></div></div></div>`;
      $('#cancelCreate').onclick=()=>$('#modalRoot').innerHTML='';
      $('#cScope').onchange=e=>{
        const input=$('#cTarget');
        if(e.target.value==='monthly'){
          input.type='month';
          input.value=today().slice(0,7);
        }else{
          input.type='date';
          input.value=e.target.value==='weekly'?mon(today()):today();
        }
      };
      $('#saveCreate').onclick=()=>{
        const title=$('#cTitle').value.trim();
        if(!title){toast('업무명을 입력해주세요.');return;}
        const scope=$('#cScope').value;
        let target=$('#cTarget').value;
        if(scope==='weekly') target=mon(target||today());
        if(scope==='daily') target=target||today();
        if(scope==='monthly') target=target||today().slice(0,7);
        addItem({title,category:$('#cCat').value.trim()||'기타',scope,target,dueDate:$('#cDue').value||''});
        $('#modalRoot').innerHTML='';
      };
    }

    const globalAdd=$('#addGlobal');
    if(globalAdd) globalAdd.onclick=openCreate;

    render();
  };
  boot();
})();