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

    if (!nav || !main || !root || !pageTitle || typeof render !== 'function') {
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
      #workhub-arcade-nav.active{background:#81525a!important;border-color:#c09a68!important;color:#fff7e5!important;box-shadow:inset 3px 0 #e4c693}
      .main{margin-left:var(--workhub-side-width)!important;width:calc(100% - var(--workhub-side-width))!important;min-width:0!important}
      header{position:sticky!important;top:0!important;z-index:45!important}
      .arcade-root{max-width:1900px;margin:0 auto;padding:22px 32px 48px}
      .arcade-root[hidden],.arcade-game-panel[hidden]{display:none!important}
      .arcade-hero{
        display:flex;align-items:center;justify-content:space-between;gap:18px;padding:22px 24px;border:1px solid var(--line);
        border-top:4px double #af8b53;border-radius:6px;background:linear-gradient(135deg,color-mix(in srgb,var(--card) 88%,#b99d62),var(--card))
      }
      .arcade-kicker{font-size:11px;letter-spacing:3px;color:var(--muted);font-weight:900}.arcade-hero h2{font-family:Georgia,'Noto Serif KR',Batang,serif;font-size:30px;margin:5px 0 7px}.arcade-hero p{margin:0;color:var(--muted);font-size:14px;line-height:1.55}
      .arcade-count{flex:0 0 auto;border:1px solid #bd9349;background:#fff6d9;color:#765315;border-radius:999px;padding:9px 13px;font-size:12px;font-weight:950}.dark .arcade-count{background:#40351c;color:#ffe09a;border-color:#715b2d}
      .arcade-game-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:16px 0}
      .arcade-game-card{
        display:grid;grid-template-columns:54px minmax(0,1fr) auto;gap:13px;align-items:center;width:100%;padding:15px 16px;
        border:1px solid var(--line);border-radius:7px;background:var(--card);color:var(--ink);text-align:left;cursor:pointer;box-shadow:var(--shadow)
      }
      .arcade-game-card:hover{border-color:#b49362;transform:translateY(-1px)}.arcade-game-card.active{border:2px solid var(--brand);background:color-mix(in srgb,var(--card) 91%,#c9a97a);box-shadow:0 12px 30px #72384118}
      .arcade-game-icon{width:54px;height:54px;display:grid;place-items:center;border-radius:7px;background:#30292a;color:#f4cc70;font-size:27px}
      .arcade-game-card b{display:block;font-family:Georgia,'Noto Serif KR',Batang,serif;font-size:18px;margin-bottom:4px}.arcade-game-card small{display:block;color:var(--muted);font-size:12px;line-height:1.45}.arcade-game-arrow{color:var(--muted);font-size:20px;font-weight:900}
      .arcade-stage{min-width:0}.arcade-game-panel{min-width:0}.arcade-loading{padding:45px 20px;border:1px dashed var(--line);border-radius:6px;background:var(--card);text-align:center;color:var(--muted);font-size:13px}
      .arcade-game-panel>.runner,.arcade-game-panel>.kart-crossing{margin:0!important;width:100%!important}
      .arcade-game-panel>.runner{border-top-width:4px}.arcade-game-panel>.kart-crossing{margin-bottom:0!important}
      body.workhub-arcade-view #addGlobal{display:none!important}
      @media(max-width:980px){
        :root{--workhub-side-width:82px}
        .side{padding:18px 8px!important}.brand{padding:4px 3px 22px!important;text-align:center!important;font-size:16px!important}.brand small{display:none!important}
        .nav button{padding:13px 6px!important;text-align:center!important;font-size:19px!important}.nav button span{display:none!important}
        .nav-divider{margin:13px 3px 2px}.nav-divider span{display:none}.arcade-root{padding:18px 18px 38px}.arcade-game-list{grid-template-columns:1fr}
      }
      @media(max-width:620px){
        :root{--workhub-side-width:72px}.side{padding:14px 6px!important}.arcade-root{padding:14px 12px 32px}.arcade-hero{align-items:flex-start;flex-direction:column;padding:17px}.arcade-hero h2{font-size:25px}.arcade-game-card{grid-template-columns:46px minmax(0,1fr) auto;padding:12px}.arcade-game-icon{width:46px;height:46px;font-size:23px}.arcade-game-card b{font-size:16px}
      }
    `;
    document.head.appendChild(style);

    const divider = document.createElement('div');
    divider.className = 'nav-divider';
    divider.setAttribute('aria-hidden', 'true');
    divider.innerHTML = '<span>쉬는 시간</span>';

    const arcadeButton = document.createElement('button');
    arcadeButton.id = 'workhub-arcade-nav';
    arcadeButton.type = 'button';
    arcadeButton.dataset.view = 'arcade';
    arcadeButton.innerHTML = '🎮 <span>딴짓</span>';
    arcadeButton.setAttribute('aria-controls', 'workhub-arcade-root');
    nav.append(divider, arcadeButton);

    const arcadeRoot = document.createElement('div');
    arcadeRoot.id = 'workhub-arcade-root';
    arcadeRoot.className = 'arcade-root';
    arcadeRoot.hidden = true;
    arcadeRoot.innerHTML = `
      <section class="arcade-hero">
        <div>
          <div class="arcade-kicker">BREAK ROOM · GAME LIST</div>
          <h2>딴짓</h2>
          <p>일계표 화면과 게임을 분리했습니다. 아래 목록에서 게임 하나를 골라서 실행하세요.</p>
        </div>
        <span class="arcade-count">게임 2개</span>
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
    main.appendChild(arcadeRoot);

    const runnerPanel = arcadeRoot.querySelector('#arcade-runner-panel');
    const kartPanel = arcadeRoot.querySelector('#arcade-kart-panel');
    const gameButtons = [...arcadeRoot.querySelectorAll('[data-arcade-game]')];
    const addGlobal = document.getElementById('addGlobal');
    let arcadeActive = false;
    let activeGame = localStorage.getItem(ACTIVE_GAME_KEY) === 'runner' ? 'runner' : 'kart';

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

    function attachGames() {
      const runner = document.getElementById('workhub-runner');
      const kart = document.getElementById('workhub-kart-crossing');

      if (runner && !runnerPanel.contains(runner)) {
        runnerPanel.replaceChildren(runner);
      }
      if (kart && !kartPanel.contains(kart)) {
        kartPanel.replaceChildren(kart);
      }
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

    function restoreArcadePresentation() {
      if (!arcadeActive) return;
      root.hidden = true;
      arcadeRoot.hidden = false;
      document.body.classList.add('workhub-arcade-view');
      pageTitle.textContent = '딴짓';
      if (addGlobal) addGlobal.hidden = true;
      [...nav.querySelectorAll('button[data-view]')].forEach((button) => button.classList.toggle('active', button === arcadeButton));
      attachGames();
      setGame(activeGame);
    }

    function enterArcade() {
      arcadeActive = true;
      restoreArcadePresentation();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function leaveArcade() {
      if (!arcadeActive) return;
      arcadeActive = false;
      pauseAllGames();
      arcadeRoot.hidden = true;
      root.hidden = false;
      document.body.classList.remove('workhub-arcade-view');
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

    arcadeButton.onclick = enterArcade;
    nav.addEventListener('click', (event) => {
      const button = event.target instanceof Element ? event.target.closest('button[data-view]') : null;
      if (!button || button === arcadeButton) return;
      leaveArcade();
    }, true);

    const previousRender = render;
    render = function () {
      previousRender();
      if (arcadeActive) restoreArcadePresentation();
      else {
        root.hidden = false;
        arcadeRoot.hidden = true;
        document.body.classList.remove('workhub-arcade-view');
        if (addGlobal) addGlobal.hidden = false;
      }
    };

    const observer = new MutationObserver(attachGames);
    observer.observe(main, { childList: true, subtree: true });
    attachGames();
    setGame(activeGame);
  }

  boot();
})();
