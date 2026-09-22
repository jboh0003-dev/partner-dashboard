/* Deterministic, frame-rate independent runner simulation; no application data access. */
(function (root) {
  'use strict';

  const stages = ['초록 들판', '노을 사막', '눈꽃 왕국', '밤의 성'];
  const ITEM_SCORE = 250;
  const STAR_SECONDS = 5;

  class RunnerEngine {
    constructor(random = Math.random) {
      this.random = random;
      this.reset();
    }

    reset() {
      this.distance = 0;
      this.coins = 0;
      this.items = 0;
      this.itemCounts = { mushroom: 0, star: 0 };
      this.elapsed = 0;
      this.speed = 260;
      this.stage = 0;
      this.objects = [];
      this.spawnIn = 1.1;
      this.dead = false;
      this.shield = 0;
      this.invincibleFor = 0;
      this.player = {
        x: 90,
        y: 0,
        vy: 0,
        jumps: 0,
        width: 30,
        height: 44,
        spin: 0,
        spinRate: 0,
      };
    }

    get score() {
      return Math.floor(this.distance) + this.coins * 100 + this.items * ITEM_SCORE;
    }

    jump() {
      const p = this.player;
      if (this.dead || p.jumps >= 2) return false;
      if (p.jumps === 0) p.spin = 0;
      p.vy = p.jumps === 0 ? 650 : 580;
      p.spinRate = p.jumps === 0 ? 8.8 : 13.2;
      p.jumps++;
      return true;
    }

    collectItem(kind) {
      if (kind === 'mushroom') {
        this.shield = Math.min(2, this.shield + 1);
        this.itemCounts.mushroom++;
      } else if (kind === 'star') {
        this.invincibleFor = Math.max(this.invincibleFor, STAR_SECONDS);
        this.itemCounts.star++;
      } else {
        return false;
      }
      this.items++;
      return true;
    }

    spawn(width) {
      const r = this.random();
      const tall = this.stage >= 1 && r > .72;
      const h = tall ? 125 : 42 + Math.floor(this.random() * 35);
      const w = 36 + Math.floor(this.random() * 25);
      this.objects.push({
        type: 'obstacle',
        x: width + 60,
        y: 0,
        width: w,
        height: h,
        kind: tall ? 'tower' : 'pipe',
      });

      for (let i = 0; i < 5; i++) {
        const x = width + 15 + i * 38;
        this.objects.push({
          type: 'coin',
          x,
          y: h + 38 + Math.sin(i / 4 * Math.PI) * 42,
          width: 20,
          height: 20,
        });
      }

      // Occasionally offer a high coin route that rewards a second jump.
      if (this.random() > .6) {
        for (let i = 0; i < 3; i++) {
          this.objects.push({
            type: 'coin',
            x: width + 110 + i * 34,
            y: 225,
            width: 20,
            height: 20,
          });
        }
      }

      // Power-ups stay uncommon so that collecting one feels meaningful.
      if (this.random() > .7) {
        const kind = this.random() > .5 ? 'star' : 'mushroom';
        this.objects.push({
          type: 'item',
          kind,
          x: width + 92 + Math.floor(this.random() * 78),
          y: Math.min(220, h + 68),
          width: 26,
          height: 26,
        });
      }

      this.spawnIn = 1.45 + this.random() * .55;
    }

    step(dt, width = 1100) {
      if (this.dead) return;

      // Bound stalls and subdivide collision checks to avoid tunnelling at high speed.
      let remaining = Math.min(Math.max(dt, 0), .1);
      while (remaining > 0 && !this.dead) {
        const d = Math.min(remaining, 1 / 120);
        remaining -= d;
        this.elapsed += d;
        this.invincibleFor = Math.max(0, this.invincibleFor - d);
        this.speed = Math.min(680, 260 + this.distance * .6);
        this.distance += this.speed * d / 10;
        this.stage = Math.floor(this.distance / 250);

        const p = this.player;
        p.vy -= 1750 * d;
        p.y += p.vy * d;
        if (p.y <= 0) {
          p.y = 0;
          p.vy = 0;
          p.jumps = 0;
          p.spin = 0;
          p.spinRate = 0;
        } else {
          p.spin = (p.spin + p.spinRate * d) % (Math.PI * 2);
        }

        this.spawnIn -= d;
        if (this.spawnIn <= 0) this.spawn(width);

        for (const o of this.objects) {
          o.x -= this.speed * d;
          const overlap = p.x + 4 < o.x + o.width
            && p.x + p.width - 4 > o.x
            && p.y + 4 < o.y + o.height
            && p.y + p.height - 4 > o.y;

          if (!overlap || o.taken) continue;

          if (o.type === 'coin') {
            o.taken = true;
            this.coins++;
          } else if (o.type === 'item') {
            o.taken = this.collectItem(o.kind);
          } else if (o.type === 'obstacle') {
            if (this.invincibleFor > 0) {
              o.taken = true;
            } else if (this.shield > 0) {
              this.shield--;
              o.taken = true;
            } else {
              this.dead = true;
            }
          }
        }

        this.objects = this.objects.filter(o => o.x + o.width > -20 && !o.taken);
      }
    }
  }

  const api = { RunnerEngine, stages, ITEM_SCORE, STAR_SECONDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WorkHubRunner = api;
})(typeof window === 'undefined' ? {} : window);
