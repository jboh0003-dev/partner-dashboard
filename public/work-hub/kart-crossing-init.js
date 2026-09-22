(() => {
  'use strict';
  try {
    if (typeof S === 'undefined') return;
    S.settings = S.settings || {};
    if (!S.settings.kartCrossing) S.settings.kartCrossing = {};
  } catch (error) {
    console.error('카트 크로싱 프로필 초기화 오류', error);
  }
})();
