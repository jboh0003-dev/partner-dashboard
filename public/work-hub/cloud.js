(() => {

  const boot = async () => {
    if (!window.__workhubConnectClient || typeof S === 'undefined' || typeof render !== 'function' || typeof save !== 'function') {
      window.setTimeout(boot, 150);
      return;
    }
    if (window.__workhubCloudLoaded) return;
    window.__workhubCloudLoaded = true;

    const sb = window.__workhubConnectClient;
    window.__workhubSupabase = sb;

    let session = null;
    let saveTimer = null;
    let saving = false;
    let lastRemoteAt = '';
    let pullTimer = null;

    const style = document.createElement('style');
    style.id = 'workhub-cloud-style';
    style.textContent = `
      .cloud-pill{border:1px solid #bad8cc;background:#edf9f4;color:#146b4e;border-radius:999px;padding:9px 12px;font-size:12px;font-weight:900;cursor:pointer;white-space:nowrap}
      .cloud-pill.saving{background:#fff8e8;border-color:#ead49c;color:#8c650d}
      .cloud-pill.error{background:#fff0f0;border-color:#e8b0b0;color:#a33c43}
      .dark .cloud-pill{background:#123126;border-color:#2c644f;color:#9be0c3}
      .cloud-auth{position:fixed;inset:0;background:rgba(3,8,16,.72);backdrop-filter:blur(8px);display:grid;place-items:center;padding:20px;z-index:10000}
      .cloud-card{width:min(440px,100%);background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:22px;padding:26px;box-shadow:0 30px 80px rgba(0,0,0,.28)}
      .cloud-card h2{font-size:26px;margin:0 0 6px;letter-spacing:-.6px}.cloud-card>p{font-size:13px;color:var(--muted);line-height:1.55;margin:0 0 18px}
      .cloud-field{margin:11px 0}.cloud-field label{display:block;font-size:12px;font-weight:850;color:var(--muted);margin-bottom:6px}.cloud-field input{width:100%;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:11px;padding:13px;font-size:15px;outline:none}
      .cloud-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:16px}.cloud-actions button{padding:12px!important;font-size:14px!important}
      .cloud-msg{min-height:19px;margin-top:10px;font-size:12px;color:#b14c52;line-height:1.45}.cloud-help{margin-top:14px;padding-top:13px;border-top:1px solid var(--line);font-size:11px;color:var(--muted);line-height:1.55}
      .cloud-user-menu{position:fixed;right:18px;top:92px;background:var(--card);border:1px solid var(--line);border-radius:13px;padding:12px;z-index:200;box-shadow:0 18px 40px rgba(0,0,0,.14);min-width:220px}
      .cloud-user-menu b{display:block;font-size:12px;word-break:break-all;margin-bottom:8px}.cloud-user-menu button{width:100%}
      .account-nav{position:absolute;left:14px;right:14px;bottom:22px}
      .account-nav button{width:100%;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.04);color:#c6d1df;border-radius:12px;padding:13px 12px;font-size:13px;font-weight:900;cursor:pointer;text-align:left}
      .account-nav button:hover{background:#192a43;border-color:#2a405f;color:#fff}
      .account-modal{width:min(620px,100%);background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:20px;padding:22px;box-shadow:0 28px 70px rgba(0,0,0,.28)}
      .account-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;margin-bottom:16px}
      .account-head h2{margin:0;font-size:26px;letter-spacing:-.6px}.account-head p{margin:5px 0 0;font-size:12px;color:var(--muted)}
      .account-email{padding:13px 14px;border:1px solid var(--line);border-radius:12px;background:color-mix(in srgb,var(--card) 88%,#edf2f8);font-size:14px;font-weight:850;word-break:break-all}
      .account-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
      .account-box{border:1px solid var(--line);border-radius:14px;padding:14px;background:color-mix(in srgb,var(--card) 94%,#eef3f8)}
      .account-box span{display:block;font-size:11px;color:var(--muted);font-weight:800}.account-box strong{display:block;font-size:15px;margin-top:5px;word-break:break-word}
      .account-section{margin-top:16px;padding-top:16px;border-top:1px solid var(--line)}
      .account-section h3{margin:0 0 10px;font-size:16px}.account-section p{font-size:11px;color:var(--muted);line-height:1.5;margin:0 0 10px}
      .account-password-grid{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:end}
      .account-danger{display:flex;justify-content:space-between;gap:10px;align-items:center}
      .account-close{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:9px;width:36px;height:36px;font-size:18px;cursor:pointer}
      @media(max-width:700px){.account-grid{grid-template-columns:1fr}.account-password-grid{grid-template-columns:1fr}.account-nav{left:8px;right:8px;bottom:14px}}
    `;
    document.head.appendChild(style);

    function stateScore(st){
      const w = st?.work || st || {};
      return (w.workItems?.length||0)*100000 + (w.history?.length||0)*100 + (w.legacyArchive?.length||0);
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
        b.onclick = toggleUserMenu;
      }
      b.className = 'cloud-pill' + (cls ? ' '+cls : '');
      b.textContent = text;
    }
    function ensureAccountNav(){
      const side=document.querySelector('.side');
      if(!side || document.getElementById('accountNav')) return;
      const wrap=document.createElement('div');
      wrap.id='accountNav';
      wrap.className='account-nav';
      wrap.innerHTML='<button type="button" id="accountManageBtn">⚙ 계정관리</button>';
      side.appendChild(wrap);
      document.getElementById('accountManageBtn').onclick=openAccountManager;
    }

    function formatSyncTime(){
      if(!lastRemoteAt) return '동기화 기록 없음';
      try{
        return new Date(lastRemoteAt).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
      }catch{return '동기화됨';}
    }

    function openAccountManager(){
      if(!session?.user){showAuth();return;}
      document.getElementById('cloudUserMenu')?.remove();
      const root=document.createElement('div');
      root.id='accountManager';
      root.className='cloud-auth';
      root.innerHTML=`
        <div class="account-modal">
          <div class="account-head">
            <div><h2>계정관리</h2><p>파트너 커넥트 계정으로 연결된 개인 업무관리입니다.</p></div>
            <button type="button" class="account-close" id="accountClose">×</button>
          </div>
          <div class="cloud-field"><label>로그인 이메일</label><div class="account-email">${esc(session.user.email||'-')}</div></div>
          <div class="account-grid">
            <div class="account-box"><span>클라우드 상태</span><strong>${saving?'저장 중':'연결됨'}</strong></div>
            <div class="account-box"><span>최근 동기화</span><strong>${esc(formatSyncTime())}</strong></div>
          </div>
          <div class="account-section">
            <h3>클라우드 동기화</h3>
            <p>현재 기기의 업무 상태를 클라우드에 즉시 저장합니다.</p>
            <button type="button" class="btn primary" id="accountSyncNow">지금 동기화</button>
          </div>
          <div class="account-section">
            <h3>파트너 커넥트 계정</h3>
            <p>비밀번호와 계정 정보는 파트너 커넥트에서 함께 관리합니다.</p>
            <a class="btn" href="/dashboard/settings/account" target="_top">내 계정 관리</a>
          </div>
          <div class="account-section">
            <div class="account-danger">
              <div><h3 style="margin-bottom:4px">로그아웃</h3><p style="margin:0">이 기기에서 파트너 커넥트와 워크허브를 함께 로그아웃합니다.</p></div>
              <button type="button" class="btn" id="accountLogout">로그아웃</button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(root);

      const close=()=>root.remove();
      document.getElementById('accountClose').onclick=close;
      root.onclick=e=>{if(e.target===root)close();};
      document.getElementById('accountSyncNow').onclick=async()=>{
        const btn=document.getElementById('accountSyncNow');
        btn.disabled=true; btn.textContent='동기화 중…';
        await pushCloud(true);
        btn.disabled=false; btn.textContent='지금 동기화';
      };
      document.getElementById('accountLogout').onclick=async()=>{
        close();
        await sb.auth.signOut({ scope: 'local' });
      };
    }

    function toggleUserMenu(){
      const old = document.getElementById('cloudUserMenu');
      if (old) { old.remove(); return; }
      if (!session?.user) return;
      const menu = document.createElement('div');
      menu.id = 'cloudUserMenu';
      menu.className = 'cloud-user-menu';
      menu.innerHTML = '<b>'+esc(session.user.email||'워크허브 계정')+'</b><button class="btn" id="cloudAccountManage">계정관리</button><button class="btn" id="cloudSyncNow" style="margin-top:7px">지금 동기화</button><button class="btn" id="cloudLogout" style="margin-top:7px">로그아웃</button>';
      document.body.appendChild(menu);
      document.getElementById('cloudAccountManage').onclick = ()=>{ menu.remove(); openAccountManager(); };
      document.getElementById('cloudSyncNow').onclick = async()=>{ await pushCloud(true); menu.remove(); };
      document.getElementById('cloudLogout').onclick = async()=>{ await sb.auth.signOut({ scope: 'local' }); menu.remove(); };
    }

    async function readRemote(){
      if (!session?.user?.id) return null;
      const {data,error} = await sb.from('workhub_state').select('state,updated_at').eq('user_id',session.user.id).maybeSingle();
      if (error) throw error;
      return data;
    }
    async function pushCloud(manual=false){
      if (!session?.user?.id || saving) return;
      if (stateScore(S) === 0) {
        if (manual) toast('업로드할 업무 데이터가 없습니다.');
        return;
      }
      saving = true;
      setBadge('☁ 저장 중…','saving');
      try {
        const updatedAt = new Date().toISOString();
        const {error} = await sb.from('workhub_state').upsert({
          user_id: session.user.id,
          state: pack(),
          updated_at: updatedAt
        }, {onConflict:'user_id'});
        if (error) throw error;
        lastRemoteAt = updatedAt;
        setBadge('☁ 클라우드 저장됨');
        if (manual) toast('클라우드 동기화 완료');
      } catch(e) {
        console.error(e);
        setBadge('☁ 동기화 오류','error');
        if (manual) toast('클라우드 저장에 실패했습니다.');
      } finally {
        saving = false;
      }
    }
    function schedulePush(){
      if (!session?.user?.id) return;
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(()=>{ saveTimer=null; pushCloud(false); }, 450);
    }
    async function pullCloud(silent=true){
      if (!session?.user?.id || saving || saveTimer) return;
      try{
        const remote = await readRemote();
        if (!remote?.state) return;
        if (!lastRemoteAt || remote.updated_at > lastRemoteAt) {
          applyRemote(remote.state);
          lastRemoteAt = remote.updated_at || '';
          setBadge('☁ 클라우드 동기화');
          if (!silent) toast('다른 기기의 최신 데이터를 불러왔습니다.');
        }
      }catch(e){
        console.error(e);
        setBadge('☁ 연결 확인 필요','error');
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

    function removeAuth(){ document.getElementById('cloudAuth')?.remove(); }
    function showAuth(){
      session = null;
      window.clearTimeout(saveTimer);
      window.clearInterval(pullTimer);
      // The parent and iframe share the existing Connect login.
      window.top.location.replace('/login?redirect=%2Fwork-hub');
    }

    async function afterAuth(s){
      if (!s?.user || s.user.id !== window.__workhubAuthorizedUserId) {
        showAuth();
        return;
      }
      session = s;
      removeAuth();
      setBadge('☁ 연결 중…','saving');
      ensureAccountNav();
      try{
        const remote = await readRemote();
        const localScore = stateScore(S);
        const remoteScore = stateScore(remote?.state);
        if (remote?.state && remoteScore > 0) {
          applyRemote(remote.state);
          lastRemoteAt = remote.updated_at || '';
          setBadge('☁ 클라우드 동기화');
          toast('클라우드 업무를 불러왔습니다.');
        } else if (localScore > 0) {
          const recoveredFrom = localStorage.getItem('workhub_recovered_from') || '';
          if (recoveredFrom.startsWith('화면 복구 스냅샷')) {
            setBadge('☁ 연결됨 · 업로드 대기','saving');
            toast('복구용 임시 스냅샷은 자동 업로드하지 않았습니다.');
          } else {
            await pushCloud(false);
            toast('이 기기의 업무를 클라우드에 올렸습니다.');
          }
        } else {
          setBadge('☁ 클라우드 연결됨');
          toast('클라우드 연결 완료');
        }
        window.clearInterval(pullTimer);
        pullTimer = window.setInterval(()=>pullCloud(true), 30000);
        window.addEventListener('focus',()=>pullCloud(true),{passive:true});
      }catch(e){
        console.error(e);
        setBadge('☁ 동기화 오류','error');
        toast('클라우드 연결 중 오류가 발생했습니다.');
      }
    }

    const {data:{user:verifiedUser},error:verifyError} = await sb.auth.getUser();
    if (verifyError || !verifiedUser || verifiedUser.id !== window.__workhubAuthorizedUserId) {
      showAuth();
      return;
    }
    const {data:{session:existing}} = await sb.auth.getSession();
    ensureAccountNav();
    if (existing) await afterAuth(existing);
    else showAuth();

    const {data:{subscription}} = sb.auth.onAuthStateChange((event,s)=>{
      if(event==='SIGNED_OUT'){session=null;window.clearInterval(pullTimer);document.getElementById('accountManager')?.remove();showAuth();}
      if(event==='SIGNED_IN' && s && session?.user?.id!==s.user.id) window.setTimeout(()=>afterAuth(s),0);
    });
    window.addEventListener('pagehide',()=>{
      subscription.unsubscribe();
      window.clearTimeout(saveTimer);
      window.clearInterval(pullTimer);
    },{once:true});
  };
  boot();
})();