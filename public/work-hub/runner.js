(() => {
  'use strict';
  if (document.getElementById('workhub-runner')) return;

  const script = document.createElement('script');
  script.src = '/work-hub/runner-engine.js?v=3';
  script.onload = mount;
  script.onerror = () => console.error('미니게임을 불러오지 못했습니다. 새로고침해주세요.');
  document.body.appendChild(script);

  function mount() {
    const { RunnerEngine, stages } = window.WorkHubRunner;
    const engine = new RunnerEngine();
    const section = document.createElement('section');
    section.id = 'workhub-runner';
    section.className = 'runner';
    section.dataset.version = '3';
    section.setAttribute('aria-label', '슈퍼마리오 미니게임');
    section.innerHTML = `
      <div class="runner-heading">
        <div>
          <div class="runner-kicker">THE ARCADE · 잠깐의 휴식</div>
          <h2>슈퍼마리오 런</h2>
          <p>덤블링 점프로 장애물을 넘고, 버섯과 별 아이템을 모아 기록에 도전하세요.</p>
        </div>
        <div class="runner-controls">
          <button type="button" class="btn primary" id="runner-start">▶ START · 시작</button>
          <button type="button" class="btn" id="runner-pause" disabled>일시정지</button>
          <button type="button" class="btn" id="runner-jump" disabled>Space · 점프</button>
        </div>
      </div>
      <div class="runner-layout">
        <div class="runner-play">
          <div class="runner-hud">
            <span>거리<strong id="runner-distance">0 m</strong></span>
            <span>코인<strong id="runner-coins">0</strong></span>
            <span>점수<strong id="runner-score">0</strong></span>
            <span class="runner-power">아이템<strong id="runner-item">없음</strong></span>
            <span id="runner-stage">STAGE 1 · 초록 들판</span>
          </div>
          <canvas
            id="runner-canvas"
            width="1100"
            height="360"
            tabindex="0"
            aria-keyshortcuts="Space ArrowUp"
            role="img"
            aria-label="오른쪽으로 달리는 마리오. 스페이스 또는 위쪽 화살표로 점프하고, 공중에서 한 번 더 누르면 이단 점프합니다."
          ></canvas>
          <div class="runner-message" id="runner-message" role="status" aria-live="polite">
            <b>READY TO RUN?</b>
            <span>START를 누른 뒤 스페이스바로 점프하세요.</span>
          </div>
        </div>
        <aside class="runner-records">
          <h3>명예의 기록판</h3>
          <p id="runner-storage-note">이 브라우저의 최고 기록 TOP 5</p>
          <ol id="runner-scores"></ol>
        </aside>
      </div>
      <div class="runner-foot">Space / ↑ / 화면 터치 = 점프 · 공중에서 한 번 더 = 이단 점프 · 점프 중 자동 덤블링 · 🍄 보호막 · ⭐ 5초 무적 · P = 일시정지</div>`;

    document.querySelector('.main').appendChild(section);

    const $ = id => section.querySelector('#' + id);
    const canvas = $('runner-canvas');
    const ctx = canvas.getContext('2d');
    let running = false;
    let paused = false;
    let raf = 0;
    let last = 0;
    let width = 1100;
    let records = [];
    let storageOK = true;
    const KEY = 'workhub_runner_scores_v2';
    const LEGACY_KEY = 'workhub_runner_scores_v1';

    function readRecords() {
      try {
        const raw = localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY) || '[]';
        const a = JSON.parse(raw);
        return Array.isArray(a)
          ? a.filter(r => r && Number.isSafeInteger(r.score) && r.score >= 0 && Number.isFinite(r.distance) && r.distance >= 0 && Number.isSafeInteger(r.coins) && r.coins >= 0 && typeof r.date === 'string')
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
          : [];
      } catch {
        storageOK = false;
        return [];
      }
    }

    records = readRecords();

    function leaderboard() {
      $('runner-scores').replaceChildren();
      if (!records.length) {
        const li = document.createElement('li');
        li.textContent = '첫 기록의 주인공이 되어보세요.';
        $('runner-scores').appendChild(li);
      }
      records.forEach((r, i) => {
        const li = document.createElement('li');
        const left = document.createElement('span');
        const right = document.createElement('strong');
        const small = document.createElement('small');
        const itemText = r.items ? ` · ${r.items}아이템` : '';
        left.textContent = `${i + 1}. ${Math.floor(r.distance)}m · ${r.coins}코인${itemText}`;
        small.textContent = r.date;
        left.appendChild(small);
        right.textContent = r.score.toLocaleString() + '점';
        li.append(left, right);
        $('runner-scores').appendChild(li);
      });
      if (!storageOK) $('runner-storage-note').textContent = '저장 공간에 접근할 수 없어 이번 화면에서만 기록됩니다.';
    }

    function message(title, sub) {
      $('runner-message').hidden = false;
      $('runner-message').querySelector('b').textContent = title;
      $('runner-message').querySelector('span').textContent = sub;
    }

    function itemLabel() {
      if (engine.invincibleFor > 0) return `⭐ 무적 ${engine.invincibleFor.toFixed(1)}초`;
      if (engine.shield > 0) return `🍄 보호막${engine.shield > 1 ? ` ×${engine.shield}` : ''}`;
      return '없음';
    }

    function hud() {
      $('runner-distance').textContent = Math.floor(engine.distance) + ' m';
      $('runner-coins').textContent = engine.coins;
      $('runner-score').textContent = engine.score.toLocaleString();
      $('runner-item').textContent = itemLabel();
      $('runner-item').classList.toggle('active', engine.invincibleFor > 0 || engine.shield > 0);
      $('runner-stage').textContent = `STAGE ${engine.stage + 1} · ${stages[engine.stage % stages.length]}`;
    }

    function finish() {
      running = false;
      paused = false;
      cancelAnimationFrame(raf);
      $('runner-start').disabled = false;
      $('runner-start').textContent = '↻ 다시 시작';
      $('runner-pause').disabled = true;
      $('runner-jump').disabled = true;
      // Once storage fails, keep one in-memory history; do not merge it with
      // the same persisted entries again on every game over.
      const persisted = storageOK ? readRecords() : null;
      records = [
        ...(storageOK ? persisted : records),
        {
          score: engine.score,
          distance: Math.floor(engine.distance),
          coins: engine.coins,
          items: engine.items,
          date: new Date().toLocaleDateString('ko-KR'),
        },
      ].sort((a, b) => b.score - a.score).slice(0, 5);
      try {
        localStorage.setItem(KEY, JSON.stringify(records));
      } catch {
        storageOK = false;
      }
      leaderboard();
      message('GAME OVER', `${engine.score.toLocaleString()}점 · ${Math.floor(engine.distance)}m · ${engine.coins}코인 · ${engine.items}아이템`);
    }

    function pause() {
      if (!running || paused) return;
      paused = true;
      cancelAnimationFrame(raf);
      $('runner-pause').textContent = '계속하기';
      $('runner-jump').disabled = true;
      message('잠시 쉬어가기', '계속하기를 누르면 이어서 달립니다.');
    }

    function resume() {
      if (!running || !paused) return;
      paused = false;
      last = 0;
      $('runner-pause').textContent = '일시정지';
      $('runner-jump').disabled = false;
      $('runner-message').hidden = true;
      canvas.focus({ preventScroll: true });
      raf = requestAnimationFrame(frame);
    }

    function jump() {
      if (running && !paused && engine.jump()) {
        canvas.focus({ preventScroll: true });
      }
    }

    $('runner-start').onclick = () => {
      cancelAnimationFrame(raf);
      engine.reset();
      running = true;
      paused = false;
      last = 0;
      $('runner-message').hidden = true;
      $('runner-start').disabled = true;
      $('runner-pause').disabled = false;
      $('runner-pause').textContent = '일시정지';
      $('runner-jump').disabled = false;
      canvas.focus({ preventScroll: true });
      hud();
      raf = requestAnimationFrame(frame);
    };

    $('runner-pause').onclick = () => paused ? resume() : pause();
    $('runner-jump').onclick = jump;

    canvas.addEventListener('pointerdown', e => {
      if (running && !paused) {
        e.preventDefault();
        jump();
      }
    });

    function isInteractiveTarget(target) {
      return target instanceof Element && Boolean(target.closest('input,textarea,select,button,[contenteditable="true"]'));
    }

    document.addEventListener('keydown', e => {
      if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey || isInteractiveTarget(e.target)) return;
      if (!section.contains(document.activeElement) || !section.getClientRects().length) return;
      if (['Space', 'ArrowUp'].includes(e.code) && running && !paused) {
        e.preventDefault();
        if (!e.repeat) jump();
        return;
      }
      if (e.code === 'KeyP' && running && !e.repeat) {
        e.preventDefault();
        paused ? resume() : pause();
      }
    }, { capture: true });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pause();
    });
    window.addEventListener('blur', pause);
    new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) pause();
    }, { threshold: 0 }).observe(canvas);

    function resize() {
      if (!canvas.clientWidth) return;
      const nextWidth = Math.max(640, Math.min(1100, canvas.clientWidth));
      if (nextWidth !== width && running) pause();
      width = nextWidth;
      // Match the CSS box to the simulation ratio at every width.
      canvas.style.aspectRatio = `${width} / 360`;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = 360 * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }

    new ResizeObserver(resize).observe(canvas);

    const palettes = [
      ['#8bcfdf', '#d8ecda', '#76a876', '#41674b', '#a67646'],
      ['#edb082', '#f5d49c', '#c18b62', '#905c52', '#98684c'],
      ['#9daecd', '#e6e8ed', '#a9bacc', '#768ba9', '#94a9b5'],
      ['#242a49', '#4b4262', '#494366', '#302f48', '#6f6278'],
    ];

    function rect(x, y, w, h, color) {
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x), Math.round(y), w, h);
    }

    function drawMushroom(x, y) {
      rect(x + 5, y + 15, 16, 10, '#f6d2a7');
      rect(x + 3, y + 8, 20, 10, '#e6423d');
      rect(x + 7, y + 4, 12, 5, '#e6423d');
      rect(x + 5, y + 7, 5, 5, '#fff3df');
      rect(x + 16, y + 7, 5, 5, '#fff3df');
      rect(x + 9, y + 18, 2, 3, '#4b332c');
      rect(x + 16, y + 18, 2, 3, '#4b332c');
    }

    function drawStar(x, y, t) {
      const cx = x + 13;
      const cy = y + 13;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.sin(t * 4) * .12);
      ctx.fillStyle = '#ffd947';
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 12 : 5.5;
        const a = -Math.PI / 2 + i * Math.PI / 5;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      rect(-5, -2, 2, 4, '#4f4226');
      rect(3, -2, 2, 4, '#4f4226');
      ctx.restore();
    }

    function drawPowerAura(x, y, t) {
      if (engine.invincibleFor > 0) {
        ctx.save();
        ctx.globalAlpha = .25 + Math.sin(t * 18) * .1;
        ctx.fillStyle = '#fff36b';
        ctx.beginPath();
        ctx.arc(x + 16, y + 22, 31 + Math.sin(t * 10) * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      if (engine.shield > 0) {
        ctx.save();
        ctx.globalAlpha = .72;
        ctx.strokeStyle = '#8be8ff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x + 16, y + 22, 27 + Math.sin(t * 6), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    function draw() {
      const pal = palettes[engine.stage % palettes.length];
      const ground = 304;
      const scroll = engine.distance * 10;
      const grad = ctx.createLinearGradient(0, 0, 0, 304);
      grad.addColorStop(0, pal[0]);
      grad.addColorStop(1, pal[1]);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, 360);

      ctx.fillStyle = engine.stage % 4 === 3 ? '#f5e4bd' : '#fff4c9';
      ctx.beginPath();
      ctx.arc(width - 95, 62, 24, 0, Math.PI * 2);
      ctx.fill();

      for (let i = -1; i < 9; i++) {
        const x = i * 210 - (scroll * .17 % 210);
        ctx.fillStyle = pal[2];
        ctx.beginPath();
        ctx.moveTo(x, ground);
        if (engine.stage % 4 === 2) {
          ctx.lineTo(x + 110, 105);
          ctx.lineTo(x + 235, ground);
          ctx.fill();
          ctx.fillStyle = '#fff8ed';
          ctx.beginPath();
          ctx.moveTo(x + 110, 105);
          ctx.lineTo(x + 83, 155);
          ctx.lineTo(x + 125, 145);
          ctx.lineTo(x + 143, 157);
          ctx.closePath();
          ctx.fill();
        } else if (engine.stage % 4 === 3) {
          rect(x, 155, 120, 149, pal[2]);
          for (let k = 0; k < 4; k++) rect(x + k * 32, 142, 20, 16, pal[2]);
          rect(x + 45, 212, 30, 92, pal[3]);
        } else {
          ctx.quadraticCurveTo(x + 90, engine.stage % 4 === 1 ? 150 : 110, x + 240, ground);
          ctx.fill();
        }
      }

      for (let i = -1; i < 7; i++) {
        const x = i * 250 - (scroll * .4 % 250);
        if (engine.stage % 4 === 0) {
          rect(x + 24, 236, 12, 68, '#7a6248');
          ctx.fillStyle = pal[3];
          ctx.beginPath();
          ctx.arc(x + 30, 221, 35, 0, Math.PI * 2);
          ctx.fill();
        } else if (engine.stage % 4 === 1) {
          rect(x + 25, 238, 12, 66, pal[3]);
          rect(x + 7, 254, 20, 10, pal[3]);
          rect(x + 7, 238, 9, 20, pal[3]);
        } else if (engine.stage % 4 === 2) {
          ctx.fillStyle = '#f4f8fc';
          for (let k = 0; k < 6; k++) ctx.fillRect((x + k * 39 + scroll * .1) % width, 45 + k * 33, 3, 3);
        } else {
          rect(x, 265, 180, 39, pal[3]);
        }
      }

      rect(0, ground, width, 56, pal[4]);
      rect(0, ground, width, 7, engine.stage % 4 === 2 ? '#f7fafc' : engine.stage % 4 === 0 ? '#567b44' : '#d1ae79');
      for (let i = -1; i < width / 48 + 1; i++) {
        const x = i * 48 - (scroll % 48);
        rect(x, ground + 26, 46, 2, '#ffffff25');
        rect(x, ground + 8, 2, 18, '#00000022');
        rect(x + 24, ground + 28, 2, 26, '#00000022');
      }

      for (const o of engine.objects) {
        const y = ground - o.y - o.height;
        if (o.type === 'coin') {
          ctx.fillStyle = '#ae701c';
          ctx.beginPath();
          ctx.ellipse(o.x + 10, y + 10, 9, 11, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffdf63';
          ctx.beginPath();
          ctx.ellipse(o.x + 10, y + 9, 7, 9, 0, 0, Math.PI * 2);
          ctx.fill();
          rect(o.x + 9, y + 3, 2, 12, '#bf8620');
        } else if (o.type === 'item') {
          if (o.kind === 'mushroom') drawMushroom(o.x, y);
          else drawStar(o.x, y, engine.elapsed);
        } else if (o.kind === 'pipe') {
          rect(o.x, y, o.width, o.height, '#377946');
          rect(o.x + 5, y + 8, 7, o.height - 8, '#79b962');
          rect(o.x - 4, y, o.width + 8, 14, '#285c38');
          rect(o.x - 2, y + 2, o.width + 4, 8, '#69a65b');
        } else {
          rect(o.x, y, o.width, o.height, '#96654e');
          for (let j = 0; j < o.height; j += 22) {
            rect(o.x, y + j, o.width, 2, '#e2b58a');
            rect(o.x + (j % 44 === 0 ? 12 : 30), y + j, 2, 22, '#583c38');
          }
        }
      }

      const marioY = ground - engine.player.y - 44;
      drawPowerAura(engine.player.x, marioY, engine.elapsed);
      drawMario(
        engine.player.x,
        marioY,
        engine.elapsed,
        engine.player.y > 0,
        engine.player.spin,
        engine.invincibleFor > 0,
      );

      if (running && !paused) {
        ctx.fillStyle = '#ffffffba';
        ctx.font = '12px sans-serif';
        ctx.fillText(`${(engine.speed / 260).toFixed(1)}× SPEED`, 18, 26);
      }
    }

    const sprite = [
      '.....RRRRRR.....',
      '....RRRRRRRRRR..',
      '....BBBSSBS.....',
      '...BSBSSSBS.....',
      '...BSBBSSSSBSS..',
      '....BSSSSBBBB...',
      '.....SSSSSSS....',
      '....RRBRRRB.....',
      '...RRRBRRRBRR...',
      '..SSRRBBBBBRSS..',
      '..SSSBBYBBYBSS..',
      '.....BBBBBBB....',
      '....BBBBBBBB....',
      '....BBB..BBB....',
      '...BBB....BBB...',
      '..KKKK....KKKK..',
    ];

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    function drawMario(x, y, t, air, spin, starPower) {
      const colors = { R: '#e43a34', B: '#225baa', S: '#ffd2a0', K: '#593d33', Y: '#f8d65b' };
      ctx.save();
      if (air && !reducedMotion.matches) {
        ctx.translate(x + 16, y + 22);
        ctx.rotate(spin);
        ctx.translate(-(x + 16), -(y + 22));
      }
      const starFlash = starPower; // Steady gold avoids rapid flashing during invincibility.
      sprite.forEach((row, j) => [...row].forEach((ch, i) => {
        if (ch === '.') return;
        let dx = 0;
        if (j > 12 && !air) dx = Math.sin(t * 20) * (i < 8 ? 2 : -2);
        let color = colors[ch];
        if (j >= 2 && j <= 5 && ch === 'B') color = '#593d33';
        if (starFlash && ch !== 'K') color = ch === 'S' ? '#fff2ad' : '#ffd84f';
        rect(x + i * 2 + dx, y + j * 2.75, 2.2, 2.9, color);
      }));
      ctx.restore();
    }

    function frame(time) {
      if (!running || paused) return;
      const dt = last ? (time - last) / 1000 : 0;
      last = time;
      engine.step(dt, width);
      hud();
      draw();
      if (engine.dead) finish();
      else raf = requestAnimationFrame(frame);
    }

    leaderboard();
    resize();
  }
})();
