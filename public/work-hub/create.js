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
      .quick{align-items:center}
      .quick .quick-title{min-width:0;flex:1 1 auto}
      .quick .quick-date{flex:0 0 138px;width:138px;min-width:138px;font-size:12px;padding:9px}
      .planneradd{grid-template-columns:minmax(260px,1fr) 150px 150px auto!important}
      .planneradd .due-input{min-width:0}
      .create-hint{font-size:10px;color:var(--muted);margin-top:5px;line-height:1.4}
      @media(max-width:900px){.quick{flex-wrap:wrap}.quick .quick-date{flex:1 1 145px;width:auto}.planneradd{grid-template-columns:1fr 1fr!important}.planneradd .btn{grid-column:span 2}}
      @media(max-width:620px){.planneradd{grid-template-columns:1fr!important}.planneradd .btn{grid-column:auto}.quick .quick-date{flex:1 1 100%}}
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
      return `<section class="lane ${focus?'focus':''}"><div class="lanehead"><div><h3>${title}</h3><p>${sub}</p></div><span class="count">${items.length}</span></div>${target?`<form class="quick" data-target="${target}"><input class="quick-title" name="title" placeholder="빠르게 할 일 추가"><input class="quick-date" name="dueDate" type="date" title="Due Date (선택)"><button class="btn primary">+</button></form>`:''}<div class="tasks">${items.length?items.map(x=>task(x)).join(''):'<div class="empty">등록된 업무 없음</div>'}</div></section>`;
    };

    planner = function(){
      let list=S.workItems.filter(x=>x.scope===plannerTab);
      return `<div class="panel"><div class="tabs">${[['daily','일간'],['weekly','주간'],['monthly','월간']].map(([k,l])=>`<button class="${plannerTab===k?'active':''}" data-act="plannerTab" data-tab="${k}">${l}</button>`).join('')}</div><form id="plannerAdd" class="planneradd"><input id="pTitle" class="input" required placeholder="해야 할 일 입력"><input id="pCat" class="input" placeholder="구분"><input id="pDue" class="input due-input" type="date" title="Due Date (선택)"><button class="btn primary">추가</button></form><div class="planlist">${list.length?list.map(x=>task(x)).join(''):'<div class="empty">등록된 계획이 없습니다.</div>'}</div></div>`;
    };

    const originalBind = bind;
    bind = function(){
      originalBind();
      $$('form.quick').forEach(f=>f.onsubmit=e=>{
        e.preventDefault();
        const title=f.elements.title.value.trim();
        if(!title)return;
        addItem({title,target:f.dataset.target,scope:'weekly',dueDate:f.elements.dueDate?.value||''});
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
      $('#modalRoot').innerHTML=`<div class="modalbg"><div class="modal"><h2>할 일 추가</h2><div class="field"><label>업무명</label><input id="cTitle" class="input" placeholder="예: 파트너 교육 현황 보고"></div><div class="formgrid"><div class="field"><label>구분</label><input id="cCat" class="input" placeholder="파트너 / 조달 / 행사 등"></div><div class="field"><label>Due Date</label><input id="cDue" class="input" type="date"></div><div class="field"><label>계획 단위</label><select id="cScope"><option value="weekly" selected>주간</option><option value="daily">일간</option><option value="monthly">월간</option></select></div><div class="field"><label>기준</label><input id="cTarget" class="input" type="date" value="${week}"></div></div><div class="create-hint">Due Date를 선택하면 해당 날짜에 달력에 바로 표시됩니다. 요일 표기는 보조 인식용으로만 사용됩니다.</div><div class="modalactions"><button class="btn" id="cancelCreate">취소</button><button class="btn primary" id="saveCreate">추가</button></div></div></div>`;
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