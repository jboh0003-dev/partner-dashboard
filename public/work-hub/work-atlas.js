(() => {
  'use strict';

  // Legacy Work Atlas has been retired. Keep this file as a tombstone so
  // older cached Work Hub loaders cannot resurrect the removed Atlas UI.
  window.__workhubAtlasDisabled = true;
  window.__workhubAtlasLoaded = true;

  const cleanup = () => {
    document.getElementById('workAtlas')?.remove();
    document.getElementById('workhub-atlas-css')?.remove();
    document.getElementById('workhub-atlas-model')?.remove();

    document.querySelectorAll('.work-atlas,.workhome-switch,.atlas-existing').forEach((el) => el.remove());

    const nav = document.querySelector('.nav button[data-view="dashboard"] span');
    if (nav) nav.textContent = '일계표';

    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle && typeof view !== 'undefined' && view === 'dashboard') pageTitle.textContent = '일계표';
  };

  cleanup();
  window.setTimeout(cleanup, 0);
  window.setTimeout(cleanup, 250);
})();