(() => {
  'use strict';

  const boot = () => {
    if (typeof S === 'undefined' || typeof dashboard !== 'function' || typeof render !== 'function' || typeof save !== 'function') {
      window.setTimeout(boot, 120);
      return;
    }
    if (window.__workhubScratchNotesLoaded) return;
    window.__workhubScratchNotesLoaded = true;

    S.settings = S.settings || {};
    if (!Array.isArray(S.settings.quickNotes)) S.settings.quickNotes = [];

    const style = document.createElement('style');
    style.id = 'workhub-scratch-note-style';
    style.textContent = `
      .scratch-card{margin:0 0 16px;border:1px solid var(--line);border-top:3px double #ae8e5b;background:var(--card);border-radius:6px;overflow:hidden}
      .scratch-head{padding:15px 17px 9px}.scratch-head h3{margin:0;font-family:Georgia,'Noto Serif KR',serif;font-size:20px}.scratch-head p{margin:4px 0 0;color:var(--muted);font-size:12px}
      .scratch-list{padding:0 13px}.scratch-note{border-top:1px solid var(--line)}.scratch-note:first-child{border-top:0}
      .scratch-note summary{display:flex;align-items:center;gap:9px;padding:11px 4px;cursor:pointer;list-style:none}.scratch-note summary::-webkit-details-marker{display:none}
      .scratch-toggle{font-size:11px;color:var(--muted);width:18px}.scratch-summary{min-width:0;flex:1;font-size:14px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .scratch-date{font-size:10px;color:var(--muted);white-space:nowrap}.scratch-body{padding:2px 31px 13px 31px}.scratch-text{white-space:pre-wrap;line-height:1.6;font-size:14px;word-break:keep-all;overflow-wrap:break-word}
      .scratch-actions{display:flex;gap:7px;margin-top:9px}.scratch-actions button{font-size:11px;padding:6px 9px}
      .scratch-compose{border-top:1px solid var(--line);padding:12px 13px}.scratch-compose textarea{min-height:58px;resize:vertical;line-height:1.55;font-size:14px}
      .scratch-hint{margin-top:5px;color:var(--muted);font-size:10px}.scratch-empty{padding:10px 4px 14px;color:var(--muted);font-size:12px}
    `;
    document.head.appendChild(style);

    function store() {
      S.settings = S.settings || {};
      if (!Array.isArray(S.settings.quickNotes)) S.settings.quickNotes = [];
      return S.settings.quickNotes;
    }

    function oneLine(text) {
      return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 120) || '메모';
    }

    function stamp(value) {
      try {
        return new Date(value).toLocaleString('ko-KR', {month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
      } catch { return ''; }
    }

    function notesPanel() {
      const notes = [...store()].sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));
      return `<section class="scratch-card">
        <div class="scratch-head"><h3>주절주절 메모</h3><p>회의·업무지시·생각나는 내용을 바로 적으세요. Enter 저장 · Shift+Enter 줄바꿈</p></div>
        <div class="scratch-list">${notes.length ? notes.map(n=>`
          <details class="scratch-note" data-note-id="${n.id}">
            <summary><span class="scratch-toggle">▸</span><span class="scratch-summary">${esc(oneLine(n.text))}</span><span class="scratch-date">${esc(stamp(n.updatedAt||n.createdAt))}</span></summary>
            <div class="scratch-body"><div class="scratch-text">${esc(n.text)}</div><div class="scratch-actions"><button class="btn" data-note-act="edit" data-id="${n.id}">수정</button><button class="btn" data-note-act="delete" data-id="${n.id}">삭제</button></div></div>
          </details>`).join('') : '<div class="scratch-empty">아직 저장된 메모가 없습니다.</div>'}</div>
        <div class="scratch-compose"><textarea id="scratchInput" placeholder="예: 비올라 조달은 식별번호 받고 CXMS 응답 온 뒤 진행. 자료 준비는 다음주 목요일쯤..."></textarea><div class="scratch-hint">Enter로 바로 저장됩니다.</div></div>
      </section>`;
    }

    function addNote(text) {
      const value = String(text || '').trim();
      if (!value) return;
      const now = new Date().toISOString();
      store().push({id:uid(), text:value, createdAt:now, updatedAt:now});
      save('메모를 저장했습니다.');
      render();
    }

    function editNote(id) {
      const note = store().find(x=>x.id===id);
      if (!note) return;
      $('#modalRoot').innerHTML = `<div class="modalbg"><div class="modal"><h2>메모 수정</h2><div class="field"><label>내용</label><textarea id="scratchEdit" rows="8">${esc(note.text)}</textarea></div><div class="modalactions"><button class="btn" id="scratchCancel">취소</button><button class="btn primary" id="scratchSave">저장</button></div></div></div>`;
      $('#scratchCancel').onclick=()=>$('#modalRoot').innerHTML='';
      $('#scratchSave').onclick=()=>{
        const text=$('#scratchEdit').value.trim();
        if(!text){toast('내용을 입력해주세요.');return;}
        note.text=text;
        note.updatedAt=new Date().toISOString();
        save('메모를 수정했습니다.');
        $('#modalRoot').innerHTML='';
        render();
      };
    }

    function deleteNote(id) {
      const note=store().find(x=>x.id===id);
      if(!note) return;
      if(!confirm('이 메모를 삭제할까요?')) return;
      S.settings.quickNotes=store().filter(x=>x.id!==id);
      save('메모를 삭제했습니다.');
      render();
    }

    const previousDashboard = dashboard;
    dashboard = function() {
      return notesPanel() + previousDashboard();
    };

    const previousRender = render;
    render = function() {
      previousRender();
      const input=$('#scratchInput');
      if(input) input.onkeydown=e=>{
        if(e.key==='Enter' && !e.shiftKey) {
          e.preventDefault();
          addNote(input.value);
        }
      };
      $$('[data-note-act]').forEach(b=>b.onclick=()=>{
        if(b.dataset.noteAct==='edit') editNote(b.dataset.id);
        if(b.dataset.noteAct==='delete') deleteNote(b.dataset.id);
      });
      $$('.scratch-note').forEach(d=>d.ontoggle=()=>{
        const icon=d.querySelector('.scratch-toggle');
        if(icon) icon.textContent=d.open?'▾':'▸';
      });
    };

    render();
  };

  boot();
})();