(() => {
  const boot = () => {
    if (typeof S === 'undefined' || typeof dashboard !== 'function' || typeof render !== 'function' || typeof openEditor !== 'function') {
      window.setTimeout(boot, 120);
      return;
    }
    if (window.__workhubCalendarLoaded) return;
    window.__workhubCalendarLoaded = true;

    let calendarMonth = `${today().slice(0,7)}-01`;
    const weekMap = { '월':0, '화':1, '수':2, '목':3, '금':4, '토':5, '일':6 };

    const style = document.createElement('style');
    style.id = 'workhub-calendar-style';
    style.textContent = `
      .tasktitle,.reportline,.reportcard,.team,.stock b,.favorite-head b,.issue-note{
        word-break:keep-all!important;overflow-wrap:break-word!important;line-break:strict!important;text-wrap:pretty!important;white-space:normal!important
      }
      .tasktop{min-width:0}.tasktitle{min-width:0}.taskactions{flex-wrap:wrap;justify-content:flex-end}
      .calendar-card{background:var(--card);border:1px solid var(--line);border-radius:17px;box-shadow:var(--shadow);margin-bottom:14px;overflow:visible}
      .calendar-head{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid var(--line)}
      .calendar-head h3{margin:0;font-size:21px;font-weight:950}.calendar-head p{margin:4px 0 0;color:var(--muted);font-size:12px}
      .calendar-nav{display:flex;gap:7px;align-items:center}.calendar-label{font-size:15px;font-weight:900;min-width:105px;text-align:center}
      .calendar-weekdays,.calendar-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr))}
      .calendar-weekdays{padding:10px 12px 0}.calendar-weekdays div{text-align:center;color:var(--muted);font-size:12px;font-weight:850;padding:7px}
      .calendar-weekdays div:first-child{color:#d0525b}.calendar-weekdays div:last-child{color:#3f6fc9}
      .calendar-grid{padding:0 12px 13px;gap:6px}
      .cal-day{position:relative;min-height:72px;border:1px solid var(--line);border-radius:11px;background:color-mix(in srgb,var(--card) 94%,#eef3f8);padding:8px;cursor:pointer;transition:.12s ease;overflow:visible}
      .cal-day:hover{border-color:#8ea2ff;box-shadow:0 8px 22px rgba(49,84,244,.12);z-index:30}.cal-day.out{opacity:.38}.cal-day.today{outline:2px solid #3154f4;outline-offset:-1px}
      .cal-num{font-size:13px;font-weight:900}.cal-day.sun .cal-num{color:#d0525b}.cal-day.sat .cal-num{color:#3f6fc9}
      .cal-count{position:absolute;right:7px;top:7px;min-width:22px;height:22px;padding:0 6px;border-radius:999px;background:#3154f4;color:white;display:grid;place-items:center;font-size:10px;font-weight:950}
      .cal-preview{margin-top:7px;display:flex;flex-direction:column;gap:4px}.cal-preview span{font-size:10px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--muted)}
      .cal-preview span.done{color:#13865f;text-decoration:line-through}.cal-preview span.blocked{color:#c7652d}
      .cal-tooltip{display:none;position:absolute;left:8px;top:calc(100% - 2px);width:min(360px,80vw);background:#091322;color:#eef4ff;border:1px solid #2b4260;border-radius:12px;padding:10px;box-shadow:0 18px 45px rgba(3,8,15,.34);z-index:100}
      .cal-day:nth-child(7n+6) .cal-tooltip,.cal-day:nth-child(7n+7) .cal-tooltip{left:auto;right:8px}.cal-day:hover .cal-tooltip{display:block}
      .cal-tooltip b{display:block;font-size:12px;margin-bottom:6px}.cal-tip-item{font-size:11px;line-height:1.4;padding:6px 0;border-top:1px solid #1f3149;word-break:keep-all;overflow-wrap:break-word}.cal-tip-item:first-of-type{border-top:0}.cal-tip-status{font-size:9px;color:#91a3bc;margin-right:6px}
      .due-chip{background:#eef7ff!important;color:#326a9c!important}.dark .due-chip{background:#18314a!important;color:#9dcdf2!important}
      .day-list{display:flex;flex-direction:column;gap:8px;margin-top:10px}.day-list-item{border:1px solid var(--line);border-radius:11px;padding:11px}.day-list-item h4{margin:0 0 5px;font-size:15px;word-break:keep-all;text-wrap:pretty}.day-list-item p{margin:0;color:var(--muted);font-size:11px}
      @media(max-width:900px){.cal-day{min-height:60px;padding:6px}.cal-preview{display:none}.calendar-head{align-items:flex-start;gap:10px}.calendar-label{min-width:88px}}
    `;
    document.head.appendChild(style);

    function inferredDue(t) {
      if (t.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(t.dueDate)) return t.dueDate;
      if (t.scope === 'daily' && /^\d{4}-\d{2}-\d{2}$/.test(t.target||'')) return t.target;
      const match = String(t.title||'').match(/\(([월화수목금토일])\)(?:\s|$)/);
      if (match && t.scope === 'weekly' && /^\d{4}-\d{2}-\d{2}$/.test(t.target||'')) return add(mon(t.target), weekMap[match[1]]);
      return null;
    }

    function dateKey(d) {
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }

    function monthShift(ymd, delta) {
      const d = dt(ymd); d.setDate(1); d.setMonth(d.getMonth()+delta); return dateKey(d);
    }

    function statusName(s) {
      return s==='todo'?'시작 전':s==='doing'?'진행 중':s==='done'?'완료':s==='blocked'?'이슈':s;
    }

    function monthCalendar() {
      const first = dt(calendarMonth); first.setDate(1);
      const year = first.getFullYear(), month = first.getMonth();
      const start = new Date(first); start.setDate(1-first.getDay());
      const byDate = {};
      S.workItems.forEach(t => { const d=inferredDue(t); if(d) (byDate[d] ||= []).push(t); });
      const cells=[];
      for(let i=0;i<42;i++){
        const d=new Date(start); d.setDate(start.getDate()+i); const key=dateKey(d), items=byDate[key]||[];
        const cls=['cal-day', d.getMonth()!==month?'out':'', key===today()?'today':'', d.getDay()===0?'sun':'', d.getDay()===6?'sat':''].filter(Boolean).join(' ');
        const preview=items.slice(0,2).map(t=>`<span class="${t.status==='done'?'done':t.status==='blocked'?'blocked':''}">${esc(t.title)}</span>`).join('');
        const tooltip=items.length?`<div class="cal-tooltip"><b>${d.getMonth()+1}월 ${d.getDate()}일 · ${items.length}건</b>${items.map(t=>`<div class="cal-tip-item"><span class="cal-tip-status">${statusName(t.status)}</span>${esc(t.title)}</div>`).join('')}</div>`:'';
        cells.push(`<div class="${cls}" data-cal-date="${key}"><span class="cal-num">${d.getDate()}</span>${items.length?`<span class="cal-count">${items.length}</span><div class="cal-preview">${preview}${items.length>2?`<span>+${items.length-2}건 더보기</span>`:''}</div>${tooltip}`:''}</div>`);
      }
      return `<section class="calendar-card"><div class="calendar-head"><div><h3>업무 캘린더</h3><p>Due Date 또는 제목의 (월)~(일) 요일을 자동 인식합니다.</p></div><div class="calendar-nav"><button class="btn" data-cal-act="prev">←</button><span class="calendar-label">${year}년 ${month+1}월</span><button class="btn" data-cal-act="next">→</button><button class="btn" data-cal-act="today">오늘</button></div></div><div class="calendar-weekdays"><div>일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div>토</div></div><div class="calendar-grid">${cells.join('')}</div></section>`;
    }

    const previousDashboard = dashboard;
    dashboard = function(){
      const html = previousDashboard();
      return html.replace('<div class="dashboard">', monthCalendar() + '<div class="dashboard">');
    };

    const previousTask = task;
    task = function(t, compact=false){
      let html = previousTask(t, compact);
      const d = inferredDue(t);
      if (d) html = html.replace('</div><div class="statusbar">', `<span class="chip due-chip">마감 ${fmt(d)}</span></div><div class="statusbar">`);
      return html;
    };

    const previousAct = act;
    act = function(b){
      if (b.dataset.act === 'carryNext') {
        const t = S.workItems.find(x=>x.id===b.dataset.id);
        if (!t) return;
        const oldDue=t.dueDate;
        const base = t.scope==='daily' ? t.target : (t.scope==='weekly' ? t.target : mon(today()));
        t.carriedFrom=t.target; t.carriedAt=today(); t.scope='weekly'; t.target=add(mon(base||today()),7); t.status='todo'; t.completedAt=null; t.issueNote=''; t.updatedAt=today();
        if(oldDue) t.dueDate=add(oldDue,7);
        save('차주로 넘겼습니다.'); render(); return;
      }
      previousAct(b);
    };

    openEditor = function(t){
      if(!t)return;
      $('#modalRoot').innerHTML=`<div class="modalbg" id="modalBg"><div class="modal"><h2>업무 수정</h2><div class="field"><label>업무명</label><input id="eTitle" class="input" value="${esc(t.title)}"></div><div class="formgrid"><div class="field"><label>구분</label><input id="eCat" class="input" value="${esc(t.category||'기타')}"></div><div class="field"><label>Due Date</label><input id="eDue" class="input" type="date" value="${esc(t.dueDate||'')}"></div></div><div class="field"><label>메모</label><textarea id="eNote" rows="3">${esc(t.note||'')}</textarea></div><div class="field"><label>이슈 내용</label><textarea id="eIssue" rows="3" placeholder="이슈 상태일 때 사유를 입력">${esc(t.issueNote||'')}</textarea></div><div class="statusbar" style="margin:10px 0 0">${Object.entries(STATUS).map(([k,v])=>`<button class="status ${k} ${t.status===k?'active':''}" data-edit-status="${k}">${v[0]} ${v[1]}</button>`).join('')}</div><div class="modalactions"><button class="btn" id="cancelEdit">취소</button><button class="btn primary" id="saveEdit">저장</button></div></div></div>`;
      let ns=t.status;
      $$('[data-edit-status]').forEach(b=>b.onclick=()=>{$$('[data-edit-status]').forEach(x=>x.classList.remove('active'));b.classList.add('active');ns=b.dataset.editStatus});
      $('#cancelEdit').onclick=()=>$('#modalRoot').innerHTML='';
      $('#saveEdit').onclick=()=>{
        const issueText=$('#eIssue').value.trim(); if(ns==='blocked'&&!issueText){toast('이슈 내용을 입력해주세요.');return;}
        t.title=$('#eTitle').value.trim()||t.title; t.category=$('#eCat').value.trim()||'기타'; t.dueDate=$('#eDue').value||''; t.note=$('#eNote').value.trim(); t.issueNote=issueText; t.status=ns; t.completedAt=ns==='done'?(t.completedAt||today()):null; t.updatedAt=today(); save('저장했습니다.'); $('#modalRoot').innerHTML=''; render();
      };
    };

    function openDay(date){
      const items=S.workItems.filter(t=>inferredDue(t)===date);
      $('#modalRoot').innerHTML=`<div class="modalbg"><div class="modal"><h2>${date} 업무 ${items.length}건</h2><div class="day-list">${items.length?items.map(t=>`<div class="day-list-item"><h4>${esc(t.title)}</h4><p>${statusName(t.status)} · ${esc(t.category||'기타')}</p><div style="margin-top:8px"><button class="btn" data-day-edit="${t.id}">수정</button></div></div>`).join(''):'<div class="empty">등록된 업무가 없습니다.</div>'}</div><div class="modalactions"><button class="btn primary" id="closeDay">닫기</button></div></div></div>`;
      $('#closeDay').onclick=()=>$('#modalRoot').innerHTML='';
      $$('[data-day-edit]').forEach(b=>b.onclick=()=>openEditor(S.workItems.find(x=>x.id===b.dataset.dayEdit)));
    }

    function bindCalendar(){
      $$('[data-cal-act]').forEach(b=>b.onclick=()=>{if(b.dataset.calAct==='prev')calendarMonth=monthShift(calendarMonth,-1);if(b.dataset.calAct==='next')calendarMonth=monthShift(calendarMonth,1);if(b.dataset.calAct==='today')calendarMonth=`${today().slice(0,7)}-01`;render()});
      $$('[data-cal-date]').forEach(d=>d.onclick=e=>{if(e.target.closest('.cal-tooltip'))return;openDay(d.dataset.calDate)});
    }

    const previousRender = render;
    render = function(){ previousRender(); bindCalendar(); };
    render();
  };
  boot();
})();