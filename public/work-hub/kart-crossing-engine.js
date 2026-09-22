/* Work Hub Kart Crossing — deterministic game and gacha rules. */
(function (root) {
  'use strict';

  const COLS = 9;
  const PITY_LIMIT = 40;
  const PULL_COST = 100;
  const TEN_PULL_COST = 900;

  const RARITIES = {
    N: { label: 'N', name: '노멀', rate: 0.72, shards: 10, rebate: 18 },
    R: { label: 'R', name: '레어', rate: 0.22, shards: 22, rebate: 45 },
    SR: { label: 'SR', name: '슈퍼 레어', rate: 0.05, shards: 55, rebate: 110 },
    SSR: { label: 'SSR', name: '울트라 레어', rate: 0.01, shards: 140, rebate: 320 },
  };

  const CHARACTERS = [
    {
      id: 'rookie-rabbit', name: '루키 래빗', species: 'rabbit', rarity: 'N',
      color: '#f2b8c8', accent: '#fff2f5', kart: '#d14d72',
      perk: { reward: 0.03 }, perkLabel: '주행 보상 +3%',
      tagline: '첫 출발은 언제나 가볍게!',
    },
    {
      id: 'lime-fox', name: '라임 폭스', species: 'fox', rarity: 'N',
      color: '#b8dc65', accent: '#f6ffd9', kart: '#6b9630',
      perk: { trafficSlow: 0.03 }, perkLabel: '교통 속도 -3%',
      tagline: '빈틈을 보면 바로 파고드는 여우.',
    },
    {
      id: 'tiny-panda', name: '타이니 판다', species: 'panda', rarity: 'N',
      color: '#f1eee7', accent: '#30333a', kart: '#636974',
      perk: { magnet: 0.38 }, perkLabel: '볼트 자석 +0.38칸',
      tagline: '작지만 수집 욕심은 아주 크다.',
    },
    {
      id: 'turbo-chick', name: '터보 칙', species: 'chick', rarity: 'N',
      color: '#ffd85a', accent: '#fff4b7', kart: '#e59125',
      perk: { reward: 0.05 }, perkLabel: '주행 보상 +5%',
      tagline: '삐약 소리보다 엔진음이 먼저 들린다.',
    },
    {
      id: 'mint-cat', name: '민트 캣', species: 'cat', rarity: 'N',
      color: '#83d8c5', accent: '#dcfff7', kart: '#288f85',
      perk: { grace: 0.12 }, perkLabel: '충돌 판정 여유 +12%',
      tagline: '차분한 표정으로 아슬아슬하게 통과.',
    },
    {
      id: 'neon-raccoon', name: '네온 라쿤', species: 'raccoon', rarity: 'R',
      color: '#9a8cff', accent: '#e7e1ff', kart: '#5541d7',
      perk: { reward: 0.09 }, perkLabel: '주행 보상 +9%',
      tagline: '밤길의 볼트는 전부 내 것.',
    },
    {
      id: 'sky-koala', name: '스카이 코알라', species: 'koala', rarity: 'R',
      color: '#8fb9d8', accent: '#e5f4ff', kart: '#3f78a2',
      perk: { trafficSlow: 0.07 }, perkLabel: '교통 속도 -7%',
      tagline: '느긋함이 최고의 드리프트 기술.',
    },
    {
      id: 'astro-pup', name: '아스트로 퍼피', species: 'dog', rarity: 'R',
      color: '#d9b07b', accent: '#fff0d9', kart: '#5d79d8',
      perk: { magnet: 0.78 }, perkLabel: '볼트 자석 +0.78칸',
      tagline: '볼트 신호를 우주에서도 찾아낸다.',
    },
    {
      id: 'drift-penguin', name: '드리프트 펭귄', species: 'penguin', rarity: 'R',
      color: '#394d69', accent: '#f3f7ff', kart: '#38a8d0',
      perk: { shield: 1 }, perkLabel: '매 주행 보호막 1회',
      tagline: '미끄러지는 게 아니라 계산된 드리프트.',
    },
    {
      id: 'flame-tiger', name: '플레임 타이거', species: 'tiger', rarity: 'SR',
      color: '#f08c3e', accent: '#ffe1be', kart: '#c63e2d',
      perk: { reward: 0.16, trafficSlow: 0.03 }, perkLabel: '보상 +16% · 교통 -3%',
      tagline: '도로 위에 불꽃 궤적을 남긴다.',
    },
    {
      id: 'moon-dragon', name: '문라이트 드래곤', species: 'dragon', rarity: 'SR',
      color: '#7567c8', accent: '#dcd5ff', kart: '#29307c',
      perk: { shield: 1, magnet: 0.55 }, perkLabel: '보호막 1회 · 자석 +0.55칸',
      tagline: '달빛을 접어 만든 날개로 달린다.',
    },
    {
      id: 'gold-capybara', name: '골든 카피바라', species: 'capybara', rarity: 'SSR',
      color: '#e2b64d', accent: '#fff2b6', kart: '#8f5d1e',
      perk: { shield: 1, magnet: 0.95, reward: 0.24, trafficSlow: 0.04 },
      perkLabel: '보호막 · 자석 · 보상 +24%',
      tagline: '서두르지 않아도 모두가 길을 비켜준다.',
    },
  ];

  const CHARACTER_MAP = Object.fromEntries(CHARACTERS.map((character) => [character.id, character]));
  const RARITY_ORDER = ['N', 'R', 'SR', 'SSR'];

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function randomChoice(items, random = Math.random) {
    return items[Math.floor(random() * items.length)] || items[0];
  }

  function createDefaultProfile() {
    return {
      version: 1,
      bolts: 300,
      pity: 0,
      pulls: 0,
      freeTenClaimed: false,
      equipped: 'rookie-rabbit',
      owned: {
        'rookie-rabbit': { copies: 1, shards: 0, stars: 1 },
      },
      bestDistance: 0,
      totalRuns: 0,
      totalBoltsEarned: 0,
      totalCharactersPulled: 0,
    };
  }

  function normalizeOwnedEntry(entry) {
    return {
      copies: Math.max(1, Number(entry?.copies) || 1),
      shards: Math.max(0, Number(entry?.shards) || 0),
      stars: clamp(Number(entry?.stars) || 1, 1, 5),
    };
  }

  function normalizeProfile(raw) {
    const defaults = createDefaultProfile();
    const profile = raw && typeof raw === 'object' ? raw : {};
    const owned = {};
    if (profile.owned && typeof profile.owned === 'object') {
      for (const [id, entry] of Object.entries(profile.owned)) {
        if (CHARACTER_MAP[id]) owned[id] = normalizeOwnedEntry(entry);
      }
    }
    if (!owned['rookie-rabbit']) owned['rookie-rabbit'] = clone(defaults.owned['rookie-rabbit']);

    const equipped = CHARACTER_MAP[profile.equipped] && owned[profile.equipped]
      ? profile.equipped
      : defaults.equipped;

    return {
      ...defaults,
      ...profile,
      version: 1,
      bolts: Math.max(0, Math.floor(Number(profile.bolts ?? defaults.bolts) || 0)),
      pity: clamp(Math.floor(Number(profile.pity) || 0), 0, PITY_LIMIT - 1),
      pulls: Math.max(0, Math.floor(Number(profile.pulls) || 0)),
      freeTenClaimed: Boolean(profile.freeTenClaimed),
      equipped,
      owned,
      bestDistance: Math.max(0, Math.floor(Number(profile.bestDistance) || 0)),
      totalRuns: Math.max(0, Math.floor(Number(profile.totalRuns) || 0)),
      totalBoltsEarned: Math.max(0, Math.floor(Number(profile.totalBoltsEarned) || 0)),
      totalCharactersPulled: Math.max(0, Math.floor(Number(profile.totalCharactersPulled) || 0)),
    };
  }

  function rarityAtLeast(rarity, minimum) {
    return RARITY_ORDER.indexOf(rarity) >= RARITY_ORDER.indexOf(minimum);
  }

  function rollRarity(profile, random = Math.random, minimum = 'N') {
    if (profile.pity >= PITY_LIMIT - 1) return 'SSR';

    const allowed = RARITY_ORDER.filter((rarity) => rarityAtLeast(rarity, minimum));
    const total = allowed.reduce((sum, rarity) => sum + RARITIES[rarity].rate, 0);
    let roll = random() * total;
    for (const rarity of allowed) {
      roll -= RARITIES[rarity].rate;
      if (roll <= 0) return rarity;
    }
    return allowed[allowed.length - 1];
  }

  function pullCharacter(profileInput, random = Math.random, minimum = 'N') {
    const profile = normalizeProfile(profileInput);
    const rarity = rollRarity(profile, random, minimum);
    const character = randomChoice(CHARACTERS.filter((item) => item.rarity === rarity), random);
    const previous = profile.owned[character.id];
    const isNew = !previous;
    let shardsAwarded = 0;
    let boltsRebated = 0;

    if (isNew) {
      profile.owned[character.id] = { copies: 1, shards: 0, stars: 1 };
    } else {
      const rarityInfo = RARITIES[rarity];
      previous.copies += 1;
      previous.shards += rarityInfo.shards;
      profile.bolts += rarityInfo.rebate;
      shardsAwarded = rarityInfo.shards;
      boltsRebated = rarityInfo.rebate;
    }

    profile.pity = rarity === 'SSR' ? 0 : profile.pity + 1;
    profile.pulls += 1;
    profile.totalCharactersPulled += 1;

    return {
      profile,
      result: {
        character: clone(character),
        rarity,
        isNew,
        shardsAwarded,
        boltsRebated,
        pityAfter: profile.pity,
      },
    };
  }

  function pullCharacters(profileInput, count, options = {}, random = Math.random) {
    const profile = normalizeProfile(profileInput);
    const amount = count === 10 ? 10 : 1;
    const freeTen = amount === 10 && !profile.freeTenClaimed && options.useFreeTen !== false;
    const cost = freeTen ? 0 : amount === 10 ? TEN_PULL_COST : PULL_COST;

    if (profile.bolts < cost) {
      return { ok: false, error: 'NOT_ENOUGH_BOLTS', profile, cost, results: [] };
    }

    profile.bolts -= cost;
    if (freeTen) profile.freeTenClaimed = true;

    const results = [];
    let current = profile;
    for (let index = 0; index < amount; index++) {
      const firstNineHaveRare = results.some((item) => rarityAtLeast(item.rarity, 'R'));
      const minimum = amount === 10 && index === 9 && !firstNineHaveRare ? 'R' : 'N';
      const pulled = pullCharacter(current, random, minimum);
      current = pulled.profile;
      results.push(pulled.result);
    }

    return { ok: true, profile: current, cost, freeTen, results };
  }

  function upgradeCost(stars) {
    return 70 + (clamp(stars, 1, 4) - 1) * 55;
  }

  function upgradeCharacter(profileInput, characterId) {
    const profile = normalizeProfile(profileInput);
    const owned = profile.owned[characterId];
    if (!owned) return { ok: false, error: 'NOT_OWNED', profile };
    if (owned.stars >= 5) return { ok: false, error: 'MAX_STARS', profile };
    const cost = upgradeCost(owned.stars);
    if (owned.shards < cost) return { ok: false, error: 'NOT_ENOUGH_SHARDS', cost, profile };
    owned.shards -= cost;
    owned.stars += 1;
    return { ok: true, cost, profile };
  }

  function equipCharacter(profileInput, characterId) {
    const profile = normalizeProfile(profileInput);
    if (!profile.owned[characterId] || !CHARACTER_MAP[characterId]) {
      return { ok: false, error: 'NOT_OWNED', profile };
    }
    profile.equipped = characterId;
    return { ok: true, profile };
  }

  function effectivePerks(profileInput) {
    const profile = normalizeProfile(profileInput);
    const character = CHARACTER_MAP[profile.equipped] || CHARACTER_MAP['rookie-rabbit'];
    const stars = profile.owned[character.id]?.stars || 1;
    const scale = 1 + (stars - 1) * 0.12;
    return {
      character: clone(character),
      stars,
      reward: (character.perk.reward || 0) * scale,
      trafficSlow: clamp((character.perk.trafficSlow || 0) * scale, 0, 0.24),
      magnet: (character.perk.magnet || 0) * scale,
      grace: clamp((character.perk.grace || 0) * scale, 0, 0.25),
      shield: character.perk.shield || 0,
    };
  }

  class KartCrossingEngine {
    constructor(random = Math.random) {
      this.random = random;
      this.reset();
    }

    reset(perks = {}) {
      this.perks = {
        reward: Number(perks.reward) || 0,
        trafficSlow: clamp(Number(perks.trafficSlow) || 0, 0, 0.24),
        magnet: Math.max(0, Number(perks.magnet) || 0),
        grace: clamp(Number(perks.grace) || 0, 0, 0.25),
        shield: Math.max(0, Math.floor(Number(perks.shield) || 0)),
      };
      this.elapsed = 0;
      this.dead = false;
      this.paused = false;
      this.rows = [];
      this.maxRow = 0;
      this.runBolts = 0;
      this.moves = 0;
      this.invulnerableFor = 0;
      this.lastHitAt = -100;
      this.player = {
        x: Math.floor(COLS / 2),
        y: 0,
        col: Math.floor(COLS / 2),
        row: 0,
        fromX: Math.floor(COLS / 2),
        fromY: 0,
        targetX: Math.floor(COLS / 2),
        targetY: 0,
        moveProgress: 1,
        shield: this.perks.shield,
      };
      for (let row = -2; row <= 15; row++) this.rows.push(this.createRow(row));
    }

    get score() {
      return this.maxRow * 10 + this.runBolts * 50;
    }

    get rewardBolts() {
      const base = Math.max(20, this.maxRow * 4 + this.runBolts * 24);
      return Math.floor(base * (1 + this.perks.reward));
    }

    createRow(index) {
      if (index <= 0 || index % 5 === 0) {
        return {
          index,
          type: index > 0 && index % 15 === 0 ? 'checkpoint' : 'grass',
          direction: 0,
          speed: 0,
          vehicles: [],
          collectibles: this.createCollectibles(index, true),
          seed: this.random(),
        };
      }

      if (index % 9 === 0) {
        return {
          index,
          type: 'boost',
          direction: 0,
          speed: 0,
          vehicles: [],
          collectibles: this.createCollectibles(index, true, 1),
          seed: this.random(),
        };
      }

      const direction = this.random() > 0.5 ? 1 : -1;
      const difficulty = Math.min(2.6, Math.max(0, index) * 0.035);
      const speed = (2.05 + this.random() * 1.65 + difficulty) * (1 - this.perks.trafficSlow);
      const count = 2 + Math.floor(this.random() * 3);
      const vehicles = [];
      const spacing = (COLS + 5) / count;
      for (let i = 0; i < count; i++) {
        const width = this.random() > 0.72 ? 1.65 : 1.05 + this.random() * 0.35;
        vehicles.push({
          x: i * spacing + this.random() * 0.8 - 1.5,
          width,
          kind: width > 1.5 ? 'truck' : this.random() > 0.75 ? 'taxi' : 'car',
          colorIndex: Math.floor(this.random() * 6),
        });
      }
      return {
        index,
        type: 'road',
        direction,
        speed,
        vehicles,
        collectibles: this.createCollectibles(index, false),
        seed: this.random(),
      };
    }

    createCollectibles(index, safe, forced = 0) {
      if (index <= 0) return [];
      const count = forced || (this.random() < (safe ? 0.42 : 0.24) ? 1 : 0);
      const collectibles = [];
      for (let i = 0; i < count; i++) {
        collectibles.push({
          col: Math.floor(this.random() * COLS),
          taken: false,
          bob: this.random() * Math.PI * 2,
        });
      }
      return collectibles;
    }

    ensureRows() {
      const highest = this.rows.reduce((max, row) => Math.max(max, row.index), -Infinity);
      for (let row = highest + 1; row <= this.maxRow + 16; row++) {
        this.rows.push(this.createRow(row));
      }
      const minKeep = Math.max(-2, this.maxRow - 10);
      this.rows = this.rows.filter((row) => row.index >= minKeep);
    }

    move(dx, dy) {
      if (this.dead || this.player.moveProgress < 1) return false;
      const nextCol = clamp(this.player.col + dx, 0, COLS - 1);
      const minRow = Math.max(0, this.maxRow - 5);
      const nextRow = Math.max(minRow, this.player.row + dy);
      if (nextCol === this.player.col && nextRow === this.player.row) return false;

      const player = this.player;
      player.fromX = player.x;
      player.fromY = player.y;
      player.targetX = nextCol;
      player.targetY = nextRow;
      player.col = nextCol;
      player.row = nextRow;
      player.moveProgress = 0;
      this.moves++;

      if (nextRow > this.maxRow) {
        this.maxRow = nextRow;
        this.ensureRows();
      }
      return true;
    }

    updateVehicles(dt) {
      for (const row of this.rows) {
        if (row.type !== 'road') continue;
        for (const vehicle of row.vehicles) {
          vehicle.x += row.direction * row.speed * dt;
          if (row.direction > 0 && vehicle.x > COLS + 2.5) vehicle.x = -vehicle.width - 2.5;
          if (row.direction < 0 && vehicle.x + vehicle.width < -2.5) vehicle.x = COLS + 2.5;
        }
      }
    }

    updatePlayer(dt) {
      const player = this.player;
      if (player.moveProgress >= 1) return;
      player.moveProgress = Math.min(1, player.moveProgress + dt * 7.4);
      const t = player.moveProgress;
      const eased = 1 - Math.pow(1 - t, 3);
      player.x = player.fromX + (player.targetX - player.fromX) * eased;
      player.y = player.fromY + (player.targetY - player.fromY) * eased;
      if (player.moveProgress >= 1) {
        player.x = player.targetX;
        player.y = player.targetY;
        this.collectNearby();
      }
    }

    collectNearby() {
      const player = this.player;
      const radius = 0.2 + this.perks.magnet;
      for (const row of this.rows) {
        if (Math.abs(row.index - player.row) > 0.35) continue;
        for (const collectible of row.collectibles) {
          if (!collectible.taken && Math.abs(collectible.col - player.col) <= radius) {
            collectible.taken = true;
            this.runBolts++;
          }
        }
      }
    }

    checkCollision() {
      if (this.dead || this.invulnerableFor > 0) return;
      const player = this.player;
      const grace = this.perks.grace;
      const playerLeft = player.x + 0.2 + grace;
      const playerRight = player.x + 0.8 - grace;

      for (const row of this.rows) {
        if (row.type !== 'road' || Math.abs(row.index - player.y) > 0.28 + grace) continue;
        for (const vehicle of row.vehicles) {
          const vehicleLeft = vehicle.x;
          const vehicleRight = vehicle.x + vehicle.width;
          if (playerLeft < vehicleRight && playerRight > vehicleLeft) {
            if (player.shield > 0) {
              player.shield--;
              this.invulnerableFor = 1.35;
              this.lastHitAt = this.elapsed;
              return;
            }
            this.dead = true;
            this.lastHitAt = this.elapsed;
            return;
          }
        }
      }
    }

    step(dt) {
      if (this.dead || this.paused) return;
      const delta = clamp(Number(dt) || 0, 0, 0.08);
      this.elapsed += delta;
      this.invulnerableFor = Math.max(0, this.invulnerableFor - delta);
      this.updateVehicles(delta);
      this.updatePlayer(delta);
      this.collectNearby();
      this.checkCollision();
    }
  }

  const api = {
    COLS,
    PITY_LIMIT,
    PULL_COST,
    TEN_PULL_COST,
    RARITIES,
    CHARACTERS,
    CHARACTER_MAP,
    createDefaultProfile,
    normalizeProfile,
    pullCharacter,
    pullCharacters,
    upgradeCost,
    upgradeCharacter,
    equipCharacter,
    effectivePerks,
    KartCrossingEngine,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WorkHubKartCrossing = api;
})(typeof window === 'undefined' ? {} : window);
