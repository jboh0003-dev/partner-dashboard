(() => {
  'use strict';
  if (window.__workhubPortalHomeLoaded) return;
  window.__workhubPortalHomeLoaded = true;

  const boot = () => {
    const main = document.querySelector('.main');
    const side = document.querySelector('.side');
    const nav = document.querySelector('.nav');
    const brand = document.querySelector('.brand');
    const appRoot = document.getElementById('root');
    const pageTitle = document.getElementById('pageTitle');
    const header = document.querySelector('.main > header');
    const addGlobal = document.getElementById('addGlobal');

    if (!main || !side || !nav || !brand || !appRoot || !pageTitle || !header || typeof render !== 'function') {
      window.setTimeout(boot, 120);
      return;
    }
    if (document.getElementById('workhub-home-root')) return;

    let portalMode = 'home';

    brand.innerHTML = 'BokDesk<small>WORK HUB</small>';
    brand.setAttribute('role', 'button');
    brand.setAttribute('tabindex', '0');
    brand.setAttribute('aria-label', 'BokDesk 홈으로 이동');
    brand.title = 'BokDesk 홈';
    document.title = 'BokDesk · Work Hub';

    const home = document.createElement('section');
    home.id = 'workhub-home-root';
    home.className = 'bokdesk-home';
    home.innerHTML = `
      <div class="bokdesk-home-inner">
        <div class="bokdesk-home-copy">
          <span class="bokdesk-eyebrow">BOKDESK · PRIVATE WORK HUB</span>
          <h1>오늘은 어디로 갈까요?</h1>
          <p>필요한 공간만 열어두고, 나머지는 조용히 숨겨둡니다.</p>
        </div>
        <div class="bokdesk-launchers" role="navigation" aria-label="BokDesk 메뉴">
          <button type="button" class="bokdesk-launcher schedule" data-portal-open="schedule">
            <span class="bokdesk-launcher-art" aria-hidden="true">
              <i class="art-calendar"><b></b><b></b><b></b></i>
            </span>
            <span class="bokdesk-launcher-copy"><small>WORK</small><b>일정관리</b><em>일계표 · 월간계획 · 업무이력 · 주간보고</em></span>
            <span class="bokdesk-launcher-arrow">↗</span>
          </button>
          <button type="button" class="bokdesk-launcher live" data-portal-open="live">
            <span class="bokdesk-launcher-art" aria-hidden="true">
              <i class="art-live"><b></b><b></b><b></b><b></b></i>
            </span>
            <span class="bokdesk-launcher-copy"><small>NOW</small><b>라이브센터</b><em>시장 · KBO · Football</em></span>
            <span class="bokdesk-launcher-arrow">↗</span>
          </button>
          <button type="button" class="bokdesk-launcher lab" data-portal-open="lab">
            <span class="bokdesk-launcher-art" aria-hidden="true">
              <i class="art-lab"><b></b><b></b><b></b></i>
            </span>
            <span class="bokdesk-launcher-copy"><small>LAB</small><b>Lab</b><em>작은 실험실 · Runner · Kart</em></span>
            <span class="bokdesk-launcher-arrow">↗</span>
          </button>
        </div>
        <div class="bokdesk-home-foot"><span>⌂ BokDesk</span><span>필요한 화면만 열기</span></div>
      </div>`;
    main.appendChild(home);

    const style = document.createElement('style');
    style.id = 'workhub-home-hub-style';
    style.textContent = `
      .brand{cursor:pointer!important;user-select:none!important}
      .brand:focus-visible{outline:3px solid #fee500!important;outline-offset:4px!important;border-radius:8px!important}
      .bokdesk-home[hidden]{display:none!important}
      .bokdesk-home{
        min-height:calc(100vh - 1px);display:grid;place-items:center;padding:64px 42px;
        background:
          radial-gradient(circle at 12% 16%,rgba(254,229,0,.22),transparent 24%),
          radial-gradient(circle at 88% 82%,rgba(139,205,255,.18),transparent 26%),
          #f7f7f7;
      }
      body.dark .bokdesk-home{
        background:radial-gradient(circle at 12% 16%,rgba(254,229,0,.08),transparent 24%),
        radial-gradient(circle at 88% 82%,rgba(74,116,148,.12),transparent 26%),#171717
      }
      .bokdesk-home-inner{width:min(1020px,100%);margin:auto}
      .bokdesk-home-copy{text-align:center;margin-bottom:34px}
      .bokdesk-eyebrow{
        display:inline-flex;padding:7px 11px;border-radius:999px;background:#191919;color:#fff;
        font-size:10px;font-weight:850;letter-spacing:1.2px
      }
      body.dark .bokdesk-eyebrow{background:#fee500;color:#191919}
      .bokdesk-home-copy h1{margin:14px 0 8px;font-size:clamp(32px,4.2vw,52px);line-height:1.12;letter-spacing:-2.2px;font-weight:850;color:var(--ink)}
      .bokdesk-home-copy p{margin:0;color:#818181;font-size:14px}
      .bokdesk-launchers{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;align-items:stretch}
      .bokdesk-launcher{
        position:relative;min-height:278px;display:flex;flex-direction:column;align-items:flex-start;text-align:left;
        padding:22px;border:0;border-radius:26px;background:#fff;color:#191919;cursor:pointer;overflow:hidden;
        box-shadow:0 9px 28px rgba(0,0,0,.055);transition:transform .18s ease,box-shadow .18s ease
      }
      body.dark .bokdesk-launcher{background:#252525;color:#f7f7f7;box-shadow:none}
      .bokdesk-launcher:hover{transform:translateY(-5px);box-shadow:0 16px 38px rgba(0,0,0,.09)}
      .bokdesk-launcher:focus-visible{outline:4px solid #fee500;outline-offset:3px}
      .bokdesk-launcher.schedule{background:linear-gradient(150deg,#fffdf0,#fff 63%)}
      .bokdesk-launcher.live{background:linear-gradient(150deg,#eef8ff,#fff 63%)}
      .bokdesk-launcher.lab{background:linear-gradient(150deg,#f3efff,#fff 63%)}
      body.dark .bokdesk-launcher.schedule,body.dark .bokdesk-launcher.live,body.dark .bokdesk-launcher.lab{background:#252525}
      .bokdesk-launcher-art{
        height:112px;width:100%;display:grid;place-items:center;margin-bottom:15px;border-radius:19px;
        background:rgba(0,0,0,.035)
      }
      body.dark .bokdesk-launcher-art{background:rgba(255,255,255,.045)}
      .bokdesk-launcher.schedule .bokdesk-launcher-art{background:#fff7ad}
      .bokdesk-launcher.live .bokdesk-launcher-art{background:#dff2ff}
      .bokdesk-launcher.lab .bokdesk-launcher-art{background:#eae2ff}
      body.dark .bokdesk-launcher.schedule .bokdesk-launcher-art{background:#3c3818}
      body.dark .bokdesk-launcher.live .bokdesk-launcher-art{background:#22323c}
      body.dark .bokdesk-launcher.lab .bokdesk-launcher-art{background:#302a3e}
      .bokdesk-launcher-copy{display:flex;flex-direction:column;gap:4px}
      .bokdesk-launcher-copy small{font-size:9px;font-weight:900;letter-spacing:1.4px;color:#aaa}
      .bokdesk-launcher-copy b{font-size:22px;line-height:1.25;font-weight:850;letter-spacing:-.8px}
      .bokdesk-launcher-copy em{font-style:normal;color:#888;font-size:11px;line-height:1.55}
      .bokdesk-launcher-arrow{position:absolute;right:19px;bottom:18px;font-size:21px;font-weight:700;color:#999}
      .art-calendar{position:relative;width:76px;height:68px;border-radius:16px;background:#fff;border:3px solid #191919;box-shadow:5px 6px 0 #fee500}
      .art-calendar:before{content:'';position:absolute;left:-3px;right:-3px;top:16px;border-top:3px solid #191919}
      .art-calendar:after{content:'';position:absolute;left:14px;right:14px;top:-9px;height:16px;border-left:5px solid #191919;border-right:5px solid #191919}
      .art-calendar b{position:absolute;width:9px;height:9px;border-radius:3px;background:#fee500;top:29px}
      .art-calendar b:nth-child(1){left:14px}.art-calendar b:nth-child(2){left:32px}.art-calendar b:nth-child(3){left:50px}
      .art-live{position:relative;width:92px;height:70px;display:flex;align-items:flex-end;justify-content:center;gap:7px}
      .art-live b{display:block;width:13px;border-radius:8px 8px 3px 3px;background:#191919}
      .art-live b:nth-child(1){height:28px}.art-live b:nth-child(2){height:51px}.art-live b:nth-child(3){height:39px}.art-live b:nth-child(4){height:63px;background:#4aa8df}
      .art-lab{position:relative;width:82px;height:80px}
      .art-lab:before{content:'';position:absolute;left:27px;top:3px;width:29px;height:28px;border:4px solid #191919;border-bottom:0;border-radius:7px 7px 0 0}
      .art-lab:after{content:'';position:absolute;left:14px;bottom:3px;width:56px;height:52px;background:#fff;border:4px solid #191919;border-radius:9px 9px 20px 20px;transform:skew(-8deg)}
      .art-lab b{position:absolute;z-index:2;width:12px;height:12px;border-radius:50%;background:#8c6ad9}
      .art-lab b:nth-child(1){left:29px;bottom:24px}.art-lab b:nth-child(2){left:47px;bottom:14px;width:8px;height:8px}.art-lab b:nth-child(3){left:52px;bottom:35px;width:10px;height:10px;background:#fee500}
      .bokdesk-home-foot{display:flex;justify-content:center;gap:18px;margin-top:24px;color:#aaa;font-size:10px}
      body.workhub-portal-home .main>header{display:none!important}
      body.workhub-portal-home .nav{display:none!important}
      body.workhub-portal-home .account-nav{margin-top:auto!important}
      body.workhub-portal-live .nav,body.workhub-portal-lab .nav{display:none!important}
      body.workhub-portal-live .account-nav,body.workhub-portal-lab .account-nav{margin-top:auto!important}
      body.workhub-portal-schedule #workhub-live-nav,
      body.workhub-portal-schedule #workhub-arcade-nav,
      body.workhub-portal-schedule .nav-divider{display:none!important}
      @media(max-width:900px){
        .bokdesk-home{padding:40px 22px}
        .bokdesk-launchers{grid-template-columns:1fr}
        .bokdesk-launcher{min-height:182px;display:grid;grid-template-columns:120px 1fr;align-items:center;column-gap:18px}
        .bokdesk-launcher-art{height:120px;margin:0}
        .bokdesk-launcher-copy b{font-size:20px}
      }
      @media(max-width:620px){
        .bokdesk-home{padding:26px 14px}
        .bokdesk-home-copy{text-align:left;margin-bottom:22px}
        .bokdesk-home-copy h1{font-size:34px}
        .bokdesk-launcher{grid-template-columns:94px 1fr;padding:16px;min-height:150px;border-radius:20px}
        .bokdesk-launcher-art{height:96px}
      }
    `;
    document.head.appendChild(style);

    const allSpecialRoots = () => [
      document.getElementById('workhub-live-root'),
      document.getElementById('workhub-arcade-root'),
      document.getElementById('workhub-monthly-root'),
      document.getElementById('workhub-history-root'),
      document.getElementById('workhub-notes-root'),
    ].filter(Boolean);

    function setBodyMode(mode) {
      document.body.classList.remove('workhub-portal-home','workhub-portal-schedule','workhub-portal-live','workhub-portal-lab');
      document.body.classList.add('workhub-portal-' + mode);
    }

    function resetToDashboard() {
      const dashboard = nav.querySelector('button[data-view="dashboard"]');
      if (dashboard) dashboard.click();
      if (typeof view !== 'undefined') view = 'dashboard';
    }

    function presentHome() {
      portalMode = 'home';
      setBodyMode('home');
      home.hidden = false;
      appRoot.hidden = true;
      allSpecialRoots().forEach(el => { el.hidden = true; });
      if (addGlobal) addGlobal.hidden = true;
      [...nav.querySelectorAll('button')].forEach(btn => btn.classList.remove('active'));
      pageTitle.textContent = 'BokDesk';
      window.scrollTo({top:0,behavior:'auto'});
    }

    function openSchedule() {
      portalMode = 'schedule';
      setBodyMode('schedule');
      home.hidden = true;
      resetToDashboard();
      appRoot.hidden = false;
      if (addGlobal) addGlobal.hidden = false;
      window.setTimeout(() => {
        pageTitle.textContent = '일계표';
        window.scrollTo({top:0,behavior:'smooth'});
      }, 0);
    }

    function openLive() {
      portalMode = 'live';
      setBodyMode('live');
      home.hidden = true;
      const liveButton = document.getElementById('workhub-live-nav');
      if (liveButton) liveButton.click();
      window.setTimeout(() => {
        const liveRoot = document.getElementById('workhub-live-root');
        if (liveRoot) liveRoot.hidden = false;
        pageTitle.textContent = '라이브센터';
        window.scrollTo({top:0,behavior:'smooth'});
      }, 0);
    }

    function openLab() {
      portalMode = 'lab';
      setBodyMode('lab');
      home.hidden = true;
      const labButton = document.getElementById('workhub-arcade-nav');
      if (labButton) labButton.click();
      window.setTimeout(() => {
        const arcadeRoot = document.getElementById('workhub-arcade-root');
        if (arcadeRoot) arcadeRoot.hidden = false;
        pageTitle.textContent = 'Lab';
        window.scrollTo({top:0,behavior:'smooth'});
      }, 0);
    }

    function returnHome() {
      resetToDashboard();
      window.setTimeout(presentHome, 0);
    }

    home.querySelectorAll('[data-portal-open]').forEach(button => {
      button.onclick = () => {
        const target = button.dataset.portalOpen;
        if (target === 'schedule') openSchedule();
        if (target === 'live') openLive();
        if (target === 'lab') openLab();
      };
    });

    brand.onclick = returnHome;
    brand.onkeydown = event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      returnHome();
    };

    nav.addEventListener('click', event => {
      const button = event.target instanceof Element ? event.target.closest('button') : null;
      if (!button) return;
      home.hidden = true;
      if (button.id === 'workhub-live-nav') {
        portalMode = 'live'; setBodyMode('live');
      } else if (button.id === 'workhub-arcade-nav') {
        portalMode = 'lab'; setBodyMode('lab');
      } else {
        portalMode = 'schedule'; setBodyMode('schedule');
      }
    }, true);

    const renameLab = () => {
      const labNav = document.querySelector('#workhub-arcade-nav span');
      if (labNav) labNav.textContent = 'Lab';
      const labHero = document.querySelector('#workhub-arcade-root .special-hero h2');
      if (labHero) labHero.textContent = 'Lab';
      const labKicker = document.querySelector('#workhub-arcade-root .special-kicker');
      if (labKicker) labKicker.textContent = 'BOKDESK · PRIVATE LAB';
      const labDesc = document.querySelector('#workhub-arcade-root .special-hero p');
      if (labDesc) labDesc.textContent = '게임과 작은 실험 기능을 업무 화면과 분리해둔 개인 공간입니다.';
    };

    const previousRender = render;
    render = function () {
      previousRender();
      renameLab();
      if (portalMode === 'home') window.requestAnimationFrame(presentHome);
    };

    const observer = new MutationObserver(() => {
      renameLab();
      if (portalMode === 'home') {
        home.hidden = false;
        appRoot.hidden = true;
        allSpecialRoots().forEach(el => { el.hidden = true; });
      }
    });
    observer.observe(main,{childList:true,subtree:true});

    renameLab();
    presentHome();
  };

  boot();
})();