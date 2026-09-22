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
    const holidayCache = {};
    S.settings = S.settings || {};
    if (!Array.isArray(S.settings.vacations)) S.settings.vacations = [];

    const style = document.createElement('style');
    style.id = 'workhub-calendar-style';
    style.textContent = `
      .tasktitle,.reportline,.reportcard,.team,.stock b,.favorite-head b,.issue-note{
        word-break:keep-all!important;overflow-wrap:break-word!important;line-break:strict!important;text-wrap:pretty!important;white-space:normal!important
      }
      .tasktop{min-width:0}.tasktitle{min-width:0}.taskactions{flex-wrap:wrap;justify-content:flex-end}
      .calendar-card{background:var(--card);border:1px solid var(--line);border-radius:17px;box-shadow:var(--shadow);margin-top:18px;margin-bottom:14px;overflow:visible}
      .calendar-head{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid var(--line);gap:14px}
      .calendar-head h3{margin:0;font-size:21px;font-weight:950}.calendar-head p{margin:4px 0 0;color:var(--muted);font-size:12px}
      .calendar-nav{display:flex;gap:7px;align-items:center;flex-wrap:wrap;justify-content:flex-end}.calendar-label{font-size:15px;font-weight:900;min-width:105px;text-align:center}
      .vacation-add{background:#5b4df0!important;border-color:#5b4df0!important;color:#fff!important}
      .calendar-weekdays,.calendar-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr))}
      .calendar-weekdays{padding:10px 12px 0}.calendar-weekdays div{text-align:center;color:var(--muted);font-size:12px;font-weight:850;padding:7px}
      .calendar-weekdays div:first-child{color:#d0525b}.calendar-weekdays div:last-child{color:#3f6fc9}
      .calendar-grid{padding:0 12px 13px;gap:6px}
      .cal-day{position:relative;min-height:84px;border:1px solid var(--line);border-radius:11px;background:color-mix(in srgb,var(--card) 94%,#eef3f8);padding:8px;cursor:pointer;transition:.12s ease;overflow:visible}
      .cal-day:hover{border-color:#8ea2ff;box-shadow:0 8px 22px rgba(49,84,244,.12);z-index:30}.cal-day.out{opacity:.38}.cal-day.today{outline:2px solid #3154f4;outline-offset:-1px}
      .cal-day.holiday{background:color-mix(in srgb,#fff0f0 35%,var(--card));border-color:color-mix(in srgb,#d0525b 35%,var(--line))}
      .cal-num{font-size:13px;font-weight:900}.cal-day.sun .cal-num,.cal-day.holiday .cal-num{color:#d0525b}.cal-day.sat .cal-num{color:#3f6fc9}
      .holiday-name{display:block;margin-top:2px;font-size:10px;font-weight:900;color:#d0525b;word-break:keep-all;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .cal-count{position:absolute;right:7px;top:7px;min-width:22px;height:22px;padding:0 6px;border-radius:999px;background:#3154f4;color:white;display:grid;place-items:center;font-size:10px;font-weight:950}
      .cal-preview{margin-top:7px;display:flex;flex-direction:column;gap:4px}.cal-preview span{font-size:10px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--muted)}
      .cal-preview span.done{color:#13865f;text-decoration:line-through}.cal-preview span.blocked{color:#c7652d}
      .cal-preview .vacation-preview{color:#6554e8;font-weight:900;text-decoration:none}
      .dark .cal-preview .vacation-preview{color:#bcb4ff}
      .cal-tooltip{display:none;position:absolute;left:8px;top:calc(100% - 2px);width:min(390px,80vw);background:#091322;color:#eef4ff;border:1px solid #2b4260;border-radius:12px;padding:10px;box-shadow:0 18px 45px rgba(3,8,15,.34);z-index:100}
      .cal-day:nth-child(7n+6) .cal-tooltip,.cal-day:nth-child(7n+7) .cal-tooltip{left:auto;right:8px}.cal-day:hover .cal-tooltip{display:block}
      .cal-tooltip b{display:block;font-size:12px;margin-bottom:6px}.cal-tip-item{font-size:11px;line-height:1.4;padding:6px 0;border-top:1px solid #1f3149;word-break:keep-all;overflow-wrap:break-word}.cal-tip-item:first-of-type{border-top:0}.cal-tip-status{font-size:9px;color:#91a3bc;margin-right:6px}
      .holiday-tip{color:#ff9ba0;font-weight:900}.vacation-tip{color:#c5bcff;font-weight:900}
      .due-chip{background:#eef7ff!important;color:#326a9c!important}.dark .due-chip{background:#18314a!important;color:#9dcdf2!important}
      .day-list{display:flex;flex-direction:column;gap:8px;margin-top:10px}.day-list-item{border:1px solid var(--line);border-radius:11px;padding:11px}.day-list-item h4{margin:0 0 5px;font-size:15px;word-break:keep-all;text-wrap:pretty}.day-list-item p{margin:0;color:var(--muted);font-size:11px}
      .day-special{border-radius:11px;padding:11px;margin:7px 0}.day-special.holiday-box{background:#fff0f0;border:1px solid #efb7bb;color:#9e3f46}.day-special.vacation-box{background:#f1efff;border:1px solid #c5bfff;color:#5044bd}
      .dark .day-special.holiday-box{background:#3a1d21;border-color:#75424a;color:#ffabb0}.dark .day-special.vacation-box{background:#252148;border-color:#544a99;color:#cbc5ff}
      .vacation-row{display:flex;justify-content:space-between;gap:10px;align-items:center}.vacation-row b{font-size:14px}.vacation-row small{display:block;margin-top:3px;font-size:10px;opacity:.8}
      .vac-delete{border:1px solid currentColor;background:transparent;color:inherit;border-radius:8px;padding:6px 8px;font-size:10px;font-weight:900;cursor:pointer}
      .vacation-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}
      @media(max-width:900px){.cal-day{min-height:64px;padding:6px}.cal-preview{display:none}.calendar-head{align-items:flex-start;gap:10px;flex-direction:column}.calendar-nav{justify-content:flex-start}.calendar-label{min-width:88px}}
      @media(max-width:620px){.vacation-form-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);

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

    function inferredDates(t) {
      if (t.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(t.dueDate)) return [t.dueDate];
      if (t.scope === 'daily' && /^\d{4}-\d{2}-\d{2}$/.test(t.target||'')) return [t.target];
      const days = weekdayTokens(t.title);
      if (days.length && t.scope === 'weekly' && /^\d{4}-\d{2}-\d{2}$/.test(t.target||'')) {
        const weekStart = mon(t.target);
        return days.map(day => add(weekStart, weekMap[day]));
      }
      return [];
    }

    function inferredDue(t) {
      return inferredDates(t)[0] || null;
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

    function vacationDates(v) {
      const start = v.startDate || v.date;
      const end = v.endDate || start;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start||'') || !/^\d{4}-\d{2}-\d{2}$/.test(end||'')) return [];
      const out=[]; let cur=start; let guard=0;
      while(cur<=end && guard<370){ out.push(cur); cur=add(cur,1); guard++; }
      return out;
    }

    function vacationsOn(date) {
      return (S.settings.vacations||[]).filter(v=>vacationDates(v).includes(date));
    }

    async function ensureHolidays(year) {
      if (holidayCache[year] === 'loading' || Array.isArray(holidayCache[year])) return;
      holidayCache[year] = 'loading';
      try {
        const res = await fetch(`/api/public/work-hub-holidays?year=${year}`, {cache:'no-store'});
        const json = await res.json();
        holidayCache[year] = Array.isArray(json.holidays) ? json.holidays : [];
      } catch {
        holidayCache[year] = [];
      }
      render();
    }

    function holidaysForYear(year) {
      const data = holidayCache[year];
      if (!Array.isArray(data)) {
        window.setTimeout(()=>ensureHolidays(year),0);
        return [];
      }
      return data;
    }

    function holidayOn(date) {
      const year = Number(date.slice(0,4));
      return holidaysForYear(year).find(h=>h.date===date) || null;
    }

    function openVacationEditor(defaultDate=today()) {
      $('#modalRoot').innerHTML=`<div class="modalbg"><div class="modal"><h2>내 휴가 추가</h2><div class="vacation-form-grid"><div class="field"><label>종류</label><select id="vType"><option value="연차">연차</option><option value="오전 반차">오전 반차</option><option value="오후 반차">오후 반차</option><option value="휴가">휴가</option><option value="기타">기타</option></select></div><div class="field"><label>표시명</label><input id="vTitle" class="input" placeholder="예: 부산 휴가"></div><div class="field"><label>시작일</label><input id="vStart" class="input" type="date" value="${defaultDate}"></div><div class="field"><label>종료일</label><input id="vEnd" class="input" type="date" value="${defaultDate}"></div></div><div class="field"><label>메모</label><textarea id="vNote" rows="3" placeholder="선택사항"></textarea></div><div class="modalactions"><button class="btn" id="vCancel">취소</button><button class="btn primary" id="vSave">휴가 추가</button></div></div></div>`;
      $('#vCancel').onclick=()=>$('#modalRoot').innerHTML='';
      $('#vStart').onchange=()=>{ if(!$('#vEnd').value || $('#vEnd').value<$('#vStart').value) $('#vEnd').value=$('#vStart').value; };
      $('#vSave').onclick=()=>{
        const start=$('#vStart').value, end=$('#vEnd').value||start, type=$('#vType').value;
        if(!start){toast('시작일을 선택해주세요.');return;}
        if(end<start){toast('종료일은 시작일보다 빠를 수 없습니다.');return;}
        S.settings.vacations.push({
          id: uid(), type, title: $('#vTitle').value.trim() || type,
          startDate:start, endDate:end, note:$('#vNote').value.trim(), createdAt:today()
        });
        save('휴가를 캘린더에 추가했습니다.');
        $('#modalRoot').innerHTML='';
        render();
      };
    }

    function deleteVacation(id) {
      const v=(S.settings.vacations||[]).find(x=>x.id===id);
      if(!v)return;
      if(!confirm(`"${v.title||v.type}" 휴가를 삭제할까요?`))return;
      S.settings.vacations=S.settings.vacations.filter(x=>x.id!==id);
      save('휴가를 삭제했습니다.');
      render();
    }

    function monthCalendar() {
      const first = dt(calendarMonth); first.setDate(1);
      const year = first.getFullYear(), month = first.getMonth();
      const holidays = holidaysForYear(year);
      const start = new Date(first); start.setDate(1-first.getDay());
      const byDate = {};
      S.workItems.forEach(t => {
        inferredDates(t).forEach(d => (byDate[d] ||= []).push(t));
      });
      const vacByDate={};
      (S.settings.vacations||[]).forEach(v=>vacationDates(v).forEach(d=>(vacByDate[d] ||= []).push(v)));

      const cells=[];
      for(let i=0;i<42;i++){
        const d=new Date(start); d.setDate(start.getDate()+i);
        const key=dateKey(d), items=byDate[key]||[], vacs=vacByDate[key]||[];
        const holiday=holidays.find(h=>h.date===key)||null;
        const cls=['cal-day', d.getMonth()!==month?'out':'', key===today()?'today':'', d.getDay()===0?'sun':'', d.getDay()===6?'sat':'', holiday?'holiday':''].filter(Boolean).join(' ');
        const taskPreview=items.slice(0,2).map(t=>`<span class="${t.status==='done'?'done':t.status==='blocked'?'blocked':''}">${esc(t.title)}</span>`).join('');
        const vacationPreview=vacs.slice(0,1).map(v=>`<span class="vacation-preview">🏖 ${esc(v.title||v.type)}</span>`).join('');
        const total=items.length+vacs.length;
        const tooltipParts=[];
        if(holiday) tooltipParts.push(`<div class="cal-tip-item holiday-tip">공휴일 · ${esc(holiday.name)}</div>`);
        vacs.forEach(v=>tooltipParts.push(`<div class="cal-tip-item vacation-tip">휴가 · ${esc(v.title||v.type)}${v.type&&v.title!==v.type?' ('+esc(v.type)+')':''}</div>`));
        items.forEach(t=>tooltipParts.push(`<div class="cal-tip-item"><span class="cal-tip-status">${statusName(t.status)}</span>${esc(t.title)}</div>`));
        const tooltip=tooltipParts.length?`<div class="cal-tooltip"><b>${d.getMonth()+1}월 ${d.getDate()}일</b>${tooltipParts.join('')}</div>`:'';
        const hiddenCount=Math.max(0,total-3);
        cells.push(`<div class="${cls}" data-cal-date="${key}"><span class="cal-num">${d.getDate()}</span>${holiday?`<span class="holiday-name">${esc(holiday.name)}</span>`:''}${total?`<span class="cal-count">${total}</span><div class="cal-preview">${vacationPreview}${taskPreview}${hiddenCount?`<span>+${hiddenCount}건 더보기</span>`:''}</div>${tooltip}`:tooltip}</div>`);
      }
      return `<section class="calendar-card"><div class="calendar-head"><div><h3>업무 캘린더</h3><p>공휴일은 자동 표시 · 날짜를 클릭하면 업무 확인과 휴가 추가가 가능합니다.</p></div><div class="calendar-nav"><button class="btn vacation-add" data-cal-act="vacation">+ 내 휴가</button><button class="btn" data-cal-act="prev">←</button><span class="calendar-label">${year}년 ${month+1}월</span><button class="btn" data-cal-act="next">→</button><button class="btn" data-cal-act="today">오늘</button></div></div><div class="calendar-weekdays"><div>일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div>토</div></div><div class="calendar-grid">${cells.join('')}</div></section>`;
    }

    const previousDashboard = dashboard;
    dashboard = function(){
      const html = previousDashboard();
      return html + monthCalendar() + `<section class="live-center-below">${liveCenter()}</section>`;
    };

    const previousTask = task;
    task = function(t, compact=false){
      let html = previousTask(t, compact);
      const dates = inferredDates(t);
      if (dates.length) {
        const label = t.dueDate ? `마감 ${fmt(dates[0])}` : dates.length > 1 ? `일정 ${dates.map(fmt).join(' · ')}` : `일정 ${fmt(dates[0])}`;
        html = html.replace('</div><div class="statusbar">', `<span class="chip due-chip">${label}</span></div><div class="statusbar">`);
      }
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
      const items=S.workItems.filter(t=>inferredDates(t).includes(date));
      const holiday=holidayOn(date);
      const vacs=vacationsOn(date);
      const special=[
        holiday?`<div class="day-special holiday-box"><b>공휴일 · ${esc(holiday.name)}</b></div>`:'',
        ...vacs.map(v=>`<div class="day-special vacation-box"><div class="vacation-row"><div><b>🏖 ${esc(v.title||v.type)}</b><small>${esc(v.type)} · ${esc(v.startDate)}${v.endDate&&v.endDate!==v.startDate?' ~ '+esc(v.endDate):''}${v.note?' · '+esc(v.note):''}</small></div><button class="vac-delete" data-vac-delete="${v.id}">삭제</button></div></div>`)
      ].join('');
      $('#modalRoot').innerHTML=`<div class="modalbg"><div class="modal"><h2>${date} 일정</h2>${special}<div class="day-list">${items.length?items.map(t=>`<div class="day-list-item"><h4>${esc(t.title)}</h4><p>${statusName(t.status)} · ${esc(t.category||'기타')}</p><div style="margin-top:8px"><button class="btn" data-day-edit="${t.id}">수정</button></div></div>`).join(''):'<div class="empty">등록된 업무가 없습니다.</div>'}</div><div class="modalactions"><button class="btn vacation-add" id="addVacationDay">+ 이 날짜에 휴가</button><button class="btn primary" id="closeDay">닫기</button></div></div></div>`;
      $('#closeDay').onclick=()=>$('#modalRoot').innerHTML='';
      $('#addVacationDay').onclick=()=>openVacationEditor(date);
      $$('[data-day-edit]').forEach(b=>b.onclick=()=>openEditor(S.workItems.find(x=>x.id===b.dataset.dayEdit)));
      $$('[data-vac-delete]').forEach(b=>b.onclick=()=>deleteVacation(b.dataset.vacDelete));
    }

    function bindCalendar(){
      $$('[data-cal-act]').forEach(b=>b.onclick=()=>{
        if(b.dataset.calAct==='prev')calendarMonth=monthShift(calendarMonth,-1);
        if(b.dataset.calAct==='next')calendarMonth=monthShift(calendarMonth,1);
        if(b.dataset.calAct==='today')calendarMonth=`${today().slice(0,7)}-01`;
        if(b.dataset.calAct==='vacation'){openVacationEditor(today());return;}
        render();
      });
      $$('[data-cal-date]').forEach(d=>d.onclick=e=>{if(e.target.closest('.cal-tooltip'))return;openDay(d.dataset.calDate)});
    }

    const previousRender = render;
    render = function(){ previousRender(); bindCalendar(); };
    ensureHolidays(Number(today().slice(0,4)));
    render();
  };
  boot();
})();