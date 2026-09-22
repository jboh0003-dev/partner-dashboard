(() => {
  'use strict';
  if (document.getElementById('workhub-kart-crossing-layout-style')) return;

  const style = document.createElement('style');
  style.id = 'workhub-kart-crossing-layout-style';
  style.textContent = `
    .kart-layout{align-items:start}
    .kart-game{align-self:start;width:100%}
    .kart-lounge{height:680px;max-height:min(760px,calc(100vh - 120px));overflow:hidden}
    .kart-panel{min-height:0;overscroll-behavior:contain}
    @media(max-width:900px){
      .kart-layout{align-items:stretch}
      .kart-lounge{height:720px;max-height:none}
    }
    @media(max-width:620px){
      .kart-lounge{height:690px}
    }
  `;
  document.head.appendChild(style);
})();
