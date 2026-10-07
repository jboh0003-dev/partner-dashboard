(() => {
  'use strict';

  const boot = async () => {
    if (!window.__workhubConnectClient || typeof S === 'undefined' || typeof render !== 'function' || typeof save !== 'function') {
      window.setTimeout(boot, 120);
      return;
    }
    if (window.__workhubCloudLoaded) return;
    window.__workhubCloudLoaded = true;

    const sb = window.__workhubConnectClient;
    window.__workhubSupabase = sb;

    let session = null;
    let profile = null;
    let saveTimer = null;
    let saving = false;
    let lastRemoteAt = '';
    let pullTimer = null;
    let socialCache = null;

    const safe = (value) => typeof esc === 'function'
      ? esc(String(value ?? ''))
      : String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

    const style = document.createElement('style');
    style.id = 'workhub-cloud-style';
    style.textContent = `
      .cloud-pill{border:1px solid #bad8cc;background:#edf9f4;color:#146b4e;border-radius:999px;padding:9px 12px;font-size:12px;font-weight:900;cursor:pointer;white-space:nowrap}
      .cloud-pill.saving{background:#fff8e8;border-color:#ead49c;color:#8c650d}.cloud-pill.error{background:#fff0f0;border-color:#e8b0b0;color:#a33c43}
      .dark .cloud-pill{background:#123126;border-color:#2c644f;color:#9be0c3}
      .cloud-auth{position:fixed;inset:0;background:rgba(3,8,16,.72);backdrop-filter:blur(8px);display:grid;place-items:center;padding:20px;z-index:10000;overflow:auto}
      .account-nav{position:absolute;left:14px;right:14px;bottom:20px;display:grid;gap:7px}
      .account-nav button{width:100%;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.04);color:#c6d1df;border-radius:12px;padding:12px;font-size:12px;font-weight:900;cursor:pointer;text-align:left}
      .account-nav button:hover{background:#192a43;border-color:#2a405f;color:#fff}
      .account-modal,.friends-modal,.friend-home{width:min(820px,100%);max-height:calc(100vh - 40px);overflow:auto;background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:22px;padding:22px;box-shadow:0 28px 70px rgba(0,0,0,.28)}
      .account-head,.friends-head,.friend-home-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;margin-bottom:16px}
      .account-head h2,.friends-head h2,.friend-home-head h2{margin:0;font-size:26px;letter-spacing:-.6px}.account-head p,.friends-head p,.friend-home-head p{margin:5px 0 0;font-size:12px;color:var(--muted);line-height:1.55}
      .account-close{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:9px;width:36px;height:36px;font-size:18px;cursor:pointer;flex:0 0 auto}
      .account-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.account-box{border:1px solid var(--line);border-radius:14px;padding:14px;background:color-mix(in srgb,var(--card) 94%,#eef3f8)}
      .account-box span{display:block;font-size:10px;color:var(--muted);font-weight:800}.account-box strong{display:block;font-size:15px;margin-top:5px;word-break:break-word}
      .account-section{margin-top:16px;padding-top:16px;border-top:1px solid var(--line)}.account-section h3{margin:0 0 9px;font-size:15px}.account-section p{font-size:11px;color:var(--muted);line-height:1.5;margin:0 0 10px}
      .profile-edit-grid{display:grid;grid-template-columns:90px 1fr;gap:8px}.profile-edit-grid input{width:100%;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:10px;padding:10px;font-size:13px}
      .profile-edit-grid .status-field{grid-column:1/-1}.account-actions{display:flex;gap:8px;flex-wrap:wrap}.account-actions .btn{margin:0}
      .friend-code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:1.5px;color:#725700}
      .friends-self{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;padding:14px;border:1px solid #e5d899;background:#fffdf0;border-radius:15px}.dark .friends-self{background:#342f19;border-color:#675a26}
      .friends-avatar{width:50px;height:50px;border-radius:16px;background:#fee500;display:grid;place-items:center;font-size:25px;border:1px solid #ead000}.friends-self b{display:block;font-size:14px}.friends-self small{display:block;margin-top:4px;color:var(--muted);font-size:10px}
      .friend-search{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:14px}.friend-search input{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:11px;padding:11px 12px;font-size:13px;text-transform:uppercase}.friend-search button{border:0;border-radius:11px;background:#191919;color:#fff;font-weight:900;padding:0 16px;cursor:pointer}
      .friend-section{margin-top:18px}.friend-section-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}.friend-section-title b{font-size:13px}.friend-section-title span{font-size:9px;color:var(--muted)}
      .friend-list{display:grid;gap:8px}.friend-card{border:1px solid var(--line);border-radius:15px;padding:12px;background:color-mix(in srgb,var(--card) 97%,#f5f1dd)}
      .friend-card-main{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center}.friend-card .friends-avatar{width:42px;height:42px;border-radius:13px;font-size:21px}.friend-card b{font-size:12px}.friend-card small{display:block;margin-top:3px;color:var(--muted);font-size:9px}
      .friend-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.friend-actions button{border:1px solid var(--line);border-radius:9px;padding:7px 9px;background:var(--card);color:var(--ink);font-size:9px;font-weight:900;cursor:pointer}.friend-actions .primary{background:#fee500;color:#191919;border-color:#e5cd00}
      .share-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px;padding-top:9px;border-top:1px dashed var(--line)}.share-row>span{font-size:9px;color:var(--muted);font-weight:850}.share-toggle{display:inline-flex;align-items:center;gap:4px;font-size:9px;font-weight:850}.share-toggle input{accent-color:#191919}
      .permission-chips{display:flex;gap:5px;flex-wrap:wrap}.permission-chip{border-radius:999px;padding:4px 7px;background:#edf6f1;color:#2a7259;font-size:8px;font-weight:900}.permission-chip.off{background:#f0f0f0;color:#999}
      .request-card{display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid var(--line);border-radius:13px;padding:10px 12px}.request-card b{font-size:11px}.request-card small{display:block;color:var(--muted);font-size:9px;margin-top:3px}
      .friends-empty{padding:18px;border:1px dashed var(--line);border-radius:13px;color:var(--muted);font-size:10px;text-align:center}
      .friend-home{width:min(940px,100%);padding:0;overflow:hidden}.friend-home-cover{padding:22px 24px;background:linear-gradient(120deg,#fff7b0,#fee500 58%,#f4c92d);color:#191919;border-bottom:1px solid #dfc700}
      .friend-home-head{margin:0}.friend-home-head p{color:#665d00}.friend-home-profile{display:flex;align-items:center;gap:13px;margin-top:15px}.friend-home-profile .friends-avatar{width:64px;height:64px;font-size:32px;background:#fff8cf}.friend-home-profile b{display:block;font-size:20px}.friend-home-profile span{display:block;margin-top:4px;font-size:11px;color:#625a00}
      .friend-home-nav{display:flex;gap:4px;padding:9px 12px;border-bottom:1px solid var(--line);background:var(--card);overflow:auto}.friend-home-nav button{border:0;background:transparent;color:var(--muted);padding:9px 12px;border-radius:10px;font-size:10px;font-weight:900;cursor:pointer;white-space:nowrap}.friend-home-nav button.active{background:#191919;color:#fff}
      .friend-home-body{padding:18px;background:color-mix(in srgb,var(--card) 97%,#f6f4e8)}.friend-home-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.friend-stat{padding:13px;border:1px solid var(--line);border-radius:14px;background:var(--card)}.friend-stat span{display:block;color:var(--muted);font-size:9px}.friend-stat strong{display:block;margin-top:4px;font-size:20px}
      .friend-panel{margin-top:12px;border:1px solid var(--line);border-radius:15px;background:var(--card);overflow:hidden}.friend-panel h3{margin:0;padding:12px 14px;border-bottom:1px solid var(--line);font-size:12px}.friend-items{padding:7px 11px 12px}.friend-item{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:8px;align-items:start;padding:9px 3px;border-bottom:1px solid color-mix(in srgb,var(--line) 70%,transparent)}.friend-item:last-child{border-bottom:0}.friend-item em{font-style:normal;font-size:9px;border-radius:999px;padding:4px 6px;background:#f0f0f0;color:#777}.friend-item b{font-size:10px;line-height:1.45}.friend-item small{display:block;color:var(--muted);font-size:8px;margin-top:3px}.friend-item>span{font-size:9px;color:var(--muted);white-space:nowrap}
      .friend-lock{padding:28px;text-align:center;border:1px dashed var(--line);border-radius:14px;color:var(--muted);background:var(--card)}.friend-lock b{display:block;font-size:14px;color:var(--ink);margin-bottom:5px}
      .game-sections{display:grid;grid-template-columns:1fr 1fr;gap:10px}.game-card{border:1px solid var(--line);border-radius:15px;padding:14px;background:var(--card)}.game-card h3{margin:0 0 10px;font-size:13px}.game-metrics{display:grid;grid-template-columns:1fr 1fr;gap:6px}.game-metric{padding:9px;border-radius:10px;background:#f7f7f7}.dark .game-metric{background:#232323}.game-metric span{display:block;font-size:8px;color:var(--muted)}.game-metric strong{display:block;margin-top:3px;font-size:14px}
      .friends-self-side{display:grid;gap:6px;justify-items:end}.friends-self-side button{border:1px solid #ddc600;border-radius:9px;padding:7px 9px;background:#fee500;color:#191919;font-size:9px;font-weight:900;cursor:pointer}
      .guestbook-compose{display:grid;grid-template-columns:1fr auto;gap:8px;margin-bottom:12px}.guestbook-compose textarea{min-height:78px;resize:vertical;border:1px solid var(--line);border-radius:12px;padding:11px 12px;background:var(--card);color:var(--ink);font:inherit;font-size:11px;line-height:1.55}.guestbook-compose button{align-self:stretch;border:0;border-radius:12px;background:#191919;color:#fff;font-weight:900;padding:0 15px;cursor:pointer}
      .guestbook-list{display:grid;gap:8px}.guestbook-entry{border:1px solid var(--line);border-radius:14px;padding:11px 12px;background:var(--card)}.guestbook-entry-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:7px}.guestbook-entry-who{display:flex;align-items:center;gap:7px}.guestbook-entry-who .mini-avatar{width:28px;height:28px;border-radius:9px;background:#fff4a6;display:grid;place-items:center;font-size:15px;border:1px solid #ead66b}.guestbook-entry-who b{font-size:10px}.guestbook-entry-head span{font-size:8px;color:var(--muted)}.guestbook-entry-body{white-space:pre-wrap;word-break:break-word;font-size:11px;line-height:1.55}.guestbook-entry-actions{margin-top:8px;display:flex;justify-content:flex-end}.guestbook-entry-actions button{border:1px solid var(--line);background:transparent;color:var(--muted);border-radius:8px;padding:5px 7px;font-size:8px;font-weight:850;cursor:pointer}
      .guestbook-modal{width:min(760px,100%);max-height:calc(100vh - 40px);overflow:auto;background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:22px;padding:22px;box-shadow:0 28px 70px rgba(0,0,0,.28)}
      .friend-home-grid{grid-template-columns:repeat(4,minmax(0,1fr))}
      .friend-home.theme-blue .friend-home-cover{background:linear-gradient(120deg,#dbeafe,#60a5fa 58%,#2563eb);border-color:#3b82f6}.friend-home.theme-blue .friend-home-head p,.friend-home.theme-blue .friend-home-profile span{color:#163d73}
      .friend-home.theme-mint .friend-home-cover{background:linear-gradient(120deg,#d8fff1,#66e0bb 58%,#22a879);border-color:#39bd91}.friend-home.theme-mint .friend-home-head p,.friend-home.theme-mint .friend-home-profile span{color:#155c49}
      .friend-home.theme-pink .friend-home-cover{background:linear-gradient(120deg,#ffe5ef,#ff9fc0 58%,#f05f94);border-color:#ef83aa}.friend-home.theme-pink .friend-home-head p,.friend-home.theme-pink .friend-home-profile span{color:#7a2748}
      .friend-home.theme-night .friend-home-cover{background:radial-gradient(circle at 82% 18%,#f9e879 0 3%,transparent 4%),radial-gradient(circle at 72% 35%,#fff 0 1%,transparent 2%),linear-gradient(120deg,#18213c,#303d72 58%,#141a31);border-color:#303d72;color:#fff}.friend-home.theme-night .friend-home-head p,.friend-home.theme-night .friend-home-profile span{color:#d8def8}.friend-home.theme-night .friends-avatar{background:#e8e8ff;border-color:#b9b9de}
      .friend-home.theme-violet .friend-home-cover{background:linear-gradient(120deg,#eee3ff,#b28cff 58%,#714ad7);border-color:#9c79e7}.friend-home.theme-violet .friend-home-head p,.friend-home.theme-violet .friend-home-profile span{color:#43277a}
      .mini-home-tools{display:flex;gap:6px;flex-wrap:wrap;margin-left:auto}.mini-home-tools button{border:1px solid rgba(25,25,25,.16);background:rgba(255,255,255,.64);color:#191919;border-radius:9px;padding:7px 9px;font-size:9px;font-weight:900;cursor:pointer}
      .home-now{margin-top:12px;border:1px solid var(--line);border-radius:15px;background:var(--card);overflow:hidden}.home-now h3{margin:0;padding:12px 14px;border-bottom:1px solid var(--line);font-size:12px}.home-now-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:10px}.home-now-item{border:1px solid var(--line);border-radius:11px;padding:10px;background:color-mix(in srgb,var(--card) 95%,#f5f1dd)}.home-now-item em{font-style:normal;font-size:8px;font-weight:900}.home-now-item b{display:block;margin-top:5px;font-size:10px;line-height:1.4}.home-now-item small{display:block;margin-top:4px;color:var(--muted);font-size:8px}
      .post-compose{border:1px solid var(--line);border-radius:15px;background:var(--card);padding:12px;margin-bottom:10px}.post-compose-head{display:flex;gap:7px;align-items:center;margin-bottom:8px}.post-compose select,.post-compose textarea,.comment-form input{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:10px;font:inherit}.post-compose select{padding:8px}.post-compose textarea{width:100%;min-height:92px;resize:vertical;padding:10px 11px;font-size:11px;line-height:1.55}.post-compose-actions{display:flex;justify-content:flex-end;margin-top:7px}.post-compose-actions button,.comment-form button,.post-action{border:0;border-radius:9px;background:#191919;color:#fff;padding:7px 10px;font-size:9px;font-weight:900;cursor:pointer}
      .post-list{display:grid;gap:10px}.post-card{border:1px solid var(--line);border-radius:15px;background:var(--card);padding:13px}.post-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.post-author{display:flex;gap:8px;align-items:center}.post-author .mini-avatar{width:34px;height:34px;border-radius:11px;background:#fff2a0;border:1px solid #e3cf5c;display:grid;place-items:center;font-size:18px}.post-author b{font-size:10px}.post-author small{display:block;margin-top:2px;color:var(--muted);font-size:8px}.post-mood{font-size:18px}.post-body{margin-top:11px;white-space:pre-wrap;word-break:break-word;font-size:11px;line-height:1.65}.post-actions{display:flex;gap:6px;align-items:center;margin-top:11px;padding-top:9px;border-top:1px solid var(--line)}.post-action{background:#f4f4f4;color:#555;border:1px solid var(--line)}.post-action.active{background:#fff2f5;color:#c13e61;border-color:#f1b4c5}.post-action.danger{margin-left:auto;color:#a14343;background:transparent}
      .comments{display:grid;gap:6px;margin-top:9px}.comment{display:grid;grid-template-columns:auto 1fr auto;gap:7px;align-items:start;padding:8px;border-radius:10px;background:color-mix(in srgb,var(--card) 92%,#f2f2f2)}.comment .mini-avatar{width:24px;height:24px;border-radius:8px;background:#eee;display:grid;place-items:center;font-size:13px}.comment b{font-size:8px}.comment p{margin:2px 0 0;font-size:9px;line-height:1.45;word-break:break-word}.comment button{border:0;background:transparent;color:var(--muted);font-size:8px;cursor:pointer}.comment-form{display:grid;grid-template-columns:1fr auto;gap:6px;margin-top:8px}.comment-form input{padding:8px 9px;font-size:9px}
      .customizer-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.customizer-box{border:1px solid var(--line);border-radius:14px;padding:13px}.customizer-box h3{margin:0 0 9px;font-size:12px}.avatar-preset,.theme-preset{display:flex;gap:6px;flex-wrap:wrap}.avatar-preset button{width:39px;height:39px;border:1px solid var(--line);border-radius:11px;background:var(--card);font-size:20px;cursor:pointer}.avatar-preset button.active{outline:2px solid #191919}.theme-preset button{border:1px solid var(--line);border-radius:999px;padding:7px 10px;background:var(--card);color:var(--ink);font-size:9px;font-weight:900;cursor:pointer}.theme-preset button.active{background:#191919;color:#fff}.customizer-box input{width:100%;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--ink);padding:10px;font:inherit;font-size:11px}
      @media(max-width:800px){.account-nav{left:8px;right:8px;bottom:12px}.account-grid,.friend-home-grid,.game-sections,.customizer-grid,.home-now-grid{grid-template-columns:1fr}.friend-card-main{grid-template-columns:auto 1fr}.friend-actions{grid-column:1/-1;justify-content:flex-start}.profile-edit-grid{grid-template-columns:1fr}.profile-edit-grid .status-field{grid-column:auto}.friends-self{grid-template-columns:auto 1fr}.friends-self-side{grid-column:1/-1;justify-items:start}.friends-self .friend-code{grid-column:auto}.friend-search{grid-template-columns:1fr}.friend-search button{min-height:42px}}
    `;
    document.head.appendChild(style);

    function stateScore(st){
      const w = st?.work || st || {};
      const ledger = w.settings?.workLedgerV1 || {};
      const br = w.settings?.bokRunV1 || {};
      const kart = w.settings?.kartCrossing || {};
      return (w.workItems?.length||0)*100000
        + (ledger.monthlyPlans?.length||0)*1000
        + (w.history?.length||0)*100
        + (w.settings?.workNotes?.length||0)*30
        + (Number(br.unlockedRound)||0)*20
        + (Object.keys(br.ownedCharacters||{}).length||0)
        + (Object.keys(br.ownedRelics||{}).length||0)
        + (Number(kart.bestDistance)||0)/1000
        + (w.legacyArchive?.length||0);
    }

    function pack(){
      return {
        version: 2,
        work: S,
        partner: (typeof partner !== 'undefined' ? partner : {}),
        savedAt: new Date().toISOString()
      };
    }

    function sharedWork(){
      return {
        schemaVersion: S?.schemaVersion || 4,
        workItems: Array.isArray(S?.workItems) ? S.workItems : [],
        history: Array.isArray(S?.history) ? S.history : [],
        legacyArchive: Array.isArray(S?.legacyArchive) ? S.legacyArchive : [],
        plans: Array.isArray(S?.plans) ? S.plans : []
      };
    }

    function sharedNotes(){
      return Array.isArray(S?.settings?.workNotes) ? S.settings.workNotes : [];
    }

    function sharedGame(){
      return {
        bokRunV1: S?.settings?.bokRunV1 || {},
        kartCrossing: S?.settings?.kartCrossing || {}
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
      if(!side) return;
      let wrap=document.getElementById('accountNav');
      if(!wrap){
        wrap=document.createElement('div');
        wrap.id='accountNav';
        wrap.className='account-nav';
        side.appendChild(wrap);
      }
      wrap.innerHTML='<button type="button" id="myMiniHomeBtn">🏡 내 미니홈</button><button type="button" id="friendsManageBtn">🏠 친구꺼 보기</button><button type="button" id="miniHomeCustomizeBtn">🎨 미니홈 꾸미기</button><button type="button" id="accountManageBtn">⚙ 계정관리</button>';
      document.getElementById('myMiniHomeBtn').onclick=openMyMiniHome;
      document.getElementById('friendsManageBtn').onclick=openFriends;
      document.getElementById('miniHomeCustomizeBtn').onclick=openHomeCustomizer;
      document.getElementById('accountManageBtn').onclick=openAccountManager;
    }

    function formatSyncTime(){
      if(!lastRemoteAt) return '동기화 기록 없음';
      try{return new Date(lastRemoteAt).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});}
      catch{return '동기화됨';}
    }

    async function ensureProfile(){
      if(!session?.user?.id) return null;
      const {data,error}=await sb.from('workhub_profiles').select('*').eq('user_id',session.user.id).maybeSingle();
      if(error) throw error;
      if(data){profile=data;return data;}
      const preferred=String(session.user.user_metadata?.workhub_display_name||'').trim();
      const fallback=String(session.user.email||'친구').split('@')[0].slice(0,30)||'친구';
      const {data:created,error:createError}=await sb.from('workhub_profiles').insert({
        user_id:session.user.id,
        display_name:(preferred||fallback).slice(0,30),
        avatar_emoji:'🙂',
        status_message:'BokDesk'
      }).select('*').single();
      if(createError) throw createError;
      profile=created;
      return created;
    }

    async function saveProfile(values){
      if(!session?.user?.id) return;
      const allowedThemes=['yellow','blue','mint','pink','night','violet'];
      const requestedTheme=String(values.home_theme??profile?.home_theme??'yellow');
      const next={
        display_name:String(values.display_name??profile?.display_name??'친구').trim().slice(0,30)||'친구',
        avatar_emoji:String(values.avatar_emoji??profile?.avatar_emoji??'🙂').trim().slice(0,16)||'🙂',
        status_message:String(values.status_message??profile?.status_message??'').trim().slice(0,120),
        home_title:String(values.home_title??profile?.home_title??'BokDesk 미니홈').trim().slice(0,40)||'BokDesk 미니홈',
        home_theme:allowedThemes.includes(requestedTheme)?requestedTheme:'yellow',
        updated_at:new Date().toISOString()
      };
      const {data,error}=await sb.from('workhub_profiles').update(next).eq('user_id',session.user.id).select('*').single();
      if(error) throw error;
      profile=data;
      socialCache=null;
      return data;
    }

    async function readRemote(){
      if (!session?.user?.id) return null;
      const {data,error} = await sb.from('workhub_state').select('state,updated_at').eq('user_id',session.user.id).maybeSingle();
      if (error) throw error;
      return data;
    }

    async function upsertOrThrow(table,row){
      const {error}=await sb.from(table).upsert(row,{onConflict:'user_id'});
      if(error) throw error;
    }

    async function pushCloud(manual=false){
      if (!session?.user?.id || saving) return;
      saving = true;
      setBadge('☁ 저장 중…','saving');
      try {
        const updatedAt = new Date().toISOString();
        const uid=session.user.id;
        const ops=[
          sb.from('workhub_state').upsert({user_id:uid,state:pack(),updated_at:updatedAt},{onConflict:'user_id'}),
          sb.from('workhub_shared_work').upsert({user_id:uid,payload:sharedWork(),updated_at:updatedAt},{onConflict:'user_id'}),
          sb.from('workhub_shared_notes').upsert({user_id:uid,payload:sharedNotes(),updated_at:updatedAt},{onConflict:'user_id'}),
          sb.from('workhub_shared_game').upsert({user_id:uid,payload:sharedGame(),updated_at:updatedAt},{onConflict:'user_id'})
        ];
        const results=await Promise.all(ops);
        const failed=results.find(x=>x.error);
        if(failed?.error) throw failed.error;
        lastRemoteAt = updatedAt;
        localStorage.setItem('workhub_last_remote_at_'+uid,updatedAt);
        localStorage.removeItem('workhub_migrated_from_legacy_'+uid);
        setBadge('☁ 저장됨');
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
      saveTimer = window.setTimeout(()=>{ saveTimer=null; pushCloud(false); }, 500);
    }

    async function pullCloud(silent=true){
      if (!session?.user?.id || saving || saveTimer) return;
      try{
        const remote = await readRemote();
        if (!remote?.state) return;
        const localRemoteAt=localStorage.getItem('workhub_last_remote_at_'+session.user.id)||'';
        if (!localRemoteAt || remote.updated_at > localRemoteAt) {
          applyRemote(remote.state);
          lastRemoteAt = remote.updated_at || '';
          localStorage.setItem('workhub_last_remote_at_'+session.user.id,lastRemoteAt);
          setBadge('☁ 동기화됨');
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

    function closeOverlay(id){document.getElementById(id)?.remove();}

    function themeLabel(theme){return ({yellow:'옐로',blue:'블루',mint:'민트',pink:'핑크',night:'밤하늘',violet:'바이올렛'})[theme]||'옐로';}
    async function openHomeCustomizer(){
      if(!session?.user)return;
      closeOverlay('accountManager');closeOverlay('friendsManager');closeOverlay('friendHome');closeOverlay('homeCustomizer');
      try{await ensureProfile();}catch(e){console.error(e);}
      let pickedEmoji=profile?.avatar_emoji||'🙂';
      let pickedTheme=profile?.home_theme||'yellow';
      const root=document.createElement('div');
      root.id='homeCustomizer';root.className='cloud-auth';
      const emojis=['🧑‍💼','😎','🤖','🐯','🐰','🐻','🐶','🐱','🦊','🐸','👾','🧙','🕶️','🔥','⭐','🍪'];
      const themes=['yellow','blue','mint','pink','night','violet'];
      root.innerHTML='<div class="account-modal"><div class="account-head"><div><h2>🎨 미니홈 꾸미기</h2><p>프로필 아이콘, 홈 제목, 상태메시지와 커버 테마를 바꿀 수 있습니다.</p></div><button type="button" class="account-close" data-close>×</button></div>'
        +'<div class="customizer-grid"><section class="customizer-box"><h3>프로필 아이콘</h3><div class="avatar-preset">'+emojis.map(e=>'<button type="button" data-emoji="'+safe(e)+'" class="'+(e===pickedEmoji?'active':'')+'">'+safe(e)+'</button>').join('')+'</div></section>'
        +'<section class="customizer-box"><h3>커버 테마</h3><div class="theme-preset">'+themes.map(t=>'<button type="button" data-theme="'+t+'" class="'+(t===pickedTheme?'active':'')+'">'+themeLabel(t)+'</button>').join('')+'</div></section>'
        +'<section class="customizer-box"><h3>미니홈 제목</h3><input id="customHomeTitle" maxlength="40" value="'+safe(profile?.home_title||'BokDesk 미니홈')+'"></section>'
        +'<section class="customizer-box"><h3>상태메시지</h3><input id="customStatus" maxlength="120" value="'+safe(profile?.status_message||'')+'"></section></div>'
        +'<div class="account-actions" style="margin-top:14px"><button type="button" class="btn primary" id="customSave">꾸미기 저장</button><button type="button" class="btn" id="customPreview">내 미니홈 보기</button></div></div>';
      document.body.appendChild(root);
      const close=()=>root.remove();root.querySelector('[data-close]').onclick=close;root.onclick=e=>{if(e.target===root)close();};
      root.querySelectorAll('[data-emoji]').forEach(btn=>btn.onclick=()=>{pickedEmoji=btn.dataset.emoji;root.querySelectorAll('[data-emoji]').forEach(x=>x.classList.toggle('active',x===btn));});
      root.querySelectorAll('[data-theme]').forEach(btn=>btn.onclick=()=>{pickedTheme=btn.dataset.theme;root.querySelectorAll('[data-theme]').forEach(x=>x.classList.toggle('active',x===btn));});
      document.getElementById('customSave').onclick=async()=>{
        const btn=document.getElementById('customSave');btn.disabled=true;
        try{
          await saveProfile({avatar_emoji:pickedEmoji,home_theme:pickedTheme,home_title:document.getElementById('customHomeTitle').value,status_message:document.getElementById('customStatus').value});
          toast('미니홈 꾸미기를 저장했습니다.');
        }catch(e){console.error(e);toast('꾸미기 저장에 실패했습니다.');}
        finally{btn.disabled=false;}
      };
      document.getElementById('customPreview').onclick=async()=>{close();await openMyMiniHome();};
    }

    async function openMyMiniHome(){
      if(!session?.user)return;
      try{await ensureProfile();await pushCloud(false);}catch(e){console.error(e);}
      openFriendHome(session.user.id,profile,{can_view_work:true,can_view_notes:true,can_view_game:true},true);
    }

    async function openAccountManager(){
      if(!session?.user) return;
      closeOverlay('cloudUserMenu');
      try{await ensureProfile();}catch(e){console.error(e);}
      const root=document.createElement('div');
      root.id='accountManager';
      root.className='cloud-auth';
      root.innerHTML=`
        <div class="account-modal">
          <div class="account-head">
            <div><h2>계정관리</h2><p>내 데이터는 내 계정에 따로 저장되고, 친구에게는 허용한 항목만 읽기 전용으로 공개됩니다.</p></div>
            <button type="button" class="account-close" data-close>×</button>
          </div>
          <div class="account-grid">
            <div class="account-box"><span>로그인</span><strong>${safe(session.user.email||'-')}</strong></div>
            <div class="account-box"><span>친구 코드</span><strong class="friend-code">${safe(profile?.friend_code||'-')}</strong></div>
            <div class="account-box"><span>클라우드</span><strong>${saving?'저장 중':'연결됨'}</strong></div>
            <div class="account-box"><span>최근 동기화</span><strong>${safe(formatSyncTime())}</strong></div>
          </div>
          <div class="account-section">
            <h3>내 미니프로필</h3>
            <div class="profile-edit-grid">
              <input id="profileEmoji" maxlength="16" value="${safe(profile?.avatar_emoji||'🙂')}" aria-label="프로필 이모지">
              <input id="profileName" maxlength="30" value="${safe(profile?.display_name||'친구')}" placeholder="표시 이름" aria-label="표시 이름">
              <input class="status-field" id="profileStatus" maxlength="120" value="${safe(profile?.status_message||'')}" placeholder="상태메시지" aria-label="상태메시지">
            </div>
            <div class="account-actions" style="margin-top:9px"><button type="button" class="btn primary" id="profileSave">프로필 저장</button></div>
          </div>
          <div class="account-section">
            <h3>데이터</h3><p>현재 일계표·메모·게임 진행도를 지금 즉시 저장합니다.</p>
            <div class="account-actions"><button type="button" class="btn primary" id="accountSyncNow">지금 동기화</button><button type="button" class="btn" id="accountFriends">친구 공간 열기</button></div>
          </div>
          <div class="account-section">
            <h3>로그아웃</h3><p>다른 계정으로 들어가도 현재 계정의 업무·메모·게임은 섞이지 않습니다.</p>
            <div class="account-actions"><button type="button" class="btn" id="accountLogout">로그아웃</button></div>
          </div>
        </div>`;
      document.body.appendChild(root);
      const close=()=>root.remove();
      root.querySelector('[data-close]').onclick=close;
      root.onclick=e=>{if(e.target===root)close();};
      document.getElementById('profileSave').onclick=async()=>{
        const btn=document.getElementById('profileSave');btn.disabled=true;
        try{
          await saveProfile({
            avatar_emoji:document.getElementById('profileEmoji').value,
            display_name:document.getElementById('profileName').value,
            status_message:document.getElementById('profileStatus').value
          });
          toast('프로필을 저장했습니다.');
        }catch(e){console.error(e);toast('프로필 저장에 실패했습니다.');}
        finally{btn.disabled=false;}
      };
      document.getElementById('accountSyncNow').onclick=()=>pushCloud(true);
      document.getElementById('accountFriends').onclick=()=>{close();openFriends();};
      document.getElementById('accountLogout').onclick=async()=>{close();await sb.auth.signOut({scope:'local'});};
    }

    function toggleUserMenu(){
      const old=document.getElementById('cloudUserMenu');
      if(old){old.remove();return;}
      if(!session?.user)return;
      const menu=document.createElement('div');
      menu.id='cloudUserMenu';
      menu.style='position:fixed;right:18px;top:92px;background:var(--card);border:1px solid var(--line);border-radius:13px;padding:10px;z-index:500;box-shadow:0 18px 40px rgba(0,0,0,.14);min-width:210px';
      menu.innerHTML='<b style="display:block;font-size:11px;margin-bottom:8px">'+safe(profile?.display_name||session.user.email||'BokDesk')+'</b><button class="btn" id="cloudFriends" style="width:100%">친구꺼 보기</button><button class="btn" id="cloudAccount" style="width:100%;margin-top:6px">계정관리</button><button class="btn" id="cloudSyncNow" style="width:100%;margin-top:6px">지금 동기화</button>';
      document.body.appendChild(menu);
      document.getElementById('cloudFriends').onclick=()=>{menu.remove();openFriends();};
      document.getElementById('cloudAccount').onclick=()=>{menu.remove();openAccountManager();};
      document.getElementById('cloudSyncNow').onclick=async()=>{await pushCloud(true);menu.remove();};
    }

    async function loadSocial(force=false){
      if(socialCache&&!force)return socialCache;
      const uid=session.user.id;
      const {data:friendships,error:fError}=await sb.from('workhub_friendships').select('*').or('requester_id.eq.'+uid+',addressee_id.eq.'+uid).order('created_at',{ascending:false});
      if(fError)throw fError;
      const others=[...new Set((friendships||[]).map(f=>f.requester_id===uid?f.addressee_id:f.requester_id))];
      let profiles=[];
      if(others.length){
        const {data,error}=await sb.from('workhub_profiles').select('*').in('user_id',others);
        if(error)throw error;profiles=data||[];
      }
      const {data:shares,error:sError}=await sb.from('workhub_shares').select('*').or('owner_id.eq.'+uid+',viewer_id.eq.'+uid);
      if(sError)throw sError;
      socialCache={friendships:friendships||[],profiles,shares:shares||[]};
      return socialCache;
    }

    function profileById(data,id){return data.profiles.find(p=>p.user_id===id)||{user_id:id,display_name:'친구',avatar_emoji:'🙂',status_message:''};}
    function otherId(f){return f.requester_id===session.user.id?f.addressee_id:f.requester_id;}
    function ownShare(data,id){return data.shares.find(s=>s.owner_id===session.user.id&&s.viewer_id===id);}
    function theirShare(data,id){return data.shares.find(s=>s.owner_id===id&&s.viewer_id===session.user.id);}

    async function ensureOwnShare(viewerId){
      if(!session?.user?.id||!viewerId)return;
      const {error}=await sb.from('workhub_shares').upsert({
        owner_id:session.user.id,viewer_id:viewerId,
        can_view_work:true,can_view_notes:true,can_view_game:true,updated_at:new Date().toISOString()
      },{onConflict:'owner_id,viewer_id'});
      if(error)throw error;
      socialCache=null;
    }

    function permissionChips(share){
      const items=[['일',share?.can_view_work],['메모',share?.can_view_notes],['게임',share?.can_view_game]];
      return '<div class="permission-chips">'+items.map(([label,on])=>'<span class="permission-chip '+(on?'':'off')+'">'+safe(label)+(on?' ✓':' 잠김')+'</span>').join('')+'</div>';
    }

    async function openFriends(){
      if(!session?.user)return;
      closeOverlay('accountManager');closeOverlay('friendHome');
      try{await ensureProfile();}catch(e){console.error(e);}
      const root=document.createElement('div');root.id='friendsManager';root.className='cloud-auth';
      root.innerHTML='<div class="friends-modal"><div class="friends-head"><div><h2>친구 공간</h2><p>미니홈피처럼 친구의 공간에 들어가서, 친구가 허용한 일·메모·게임만 읽기 전용으로 볼 수 있습니다.</p></div><button type="button" class="account-close" data-close>×</button></div><div id="friendsContent"><div class="friends-empty">친구 목록을 불러오는 중…</div></div></div>';
      document.body.appendChild(root);
      const close=()=>root.remove();root.querySelector('[data-close]').onclick=close;root.onclick=e=>{if(e.target===root)close();};

      const draw=async()=>{
        const box=document.getElementById('friendsContent');if(!box)return;
        try{
          const data=await loadSocial(true);
          const uid=session.user.id;
          const incoming=data.friendships.filter(f=>f.status==='pending'&&f.addressee_id===uid);
          const outgoing=data.friendships.filter(f=>f.status==='pending'&&f.requester_id===uid);
          const accepted=data.friendships.filter(f=>f.status==='accepted');

          box.innerHTML=`
            <div class="friends-self">
              <div class="friends-avatar">${safe(profile?.avatar_emoji||'🙂')}</div>
              <div><b>${safe(profile?.display_name||'친구')}</b><small>${safe(profile?.status_message||'상태메시지를 설정해보세요.')}</small></div>
              <div class="friends-self-side"><strong class="friend-code">${safe(profile?.friend_code||'-')}</strong><button type="button" id="myGuestbookBtn">📮 내 방명록</button></div>
            </div>
            <form class="friend-search" id="friendSearchForm">
              <input id="friendCodeInput" maxlength="10" placeholder="친구 코드 입력 (예: 6B290F2639)" autocomplete="off">
              <button type="submit">친구 요청</button>
            </form>
            ${incoming.length?'<section class="friend-section"><div class="friend-section-title"><b>받은 친구 요청</b><span>'+incoming.length+'건</span></div><div class="friend-list">'+incoming.map(f=>{const p=profileById(data,f.requester_id);return '<div class="request-card"><div><b>'+safe(p.avatar_emoji)+' '+safe(p.display_name)+'</b><small>'+safe(p.status_message||'친구 요청이 왔습니다.')+'</small></div><div class="friend-actions"><button class="primary" data-accept="'+f.id+'">수락</button><button data-reject="'+f.id+'">거절</button></div></div>';}).join('')+'</div></section>':''}
            ${outgoing.length?'<section class="friend-section"><div class="friend-section-title"><b>보낸 요청</b><span>수락 대기</span></div><div class="friend-list">'+outgoing.map(f=>{const p=profileById(data,f.addressee_id);return '<div class="request-card"><div><b>'+safe(p.avatar_emoji)+' '+safe(p.display_name)+'</b><small>'+safe(p.status_message||'친구 수락을 기다리는 중입니다.')+'</small></div><div class="friend-actions"><button data-cancel="'+f.id+'">요청 취소</button></div></div>';}).join('')+'</div></section>':''}
            <section class="friend-section">
              <div class="friend-section-title"><b>내 친구</b><span>${accepted.length}명</span></div>
              <div class="friend-list">
                ${accepted.length?accepted.map(f=>{const id=otherId(f),p=profileById(data,id),mine=ownShare(data,id),theirs=theirShare(data,id);return `
                  <article class="friend-card">
                    <div class="friend-card-main">
                      <div class="friends-avatar">${safe(p.avatar_emoji||'🙂')}</div>
                      <div><b>${safe(p.display_name||'친구')}</b><small>${safe(p.status_message||'')}</small><div style="margin-top:6px">${permissionChips(theirs)}</div></div>
                      <div class="friend-actions"><button class="primary" data-visit="${id}">친구꺼 보기</button><button data-remove="${f.id}" data-friend="${id}">친구 삭제</button></div>
                    </div>
                    <div class="share-row"><span>내 공간 공개:</span>
                      <label class="share-toggle"><input type="checkbox" data-share="${id}" data-field="can_view_work" ${mine?.can_view_work!==false?'checked':''}> 일</label>
                      <label class="share-toggle"><input type="checkbox" data-share="${id}" data-field="can_view_notes" ${mine?.can_view_notes!==false?'checked':''}> 메모</label>
                      <label class="share-toggle"><input type="checkbox" data-share="${id}" data-field="can_view_game" ${mine?.can_view_game!==false?'checked':''}> 게임</label>
                    </div>
                  </article>`;}).join(''):'<div class="friends-empty">아직 친구가 없습니다. 친구 코드를 받아 요청해보세요.</div>'}
              </div>
            </section>`;

          const myGuestbookBtn=document.getElementById('myGuestbookBtn');
          if(myGuestbookBtn)myGuestbookBtn.onclick=()=>{close();openMyGuestbook();};

          const form=document.getElementById('friendSearchForm');
          form.onsubmit=async(e)=>{
            e.preventDefault();
            const input=document.getElementById('friendCodeInput'),code=String(input.value||'').trim().toUpperCase();
            if(!code){toast('친구 코드를 입력해주세요.');return;}
            const {data:target,error}=await sb.from('workhub_profiles').select('*').eq('friend_code',code).maybeSingle();
            if(error){console.error(error);toast('친구 검색에 실패했습니다.');return;}
            if(!target){toast('해당 친구 코드를 찾지 못했습니다.');return;}
            if(target.user_id===uid){toast('내 코드는 친구로 추가할 수 없습니다.');return;}
            const {error:requestError}=await sb.from('workhub_friendships').insert({requester_id:uid,addressee_id:target.user_id,status:'pending'});
            if(requestError){
              if(String(requestError.code)==='23505')toast('이미 친구 요청 또는 친구 관계가 있습니다.');
              else{console.error(requestError);toast('친구 요청에 실패했습니다.');}
              return;
            }
            try{await ensureOwnShare(target.user_id);}catch(e2){console.error(e2);}
            toast(target.display_name+'님께 친구 요청을 보냈습니다.');
            socialCache=null;await draw();
          };

          root.querySelectorAll('[data-accept]').forEach(btn=>btn.onclick=async()=>{
            const id=btn.dataset.accept;
            const f=data.friendships.find(x=>x.id===id);if(!f)return;
            const {error}=await sb.from('workhub_friendships').update({status:'accepted',accepted_at:new Date().toISOString()}).eq('id',id);
            if(error){console.error(error);toast('친구 수락에 실패했습니다.');return;}
            try{await ensureOwnShare(f.requester_id);}catch(e){console.error(e);}
            socialCache=null;toast('친구가 되었습니다.');await draw();
          });

          root.querySelectorAll('[data-reject],[data-cancel]').forEach(btn=>btn.onclick=async()=>{
            const id=btn.dataset.reject||btn.dataset.cancel;
            const {error}=await sb.from('workhub_friendships').delete().eq('id',id);
            if(error){console.error(error);toast('요청 처리에 실패했습니다.');return;}
            socialCache=null;await draw();
          });

          root.querySelectorAll('[data-remove]').forEach(btn=>btn.onclick=async()=>{
            if(!confirm('친구를 삭제할까요? 서로의 공간을 더 이상 볼 수 없습니다.'))return;
            const id=btn.dataset.remove,friendId=btn.dataset.friend;
            const {error}=await sb.from('workhub_friendships').delete().eq('id',id);
            if(error){console.error(error);toast('친구 삭제에 실패했습니다.');return;}
            await sb.from('workhub_shares').delete().eq('owner_id',uid).eq('viewer_id',friendId);
            socialCache=null;await draw();
          });

          root.querySelectorAll('[data-share]').forEach(input=>input.onchange=async()=>{
            const friendId=input.dataset.share,field=input.dataset.field;
            let share=ownShare(data,friendId);
            if(!share){
              try{await ensureOwnShare(friendId);share=(await loadSocial(true)).shares.find(s=>s.owner_id===uid&&s.viewer_id===friendId);}catch(e){console.error(e);input.checked=!input.checked;return;}
            }
            const patch={updated_at:new Date().toISOString()};patch[field]=Boolean(input.checked);
            const {error}=await sb.from('workhub_shares').update(patch).eq('owner_id',uid).eq('viewer_id',friendId);
            if(error){console.error(error);input.checked=!input.checked;toast('공개 설정 변경에 실패했습니다.');return;}
            socialCache=null;toast('공개 범위를 변경했습니다.');
          });

          root.querySelectorAll('[data-visit]').forEach(btn=>btn.onclick=()=>{
            const id=btn.dataset.visit,p=profileById(data,id),share=theirShare(data,id);
            close();openFriendHome(id,p,share);
          });
        }catch(e){
          console.error(e);
          box.innerHTML='<div class="friends-empty">친구 공간을 불러오지 못했습니다.</div>';
        }
      };
      await draw();
    }

    async function loadPosts(authorId){
      const {data:posts,error}=await sb.from('workhub_posts').select('id,author_id,mood,body,created_at').eq('author_id',authorId).order('created_at',{ascending:false}).limit(30);
      if(error)throw error;
      const rows=posts||[];
      const ids=rows.map(x=>x.id);
      let comments=[],reactions=[];
      if(ids.length){
        const [cRes,rRes]=await Promise.all([
          sb.from('workhub_post_comments').select('id,post_id,author_id,body,created_at').in('post_id',ids).order('created_at',{ascending:true}),
          sb.from('workhub_post_reactions').select('post_id,user_id,emoji,created_at').in('post_id',ids)
        ]);
        if(cRes.error)throw cRes.error;if(rRes.error)throw rRes.error;
        comments=cRes.data||[];reactions=rRes.data||[];
      }
      const userIds=[...new Set([authorId,...comments.map(x=>x.author_id)])];
      let profiles=[];
      if(userIds.length){
        const pRes=await sb.from('workhub_profiles').select('user_id,display_name,avatar_emoji').in('user_id',userIds);
        if(pRes.error)throw pRes.error;profiles=pRes.data||[];
      }
      const byUser=new Map(profiles.map(p=>[p.user_id,p]));
      return rows.map(post=>({
        ...post,
        author:byUser.get(post.author_id)||{display_name:'친구',avatar_emoji:'🙂'},
        comments:comments.filter(x=>x.post_id===post.id).map(x=>({...x,author:byUser.get(x.author_id)||{display_name:'친구',avatar_emoji:'🙂'}})),
        reactions:reactions.filter(x=>x.post_id===post.id)
      }));
    }
    function postDate(value){try{return new Date(value).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});}catch{return '';}}
    function postCardHtml(post,isSelf){
      const mine=post.author_id===session?.user?.id;
      const reacted=post.reactions.some(r=>r.user_id===session?.user?.id);
      const comments=post.comments.map(cm=>{
        const canDelete=isSelf||cm.author_id===session?.user?.id;
        return '<div class="comment"><div class="mini-avatar">'+safe(cm.author?.avatar_emoji||'🙂')+'</div><div><b>'+safe(cm.author?.display_name||'친구')+'</b><p>'+safe(cm.body||'')+'</p></div>'+(canDelete?'<button type="button" data-comment-delete="'+safe(cm.id)+'">삭제</button>':'<span></span>')+'</div>';
      }).join('');
      return '<article class="post-card" data-post="'+safe(post.id)+'"><div class="post-head"><div class="post-author"><div class="mini-avatar">'+safe(post.author?.avatar_emoji||'🙂')+'</div><div><b>'+safe(post.author?.display_name||'친구')+'</b><small>'+safe(postDate(post.created_at))+'</small></div></div><span class="post-mood">'+safe(post.mood||'💬')+'</span></div><div class="post-body">'+safe(post.body||'')+'</div><div class="post-actions"><button type="button" class="post-action '+(reacted?'active':'')+'" data-react="'+safe(post.id)+'">♥ 공감 '+post.reactions.length+'</button><span style="font-size:8px;color:var(--muted)">댓글 '+post.comments.length+'</span>'+(mine?'<button type="button" class="post-action danger" data-post-delete="'+safe(post.id)+'">게시글 삭제</button>':'')+'</div><div class="comments">'+comments+'</div><form class="comment-form" data-comment-form="'+safe(post.id)+'"><input maxlength="300" placeholder="댓글 남기기"><button type="submit">댓글</button></form></article>';
    }

    function statusText(s){return s==='done'?'완료':s==='doing'?'진행':s==='blocked'?'이슈':s==='failed'?'못함':'예정';}
    function guestbookDate(value){
      try{return new Date(value).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});}
      catch{return '';}
    }

    async function loadGuestbook(ownerId){
      const {data,error}=await sb.from('workhub_guestbook')
        .select('id,owner_id,author_id,body,created_at')
        .eq('owner_id',ownerId)
        .order('created_at',{ascending:false})
        .limit(50);
      if(error)throw error;
      const rows=data||[];
      const ids=[...new Set(rows.map(x=>x.author_id).filter(Boolean))];
      let profiles=[];
      if(ids.length){
        const result=await sb.from('workhub_profiles').select('user_id,display_name,avatar_emoji').in('user_id',ids);
        if(result.error)throw result.error;
        profiles=result.data||[];
      }
      const byId=new Map(profiles.map(p=>[p.user_id,p]));
      return rows.map(row=>({...row,author:byId.get(row.author_id)||{display_name:'친구',avatar_emoji:'🙂'}}));
    }

    function guestbookEntriesHtml(entries,canDeleteAll=false){
      if(!entries.length)return '<div class="friends-empty">아직 남겨진 방명록이 없습니다.</div>';
      return '<div class="guestbook-list">'+entries.map(entry=>{
        const mine=entry.author_id===session?.user?.id;
        const canDelete=canDeleteAll||mine;
        return '<article class="guestbook-entry"><div class="guestbook-entry-head"><div class="guestbook-entry-who"><div class="mini-avatar">'+safe(entry.author?.avatar_emoji||'🙂')+'</div><div><b>'+safe(entry.author?.display_name||'친구')+'</b><span style="display:block;margin-top:2px">'+safe(guestbookDate(entry.created_at))+'</span></div></div><span>No. '+safe(String(entry.id||'').slice(0,4).toUpperCase())+'</span></div><div class="guestbook-entry-body">'+safe(entry.body||'')+'</div>'+(canDelete?'<div class="guestbook-entry-actions"><button type="button" data-guestbook-delete="'+safe(entry.id)+'">삭제</button></div>':'')+'</article>';
      }).join('')+'</div>';
    }

    async function openMyGuestbook(){
      if(!session?.user)return;
      closeOverlay('friendsManager');
      const root=document.createElement('div');
      root.id='myGuestbook';
      root.className='cloud-auth';
      root.innerHTML='<div class="guestbook-modal"><div class="friends-head"><div><h2>📮 내 방명록</h2><p>친구들이 내 미니홈에 남긴 글입니다. 글 수정은 없고, 내 방명록에서는 필요할 때 삭제만 할 수 있습니다.</p></div><button type="button" class="account-close" data-close>×</button></div><div id="myGuestbookBody"><div class="friends-empty">방명록을 불러오는 중…</div></div></div>';
      document.body.appendChild(root);
      const close=()=>root.remove();
      root.querySelector('[data-close]').onclick=close;
      root.onclick=e=>{if(e.target===root)close();};

      const draw=async()=>{
        const body=root.querySelector('#myGuestbookBody');
        try{
          const entries=await loadGuestbook(session.user.id);
          body.innerHTML=guestbookEntriesHtml(entries,true);
          body.querySelectorAll('[data-guestbook-delete]').forEach(btn=>btn.onclick=async()=>{
            if(!confirm('이 방명록 글을 삭제할까요?'))return;
            const {error}=await sb.from('workhub_guestbook').delete().eq('id',btn.dataset.guestbookDelete);
            if(error){console.error(error);toast('방명록 삭제에 실패했습니다.');return;}
            toast('방명록 글을 삭제했습니다.');
            await draw();
          });
        }catch(e){console.error(e);body.innerHTML='<div class="friends-empty">방명록을 불러오지 못했습니다.</div>';}
      };
      await draw();
    }

    async function openFriendHome(friendId,friendProfile,share,isSelf=false){
      closeOverlay('friendsManager');closeOverlay('homeCustomizer');
      const theme=['yellow','blue','mint','pink','night','violet'].includes(friendProfile?.home_theme)?friendProfile.home_theme:'yellow';
      const root=document.createElement('div');root.id='friendHome';root.className='cloud-auth';
      const backLabel=isSelf?'← 닫기':'← 친구목록';
      root.innerHTML='<div class="friend-home theme-'+theme+'"><div class="friend-home-cover"><div class="friend-home-head"><div><h2>'+safe(friendProfile?.home_title||'BokDesk 미니홈')+'</h2><p>'+(isSelf?'내 업무·메모·게임과 게시글을 한 곳에서 보는 개인 미니홈입니다.':'친구가 공개한 업무·메모·게임은 읽기 전용이며, 게시글과 방명록으로 소통할 수 있습니다.')+'</p></div><div class="mini-home-tools">'+(isSelf?'<button type="button" data-customize>🎨 꾸미기</button>':'')+'<button type="button" class="account-close" data-close>×</button></div></div><div class="friend-home-profile"><div class="friends-avatar">'+safe(friendProfile?.avatar_emoji||'🙂')+'</div><div><b>'+safe(friendProfile?.display_name||'친구')+'</b><span>'+safe(friendProfile?.status_message||'')}</span></div></div></div><nav class="friend-home-nav"><button data-tab="home" class="active">🏠 홈</button><button data-tab="posts">📌 게시글</button><button data-tab="work">📋 업무</button><button data-tab="notes">📝 메모</button><button data-tab="game">🎮 게임</button><button data-tab="guestbook">📮 방명록</button><button data-back>'+backLabel+'</button></nav><div class="friend-home-body" id="friendHomeBody"><div class="friends-empty">미니홈을 불러오는 중…</div></div></div>';
      document.body.appendChild(root);
      const close=()=>root.remove();
      root.querySelector('[data-close]').onclick=close;
      root.onclick=e=>{if(e.target===root)close();};
      root.querySelector('[data-back]').onclick=()=>{close();if(!isSelf)openFriends();};
      const customize=root.querySelector('[data-customize]');
      if(customize)customize.onclick=()=>{close();openHomeCustomizer();};

      let work=null,notes=null,game=null,guestbook=[],posts=[];
      try{
        const queries=[
          loadGuestbook(friendId).then(rows=>{guestbook=rows;}),
          loadPosts(friendId).then(rows=>{posts=rows;})
        ];
        if(share?.can_view_work)queries.push(sb.from('workhub_shared_work').select('payload,updated_at').eq('user_id',friendId).maybeSingle().then(r=>{if(r.error)throw r.error;work=r.data;}));
        if(share?.can_view_notes)queries.push(sb.from('workhub_shared_notes').select('payload,updated_at').eq('user_id',friendId).maybeSingle().then(r=>{if(r.error)throw r.error;notes=r.data;}));
        if(share?.can_view_game)queries.push(sb.from('workhub_shared_game').select('payload,updated_at').eq('user_id',friendId).maybeSingle().then(r=>{if(r.error)throw r.error;game=r.data;}));
        await Promise.all(queries);
      }catch(e){console.error(e);}

      const refreshGuestbook=async()=>{guestbook=await loadGuestbook(friendId);};
      const refreshPosts=async()=>{posts=await loadPosts(friendId);};

      const workItems=()=>Array.isArray(work?.payload?.workItems)?work.payload.workItems:[];
      const currentWork=()=>{
        const items=workItems();
        const rank={doing:0,blocked:1,todo:2,done:3,failed:4};
        return [...items]
          .filter(x=>!['done','failed'].includes(x.status))
          .sort((a,b)=>(rank[a.status]??9)-(rank[b.status]??9)||String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')))
          .slice(0,3);
      };

      const renderHome=()=>{
        const items=workItems();
        const open=items.filter(x=>!['done','failed'].includes(x.status)).length;
        const doing=items.filter(x=>x.status==='doing').length;
        const done=items.filter(x=>x.status==='done').length;
        const now=share?.can_view_work?currentWork():[];
        const recentPosts=posts.slice(0,2);
        const br=game?.payload?.bokRunV1||{},kart=game?.payload?.kartCrossing||{};
        const gameLabel=share?.can_view_game?('BokRun R'+(Number(br.unlockedRound)||1)+' · Kart '+(Number(kart.bestDistance)||0)+'m'):'비공개';

        return '<div class="friend-home-grid"><div class="friend-stat"><span>진행 중 업무</span><strong>'+(share?.can_view_work?doing:'🔒')+'</strong></div><div class="friend-stat"><span>남은 업무</span><strong>'+(share?.can_view_work?open:'🔒')+'</strong></div><div class="friend-stat"><span>게시글</span><strong>'+posts.length+'</strong></div><div class="friend-stat"><span>방명록</span><strong>'+guestbook.length+'</strong></div></div>'
          +(share?.can_view_work?'<section class="home-now"><h3>💼 지금 뭐 하는지</h3><div class="home-now-grid">'+(now.length?now.map(x=>'<div class="home-now-item"><em>'+safe(statusText(x.status))+'</em><b>'+safe(x.title||'업무')+'</b><small>'+safe(x.category||'기타')+(x.dueDate?' · '+safe(x.dueDate):'')+'</small></div>').join(''):'<div class="friends-empty" style="grid-column:1/-1">현재 진행 중인 업무가 없습니다.</div>')+'</div></section>':'<div class="friend-lock" style="margin-top:12px"><b>🔒 업무는 비공개입니다.</b>친구가 업무 공개를 켜면 현재 하는 일을 볼 수 있습니다.</div>')
          +(recentPosts.length?'<div class="friend-panel"><h3>📌 최근 게시글</h3><div class="friend-items">'+recentPosts.map(p=>'<div class="friend-item"><em>'+safe(p.mood||'💬')+'</em><div><b>'+safe(String(p.body||'').replace(/\s+/g,' ').slice(0,120))+'</b><small>공감 '+p.reactions.length+' · 댓글 '+p.comments.length+'</small></div><span>'+safe(postDate(p.created_at))+'</span></div>').join('')+'</div></div>':'')
          +'<div class="friend-panel"><h3>🎮 게임 한눈에 보기</h3><div class="friend-items"><div class="friend-item"><em>GAME</em><div><b>'+safe(gameLabel)+'</b><small>게임은 진행도와 컬렉션만 확인할 수 있고 친구가 대신 플레이하거나 강화할 수 없습니다.</small></div><span>읽기 전용</span></div></div></div>';
      };

      const renderPosts=()=>{
        const composer=isSelf?'<form class="post-compose" id="postComposeForm"><div class="post-compose-head"><select id="postMood" aria-label="게시글 기분"><option>💬</option><option>🔥</option><option>😎</option><option>😂</option><option>🥲</option><option>💼</option><option>🎮</option><option>⭐</option></select><b style="font-size:11px">내 미니홈에 게시글 쓰기</b></div><textarea id="postBody" maxlength="500" placeholder="오늘 한 일, 잡담, 게임 자랑 등 자유롭게 남겨보세요."></textarea><div class="post-compose-actions"><button type="submit">게시하기</button></div></form>':'';
        return composer+'<div class="post-list">'+(posts.length?posts.map(p=>postCardHtml(p,isSelf)).join(''):'<div class="friends-empty">아직 게시글이 없습니다.</div>')+'</div>';
      };

      const renderWork=()=>{
        if(!share?.can_view_work)return '<div class="friend-lock"><b>🔒 업무는 비공개입니다.</b>친구가 업무 공개를 켜면 여기서 볼 수 있습니다.</div>';
        const items=workItems();
        const groups=[
          ['진행 중',items.filter(x=>x.status==='doing')],
          ['이슈/대기',items.filter(x=>x.status==='blocked')],
          ['예정',items.filter(x=>x.status==='todo')],
          ['완료',items.filter(x=>x.status==='done')]
        ];
        return groups.map(([label,arr])=>'<div class="friend-panel" style="margin-top:'+(label==='진행 중'?'0':'12px')+'"><h3>📋 '+safe(label)+' · '+arr.length+'</h3><div class="friend-items">'+(arr.length?[...arr].sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||''))).slice(0,30).map(x=>'<div class="friend-item"><em>'+safe(statusText(x.status))+'</em><div><b>'+safe(x.title||'업무')+'</b><small>'+safe(x.category||'기타')+(x.note?' · '+safe(x.note):'')+'</small></div><span>'+safe(x.dueDate||x.target||'')+'</span></div>').join(''):'<div class="friends-empty">해당 업무가 없습니다.</div>')+'</div></div>').join('');
      };

      const renderNotes=()=>{
        if(!share?.can_view_notes)return '<div class="friend-lock"><b>🔒 메모는 비공개입니다.</b>친구가 메모 공개를 켜면 여기서 볼 수 있습니다.</div>';
        const arr=Array.isArray(notes?.payload)?notes.payload:[];
        const sorted=[...arr].sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||''))).slice(0,40);
        return '<div class="friend-panel" style="margin-top:0"><h3>📝 메모장 · 읽기 전용</h3><div class="friend-items">'+(sorted.length?sorted.map(n=>'<div class="friend-item"><em>'+(n.status==='done'?'완료':'메모')+'</em><div><b>'+safe(String(n.body||'').replace(/\s+/g,' ').slice(0,240))+'</b><small>'+(n.scheduledDate?'예정 '+safe(n.scheduledDate):'날짜 미정')+'</small></div><span>읽기</span></div>').join(''):'<div class="friends-empty">공유된 메모가 없습니다.</div>')+'</div></div>';
      };

      const renderGame=()=>{
        if(!share?.can_view_game)return '<div class="friend-lock"><b>🔒 게임은 비공개입니다.</b>친구가 게임 공개를 켜면 여기서 볼 수 있습니다.</div>';
        const br=game?.payload?.bokRunV1||{},kart=game?.payload?.kartCrossing||{};
        const brChars=Object.keys(br.ownedCharacters||{}).length,brRelics=Object.keys(br.ownedRelics||{}).length;
        const brRuns=Number(br.lifetime?.runs)||0,brClears=Number(br.lifetime?.clears)||0;
        const kartOwned=Object.keys(kart.owned||{}).length,kartRuns=Number(kart.totalRuns)||0;
        return '<div class="game-sections"><section class="game-card"><h3>🏃 BokRun · 읽기 전용</h3><div class="game-metrics"><div class="game-metric"><span>해금 라운드</span><strong>'+Math.max(1,Number(br.unlockedRound)||1)+'</strong></div><div class="game-metric"><span>클리어</span><strong>'+brClears+'</strong></div><div class="game-metric"><span>보유 캐릭터</span><strong>'+brChars+'</strong></div><div class="game-metric"><span>보유 유물</span><strong>'+brRelics+'</strong></div><div class="game-metric"><span>총 플레이</span><strong>'+brRuns+'</strong></div><div class="game-metric"><span>대표 캐릭터</span><strong style="font-size:10px">'+safe(br.selectedCharacter||'-')+'</strong></div></div></section><section class="game-card"><h3>🚗 Kart Crossing · 읽기 전용</h3><div class="game-metrics"><div class="game-metric"><span>최고 거리</span><strong>'+(Number(kart.bestDistance)||0)+'m</strong></div><div class="game-metric"><span>총 플레이</span><strong>'+kartRuns+'</strong></div><div class="game-metric"><span>보유 캐릭터</span><strong>'+kartOwned+'</strong></div><div class="game-metric"><span>총 뽑기</span><strong>'+(Number(kart.pulls)||0)+'</strong></div><div class="game-metric"><span>장착 캐릭터</span><strong style="font-size:10px">'+safe(kart.equipped||'-')+'</strong></div><div class="game-metric"><span>볼트</span><strong>'+(Number(kart.bolts)||0).toLocaleString()+'</strong></div></div></section></div>';
      };

      const renderGuestbook=()=>{
        const form=isSelf?'':'<form class="guestbook-compose" id="guestbookForm"><textarea id="guestbookBody" maxlength="200" placeholder="'+safe(friendProfile?.display_name||'친구')+'님 미니홈에 한마디 남겨보세요. (최대 200자)"></textarea><button type="submit">남기기</button></form>';
        return form+guestbookEntriesHtml(guestbook,isSelf);
      };

      const bindPosts=()=>{
        const composer=root.querySelector('#postComposeForm');
        if(composer)composer.onsubmit=async(e)=>{
          e.preventDefault();
          const body=String(root.querySelector('#postBody')?.value||'').trim();
          const mood=String(root.querySelector('#postMood')?.value||'💬');
          if(!body){toast('게시글 내용을 입력해주세요.');return;}
          const btn=composer.querySelector('button');btn.disabled=true;
          const {error}=await sb.from('workhub_posts').insert({author_id:session.user.id,mood,body});
          btn.disabled=false;
          if(error){console.error(error);toast('게시글 등록에 실패했습니다.');return;}
          toast('게시글을 올렸습니다.');
          await refreshPosts();renderTab('posts');
        };
        root.querySelectorAll('[data-post-delete]').forEach(btn=>btn.onclick=async()=>{
          if(!confirm('이 게시글을 삭제할까요?'))return;
          const {error}=await sb.from('workhub_posts').delete().eq('id',btn.dataset.postDelete);
          if(error){console.error(error);toast('게시글 삭제에 실패했습니다.');return;}
          await refreshPosts();renderTab('posts');
        });
        root.querySelectorAll('[data-react]').forEach(btn=>btn.onclick=async()=>{
          const postId=btn.dataset.react;
          const post=posts.find(p=>p.id===postId);
          const reacted=post?.reactions?.some(r=>r.user_id===session.user.id);
          const result=reacted
            ?await sb.from('workhub_post_reactions').delete().eq('post_id',postId).eq('user_id',session.user.id)
            :await sb.from('workhub_post_reactions').upsert({post_id:postId,user_id:session.user.id,emoji:'❤️'},{onConflict:'post_id,user_id'});
          if(result.error){console.error(result.error);toast('공감 처리에 실패했습니다.');return;}
          await refreshPosts();renderTab('posts');
        });
        root.querySelectorAll('[data-comment-form]').forEach(form=>form.onsubmit=async(e)=>{
          e.preventDefault();
          const input=form.querySelector('input'),body=String(input?.value||'').trim();
          if(!body)return;
          const postId=form.dataset.commentForm;
          const {error}=await sb.from('workhub_post_comments').insert({post_id:postId,author_id:session.user.id,body});
          if(error){console.error(error);toast('댓글 등록에 실패했습니다.');return;}
          await refreshPosts();renderTab('posts');
        });
        root.querySelectorAll('[data-comment-delete]').forEach(btn=>btn.onclick=async()=>{
          const {error}=await sb.from('workhub_post_comments').delete().eq('id',btn.dataset.commentDelete);
          if(error){console.error(error);toast('댓글 삭제에 실패했습니다.');return;}
          await refreshPosts();renderTab('posts');
        });
      };

      const bindGuestbook=()=>{
        const form=root.querySelector('#guestbookForm');
        if(form)form.onsubmit=async(e)=>{
          e.preventDefault();
          const input=root.querySelector('#guestbookBody');
          const body=String(input?.value||'').trim();
          if(!body){toast('방명록 내용을 입력해주세요.');return;}
          const button=form.querySelector('button');button.disabled=true;
          const {error}=await sb.from('workhub_guestbook').insert({owner_id:friendId,author_id:session.user.id,body});
          button.disabled=false;
          if(error){console.error(error);toast('방명록을 남기지 못했습니다.');return;}
          toast('방명록을 남겼습니다.');
          await refreshGuestbook();renderTab('guestbook');
        };
        root.querySelectorAll('[data-guestbook-delete]').forEach(btn=>btn.onclick=async()=>{
          if(!confirm('이 방명록 글을 삭제할까요?'))return;
          const {error}=await sb.from('workhub_guestbook').delete().eq('id',btn.dataset.guestbookDelete);
          if(error){console.error(error);toast('방명록 삭제에 실패했습니다.');return;}
          await refreshGuestbook();renderTab('guestbook');
        });
      };

      const renderTab=(tab)=>{
        root.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
        const body=root.querySelector('#friendHomeBody');if(!body)return;
        body.innerHTML=tab==='posts'?renderPosts():tab==='work'?renderWork():tab==='notes'?renderNotes():tab==='game'?renderGame():tab==='guestbook'?renderGuestbook():renderHome();
        if(tab==='posts')bindPosts();
        if(tab==='guestbook')bindGuestbook();
      };
      root.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>renderTab(b.dataset.tab));
      renderTab('home');
    }

    function showAuth(){
      session=null;window.clearTimeout(saveTimer);window.clearInterval(pullTimer);
      window.top.location.replace('/');
    }

    async function afterAuth(s){
      if(!s?.user || s.user.id!==window.__workhubAuthorizedUserId){showAuth();return;}
      session=s;
      try{await ensureProfile();}catch(e){console.error(e);}
      setBadge('☁ 연결 중…','saving');ensureAccountNav();
      try{
        const remote=await readRemote();
        const localScore=stateScore(S),remoteScore=stateScore(remote?.state);
        const migrated=localStorage.getItem('workhub_migrated_from_legacy_'+s.user.id)==='1';
        if(migrated&&localScore>0){
          await pushCloud(false);
          toast('기존 개인 데이터를 새 계정 공간으로 옮겼습니다.');
        }else if(remote?.state&&remoteScore>0){
          const lastLocal=localStorage.getItem('workhub_last_remote_at_'+s.user.id)||'';
          if(localScore===0 || !lastLocal || remote.updated_at>lastLocal){
            applyRemote(remote.state);
            lastRemoteAt=remote.updated_at||'';
            localStorage.setItem('workhub_last_remote_at_'+s.user.id,lastRemoteAt);
            setBadge('☁ 동기화됨');
          }else if(localScore>remoteScore){
            await pushCloud(false);
          }else{
            setBadge('☁ 연결됨');
          }
        }else{
          await pushCloud(false);
        }
        window.clearInterval(pullTimer);
        pullTimer=window.setInterval(()=>pullCloud(true),30000);
        window.addEventListener('focus',()=>pullCloud(true),{passive:true});
      }catch(e){
        console.error(e);setBadge('☁ 동기화 오류','error');toast('클라우드 연결 중 오류가 발생했습니다.');
      }
    }

    const {data:{user:verifiedUser},error:verifyError}=await sb.auth.getUser();
    if(verifyError||!verifiedUser||verifiedUser.id!==window.__workhubAuthorizedUserId){showAuth();return;}
    const {data:{session:existing}}=await sb.auth.getSession();
    if(existing)await afterAuth(existing);else showAuth();

    const {data:{subscription}}=sb.auth.onAuthStateChange((event,s)=>{
      if(event==='SIGNED_OUT'){session=null;window.clearInterval(pullTimer);closeOverlay('accountManager');closeOverlay('friendsManager');closeOverlay('friendHome');showAuth();}
      if(event==='SIGNED_IN'&&s&&session?.user?.id!==s.user.id)window.setTimeout(()=>afterAuth(s),0);
    });

    window.addEventListener('pagehide',()=>{
      subscription.unsubscribe();window.clearTimeout(saveTimer);window.clearInterval(pullTimer);
    },{once:true});
  };
  boot();
})();