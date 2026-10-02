(() => {
  'use strict';

  if (window.__bokdeskHomeControllerLoaded) return;
  window.__bokdeskHomeControllerLoaded = true;

  const entry = document.getElementById('bokdesk-entry');
  const readyState = document.getElementById('bokdeskReadyState');
  const launchers = [...document.querySelectorAll('[data-bokdesk-open]')];

  if (!entry || !readyState || launchers.length !== 3) return;

  let launchersBound = false;
  let attempts = 0;

  function setHomeVisible(visible) {
    document.body.classList.toggle('bokdesk-home-mode', visible);
    if (visible) {
      document.title = 'BokDesk';
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }

  function renameInternalNavigation() {
    const brand = document.querySelector('.brand');
    if (brand) {
      brand.innerHTML = 'BokDesk<small>PRIVATE WORK HUB</small>';
      brand.setAttribute('role', 'button');
      brand.setAttribute('tabindex', '0');
      brand.setAttribute('aria-label', 'BokDesk 홈으로 이동');
      brand.title = 'BokDesk 홈';
    }

    const labNav = document.querySelector('#workhub-arcade-nav span');
    if (labNav) labNav.textContent = 'Lab';

    const labRoot = document.getElementById('workhub-arcade-root');
    const labTitle = labRoot?.querySelector('.special-hero h2');
    const labKicker = labRoot?.querySelector('.special-kicker');
    const labDesc = labRoot?.querySelector('.special-hero p');
    if (labTitle) labTitle.textContent = 'Lab';
    if (labKicker) labKicker.textContent = 'BOKDESK · PRIVATE LAB';
    if (labDesc) labDesc.textContent = '게임과 작은 실험 기능을 업무 화면과 분리해둔 개인 공간입니다.';
  }

  function clickDashboard() {
    const button = document.querySelector('.nav button[data-view="dashboard"]');
    if (button instanceof HTMLButtonElement) button.click();
  }

  function showHome() {
    clickDashboard();
    setHomeVisible(true);
    launchers.forEach(button => button.blur());
  }

  function openSchedule() {
    setHomeVisible(false);
    clickDashboard();
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) pageTitle.textContent = '일계표';
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function openLive() {
    const button = document.getElementById('workhub-live-nav');
    if (!(button instanceof HTMLButtonElement)) return;
    setHomeVisible(false);
    button.click();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function openLab() {
    const button = document.getElementById('workhub-arcade-nav');
    if (!(button instanceof HTMLButtonElement)) return;
    setHomeVisible(false);
    button.click();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function bindLaunchers() {
    if (launchersBound) return;
    launchersBound = true;

    launchers.forEach(button => {
      button.addEventListener('click', () => {
        if (button.disabled) return;
        const target = button.dataset.bokdeskOpen;
        if (target === 'schedule') openSchedule();
        if (target === 'live') openLive();
        if (target === 'lab') openLab();
      });
    });

    document.querySelectorAll('[data-bokdesk-home]').forEach(button => {
      button.addEventListener('click', showHome);
    });
  }

  function bindBrand() {
    const brand = document.querySelector('.brand');
    if (!brand || brand.dataset.bokdeskHomeBound === 'true') return;
    brand.dataset.bokdeskHomeBound = 'true';
    brand.addEventListener('click', showHome);
    brand.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      showHome();
    });
  }

  function boot() {
    attempts += 1;
    renameInternalNavigation();
    bindLaunchers();
    bindBrand();

    const coreReady = typeof window.render === 'function';
    const themeReady = window.__workhubKakaoThemeLoaded === true;
    const liveReady = document.getElementById('workhub-live-nav') instanceof HTMLButtonElement;
    const labReady = document.getElementById('workhub-arcade-nav') instanceof HTMLButtonElement;

    const scheduleButton = document.querySelector('[data-bokdesk-open="schedule"]');
    const liveButton = document.querySelector('[data-bokdesk-open="live"]');
    const labButton = document.querySelector('[data-bokdesk-open="lab"]');

    if (scheduleButton instanceof HTMLButtonElement) scheduleButton.disabled = !(coreReady && themeReady);
    if (liveButton instanceof HTMLButtonElement) liveButton.disabled = !(themeReady && liveReady);
    if (labButton instanceof HTMLButtonElement) labButton.disabled = !(themeReady && labReady);

    if (coreReady && themeReady && liveReady && labReady) {
      readyState.textContent = '준비 완료';
      readyState.dataset.ready = 'true';
      setHomeVisible(true);
      return;
    }

    if (coreReady && themeReady) {
      readyState.textContent = '일정관리 준비 완료 · 나머지 불러오는 중';
    } else {
      readyState.textContent = '화면 준비 중…';
    }

    if (attempts > 60 && !(coreReady && themeReady)) {
      readyState.textContent = '일정 화면 준비가 지연되고 있습니다';
      readyState.title = '새로고침 후에도 계속되면 연결 상태를 확인해주세요.';
    }

    window.setTimeout(boot, 120);
  }

  setHomeVisible(true);
  bindLaunchers();
  boot();
})();