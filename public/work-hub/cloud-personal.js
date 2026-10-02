(() => {
  const boot = async () => {
    if (typeof S === 'undefined' || typeof render !== 'function' || typeof save !== 'function') {
      window.setTimeout(boot, 150);
      return;
    }
    if (window.__workhubPersonalCloudLoaded) return;
    window.__workhubPersonalCloudLoaded = true;

    let saveTimer = null;
    let saving = false;
    let lastRemoteAt = '';
    let pullTimer = null;

    const style = document.createElement('style');
    style.textContent = `
      .cloud-pill{border:1px solid #bad8cc;background:#edf9f4;color:#146b4e;border-radius:999px;padding:9px 12px;font-size:12px;font-weight:900;cursor:pointer;white-space:nowrap}
      .cloud-pill.saving{background:#fff8e8;border-color:#ead49c;color:#8c650d}
      .cloud-pill.error{background:#fff0f0;border-color:#e8b0b0;color:#a33c43}
      .dark .cloud-pill{background:#123126;border-color:#2c644f;color:#9be0c3}
    `;
    document.head.appendChild(style);

    function stateScore(st){
      const w = st?.work || st || {};
      const ledger = w.settings?.workLedgerV1 || {};
      return (w.workItems?.length||0)*100000
        + (ledger.monthlyPlans?.length||0)*1000
        + (w.history?.length||0)*100
        + (ledger.archivedTasks?.length||0)*10
        + (ledger.events?.length||0)
        + (w.legacyArchive?.length||0);
    }

    function pack(){
      return {
        version: 1,
        work: S,
        partner: (typeof partner !== 'undefined' ? partner : {}),
        savedAt: new Date().toISOString()
      };
    }

    function applyRemote(payload){
      if (!payload) return;
      const work = payload.work || payload;
      S = typeof normalizeState === 'function' ? normalizeState(work) : work;
      localStorage.setItem(K, JSON.stringify(S));
      if (payload.partner && typeof partner !== 'undefined') {
        partner = {...partner, ...payload.partner};
        localStorage.setItem(PARTNER, JSON.stringify(partner));
      }
      render();
    }

    function setBadge(text, cls=''){
      let b = document.getElementById('cloudBadge');
      if (!b) {
        b = document.createElement('button');
        b.id = 'cloudBadge';
        b.className = 'cloud-pill';
        const tools = document.querySelector('.headtools');
        if (tools) tools.insertBefore(b, tools.firstChild);
        b.onclick = async () => {
          await pushCloud(true);
          await pullCloud(false);
        };
      }
      b.className = 'cloud-pill' + (cls ? ' '+cls : '');
      b.textContent = text;
    }

    async function readRemote(){
      const res = await fetch('/api/workhub-state', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.message || 'Cloud read failed');
      return json.data || null;
    }

    async function pushCloud(manual=false){
      if (saving) return;
      if (stateScore(S) === 0) {
        if (manual && typeof toast === 'function') toast('업로드할 업무 데이터가 없습니다.');
        return;
      }
      saving = true;
      setBadge('☁ 저장 중…','saving');
      try {
        const res = await fetch('/api/workhub-state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state: pack() })
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.ok) throw new Error(json.message || 'Cloud write failed');
        lastRemoteAt = json.updated_at || new Date().toISOString();
        setBadge('☁ 저장됨');
        if (manual && typeof toast === 'function') toast('클라우드 동기화 완료');
      } catch(e) {
        console.error(e);
        setBadge('☁ 저장 오류','error');
        if (manual && typeof toast === 'function') toast('클라우드 저장에 실패했습니다.');
      } finally {
        saving = false;
      }
    }

    function schedulePush(){
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => {
        saveTimer = null;
        pushCloud(false);
      }, 450);
    }

    async function pullCloud(silent=true){
      if (saving || saveTimer) return;
      try {
        const remote = await readRemote();
        if (!remote?.state) return;
        if (!lastRemoteAt || remote.updated_at > lastRemoteAt) {
          applyRemote(remote.state);
          lastRemoteAt = remote.updated_at || '';
          setBadge('☁ 동기화됨');
          if (!silent && typeof toast === 'function') toast('최신 업무 데이터를 불러왔습니다.');
        }
      } catch(e) {
        console.error(e);
        setBadge('☁ 연결 오류','error');
      }
    }

    const originalSave = save;
    save = function(msg){
      originalSave(msg);
      schedulePush();
    };

    if (typeof savePartner === 'function') {
      const originalSavePartner = savePartner;
      savePartner = function(){
        originalSavePartner();
        schedulePush();
      };
    }

    setBadge('☁ 연결 중…','saving');

    try {
      const remote = await readRemote();
      const localScore = stateScore(S);
      const remoteScore = stateScore(remote?.state);

      if (remote?.state && remoteScore > 0) {
        applyRemote(remote.state);
        lastRemoteAt = remote.updated_at || '';
        setBadge('☁ 동기화됨');
      } else if (localScore > 0) {
        await pushCloud(false);
      } else {
        setBadge('☁ 연결됨');
      }
    } catch(e) {
      console.error(e);
      setBadge('☁ 연결 오류','error');
    }

    window.clearInterval(pullTimer);
    pullTimer = window.setInterval(() => pullCloud(true), 30000);
    window.addEventListener('focus', () => pullCloud(true), { passive: true });
    window.addEventListener('pagehide', () => {
      window.clearTimeout(saveTimer);
      window.clearInterval(pullTimer);
    }, { once: true });
  };

  boot();
})();
