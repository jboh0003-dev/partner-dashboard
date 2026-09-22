(() => {
  'use strict';

  if (document.getElementById('workhub-kart-crossing')) return;

  const ENGINE_ID = 'workhub-kart-crossing-engine';
  const ENGINE_SRC = '/work-hub/kart-crossing-engine.js?v=1';

  if (window.WorkHubKartCrossing) mount();
  else {
    const script = document.createElement('script');
    script.id = ENGINE_ID;
    script.src = ENGINE_SRC;
    script.async = false;
    script.onload = mount;
    script.onerror = () => console.error('카트 크로싱 엔진을 불러오지 못했습니다.');
    document.body.appendChild(script);
  }

  function mount() {
    const api = window.WorkHubKartCrossing;
    if (!api || document.getElementById('workhub-kart-crossing')) return;

    const {
      COLS,
      PITY_LIMIT,
      PULL_COST,
      TEN_PULL_COST,
      RARITIES,
      CHARACTERS,
      CHARACTER_MAP,
      normalizeProfile,
      pullCharacters,
      upgradeCost,
      upgradeCharacter,
      equipCharacter,
      effectivePerks,
      KartCrossingEngine,
    } = api;

    const PROFILE_KEY = 'workhub_kart_crossing_profile_v1';
    const RARITY_RANK = { SSR: 4, SR: 3, R: 2, N: 1 };
    const RARITY_CLASS = { N: 'normal', R: 'rare', SR: 'super', SSR: 'ultra' };
    const vehicleColors = ['#ef5a5a', '#4d7fe3', '#e4b540', '#37a77a', '#9b65d8', '#e78544'];

    function readProfileSource() {
      try {
        if (typeof S !== 'undefined') {
          S.settings = S.settings || {};
          return S.settings.kartCrossing || null;
        }
        return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
      } catch {
        return null;
      }
    }

    let profile = normalizeProfile(readProfileSource());
    let profileHash = JSON.stringify(profile);

    function persistProfile(next, messageText = '') {
      profile = normalizeProfile(next);
      profileHash = JSON.stringify(profile);
      try {
        if (typeof S !== 'undefined') {
          S.settings = S.settings || {};
          S.settings.kartCrossing = profile;
          if (typeof save === 'function') save();
        } else {
          localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
        }
      } catch (error) {
        console.error(error);
      }
      renderProfile();
      if (messageText && typeof toast === 'function') toast(messageText);
    }

    if (!readProfileSource()) persistProfile(profile);

    const style = document.createElement('style');
    style.id = 'workhub-kart-crossing-style';
    style.textContent = `
      .kart-crossing{margin:26px 32px 48px;border:1px solid var(--line);border-top:4px double #af8b53;background:var(--card);border-radius:5px;overflow:hidden;box-shadow:0 18px 54px rgba(52,37,28,.08)}
      .kart-head{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:22px 24px;background:linear-gradient(135deg,color-mix(in srgb,var(--card) 88%,#b99d62),var(--card));border-bottom:1px solid var(--line)}
      .kart-kicker{font-size:11px;letter-spacing:3px;color:var(--muted);font-weight:900}.kart-head h2{font-family:Georgia,'Noto Serif KR',Batang,serif;font-size:27px;margin:5px 0 7px}.kart-head p{margin:0;color:var(--muted);font-size:14px;line-height:1.55}.kart-head-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
      .kart-layout{display:grid;grid-template-columns:minmax(0,1fr) 390px;min-height:610px}.kart-game{position:relative;min-width:0;background:#152639;border-right:1px solid var(--line)}
      .kart-hud{display:flex;align-items:center;gap:20px;min-height:51px;padding:11px 18px;background:#30292a;color:#f3e5cc;font-size:13px;font-variant-numeric:tabular-nums;flex-wrap:wrap}.kart-hud strong{color:#f4cc70;margin-left:6px}.kart-hud .kart-hud-char{margin-left:auto;max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#d8c8ad}
      .kart-stage{position:relative;min-height:0}.kart-stage canvas{display:block;width:100%;height:auto;aspect-ratio:960/560;touch-action:none;outline-offset:-5px!important;background:#1f3a4d}.kart-message{position:absolute;inset:50% auto auto 50%;transform:translate(-50%,-50%);z-index:4;min-width:290px;max-width:calc(100% - 36px);padding:20px 24px;border:1px solid #d0a953;background:#201c1aee;color:#fff1d6;text-align:center;box-shadow:0 18px 55px rgba(0,0,0,.34);pointer-events:none}.kart-message b{display:block;font-family:Georgia,Batang,serif;font-size:24px;margin-bottom:7px}.kart-message span{display:block;font-size:13px;line-height:1.55}.kart-message em{display:block;margin-top:8px;color:#f4cc70;font-style:normal;font-weight:900}
      .kart-controls{display:grid;grid-template-columns:repeat(3,58px);grid-template-rows:repeat(2,48px);gap:7px;justify-content:center;padding:13px;background:#282223;border-top:1px solid #4f403a}.kart-controls button{border:1px solid #75604d;background:#443739;color:#f4e4ca;border-radius:6px;font-weight:950;cursor:pointer;touch-action:manipulation}.kart-controls button:active{transform:translateY(1px);background:#624d50}.kart-controls [data-move="up"]{grid-column:2}.kart-controls [data-move="left"]{grid-column:1;grid-row:2}.kart-controls [data-move="down"]{grid-column:2;grid-row:2}.kart-controls [data-move="right"]{grid-column:3;grid-row:2}
      .kart-lounge{display:flex;flex-direction:column;min-width:0;background:color-mix(in srgb,var(--card) 94%,#c8aa71)}.kart-lounge-top{padding:18px 18px 13px;border-bottom:1px solid var(--line)}.kart-lounge-title{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.kart-lounge-title h3{font-family:Georgia,Batang,serif;margin:0;font-size:21px}.kart-balance{display:flex;align-items:center;gap:6px;padding:7px 10px;border:1px solid #bd9349;background:#fff6d9;color:#765315;border-radius:999px;font-size:12px;font-weight:950;white-space:nowrap}.dark .kart-balance{background:#40351c;color:#ffe09a;border-color:#715b2d}
      .kart-selected{display:grid;grid-template-columns:72px minmax(0,1fr);gap:12px;align-items:center;margin-top:14px;padding:11px;border:1px solid var(--line);background:var(--card);border-radius:8px}.kart-avatar{width:72px;height:72px;border-radius:8px;overflow:hidden;border:1px solid rgba(0,0,0,.12);background:#ddd}.kart-avatar svg{display:block;width:100%;height:100%}.kart-selected b{display:block;font-size:15px}.kart-selected small{display:block;margin-top:4px;color:var(--muted);font-size:11px;line-height:1.4}.kart-rarity{display:inline-flex;align-items:center;justify-content:center;min-width:33px;padding:3px 6px;border-radius:4px;font-size:10px;font-weight:1000;margin-right:5px}.kart-rarity.normal{background:#e7e2d8;color:#62594e}.kart-rarity.rare{background:#dce8ff;color:#2d5caa}.kart-rarity.super{background:#f0e0ff;color:#7b31ac}.kart-rarity.ultra{background:linear-gradient(135deg,#ffe9a1,#ffc562);color:#7a4b00;box-shadow:0 0 14px #f6c84b66}
      .kart-tabs{display:grid;grid-template-columns:1fr 1fr;padding:10px 12px 0;gap:7px}.kart-tabs button{border:1px solid var(--line);background:var(--card);color:var(--muted);padding:9px;border-radius:5px;font-weight:900;cursor:pointer}.kart-tabs button.active{background:#69404b;color:#fff;border-color:#8f6570}
      .kart-panel{padding:14px 16px 18px;overflow:auto;flex:1;min-height:0}.kart-gacha-machine{position:relative;display:grid;place-items:center;min-height:180px;border:1px solid #bda67d;border-radius:10px;background:radial-gradient(circle at 50% 38%,#fff9dc 0 20%,#e5d2a6 21% 48%,#7a4b55 49% 100%);overflow:hidden}.kart-gacha-machine:before,.kart-gacha-machine:after{content:'';position:absolute;border-radius:50%;background:#fff8ce77}.kart-gacha-machine:before{width:95px;height:95px;left:16px;top:17px}.kart-gacha-machine:after{width:70px;height:70px;right:22px;bottom:12px}.kart-capsule{position:relative;z-index:2;width:104px;height:104px;border-radius:52px;border:6px solid #f8e4af;background:linear-gradient(180deg,#ff6675 0 48%,#fff3dc 49% 100%);box-shadow:0 15px 28px rgba(42,22,25,.34),inset 0 -8px 12px rgba(0,0,0,.08);animation:kartCapsuleFloat 2s ease-in-out infinite}.kart-capsule:after{content:'?';position:absolute;inset:24px;display:grid;place-items:center;border-radius:50%;background:#fff4d9;color:#7b3d48;font:bold 34px Georgia}.kart-capsule.free{animation:kartCapsuleFloat 1.4s ease-in-out infinite,kartCapsuleGlow 1.5s ease-in-out infinite}.kart-machine-label{position:absolute;left:12px;bottom:10px;z-index:3;padding:5px 8px;background:#2d2023cc;color:#ffe8a6;border-radius:4px;font-size:10px;font-weight:900;letter-spacing:1px}
      @keyframes kartCapsuleFloat{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-9px) rotate(2deg)}}@keyframes kartCapsuleGlow{0%,100%{box-shadow:0 15px 28px rgba(42,22,25,.34),0 0 0 0 #ffe07088}50%{box-shadow:0 15px 28px rgba(42,22,25,.34),0 0 0 13px #ffe07000}}
      .kart-pity{margin-top:13px}.kart-pity-head{display:flex;justify-content:space-between;gap:10px;font-size:11px;color:var(--muted)}.kart-pity-bar{height:8px;margin-top:6px;border-radius:999px;background:#d7cbb8;overflow:hidden}.kart-pity-bar i{display:block;height:100%;background:linear-gradient(90deg,#7c56d9,#f0b53c);transition:width .25s ease}.kart-pull-actions{display:grid;grid-template-columns:1fr 1.25fr;gap:8px;margin-top:13px}.kart-pull-actions button{min-height:48px}.kart-pull-actions .free-ten{background:linear-gradient(135deg,#7049ca,#b24a83);border-color:#a772d0;color:#fff;animation:kartFreePulse 1.7s ease-in-out infinite}.kart-pull-actions small{display:block;font-size:9px;font-weight:700;opacity:.82;margin-top:3px}@keyframes kartFreePulse{50%{filter:brightness(1.18)}}.kart-odds{width:100%;margin-top:8px}.kart-earn-tip{margin-top:11px;padding:10px;border:1px dashed var(--line);border-radius:7px;color:var(--muted);font-size:11px;line-height:1.5}
      .kart-collection-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}.kart-collection-head b{font-size:13px}.kart-collection-head span{font-size:11px;color:var(--muted)}.kart-collection{display:grid;grid-template-columns:1fr 1fr;gap:8px}.kart-char-card{position:relative;border:1px solid var(--line);background:var(--card);border-radius:8px;padding:8px;min-width:0}.kart-char-card.locked{filter:saturate(.18);opacity:.72}.kart-char-card.equipped{outline:2px solid #8d5b66;outline-offset:-2px}.kart-char-card .kart-avatar{width:100%;height:auto;aspect-ratio:1/1}.kart-char-name{display:block;margin-top:7px;font-size:11px;font-weight:950;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.kart-char-meta{margin-top:4px;color:var(--muted);font-size:9px;line-height:1.45}.kart-card-actions{display:grid;grid-template-columns:1fr;gap:5px;margin-top:7px}.kart-card-actions button{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:5px;padding:6px;font-size:9px;font-weight:900;cursor:pointer}.kart-card-actions button.primary{background:#69404b;color:#fff;border-color:#69404b}.kart-card-actions button:disabled{opacity:.45;cursor:not-allowed}.kart-lock{position:absolute;inset:8px 8px auto auto;z-index:2;padding:4px 6px;border-radius:4px;background:#292321cc;color:#fff;font-size:9px;font-weight:900}
      .kart-modal-bg{position:fixed;inset:0;z-index:12000;display:grid;place-items:center;padding:18px;background:rgba(13,10,12,.78);backdrop-filter:blur(7px)}.kart-modal{width:min(900px,100%);max-height:92vh;overflow:auto;border:1px solid #ae8c59;border-radius:12px;background:#fffaf0;color:#302a27;box-shadow:0 30px 100px rgba(0,0,0,.48);padding:22px}.dark .kart-modal{background:#2b2523;color:#f1e7d6}.kart-modal h3{font-family:Georgia,Batang,serif;font-size:25px;margin:0 0 6px}.kart-modal>p{color:var(--muted);font-size:12px;line-height:1.5}.kart-reveal-stage{display:grid;place-items:center;min-height:270px}.kart-reveal-capsule{width:150px;height:150px;border-radius:50%;border:8px solid #ffe9b1;background:linear-gradient(180deg,#7954d4 0 48%,#fff4d6 49% 100%);position:relative;box-shadow:0 20px 50px #5f3eb166;animation:kartRevealShake .65s ease-in-out infinite}.kart-reveal-capsule:after{content:'OPEN';position:absolute;inset:35px;display:grid;place-items:center;border-radius:50%;background:#fff6de;color:#603a8c;font:bold 16px Georgia;letter-spacing:2px}.kart-reveal-button{margin-top:18px;min-width:190px}.kart-reveal-cards{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:11px;margin-top:16px}.kart-result-card{position:relative;border:2px solid #c9bca7;border-radius:10px;background:#fff;padding:9px;text-align:center;transform:translateY(16px) scale(.92);opacity:0;animation:kartCardReveal .45s cubic-bezier(.2,.8,.2,1) forwards}.dark .kart-result-card{background:#342d2a}.kart-result-card.rare{border-color:#6c9eed;box-shadow:0 0 22px #6c9eed55}.kart-result-card.super{border-color:#af68db;box-shadow:0 0 26px #af68db66}.kart-result-card.ultra{border-color:#f4be3f;box-shadow:0 0 34px #f4be3f88;background:linear-gradient(160deg,#fffaf0,#fff0b8)}.dark .kart-result-card.ultra{background:linear-gradient(160deg,#473a26,#5b4724)}.kart-result-card .kart-avatar{width:100%;height:auto;aspect-ratio:1/1}.kart-result-card b{display:block;margin-top:7px;font-size:12px}.kart-result-card small{display:block;margin-top:4px;color:var(--muted);font-size:9px;line-height:1.35}.kart-new{position:absolute;left:7px;top:7px;z-index:3;padding:4px 6px;border-radius:4px;background:#e54858;color:#fff;font-size:9px;font-weight:1000}.kart-reveal-summary{text-align:center;margin-top:14px;font-size:12px;color:var(--muted)}.kart-modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}.kart-odds-table{width:100%;border-collapse:collapse;margin-top:14px;font-size:13px}.kart-odds-table th,.kart-odds-table td{padding:10px;border-bottom:1px solid var(--line);text-align:left}.kart-odds-table td:last-child,.kart-odds-table th:last-child{text-align:right}.kart-odds-note{margin-top:12px;padding:11px;border:1px dashed var(--line);font-size:11px;line-height:1.55;color:var(--muted)}
      @keyframes kartRevealShake{0%,100%{transform:rotate(-4deg) scale(1)}50%{transform:rotate(5deg) scale(1.04)}}@keyframes kartCardReveal{to{transform:translateY(0) scale(1);opacity:1}}
      @media(max-width:1180px){.kart-layout{grid-template-columns:minmax(0,1fr) 340px}.kart-reveal-cards{grid-template-columns:repeat(4,minmax(0,1fr))}}
      @media(max-width:900px){.kart-crossing{margin:22px 16px 38px}.kart-head{align-items:flex-start;flex-direction:column}.kart-head-actions{justify-content:flex-start}.kart-layout{grid-template-columns:1fr}.kart-game{border-right:0;border-bottom:1px solid var(--line)}.kart-lounge{min-height:620px}.kart-collection{grid-template-columns:repeat(3,1fr)}.kart-reveal-cards{grid-template-columns:repeat(3,minmax(0,1fr))}}
      @media(max-width:620px){.kart-crossing{margin:18px 12px}.kart-head{padding:17px}.kart-head h2{font-size:23px}.kart-hud{gap:10px;font-size:11px}.kart-hud .kart-hud-char{width:100%;margin-left:0}.kart-message{min-width:230px;padding:15px}.kart-controls{grid-template-columns:repeat(3,64px)}.kart-lounge-top{padding:14px}.kart-panel{padding:12px}.kart-collection{grid-template-columns:1fr 1fr}.kart-modal{padding:15px}.kart-reveal-cards{grid-template-columns:repeat(2,minmax(0,1fr))}.kart-pull-actions{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);

    const section = document.createElement('section');
    section.id = 'workhub-kart-crossing';
    section.className = 'kart-crossing';
    section.dataset.version = '1';
    section.setAttribute('aria-label', '카트 크로싱 미니게임과 캐릭터 캡슐');
    section.innerHTML = `
      <div class="kart-head">
        <div>
          <div class="kart-kicker">CROSSING CIRCUIT · CHARACTER CAPSULE</div>
          <h2>카트 크로싱</h2>
          <p>차선을 한 칸씩 건너며 볼트를 모으세요. 뽑은 캐릭터를 카트에 태우면 고유 특성이 실제 주행에 적용됩니다.</p>
        </div>
        <div class="kart-head-actions">
          <button type="button" class="btn primary" id="kart-start">▶ 새 주행</button>
          <button type="button" class="btn" id="kart-pause" disabled>일시정지</button>
          <button type="button" class="btn" id="kart-open-gacha">🎁 캐릭터 뽑기</button>
        </div>
      </div>
      <div class="kart-layout">
        <div class="kart-game">
          <div class="kart-hud">
            <span>거리<strong id="kart-distance">0칸</strong></span>
            <span>주행 볼트<strong id="kart-run-bolts">0</strong></span>
            <span>점수<strong id="kart-score">0</strong></span>
            <span>보호막<strong id="kart-shield">0</strong></span>
            <span class="kart-hud-char" id="kart-hud-char"></span>
          </div>
          <div class="kart-stage">
            <canvas id="kart-canvas" width="960" height="560" tabindex="0" role="img" aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight W A S D" aria-label="위에서 내려다보는 카트 횡단 게임. 방향키 또는 WASD로 한 칸씩 이동합니다."></canvas>
            <div class="kart-message" id="kart-message" role="status" aria-live="polite">
              <b>READY TO CROSS?</b>
              <span>새 주행을 누른 뒤 방향키 또는 WASD로 이동하세요.</span>
              <em>도로에서 모은 볼트로 캐릭터를 뽑을 수 있습니다.</em>
            </div>
          </div>
          <div class="kart-controls" aria-label="모바일 이동 버튼">
            <button type="button" data-move="up" aria-label="앞으로">▲</button>
            <button type="button" data-move="left" aria-label="왼쪽">◀</button>
            <button type="button" data-move="down" aria-label="뒤로">▼</button>
            <button type="button" data-move="right" aria-label="오른쪽">▶</button>
          </div>
        </div>
        <aside class="kart-lounge">
          <div class="kart-lounge-top">
            <div class="kart-lounge-title">
              <div><h3>캐릭터 캡슐</h3><div class="kart-kicker" style="margin-top:4px;letter-spacing:1.5px">GARAGE GACHA</div></div>
              <span class="kart-balance">⚙ <strong id="kart-balance">0</strong> 볼트</span>
            </div>
            <div class="kart-selected" id="kart-selected"></div>
          </div>
          <div class="kart-tabs">
            <button type="button" class="active" data-kart-tab="gacha">가챠</button>
            <button type="button" data-kart-tab="garage">차고</button>
          </div>
          <div class="kart-panel" id="kart-gacha-panel">
            <div class="kart-gacha-machine">
              <div class="kart-capsule" id="kart-capsule"></div>
              <span class="kart-machine-label">SSR 천장 40회 · 10연 R↑ 보장</span>
            </div>
            <div class="kart-pity">
              <div class="kart-pity-head"><span id="kart-pity-label">SSR 천장</span><strong id="kart-pity-count">0 / 40</strong></div>
              <div class="kart-pity-bar"><i id="kart-pity-fill" style="width:0%"></i></div>
            </div>
            <div class="kart-pull-actions">
              <button type="button" class="btn" id="kart-pull-one">1회 뽑기<small>${PULL_COST} 볼트</small></button>
              <button type="button" class="btn primary" id="kart-pull-ten">10연 뽑기<small>${TEN_PULL_COST} 볼트</small></button>
            </div>
            <button type="button" class="btn kart-odds" id="kart-odds">확률 및 중복 보상 보기</button>
            <div class="kart-earn-tip">주행 종료 시 이동 거리와 수집 볼트에 따라 가챠 볼트를 받습니다. 중복 캐릭터는 승급 조각과 일부 볼트로 자동 변환됩니다.</div>
          </div>
          <div class="kart-panel" id="kart-garage-panel" hidden>
            <div class="kart-collection-head"><b>보유 캐릭터</b><span id="kart-collection-count"></span></div>
            <div class="kart-collection" id="kart-collection"></div>
          </div>
        </aside>
      </div>
    `;

    const main = document.querySelector('.main');
    if (!main) return;
    main.appendChild(section);

    const $ = (id) => section.querySelector('#' + id);
    const canvas = $('kart-canvas');
    const ctx = canvas.getContext('2d');
    const engine = new KartCrossingEngine();
    let running = false;
    let paused = false;
    let raf = 0;
    let last = 0;
    let logicalWidth = 960;
    let logicalHeight = 560;
    let cameraY = 0;
    let activePanel = 'gacha';
    let audioContext = null;

    function rarityClass(rarity) {
      return RARITY_CLASS[rarity] || 'normal';
    }

    function faceParts(character) {
      const c = character.color;
      const a = character.accent;
      const dark = '#3b3331';
      const earMap = {
        rabbit: `<rect x="19" y="5" width="10" height="28" rx="5" fill="${c}"/><rect x="51" y="5" width="10" height="28" rx="5" fill="${c}"/><rect x="22" y="9" width="4" height="19" rx="2" fill="${a}"/><rect x="54" y="9" width="4" height="19" rx="2" fill="${a}"/>`,
        fox: `<path d="M15 32 19 8 36 26Z" fill="${c}"/><path d="M65 32 61 8 44 26Z" fill="${c}"/><path d="M20 25 22 15 30 26Z" fill="${a}"/><path d="M60 25 58 15 50 26Z" fill="${a}"/>`,
        cat: `<path d="M14 33 20 12 35 27Z" fill="${c}"/><path d="M66 33 60 12 45 27Z" fill="${c}"/>`,
        panda: `<circle cx="20" cy="25" r="11" fill="${dark}"/><circle cx="60" cy="25" r="11" fill="${dark}"/>`,
        chick: `<path d="M33 23 39 8 44 23 51 11 52 29Z" fill="#e6a51f"/>`,
        raccoon: `<circle cx="20" cy="25" r="10" fill="${c}"/><circle cx="60" cy="25" r="10" fill="${c}"/>`,
        koala: `<circle cx="17" cy="31" r="14" fill="${c}"/><circle cx="63" cy="31" r="14" fill="${c}"/><circle cx="17" cy="31" r="8" fill="${a}"/><circle cx="63" cy="31" r="8" fill="${a}"/>`,
        dog: `<ellipse cx="16" cy="34" rx="11" ry="18" fill="${c}"/><ellipse cx="64" cy="34" rx="11" ry="18" fill="${c}"/>`,
        penguin: `<ellipse cx="16" cy="39" rx="9" ry="20" fill="${c}"/><ellipse cx="64" cy="39" rx="9" ry="20" fill="${c}"/>`,
        tiger: `<path d="M14 34 20 13 35 28Z" fill="${c}"/><path d="M66 34 60 13 45 28Z" fill="${c}"/><path d="M34 23 39 12 44 23" fill="${dark}"/>`,
        dragon: `<path d="M12 34 20 9 34 28Z" fill="${a}"/><path d="M68 34 60 9 46 28Z" fill="${a}"/><path d="M32 22 40 7 48 22Z" fill="${c}"/>`,
        capybara: `<circle cx="20" cy="27" r="8" fill="${c}"/><circle cx="60" cy="27" r="8" fill="${c}"/>`,
      };
      const extra = character.species === 'raccoon'
        ? `<path d="M18 43 Q40 27 62 43 L58 55 Q40 42 22 55Z" fill="${dark}" opacity=".72"/>`
        : character.species === 'tiger'
          ? `<path d="M27 31 33 40 28 43Z M53 31 47 40 52 43Z" fill="${dark}"/>`
          : character.species === 'penguin'
            ? `<ellipse cx="40" cy="48" rx="18" ry="19" fill="${a}"/>`
            : '';
      return { ears: earMap[character.species] || '', extra };
    }

    function avatarSvg(character, locked = false) {
      const { ears, extra } = faceParts(character);
      const rarity = rarityClass(character.rarity);
      const bg = character.rarity === 'SSR' ? '#f6d66e' : character.rarity === 'SR' ? '#c9a1e5' : character.rarity === 'R' ? '#99bdf0' : '#d7cfbf';
      return `<svg viewBox="0 0 80 80" aria-hidden="true" data-rarity="${rarity}">
        <rect width="80" height="80" rx="8" fill="${bg}"/>
        <circle cx="12" cy="12" r="18" fill="#fff" opacity=".22"/>
        ${ears}
        <ellipse cx="40" cy="43" rx="27" ry="24" fill="${character.color}"/>
        ${extra}
        <ellipse cx="31" cy="42" rx="3" ry="4" fill="#342c2a"/><ellipse cx="49" cy="42" rx="3" ry="4" fill="#342c2a"/>
        <ellipse cx="40" cy="52" rx="11" ry="8" fill="${character.accent}" opacity=".92"/>
        <circle cx="40" cy="49" r="3" fill="#342c2a"/>
        <rect x="10" y="61" width="60" height="13" rx="5" fill="${character.kart}"/>
        <rect x="17" y="58" width="46" height="9" rx="4" fill="${character.kart}"/>
        <circle cx="19" cy="74" r="4" fill="#252525"/><circle cx="61" cy="74" r="4" fill="#252525"/>
        ${locked ? '<rect width="80" height="80" rx="8" fill="#201c1a" opacity=".66"/><text x="40" y="48" text-anchor="middle" font-size="28" font-weight="900" fill="#fff">?</text>' : ''}
      </svg>`;
    }

    function selectedCharacter() {
      return CHARACTER_MAP[profile.equipped] || CHARACTERS[0];
    }

    function selectedMarkup() {
      const character = selectedCharacter();
      const owned = profile.owned[character.id];
      return `
        <div class="kart-avatar">${avatarSvg(character)}</div>
        <div>
          <b><span class="kart-rarity ${rarityClass(character.rarity)}">${character.rarity}</span>${character.name} · ★${owned?.stars || 1}</b>
          <small>${character.perkLabel}</small>
          <small>${character.tagline}</small>
        </div>`;
    }

    function renderGarage() {
      const ownedCount = Object.keys(profile.owned).filter((id) => CHARACTER_MAP[id]).length;
      $('kart-collection-count').textContent = `${ownedCount} / ${CHARACTERS.length}`;
      const ordered = [...CHARACTERS].sort((a, b) => RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity] || a.name.localeCompare(b.name, 'ko'));
      $('kart-collection').innerHTML = ordered.map((character) => {
        const owned = profile.owned[character.id];
        const equipped = profile.equipped === character.id;
        const cost = owned && owned.stars < 5 ? upgradeCost(owned.stars) : 0;
        return `<article class="kart-char-card ${owned ? '' : 'locked'} ${equipped ? 'equipped' : ''}">
          ${owned ? '' : '<span class="kart-lock">미보유</span>'}
          <div class="kart-avatar">${avatarSvg(character, !owned)}</div>
          <span class="kart-char-name"><span class="kart-rarity ${rarityClass(character.rarity)}">${character.rarity}</span>${character.name}</span>
          <div class="kart-char-meta">${owned ? `★${owned.stars} · 조각 ${owned.shards} · ${owned.copies}회 획득` : character.perkLabel}</div>
          <div class="kart-card-actions">
            ${owned ? `<button type="button" class="${equipped ? '' : 'primary'}" data-kart-equip="${character.id}" ${equipped ? 'disabled' : ''}>${equipped ? '장착 중' : '카트에 장착'}</button>` : ''}
            ${owned && owned.stars < 5 ? `<button type="button" data-kart-upgrade="${character.id}" ${owned.shards < cost ? 'disabled' : ''}>★ 승급 · ${cost}조각</button>` : owned ? '<button type="button" disabled>최대 ★5</button>' : ''}
          </div>
        </article>`;
      }).join('');

      section.querySelectorAll('[data-kart-equip]').forEach((button) => {
        button.onclick = () => {
          const result = equipCharacter(profile, button.dataset.kartEquip);
          if (!result.ok) return;
          persistProfile(result.profile, '캐릭터를 카트에 장착했습니다.');
          draw();
        };
      });

      section.querySelectorAll('[data-kart-upgrade]').forEach((button) => {
        button.onclick = () => {
          const result = upgradeCharacter(profile, button.dataset.kartUpgrade);
          if (!result.ok) {
            if (typeof toast === 'function') toast(result.error === 'NOT_ENOUGH_SHARDS' ? '승급 조각이 부족합니다.' : '더 이상 승급할 수 없습니다.');
            return;
          }
          persistProfile(result.profile, `★${result.profile.owned[button.dataset.kartUpgrade].stars} 승급 완료`);
          playTone(620, .12, 'triangle');
          draw();
        };
      });
    }

    function renderProfile() {
      $('kart-balance').textContent = profile.bolts.toLocaleString('ko-KR');
      $('kart-selected').innerHTML = selectedMarkup();
      $('kart-hud-char').textContent = `장착: ${selectedCharacter().name}`;
      $('kart-pity-count').textContent = `${profile.pity} / ${PITY_LIMIT}`;
      $('kart-pity-fill').style.width = `${profile.pity / PITY_LIMIT * 100}%`;
      $('kart-pity-label').textContent = profile.pity >= PITY_LIMIT - 1 ? '다음 뽑기 SSR 확정' : `SSR 확정까지 ${PITY_LIMIT - profile.pity}회`;
      const freeTen = !profile.freeTenClaimed;
      const capsule = $('kart-capsule');
      capsule.classList.toggle('free', freeTen);
      $('kart-pull-one').disabled = profile.bolts < PULL_COST;
      $('kart-pull-ten').disabled = !freeTen && profile.bolts < TEN_PULL_COST;
      $('kart-pull-ten').classList.toggle('free-ten', freeTen);
      $('kart-pull-ten').innerHTML = freeTen
        ? '첫 10연 무료<small>R 이상 1명 보장</small>'
        : `10연 뽑기<small>${TEN_PULL_COST} 볼트 · R 이상 보장</small>`;
      renderGarage();
    }

    function setPanel(panel) {
      activePanel = panel === 'garage' ? 'garage' : 'gacha';
      section.querySelectorAll('[data-kart-tab]').forEach((button) => button.classList.toggle('active', button.dataset.kartTab === activePanel));
      $('kart-gacha-panel').hidden = activePanel !== 'gacha';
      $('kart-garage-panel').hidden = activePanel !== 'garage';
    }

    function showMessage(title, body, emphasis = '') {
      const message = $('kart-message');
      message.hidden = false;
      message.querySelector('b').textContent = title;
      message.querySelector('span').textContent = body;
      message.querySelector('em').textContent = emphasis;
    }

    function hideMessage() {
      $('kart-message').hidden = true;
    }

    function updateHud() {
      $('kart-distance').textContent = `${engine.maxRow}칸`;
      $('kart-run-bolts').textContent = engine.runBolts;
      $('kart-score').textContent = engine.score.toLocaleString('ko-KR');
      $('kart-shield').textContent = engine.player.shield;
    }

    function pauseMario() {
      const button = document.getElementById('runner-pause');
      if (button && !button.disabled && button.textContent.includes('일시정지')) button.click();
    }

    function startGame() {
      pauseMario();
      cancelAnimationFrame(raf);
      const perks = effectivePerks(profile);
      engine.reset(perks);
      running = true;
      paused = false;
      last = 0;
      cameraY = 0;
      $('kart-start').disabled = true;
      $('kart-start').textContent = '주행 중';
      $('kart-pause').disabled = false;
      $('kart-pause').textContent = '일시정지';
      hideMessage();
      updateHud();
      canvas.focus({ preventScroll: true });
      raf = requestAnimationFrame(frame);
    }

    function pauseGame(silent = false) {
      if (!running || paused) return;
      paused = true;
      engine.paused = true;
      cancelAnimationFrame(raf);
      $('kart-pause').textContent = '계속하기';
      if (!silent) showMessage('PIT STOP', '잠시 정차했습니다. 계속하기를 누르면 이어서 달립니다.', '현재 기록은 유지됩니다.');
    }

    function resumeGame() {
      if (!running || !paused) return;
      pauseMario();
      paused = false;
      engine.paused = false;
      last = 0;
      $('kart-pause').textContent = '일시정지';
      hideMessage();
      canvas.focus({ preventScroll: true });
      raf = requestAnimationFrame(frame);
    }

    function finishGame() {
      if (!running) return;
      running = false;
      paused = false;
      cancelAnimationFrame(raf);
      const reward = engine.rewardBolts;
      profile.bolts += reward;
      profile.bestDistance = Math.max(profile.bestDistance, engine.maxRow);
      profile.totalRuns += 1;
      profile.totalBoltsEarned += reward;
      persistProfile(profile);
      $('kart-start').disabled = false;
      $('kart-start').textContent = '↻ 다시 주행';
      $('kart-pause').disabled = true;
      showMessage('CRASH!', `${engine.maxRow}칸 전진 · 주행 볼트 ${engine.runBolts}개`, `보상 +${reward} 볼트 · 최고 ${profile.bestDistance}칸`);
      playTone(150, .2, 'sawtooth');
    }

    function movePlayer(dx, dy) {
      if (!running || paused) return;
      if (engine.move(dx, dy)) {
        canvas.focus({ preventScroll: true });
        playTone(250 + Math.max(0, dy) * 70, .035, 'square', .025);
      }
    }

    function ensureAudio() {
      if (audioContext) return audioContext;
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return null;
      try {
        audioContext = new Audio();
        return audioContext;
      } catch {
        return null;
      }
    }

    function playTone(frequency, duration = .08, type = 'sine', volume = .045, delay = 0) {
      const audio = ensureAudio();
      if (!audio) return;
      const start = audio.currentTime + delay;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + .01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + .02);
    }

    function playRevealSounds(results) {
      results.forEach((result, index) => {
        const base = result.rarity === 'SSR' ? 920 : result.rarity === 'SR' ? 760 : result.rarity === 'R' ? 580 : 410;
        playTone(base, result.rarity === 'SSR' ? .22 : .1, result.rarity === 'SSR' ? 'sine' : 'triangle', .05, index * .09);
        if (result.rarity === 'SSR') playTone(1220, .28, 'sine', .04, index * .09 + .08);
      });
    }

    function resultCard(result, index) {
      const character = result.character;
      const duplicateText = result.isNew
        ? '새 캐릭터 획득'
        : `중복 · +${result.shardsAwarded}조각 · +${result.boltsRebated}볼트`;
      return `<article class="kart-result-card ${rarityClass(result.rarity)}" style="animation-delay:${index * 70}ms">
        ${result.isNew ? '<span class="kart-new">NEW</span>' : ''}
        <div class="kart-avatar">${avatarSvg(character)}</div>
        <b><span class="kart-rarity ${rarityClass(result.rarity)}">${result.rarity}</span>${character.name}</b>
        <small>${duplicateText}</small>
      </article>`;
    }

    function openReveal(pull) {
      const modal = document.createElement('div');
      modal.className = 'kart-modal-bg';
      modal.id = 'kartRevealModal';
      const costText = pull.freeTen ? '첫 10연 무료' : pull.cost ? `${pull.cost} 볼트 사용` : '무료';
      modal.innerHTML = `<div class="kart-modal">
        <h3>캐릭터 캡슐</h3>
        <p>${costText} · SSR 천장은 뽑기 결과에 즉시 반영됩니다.</p>
        <div class="kart-reveal-stage" id="kartRevealStage">
          <div><div class="kart-reveal-capsule"></div><button type="button" class="btn primary kart-reveal-button" id="kartRevealOpen">캡슐 열기</button></div>
        </div>
      </div>`;
      document.body.appendChild(modal);
      modal.querySelector('#kartRevealOpen').onclick = () => {
        const highest = [...pull.results].sort((a, b) => RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity])[0];
        modal.querySelector('#kartRevealStage').outerHTML = `<div>
          <div class="kart-reveal-cards">${pull.results.map(resultCard).join('')}</div>
          <div class="kart-reveal-summary">최고 등급 <span class="kart-rarity ${rarityClass(highest.rarity)}">${highest.rarity}</span> · 현재 천장 ${profile.pity} / ${PITY_LIMIT}</div>
          <div class="kart-modal-actions"><button type="button" class="btn" id="kartRevealGarage">차고에서 보기</button><button type="button" class="btn primary" id="kartRevealClose">확인</button></div>
        </div>`;
        playRevealSounds(pull.results);
        modal.querySelector('#kartRevealClose').onclick = () => modal.remove();
        modal.querySelector('#kartRevealGarage').onclick = () => {
          modal.remove();
          setPanel('garage');
          section.scrollIntoView({ behavior: 'smooth', block: 'center' });
        };
      };
      modal.addEventListener('click', (event) => {
        if (event.target === modal) modal.remove();
      });
    }

    function doPull(count) {
      const pull = pullCharacters(profile, count, { useFreeTen: true }, Math.random);
      if (!pull.ok) {
        if (typeof toast === 'function') toast('볼트가 부족합니다. 카트 주행으로 볼트를 모아주세요.');
        setPanel('gacha');
        return;
      }
      persistProfile(pull.profile);
      openReveal(pull);
    }

    function openOdds() {
      const modal = document.createElement('div');
      modal.className = 'kart-modal-bg';
      modal.innerHTML = `<div class="kart-modal" style="width:min(620px,100%)">
        <h3>캐릭터 캡슐 확률</h3>
        <p>모든 뽑기는 게임에서 획득한 무료 볼트만 사용합니다.</p>
        <table class="kart-odds-table"><thead><tr><th>등급</th><th>중복 보상</th><th>기본 확률</th></tr></thead><tbody>
          ${['SSR','SR','R','N'].map((rarity) => `<tr><td><span class="kart-rarity ${rarityClass(rarity)}">${rarity}</span>${RARITIES[rarity].name}</td><td>${RARITIES[rarity].shards}조각 + ${RARITIES[rarity].rebate}볼트</td><td>${(RARITIES[rarity].rate * 100).toFixed(0)}%</td></tr>`).join('')}
        </tbody></table>
        <div class="kart-odds-note">10연 뽑기는 최소 R 등급 1명을 보장합니다. SSR이 ${PITY_LIMIT - 1}회 연속 나오지 않으면 다음 뽑기에서 SSR이 확정되며, SSR 획득 시 천장 카운트는 0으로 초기화됩니다. 중복으로 받은 조각은 ★5까지 캐릭터 승급에 사용됩니다.</div>
        <div class="kart-modal-actions"><button type="button" class="btn primary" id="kartOddsClose">확인</button></div>
      </div>`;
      document.body.appendChild(modal);
      modal.querySelector('#kartOddsClose').onclick = () => modal.remove();
      modal.onclick = (event) => { if (event.target === modal) modal.remove(); };
    }

    function resize() {
      const cssWidth = Math.max(520, canvas.clientWidth || 960);
      logicalWidth = Math.min(1100, cssWidth);
      logicalHeight = Math.round(logicalWidth * 560 / 960);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(logicalWidth * dpr);
      canvas.height = Math.round(logicalHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }

    function drawRoadRow(row, y, rowHeight, tileWidth, left) {
      if (row.type === 'road') {
        ctx.fillStyle = '#3b4047';
        ctx.fillRect(0, y, logicalWidth, rowHeight + 1);
        ctx.fillStyle = '#e7d47d';
        ctx.fillRect(0, y + 2, logicalWidth, 2);
        ctx.fillRect(0, y + rowHeight - 4, logicalWidth, 2);
        ctx.fillStyle = '#f7f3dd88';
        for (let x = -40; x < logicalWidth + 50; x += 78) ctx.fillRect(x, y + rowHeight / 2 - 1, 35, 2);
      } else if (row.type === 'boost') {
        ctx.fillStyle = '#315c75';
        ctx.fillRect(0, y, logicalWidth, rowHeight + 1);
        ctx.fillStyle = '#74d8e8';
        for (let col = 0; col < COLS; col++) {
          const x = left + col * tileWidth + tileWidth / 2;
          ctx.beginPath();
          ctx.moveTo(x, y + 12);
          ctx.lineTo(x - 9, y + 27);
          ctx.lineTo(x - 3, y + 27);
          ctx.lineTo(x - 3, y + 43);
          ctx.lineTo(x + 3, y + 43);
          ctx.lineTo(x + 3, y + 27);
          ctx.lineTo(x + 9, y + 27);
          ctx.closePath();
          ctx.fill();
        }
      } else {
        ctx.fillStyle = row.type === 'checkpoint' ? '#67965d' : '#5f8b55';
        ctx.fillRect(0, y, logicalWidth, rowHeight + 1);
        ctx.fillStyle = '#77a96d';
        for (let i = 0; i < 8; i++) {
          const bx = ((row.seed * 997 + i * 143) % 1) * logicalWidth;
          ctx.beginPath();
          ctx.arc(bx, y + 10 + (i % 3) * 17, 3 + (i % 2), 0, Math.PI * 2);
          ctx.fill();
        }
        if (row.type === 'checkpoint') {
          ctx.fillStyle = '#fff5cf';
          ctx.font = `900 ${Math.max(11, rowHeight * .18)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText('CHECKPOINT', logicalWidth / 2, y + rowHeight * .62);
        }
      }
    }

    function drawVehicle(vehicle, row, y, rowHeight, tileWidth, left) {
      const x = left + vehicle.x * tileWidth;
      const width = vehicle.width * tileWidth;
      const bodyHeight = rowHeight * .58;
      const top = y + (rowHeight - bodyHeight) / 2;
      ctx.save();
      if (row.direction < 0) {
        ctx.translate(x + width / 2, 0);
        ctx.scale(-1, 1);
        ctx.translate(-(x + width / 2), 0);
      }
      ctx.fillStyle = '#242629';
      ctx.fillRect(x + width * .08, top - 4, width * .22, 5);
      ctx.fillRect(x + width * .7, top - 4, width * .22, 5);
      ctx.fillRect(x + width * .08, top + bodyHeight - 1, width * .22, 5);
      ctx.fillRect(x + width * .7, top + bodyHeight - 1, width * .22, 5);
      ctx.fillStyle = vehicleColors[vehicle.colorIndex % vehicleColors.length];
      const radius = Math.min(8, bodyHeight * .2);
      ctx.beginPath();
      ctx.roundRect(x, top, width, bodyHeight, radius);
      ctx.fill();
      ctx.fillStyle = '#cce7ef';
      ctx.fillRect(x + width * .15, top + bodyHeight * .18, width * .26, bodyHeight * .64);
      ctx.fillStyle = '#e8f4f7';
      ctx.fillRect(x + width * .71, top + bodyHeight * .23, width * .14, bodyHeight * .54);
      if (vehicle.kind === 'taxi') {
        ctx.fillStyle = '#ffe476';
        ctx.fillRect(x + width * .45, top + 2, width * .13, 5);
      }
      if (vehicle.kind === 'truck') {
        ctx.fillStyle = '#ffffff33';
        ctx.fillRect(x + width * .43, top + 4, width * .2, bodyHeight - 8);
      }
      ctx.restore();
    }

    function drawBolt(col, y, rowHeight, tileWidth, left, bob, taken) {
      if (taken) return;
      const x = left + (col + .5) * tileWidth;
      const cy = y + rowHeight * .5 + Math.sin(engine.elapsed * 5 + bob) * 4;
      ctx.save();
      ctx.translate(x, cy);
      ctx.rotate(engine.elapsed * 1.7 + bob);
      ctx.fillStyle = '#f7cc55';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#9d6b13';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#8b5e16';
      for (let i = 0; i < 6; i++) {
        ctx.rotate(Math.PI / 3);
        ctx.fillRect(7, -2, 5, 4);
      }
      ctx.fillStyle = '#fff0a8';
      ctx.beginPath();
      ctx.arc(-2, -3, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawDriverHead(character, x, y, scale) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.fillStyle = character.color;
      const species = character.species;
      if (['rabbit'].includes(species)) {
        ctx.fillRect(-10, -20, 7, 16);
        ctx.fillRect(3, -20, 7, 16);
      } else if (['fox', 'cat', 'tiger', 'dragon'].includes(species)) {
        ctx.beginPath(); ctx.moveTo(-12, -5); ctx.lineTo(-9, -18); ctx.lineTo(-1, -8); ctx.fill();
        ctx.beginPath(); ctx.moveTo(12, -5); ctx.lineTo(9, -18); ctx.lineTo(1, -8); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(-9, -6, 5, 0, Math.PI * 2); ctx.arc(9, -6, 5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = character.accent;
      ctx.beginPath(); ctx.ellipse(0, 5, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#332b29';
      ctx.beginPath(); ctx.arc(-5, -2, 2, 0, Math.PI * 2); ctx.arc(5, -2, 2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    function drawPlayer(tileWidth, rowHeight, left) {
      const character = selectedCharacter();
      const x = left + (engine.player.x + .5) * tileWidth;
      const y = logicalHeight - 74 - (engine.player.y - cameraY) * rowHeight - rowHeight / 2;
      const flash = engine.invulnerableFor > 0 && Math.floor(engine.elapsed * 12) % 2 === 0;
      const scale = Math.min(1.1, tileWidth / 68);
      ctx.save();
      ctx.translate(x, y);
      if (engine.player.moveProgress < 1) ctx.translate(0, -Math.sin(engine.player.moveProgress * Math.PI) * 9);
      if (flash) ctx.globalAlpha = .55;
      if (engine.player.shield > 0) {
        ctx.strokeStyle = '#7ee6ff';
        ctx.lineWidth = 3;
        ctx.globalAlpha = .72;
        ctx.beginPath();
        ctx.arc(0, 0, 29 * scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = flash ? .55 : 1;
      }
      ctx.fillStyle = '#242629';
      ctx.fillRect(-25 * scale, -19 * scale, 8 * scale, 13 * scale);
      ctx.fillRect(17 * scale, -19 * scale, 8 * scale, 13 * scale);
      ctx.fillRect(-25 * scale, 8 * scale, 8 * scale, 13 * scale);
      ctx.fillRect(17 * scale, 8 * scale, 8 * scale, 13 * scale);
      ctx.fillStyle = character.kart;
      ctx.beginPath();
      ctx.roundRect(-22 * scale, -17 * scale, 44 * scale, 36 * scale, 8 * scale);
      ctx.fill();
      ctx.fillStyle = '#ffffff55';
      ctx.fillRect(-14 * scale, -12 * scale, 28 * scale, 7 * scale);
      drawDriverHead(character, 0, -9 * scale, .7 * scale);
      ctx.fillStyle = '#f6d568';
      ctx.fillRect(-12 * scale, 13 * scale, 24 * scale, 4 * scale);
      ctx.restore();
    }

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, logicalWidth, logicalHeight);
      const rowHeight = Math.max(48, logicalHeight / 9.3);
      const tileWidth = Math.min(82, (logicalWidth - 72) / COLS);
      const left = (logicalWidth - tileWidth * COLS) / 2;
      const targetCamera = Math.max(0, engine.player.y - 2.1);
      cameraY += (targetCamera - cameraY) * .16;

      const sky = ctx.createLinearGradient(0, 0, 0, logicalHeight);
      sky.addColorStop(0, '#8dc8d8');
      sky.addColorStop(1, '#dce8c9');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, logicalWidth, logicalHeight);

      const visibleRows = [...engine.rows]
        .filter((row) => {
          const y = logicalHeight - 74 - (row.index - cameraY) * rowHeight;
          return y > -rowHeight && y < logicalHeight + rowHeight;
        })
        .sort((a, b) => b.index - a.index);

      for (const row of visibleRows) {
        const y = logicalHeight - 74 - (row.index - cameraY) * rowHeight - rowHeight;
        drawRoadRow(row, y, rowHeight, tileWidth, left);
        for (const collectible of row.collectibles) drawBolt(collectible.col, y, rowHeight, tileWidth, left, collectible.bob, collectible.taken);
        if (row.type === 'road') {
          for (const vehicle of row.vehicles) drawVehicle(vehicle, row, y, rowHeight, tileWidth, left);
        }
      }

      ctx.strokeStyle = '#ffffff14';
      for (let col = 0; col <= COLS; col++) {
        const x = left + col * tileWidth;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, logicalHeight);
        ctx.stroke();
      }

      drawPlayer(tileWidth, rowHeight, left);

      ctx.fillStyle = '#0e1825aa';
      ctx.fillRect(12, 12, 125, 29);
      ctx.fillStyle = '#fff3d3';
      ctx.font = '800 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('▲ 앞으로 · WASD', 23, 31);

      if (!running && engine.dead) {
        ctx.fillStyle = '#ffca5d99';
        for (let i = 0; i < 12; i++) {
          const a = i / 12 * Math.PI * 2;
          const radius = 30 + (i % 3) * 8;
          ctx.beginPath();
          ctx.arc(left + (engine.player.x + .5) * tileWidth + Math.cos(a) * radius, logicalHeight - 74 - (engine.player.y - cameraY) * rowHeight - rowHeight / 2 + Math.sin(a) * radius, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    function frame(time) {
      if (!running || paused) return;
      const dt = last ? (time - last) / 1000 : 0;
      last = time;
      engine.step(dt);
      updateHud();
      draw();
      if (engine.dead) finishGame();
      else raf = requestAnimationFrame(frame);
    }

    function isInteractiveTarget(target) {
      return target instanceof Element && Boolean(target.closest('input,textarea,select,button,[contenteditable="true"]'));
    }

    document.addEventListener('keydown', (event) => {
      if (!running || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || isInteractiveTarget(event.target)) return;
      if (!section.contains(document.activeElement) || !section.getClientRects().length) return;
      if (event.code === 'KeyP' && !event.repeat) {
        event.preventDefault();
        paused ? resumeGame() : pauseGame();
        return;
      }
      if (paused) return;
      const moves = {
        ArrowUp: [0, 1], KeyW: [0, 1],
        ArrowDown: [0, -1], KeyS: [0, -1],
        ArrowLeft: [-1, 0], KeyA: [-1, 0],
        ArrowRight: [1, 0], KeyD: [1, 0],
      };
      const move = moves[event.code];
      if (move) {
        event.preventDefault();
        if (!event.repeat) movePlayer(move[0], move[1]);
      }
    }, { capture: true });

    document.addEventListener('click', (event) => {
      if (event.target instanceof Element && event.target.closest('#runner-start')) pauseGame(true);
    }, { capture: true });

    canvas.addEventListener('pointerdown', (event) => {
      if (!running || paused) return;
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      if (y < .36) movePlayer(0, 1);
      else if (y > .68) movePlayer(0, -1);
      else if (x < .5) movePlayer(-1, 0);
      else movePlayer(1, 0);
    });

    section.querySelectorAll('[data-move]').forEach((button) => {
      const action = () => {
        const map = { up: [0, 1], down: [0, -1], left: [-1, 0], right: [1, 0] };
        const move = map[button.dataset.move];
        movePlayer(move[0], move[1]);
      };
      button.addEventListener('pointerdown', (event) => { event.preventDefault(); action(); });
    });

    section.querySelectorAll('[data-kart-tab]').forEach((button) => button.onclick = () => setPanel(button.dataset.kartTab));
    $('kart-start').onclick = startGame;
    $('kart-pause').onclick = () => paused ? resumeGame() : pauseGame();
    $('kart-open-gacha').onclick = () => { setPanel('gacha'); section.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
    $('kart-pull-one').onclick = () => doPull(1);
    $('kart-pull-ten').onclick = () => doPull(10);
    $('kart-odds').onclick = openOdds;

    document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(true); });
    window.addEventListener('blur', () => pauseGame(true));
    new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) pauseGame(true);
    }, { threshold: 0 }).observe(canvas);

    new ResizeObserver(resize).observe(canvas);

    window.setInterval(() => {
      const fresh = normalizeProfile(readProfileSource());
      const nextHash = JSON.stringify(fresh);
      if (nextHash !== profileHash && !document.getElementById('kartRevealModal')) {
        profile = fresh;
        profileHash = nextHash;
        renderProfile();
        draw();
      }
    }, 5000);

    renderProfile();
    updateHud();
    resize();
  }
})();
