(() => {
  'use strict';

  if (window.__workhubArcadeMenuLoaded) return;
  window.__workhubArcadeMenuLoaded = true;

  const ACTIVE_GAME_KEY = 'workhub_arcade_active_game_v1';

  function boot() {
    const nav = document.querySelector('.nav');
    const main = document.querySelector('.main');
    const root = document.getElementById('root');
    const pageTitle = document.getElementById('pageTitle');

    if (
      !nav || !main || !root || !pageTitle ||
      typeof render !== 'function' || typeof liveCenter !== 'function'
    ) {
      window.setTimeout(boot, 120);
      return;
    }
    if (document.getElementById('workhub-arcade-nav')) return;

    const style = document.createElement('style');
    style.id = 'workhub-arcade-nav-style';
    style.textContent = `
      :root{--workhub-side-width:216px}
      .shell{display:flex!important;min-height:100vh!important}
      .side{
        position:fixed!important;inset:0 auto 0 0!important;width:var(--workhub-side-width)!important;height:100vh!important;
        padding:28px 15px!important;display:flex!important;flex-direction:column!important;align-items:stretch!important;
        justify-content:flex-start!important;background:#39242a!important;border-right:3px double #af8b53!important;
        border-bottom:0!important;color:#f7edda!important;overflow-y:auto!important;z-index:60!important
      }
      .brand{display:block!important;padding:0 10px 28px!important;margin:0!important;font-size:25px!important;line-height:1.08!important}
      .brand small{display:block!important;margin:7px 0 0!important;font-size:10px!important;line-height:1.3!important}
      .nav{display:flex!important;flex-direction:column!important;gap:6px!important;width:100%!important}
      .nav button{
        width:100%!important;margin:0!important;padding:14px 13px!important;text-align:left!important;border-radius:5px!important;
        font-size:15px!important;line-height:1.2!important
      }
      .nav-divider{display:flex;align-items:center;gap:8px;margin:15px 8px 3px;color:#bda98b;font-size:10px;font-weight:900;letter-spacing:2px}
      .nav-divider:before,.nav-divider:after{content:'';height:1px;background:#765963;flex:1}.nav-divider span{white-space:nowrap}
      #workhub-live-nav.active,#workhub-arcade-nav.active{
        background:#81525a!important;border-color:#c09a68!important;color:#fff7e5!important;box-shadow:inset 3px 0 #e4c693
      }
      .main{margin-left:var(--workhub-side-width)!important;width:calc(100% - var(--workhub-side-width))!important;min-width:0!important}
      header{position:sticky!important;top:0!important;z-index:45!important}
      .special-root{max-width:1900px;margin:0 auto;padding:22px 32px 48px}
      .special-root[hidden],.arcade-game-panel[hidden]{display:none!important}
      .special-hero{
        display:flex;align-items:center;justify-content:space-between;gap:18px;padding:22px 24px;border:1px solid var(--line);
        border-top:4px double #af8b53;border-radius:6px;background:linear-gradient(135deg,color-mix(in srgb,var(--card) 88%,#b99d62),var(--card))
      }
      .special-kicker{font-size:11px;letter-spacing:3px;color:var(--muted);font-weight:900}
      .special-hero h2{font-family:Georgia,'Noto Serif KR',Batang,serif;font-size:30px;margin:5px 0 7px}
      .special-hero p{margin:0;color:var(--muted);font-size:14px;line-height:1.55}
      .special-count{flex:0 0 auto;border:1px solid #bd9349;background:#fff6d9;color:#765315;border-radius:999px;padding:9px 13px;font-size:12px;font-weight:950}
      .dark .special-count{background:#40351c;color:#ffe09a;border-color:#715b2d}
      .live-stage{margin-top:16px;min-width:0}
      .live-stage .live-center-below{width:100%!important;margin:0!important}
      .live-stage .live:not(.expanded){position:relative!important;top:auto!important;width:100%!important;max-height:none!important;margin:0!important;border-radius:6px!important}
      .live-stage .live:not(.expanded) .livebody{max-height:none!important;min-height:430px!important;padding:0 20px 22px!important}
      .live-stage .live:not(.expanded) .livetabs{max-width:640px}
      .live-stage .live:not(.expanded) .market-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:36px}
      .live-stage .live:not(.expanded) .score-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
      .arcade-game-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:16px 0}
      .arcade-game-card{
        display:grid;grid-template-columns:54px minmax(0,1fr) auto;gap:13px;align-items:center;width:100%;padding:15px 16px;
        border:1px solid var(--line);border-radius:7px;background:var(--card);color:var(--ink);text-align:left;cursor:pointer;box-shadow:var(--shadow)
      }
      .arcade-game-card:hover{border-color:#b49362;transform:translateY(-1px)}
      .arcade-game-card.active{border:2px solid var(--brand);background:color-mix(in srgb,var(--card) 91%,#c9a97a);box-shadow:0 12px 30px #72384118}
      .arcade-game-icon{width:54px;height:54px;display:grid;place-items:center;border-radius:7px;background:#30292a;color:#f4cc70;font-size:27px}
      .arcade-game-card b{display:block;font-family:Georgia,'Noto Serif KR',Batang,serif;font-size:18px;margin-bottom:4px}
      .arcade-game-card small{display:block;color:var(--muted);font-size:12px;line-height:1.45}
      .arcade-game-arrow{color:var(--muted);font-size:20px;font-weight:900}
      .arcade-stage{min-width:0}.arcade-game-panel{min-width:0}
      .arcade-loading{padding:45px 20px;border:1px dashed var(--line);border-radius:6px;background:var(--card);text-align:center;color:var(--muted);font-size:13px}
      .arcade-game-panel>.runner,.arcade-game-panel>.kart-crossing{margin:0!important;width:100%!important}
      .arcade-game-panel>.runner{border-top-width:4px}.arcade-game-panel>.kart-crossing{margin-bottom:0!important}
      body.workhub-special-view #addGlobal{display:none!important}
      @media(max-width:1180px){.live-stage .live:not(.expanded) .score-list{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:980px){
        :root{--workhub-side-width:82px}
        .side{padding:18px 8px!important}.brand{padding:4px 3px 22px!important;text-align:center!important;font-size:16px!important}.brand small{display:none!important}
        .nav button{padding:13px 6px!important;text-align:center!important;font-size:19px!important}.nav button span{display:none!important}
        .nav-divider{margin:13px 3px 2px}.nav-divider span{display:none}.special-root{padding:18px 18px 38px}.arcade-game-list{grid-template-columns:1fr}
      }
      @media(max-width:700px){
        .live-stage .live:not(.expanded) .market-list,.live-stage .live:not(.expanded) .score-list{grid-template-columns:1fr}
        .live-stage .live:not(.expanded) .livebody{min-height:0!important;padding:0 12px 15px!important}
      }
      @media(max-width:620px){
        :root{--workhub-side-width:72px}.side{padding:14px 6px!important}.special-root{padding:14px 12px 32px}
        .special-hero{align-items:flex-start;flex-direction:column;padding:17px}.special-hero h2{font-size:25px}
        .arcade-game-card{grid-template-columns:46px minmax(0,1fr) auto;padding:12px}.arcade-game-icon{width:46px;height:46px;font-size:23px}.arcade-game-card b{font-size:16px}
      }
    `;
    document.head.appendChild(style);

    const infoDivider = document.createElement('div');
    infoDivider.className = 'nav-divider';
    infoDivider.setAttribute('aria-hidden', 'true');
    infoDivider.innerHTML = '<span>실시간 정보</span>';

    const liveButton = document.createElement('button');
    liveButton.id = 'workhub-live-nav';
    liveButton.type = 'button';
    liveButton.dataset.view = 'live-center';
    liveButton.innerHTML = '📡 <span>라이브센터</span>';
    liveButton.setAttribute('aria-controls', 'workhub-live-root');

    const breakDivider = document.createElement('div');
    breakDivider.className = 'nav-divider';
    breakDivider.setAttribute('aria-hidden', 'true');
    breakDivider.innerHTML = '<span>쉬는 시간</span>';

    const arcadeButton = document.createElement('button');
    arcadeButton.id = 'workhub-arcade-nav';
    arcadeButton.type = 'button';
    arcadeButton.dataset.view = 'arcade';
    arcadeButton.innerHTML = '🎮 <span>딴짓</span>';
    arcadeButton.setAttribute('aria-controls', 'workhub-arcade-root');
    nav.append(infoDivider, liveButton, breakDivider, arcadeButton);

    const liveRoot = document.createElement('div');
    liveRoot.id = 'workhub-live-root';
    liveRoot.className = 'special-root live-root';
    liveRoot.hidden = true;
    liveRoot.innerHTML = `
      <section class="special-hero">
        <div>
          <div class="special-kicker">MARKET · KBO · FOOTBALL</div>
          <h2>라이브센터</h2>
          <p>시장과 스포츠 실시간 보드를 업무 화면에서 분리했습니다. 탭을 눌러 필요한 정보만 확인하세요.</p>
        </div>
        <span class="special-count">60초 자동 갱신</span>
      </section>
      <div class="live-stage" id="workhub-live-stage"><div class="arcade-loading">라이브센터를 불러오는 중입니다.</div></div>`;

    const arcadeRoot = document.createElement('div');
    arcadeRoot.id = 'workhub-arcade-root';
    arcadeRoot.className = 'special-root arcade-root';
    arcadeRoot.hidden = true;
    arcadeRoot.innerHTML = `
      <section class="special-hero">
        <div>
          <div class="special-kicker">BREAK ROOM · GAME LIST</div>
          <h2>딴짓</h2>
          <p>일계표 화면과 게임을 분리했습니다. 아래 목록에서 게임 하나를 골라서 실행하세요.</p>
        </div>
        <span class="special-count">게임 2개</span>
      </section>
      <div class="arcade-game-list" role="tablist" aria-label="게임 목록">
        <button type="button" class="arcade-game-card" data-arcade-game="runner" role="tab" aria-controls="arcade-runner-panel">
          <span class="arcade-game-icon">🏃</span><span><b>슈퍼마리오 런</b><small>덤블링 점프 · 코인 · 버섯 · 별 아이템</small></span><span class="arcade-game-arrow">›</span>
        </button>
        <button type="button" class="arcade-game-card" data-arcade-game="kart" role="tab" aria-controls="arcade-kart-panel">
          <span class="arcade-game-icon">🏎️</span><span><b>카트 크로싱</b><small>차선 횡단 · 캐릭터 가챠 · 차고 · 승급</small></span><span class="arcade-game-arrow">›</span>
        </button>
      </div>
      <div class="arcade-stage">
        <div class="arcade-game-panel" id="arcade-runner-panel" data-arcade-panel="runner" role="tabpanel"><div class="arcade-loading">슈퍼마리오 런을 불러오는 중입니다.</div></div>
        <div class="arcade-game-panel" id="arcade-kart-panel" data-arcade-panel="kart" role="tabpanel" hidden><div class="arcade-loading">카트 크로싱을 불러오는 중입니다.</div></div>
      </div>`;
    main.append(liveRoot, arcadeRoot);

    const liveStage = liveRoot.querySelector('#workhub-live-stage');
    const runnerPanel = arcadeRoot.querySelector('#arcade-runner-panel');
    const kartPanel = arcadeRoot.querySelector('#arcade-kart-panel');
    const gameButtons = [...arcadeRoot.querySelectorAll('[data-arcade-game]')];
    const addGlobal = document.getElementById('addGlobal');
    let specialView = null;
    let activeGame = 'kart';
    try { activeGame = localStorage.getItem(ACTIVE_GAME_KEY) === 'runner' ? 'runner' : 'kart'; } catch {}

    function pauseRunner() {
      const button = document.getElementById('runner-pause');
      if (button && !button.disabled && button.textContent.includes('일시정지')) button.click();
    }

    function pauseKart() {
      const button = document.getElementById('kart-pause');
      if (button && !button.disabled && button.textContent.includes('일시정지')) button.click();
    }

    function pauseAllGames() {
      pauseRunner();
      pauseKart();
    }

    function collapseLiveCenter() {
      if (typeof expanded !== 'undefined' && expanded) expanded = false;
      document.getElementById('liveBackdrop')?.remove();
    }

    function attachLiveCenter() {
      const incoming = root.querySelector('.live-center-below');
      if (incoming && !liveStage.contains(incoming)) liveStage.replaceChildren(incoming);
    }

    function attachGames() {
      const runner = document.getElementById('workhub-runner');
      const kart = document.getElementById('workhub-kart-crossing');

      if (runner && !runnerPanel.contains(runner)) runnerPanel.replaceChildren(runner);
      if (kart && !kartPanel.contains(kart)) kartPanel.replaceChildren(kart);
    }

    function setGame(nextGame, options = {}) {
      activeGame = nextGame === 'runner' ? 'runner' : 'kart';
      try { localStorage.setItem(ACTIVE_GAME_KEY, activeGame); } catch {}

      gameButtons.forEach((button) => {
        const selected = button.dataset.arcadeGame === activeGame;
        button.classList.toggle('active', selected);
        button.setAttribute('aria-selected', String(selected));
        button.tabIndex = selected ? 0 : -1;
      });
      runnerPanel.hidden = activeGame !== 'runner';
      kartPanel.hidden = activeGame !== 'kart';

      if (activeGame === 'runner') pauseKart();
      else pauseRunner();

      window.requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
      if (options.focus) {
        const selected = gameButtons.find((button) => button.dataset.arcadeGame === activeGame);
        selected?.focus({ preventScroll: true });
      }
    }

    function markNavigation(activeButton) {
      [...nav.querySelectorAll('button[data-view]')].forEach((button) => {
        button.classList.toggle('active', button === activeButton);
      });
    }

    function present() {
      attachLiveCenter();
      attachGames();

      const isLive = specialView === 'live';
      const isArcade = specialView === 'arcade';
      root.hidden = isLive || isArcade;
      liveRoot.hidden = !isLive;
      arcadeRoot.hidden = !isArcade;
      document.body.classList.toggle('workhub-special-view', isLive || isArcade);
      document.body.classList.toggle('workhub-live-view', isLive);
      document.body.classList.toggle('workhub-arcade-view', isArcade);
      if (addGlobal) addGlobal.hidden = isLive || isArcade;

      if (isLive) {
        pageTitle.textContent = '라이브센터';
        markNavigation(liveButton);
        window.requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
      } else if (isArcade) {
        pageTitle.textContent = '딴짓';
        markNavigation(arcadeButton);
        setGame(activeGame);
      }
    }

    function enterLive() {
      pauseAllGames();
      specialView = 'live';
      if (typeof view !== 'undefined') view = 'dashboard';
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function enterArcade() {
      collapseLiveCenter();
      specialView = 'arcade';
      present();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function leaveSpecial() {
      if (!specialView) return;
      if (specialView === 'live') collapseLiveCenter();
      if (specialView === 'arcade') pauseAllGames();
      specialView = null;
      root.hidden = false;
      liveRoot.hidden = true;
      arcadeRoot.hidden = true;
      document.body.classList.remove('workhub-special-view', 'workhub-live-view', 'workhub-arcade-view');
      if (addGlobal) addGlobal.hidden = false;
    }

    gameButtons.forEach((button) => {
      button.onclick = () => setGame(button.dataset.arcadeGame, { focus: true });
      button.onkeydown = (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.code)) return;
        event.preventDefault();
        const index = gameButtons.indexOf(button);
        const delta = ['ArrowRight', 'ArrowDown'].includes(event.code) ? 1 : -1;
        const next = gameButtons[(index + delta + gameButtons.length) % gameButtons.length];
        setGame(next.dataset.arcadeGame, { focus: true });
      };
    });

    liveButton.onclick = enterLive;
    arcadeButton.onclick = enterArcade;
    nav.addEventListener('click', (event) => {
      const button = event.target instanceof Element ? event.target.closest('button[data-view]') : null;
      if (!button || button === liveButton || button === arcadeButton) return;
      leaveSpecial();
    }, true);

    const previousRender = render;
    render = function () {
      previousRender();
      attachLiveCenter();
      attachGames();
      if (specialView) present();
      else {
        root.hidden = false;
        liveRoot.hidden = true;
        arcadeRoot.hidden = true;
        document.body.classList.remove('workhub-special-view', 'workhub-live-view', 'workhub-arcade-view');
        if (addGlobal) addGlobal.hidden = false;
      }
    };

    const observer = new MutationObserver(() => {
      attachLiveCenter();
      attachGames();
    });
    observer.observe(main, { childList: true, subtree: true });
    attachLiveCenter();
    attachGames();
    setGame(activeGame);
  }

  boot();
})();
