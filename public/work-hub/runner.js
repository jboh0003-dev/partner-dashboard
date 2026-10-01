(() => {
  'use strict';
  if (document.getElementById('workhub-runner')) return;

  const script=document.createElement('script');
  script.src='/work-hub/runner-engine.js?v=7';
  script.onload=mount;
  script.onerror=()=>console.error('BokRun 엔진을 불러오지 못했습니다.');
  document.body.appendChild(script);

  function mount(){
    const API=window.WorkHubRunner;
    if(!API)return;
    const RunnerEngine=API.RunnerEngine, CHARACTERS=API.CHARACTERS, RELICS=API.RELICS, SETS=API.SETS||[], WORLDS=API.WORLDS, ROUNDS=API.ROUNDS, CONSUMABLES=API.CONSUMABLES, POWERUPS=API.POWERUPS||{}, getCharacterMaxHealth=API.getCharacterMaxHealth;
    const section=document.createElement('section');
    section.id='workhub-runner';
    section.className='runner bokrun';
    section.dataset.version='7';
    section.setAttribute('aria-label','BokRun Relic Rush');
    document.querySelector('.main').appendChild(section);

    const PROFILE_KEY='bokrun_profile_v1';
    const RECORD_KEY='bokrun_records_v1';
    const DEFAULT_PROFILE={
      version:2,economyVersion:2,gold:2200,gems:1200,
      ownedCharacters:{momo:{level:1,shards:0}},
      ownedRelics:{feather:{level:1,shards:0},coinbell:{level:1,shards:0}},
      selectedCharacter:'momo',equippedRelics:['feather','coinbell'],
      unlockedRound:1,roundStars:{},firstClear:{},firstThreeStar:{},
      inventory:{shield:2,booster:1,magnet:1,revive:1},
      selectedConsumables:[],
      pity:{character:0,relic:0},
      lifetime:{runs:0,clears:0,gold:0,gems:0,bestScore:0,bestCombo:0},
      updatedAt:new Date().toISOString()
    };

    function clone(x){return JSON.parse(JSON.stringify(x));}
    function esc(v){return String(v==null?'':v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
    function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
    function charBy(id){return CHARACTERS.find(x=>x.id===id)||CHARACTERS[0];}
    function relicBy(id){return RELICS.find(x=>x.id===id)||RELICS[0];}
    function roundBy(id){return ROUNDS[Math.max(0,Math.min(ROUNDS.length-1,id-1))];}
    function rarityClass(r){return 'rarity-'+String(r||'N').toLowerCase();}
    function levelCap(){return 10;}
    function charLevelSummary(c,level){
      level=clamp(Number(level)||1,1,10);
      if(level>=10)return 'MAX · 패시브 +90% · 스킬 위력 +45% · 지속 +36% · 쿨 -18% · 최종점수 +18%';
      return '다음 Lv.'+(level+1)+' · 패시브 +10% · 스킬 위력 +5% · 지속 +4% · 쿨 -2% · 최종점수 +2%';
    }
    function relicLevelSummary(level){
      level=clamp(Number(level)||1,1,10);
      return level>=10?'MAX · 고유 효과 +135%':'다음 Lv.'+(level+1)+' · 고유 효과 +15%';
    }
    function activeSetIds(){
      const c=charBy(profile.selectedCharacter),ids=profile.equippedRelics;
      return SETS.filter(s=>s.characterIds.includes(c.id)&&ids.filter(id=>s.relicIds.includes(id)).length>=s.requiredRelics);
    }
    function recommendedBuild(r){
      const map={
        distance:{title:'안정 클리어',character:'moonlight_milk',relics:['moon_grail','phoenix','shield'],reason:'실드 + 부활로 3성 무피격을 노리는 안정 빌드'},
        coins:{title:'코인 파밍',character:'golden_mango',relics:['mango_crown','emerald_gem','coinbell'],reason:'코인 점수와 골드, 자석을 동시에 챙기는 파밍 빌드'},
        score:{title:'점수 폭발',character:'aurora_soda',relics:['aurora_crystal','stardust_orb','crown'],reason:'최종 점수와 파워업 지속을 겹치는 고점수 빌드'},
        combo:{title:'콤보 유지',character:'stardust_berry',relics:['stardust_orb','combo','lavender_perfume'],reason:'콤보 유지시간과 콤보 점수를 극대화하는 빌드'}
      };
      return map[r.mode]||map.distance;
    }
    function ownsBuild(build){
      return Boolean(profile.ownedCharacters[build.character]&&build.relics.every(id=>profile.ownedRelics[id]));
    }

    function normalizeProfile(raw){
      const p=Object.assign(clone(DEFAULT_PROFILE),raw&&typeof raw==='object'?raw:{});
      p.ownedCharacters=Object.assign({},DEFAULT_PROFILE.ownedCharacters,raw?.ownedCharacters||{});
      p.ownedRelics=Object.assign({},DEFAULT_PROFILE.ownedRelics,raw?.ownedRelics||{});
      p.roundStars=Object.assign({},raw?.roundStars||{});
      p.firstClear=Object.assign({},raw?.firstClear||{});
      p.firstThreeStar=Object.assign({},raw?.firstThreeStar||{});
      p.inventory=Object.assign({},DEFAULT_PROFILE.inventory,raw?.inventory||{});
      p.pity=Object.assign({},DEFAULT_PROFILE.pity,raw?.pity||{});
      p.lifetime=Object.assign({},DEFAULT_PROFILE.lifetime,raw?.lifetime||{});
      p.selectedConsumables=Array.isArray(raw?.selectedConsumables)?raw.selectedConsumables.filter(id=>CONSUMABLES[id]):[];
      p.equippedRelics=Array.isArray(raw?.equippedRelics)?raw.equippedRelics.filter(id=>p.ownedRelics[id]).slice(0,3):['feather','coinbell'];
      if(!p.ownedCharacters[p.selectedCharacter])p.selectedCharacter='momo';
      const completedIds=[
        ...Object.entries(p.roundStars||{}).filter(([,stars])=>Number(stars)>=1).map(([id])=>Number(id)),
        ...Object.entries(p.firstClear||{}).filter(([,done])=>Boolean(done)).map(([id])=>Number(id))
      ].filter(id=>Number.isFinite(id)&&id>=1&&id<=25);
      const inferredUnlock=completedIds.length?Math.min(25,Math.max(...completedIds)+1):1;
      p.unlockedRound=Math.max(clamp(Number(p.unlockedRound)||1,1,25),inferredUnlock);
      if(raw&&typeof raw==='object'&&(Number(raw.economyVersion)||0)<2){
        p.gems=(Number(p.gems)||0)+800;
        p.economyVersion=2;
        p.version=Math.max(2,Number(p.version)||1);
        p._economyBonusGranted=true;
      }
      return p;
    }

    function loadProfile(){
      let cloudRaw=null,localRaw=null;
      try{cloudRaw=(typeof S!=='undefined'&&S?.settings?.bokRunV1)?S.settings.bokRunV1:null;}catch{}
      try{localRaw=JSON.parse(localStorage.getItem(PROFILE_KEY)||'null');}catch{}
      if(!cloudRaw&&!localRaw)return clone(DEFAULT_PROFILE);
      const cloud=cloudRaw?normalizeProfile(cloudRaw):null;
      const local=localRaw?normalizeProfile(localRaw):null;
      if(!cloud)return local;
      if(!local)return cloud;
      const cloudAt=Date.parse(cloud.updatedAt||'')||0;
      const localAt=Date.parse(local.updatedAt||'')||0;
      const primary=clone(localAt>=cloudAt?local:cloud);
      const secondary=localAt>=cloudAt?cloud:local;
      primary.unlockedRound=Math.max(primary.unlockedRound||1,secondary.unlockedRound||1);
      const starIds=new Set([...Object.keys(primary.roundStars||{}),...Object.keys(secondary.roundStars||{})]);
      starIds.forEach(id=>{primary.roundStars[id]=Math.max(Number(primary.roundStars[id])||0,Number(secondary.roundStars[id])||0);});
      primary.firstClear=Object.assign({},secondary.firstClear||{},primary.firstClear||{});
      primary.firstThreeStar=Object.assign({},secondary.firstThreeStar||{},primary.firstThreeStar||{});
      const completed=[
        ...Object.entries(primary.roundStars||{}).filter(([,stars])=>Number(stars)>=1).map(([id])=>Number(id)),
        ...Object.entries(primary.firstClear||{}).filter(([,done])=>Boolean(done)).map(([id])=>Number(id))
      ].filter(id=>Number.isFinite(id)&&id>=1&&id<=25);
      if(completed.length)primary.unlockedRound=Math.max(primary.unlockedRound,Math.min(25,Math.max(...completed)+1));
      return normalizeProfile(primary);
    }

    let profile=loadProfile();
    let view='play';
    let selectedRound=Math.min(profile.unlockedRound,25);
    let selectedGacha='character';
    let collectionRarity='ALL';
    let collectionType='character';
    let engine=null,running=false,paused=false,raf=0,last=0,width=1100,ctx=null,canvas=null;
    let records=readRecords();

    function persist(){
      profile.updatedAt=new Date().toISOString();
      try{localStorage.setItem(PROFILE_KEY,JSON.stringify(profile));}catch{}
      try{
        if(typeof S!=='undefined'){
          S.settings=S.settings||{};
          S.settings.bokRunV1=clone(profile);
          if(typeof save==='function')save();
        }
      }catch{}
    }

    function readRecords(){
      try{const a=JSON.parse(localStorage.getItem(RECORD_KEY)||'[]');return Array.isArray(a)?a.slice(0,10):[];}catch{return [];}
    }
    function saveRecords(){try{localStorage.setItem(RECORD_KEY,JSON.stringify(records.slice(0,10)));}catch{}}

    const style=document.createElement('style');
    style.id='bokrun-style-v4';
    style.textContent="\n.bokrun{margin:18px 18px 34px!important;border:0!important;background:transparent!important;border-radius:0!important;overflow:visible!important;color:#191919!important;font-family:Pretendard,\"Apple SD Gothic Neo\",\"Noto Sans KR\",\"Malgun Gothic\",sans-serif!important}\n.bokrun *{box-sizing:border-box}\n.bokrun-shell{border:1px solid #ececec;border-radius:26px;background:#fff;overflow:hidden;box-shadow:0 12px 34px rgba(0,0,0,.055)}\n.bokrun-hero{display:flex;justify-content:space-between;gap:20px;align-items:center;padding:22px 24px;background:linear-gradient(120deg,#fff8ad,#fee500 58%,#ffd83b);color:#191919}\n.bokrun-kicker{font-size:10px;letter-spacing:1.2px;font-weight:900;opacity:.62}\n.bokrun-hero h2{margin:3px 0 5px!important;font-family:inherit!important;font-size:29px!important;letter-spacing:-1.2px!important}\n.bokrun-hero p{margin:0;font-size:12px;line-height:1.55;color:#5d5500}\n.bokrun-wallet{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.bokrun-wallet span{display:flex;gap:6px;align-items:center;background:rgba(255,255,255,.72);padding:9px 11px;border-radius:999px;font-size:11px;font-weight:850}.bokrun-wallet strong{font-size:14px}\n.bokrun-nav{display:flex;gap:5px;padding:10px 12px;border-bottom:1px solid #eee;background:#fafafa;overflow:auto}.bokrun-nav button{border:0;background:transparent;color:#777;padding:9px 14px;border-radius:12px;font-weight:800;white-space:nowrap;cursor:pointer}.bokrun-nav button.active{background:#191919;color:#fff}\n.bokrun-body{padding:18px}.bokrun-grid{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(300px,.55fr);gap:16px}.bokrun-card{background:#fff;border:1px solid #ececec;border-radius:18px;padding:16px}.bokrun-card h3{margin:0 0 4px;font-size:17px;letter-spacing:-.4px}.bokrun-card>p,.bokrun-sub{margin:0;color:#888;font-size:11px;line-height:1.55}\n.bokrun-worlds{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-top:13px}.bokrun-world{border:1px solid #eee;background:#fafafa;border-radius:14px;padding:11px;text-align:left;cursor:pointer;min-height:88px}.bokrun-world.active{border-color:#fee500;box-shadow:inset 0 0 0 2px #fee500;background:#fffdf0}.bokrun-world.locked{opacity:.38;cursor:not-allowed}.bokrun-world b{display:block;margin-top:5px;font-size:12px}.bokrun-world small{display:block;color:#999;margin-top:3px;font-size:9px}\n.bokrun-rounds{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}.bokrun-round{width:54px;height:54px;border:1px solid #eee;background:#fafafa;border-radius:14px;font-weight:850;cursor:pointer;position:relative}.bokrun-round.active{background:#191919;color:#fff;border-color:#191919}.bokrun-round.locked{opacity:.35;cursor:not-allowed}.bokrun-stars{position:absolute;bottom:3px;left:0;right:0;font-size:8px;color:#e7aa00}\n.bokrun-objective{margin-top:13px;padding:12px 13px;border-radius:14px;background:#f7f7f7;display:flex;justify-content:space-between;gap:12px;align-items:center}.bokrun-objective b{font-size:13px}.bokrun-objective small{display:block;color:#888;font-size:10px;margin-top:3px}.bokrun-objective em{font-style:normal;font-size:20px}\n.bokrun-loadout{display:grid;grid-template-columns:1fr;gap:9px;margin-top:12px}.bokrun-slot{display:flex;align-items:center;gap:10px;padding:10px;border:1px solid #eee;border-radius:14px;background:#fafafa}.bokrun-avatar{width:46px;height:46px;border-radius:15px;display:grid;place-items:center;font-size:24px;flex:0 0 auto}.bokrun-slot b{display:block;font-size:12px}.bokrun-slot small{display:block;color:#888;font-size:9px;margin-top:2px;line-height:1.4}.bokrun-slot .rarity{margin-left:auto;font-size:9px;font-weight:900}\n.bokrun-consumables{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:12px}.bokrun-consume{border:1px solid #eee;background:#fafafa;border-radius:12px;padding:9px 5px;text-align:center;cursor:pointer;position:relative}.bokrun-consume.active{background:#fff9c9;border-color:#fee500}.bokrun-consume:disabled{opacity:.36;cursor:not-allowed}.bokrun-consume span{display:block;font-size:20px}.bokrun-consume b{display:block;font-size:9px;margin-top:4px}.bokrun-consume small{position:absolute;right:5px;top:4px;font-size:8px;background:#191919;color:#fff;border-radius:999px;padding:2px 5px}\n.bokrun-start{width:100%;margin-top:12px;border:0;border-radius:14px;background:#fee500;color:#191919;padding:13px;font-size:14px;font-weight:900;cursor:pointer}.bokrun-start:hover{background:#f4dc00}\n.bokrun-record-list{margin:12px 0 0;padding:0;list-style:none}.bokrun-record-list li{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid #eee;font-size:10px}.bokrun-record-list li:last-child{border:0}.bokrun-record-list strong{white-space:nowrap}\n.bokrun-collection-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:14px}.bokrun-unit{border:1px solid #eee;border-radius:16px;padding:13px;background:#fafafa;position:relative}.bokrun-unit.locked{filter:grayscale(.7);opacity:.58}.bokrun-unit.selected{border-color:#fee500;box-shadow:inset 0 0 0 2px #fee500}.bokrun-unit-top{display:flex;gap:9px;align-items:center}.bokrun-unit h4{margin:0;font-size:12px}.bokrun-unit p{margin:7px 0;color:#777;font-size:9px;line-height:1.5;min-height:40px}.bokrun-unit-meta{display:flex;justify-content:space-between;gap:6px;font-size:9px;color:#999}.bokrun-unit-actions{display:flex;gap:5px;margin-top:9px}.bokrun-unit-actions button{flex:1;border:0;border-radius:9px;background:#eee;padding:7px;font-size:9px;font-weight:800;cursor:pointer}.bokrun-unit-actions button.primary{background:#fee500}.bokrun-unit-actions button:disabled{opacity:.4;cursor:not-allowed}\n.rarity-n{color:#777}.rarity-r{color:#2b7ccc}.rarity-sr{color:#8d58d5}.rarity-ssr{color:#d89000}.bokrun-rarity-filter{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}.bokrun-rarity-filter button{border:0;border-radius:999px;padding:7px 12px;background:#f0f0f0;color:#777;font-size:10px;font-weight:900;cursor:pointer}.bokrun-rarity-filter button.active{background:#191919;color:#fff}.bokrun-star-rules{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:10px;padding:11px;border-radius:14px;background:#fffdf0;border:1px solid #f4e57e}.bokrun-star-rules b{grid-column:1/-1;font-size:11px}.bokrun-star-rules span{font-size:9px;color:#6e6500}.bokrun-recommend{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:10px;padding:12px;border:1px solid #e7e7e7;border-radius:14px;background:#fafafa}.bokrun-recommend span{font-size:9px;color:#8a8a8a;font-weight:850}.bokrun-recommend b{display:block;margin-top:3px;font-size:11px}.bokrun-recommend small{display:block;margin-top:3px;color:#888;font-size:9px}.bokrun-recommend button{border:0;border-radius:10px;padding:9px 11px;background:#fee500;font-size:9px;font-weight:900;white-space:nowrap}.bokrun-recommend button:disabled{background:#eee;color:#aaa}.bokrun-set-box{margin-top:10px;padding:11px;background:#f8f8f8;border-radius:13px}.bokrun-set-box h4{margin:0 0 7px;font-size:10px}.bokrun-set-active{padding:7px 8px;border-radius:10px;background:#fff5ae;margin-top:5px}.bokrun-set-active b{display:block;font-size:10px}.bokrun-set-active small,.bokrun-set-empty{display:block;color:#777;font-size:8px;line-height:1.45}.bokrun-set-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}.bokrun-set-card{padding:11px;border:1px solid #eee;border-radius:13px;background:#fafafa}.bokrun-set-card b{display:block;font-size:10px}.bokrun-set-card small{display:block;margin-top:4px;color:#777;font-size:8px;line-height:1.45}.bokrun-set-card em{display:block;margin-top:6px;color:#a06b00;font-size:8px;font-style:normal;font-weight:800}\n.bokrun-gacha-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:13px}.bokrun-banner{border:1px solid #eee;border-radius:18px;padding:18px;background:linear-gradient(140deg,#fafafa,#fff)}.bokrun-banner.active{border-color:#fee500;box-shadow:inset 0 0 0 2px #fee500}.bokrun-banner h3{font-size:18px}.bokrun-rates{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0}.bokrun-rates span{background:#f4f4f4;border-radius:999px;padding:5px 7px;font-size:9px;font-weight:800}.bokrun-gacha-actions{display:flex;gap:7px}.bokrun-gacha-actions button{flex:1;border:0;border-radius:11px;padding:10px;background:#191919;color:#fff;font-size:10px;font-weight:850;cursor:pointer}.bokrun-gacha-actions button.ten{background:#fee500;color:#191919}.bokrun-gacha-actions button:disabled{opacity:.38}\n.bokrun-shop{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:13px}.bokrun-shop-item{border:1px solid #eee;border-radius:16px;padding:14px;background:#fafafa;text-align:center}.bokrun-shop-item .icon{font-size:32px}.bokrun-shop-item h4{margin:7px 0 4px;font-size:12px}.bokrun-shop-item p{margin:0;color:#888;font-size:9px;min-height:28px}.bokrun-shop-item button{width:100%;margin-top:10px;border:0;border-radius:10px;background:#fee500;padding:8px;font-size:10px;font-weight:850;cursor:pointer}.bokrun-shop-item button:disabled{opacity:.4}\n.bokrun-game{position:relative;background:#111;border-radius:18px;overflow:hidden}.bokrun-game-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 12px;background:#191919;color:#fff}.bokrun-hud{display:flex;gap:11px;flex:1;flex-wrap:wrap}.bokrun-hud span{font-size:9px;color:#aaa}.bokrun-hud strong{display:block;font-size:13px;color:#fff}.bokrun-skill{border:0;border-radius:10px;background:#fee500;color:#191919;padding:9px 12px;font-weight:900;cursor:pointer}.bokrun-skill:disabled{opacity:.45}.bokrun-game canvas{display:block;width:100%;height:auto;aspect-ratio:1100/390;background:#bde8ff;touch-action:none}.bokrun-progress{height:6px;background:#333}.bokrun-progress i{display:block;height:100%;background:#fee500;width:0%}.bokrun-mobile-controls{display:flex;gap:7px;padding:10px;background:#191919}.bokrun-mobile-controls button{flex:1;border:0;border-radius:11px;padding:11px;background:#2d2d2d;color:#fff;font-weight:850}.bokrun-mobile-controls button.skill{background:#fee500;color:#191919}\n.bokrun-runmsg{position:absolute;left:50%;top:54%;transform:translate(-50%,-50%);min-width:260px;max-width:85%;padding:17px 20px;background:rgba(17,17,17,.88);color:#fff;border-radius:16px;text-align:center;pointer-events:none;backdrop-filter:blur(5px)}.bokrun-runmsg[hidden]{display:none}.bokrun-runmsg b{display:block;font-size:21px}.bokrun-runmsg span{display:block;margin-top:5px;color:#ccc;font-size:11px;line-height:1.45}\n.bokrun-overlay{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:20px;background:rgba(0,0,0,.55);backdrop-filter:blur(7px)}.bokrun-modal{width:min(720px,100%);max-height:90vh;overflow:auto;border-radius:24px;background:#fff;padding:20px;box-shadow:0 24px 80px rgba(0,0,0,.25)}.bokrun-modal h3{margin:0 0 6px;font-size:22px}.bokrun-modal p{margin:0;color:#777;font-size:11px}.bokrun-result-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin:14px 0}.bokrun-result-stats div{background:#f7f7f7;border-radius:12px;padding:10px;text-align:center}.bokrun-result-stats small{display:block;color:#999;font-size:8px}.bokrun-result-stats b{font-size:14px}.bokrun-modal-actions{display:flex;gap:7px}.bokrun-modal-actions button{flex:1;border:0;border-radius:12px;padding:11px;font-weight:850;cursor:pointer}.bokrun-modal-actions .primary{background:#fee500}.bokrun-pulls{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:14px 0}.bokrun-pull{border:1px solid #eee;border-radius:13px;padding:10px 6px;text-align:center;background:#fafafa}.bokrun-pull span{display:block;font-size:26px}.bokrun-pull b{display:block;font-size:9px;margin-top:4px}.bokrun-pull small{font-size:8px}\nbody.dark .bokrun-shell,body.dark .bokrun-card,body.dark .bokrun-modal{background:#242424;color:#f5f5f5;border-color:#373737}.dark .bokrun-nav{background:#202020;border-color:#333}.dark .bokrun-world,.dark .bokrun-slot,.dark .bokrun-unit,.dark .bokrun-banner,.dark .bokrun-shop-item,.dark .bokrun-objective{background:#2d2d2d;border-color:#3b3b3b}.dark .bokrun-sub,.dark .bokrun-card>p,.dark .bokrun-unit p,.dark .bokrun-unit-meta{color:#aaa}\n@media(max-width:1050px){.bokrun-grid{grid-template-columns:1fr}.bokrun-worlds{grid-template-columns:repeat(3,1fr)}.bokrun-collection-grid{grid-template-columns:repeat(2,1fr)}}\n@media(max-width:800px){.bokrun-star-rules{grid-template-columns:1fr}.bokrun-set-grid{grid-template-columns:1fr}.bokrun-recommend{align-items:flex-start;flex-direction:column}.bokrun-recommend button{width:100%}}@media(max-width:700px){.bokrun{margin:10px!important}.bokrun-hero{align-items:flex-start;flex-direction:column}.bokrun-wallet{justify-content:flex-start}.bokrun-body{padding:12px}.bokrun-worlds{grid-template-columns:repeat(2,1fr)}.bokrun-collection-grid{grid-template-columns:1fr}.bokrun-gacha-grid{grid-template-columns:1fr}.bokrun-shop{grid-template-columns:repeat(2,1fr)}.bokrun-result-stats{grid-template-columns:repeat(2,1fr)}.bokrun-pulls{grid-template-columns:repeat(2,1fr)}}\n";
    document.head.appendChild(style);
    const styleExtra=document.createElement('style');
    styleExtra.id='bokrun-style-v7-extra';
    styleExtra.textContent=`
      .bokrun-collection-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}.bokrun-collection-tabs button{border:1px solid #e8e8e8;background:#fafafa;border-radius:13px;padding:11px;font-weight:900;cursor:pointer}.bokrun-collection-tabs button.active{background:#191919;color:#fff;border-color:#191919}
      .bokrun-collection-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:12px}.bokrun-compact{display:flex;gap:10px;align-items:center;border:1px solid #ededed;border-radius:15px;padding:10px;background:#fafafa;min-width:0}.bokrun-compact.locked{opacity:.48;filter:grayscale(.45)}.bokrun-compact.selected{border-color:#fee500;box-shadow:inset 0 0 0 2px #fee500}.bokrun-compact-main{min-width:0;flex:1}.bokrun-compact-main b{display:block;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bokrun-compact-main small{display:block;color:#8b8b8b;font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:3px}.bokrun-compact-actions{display:flex;gap:4px}.bokrun-compact-actions button{border:0;border-radius:8px;padding:7px 8px;font-size:8px;font-weight:850;cursor:pointer;background:#eee}.bokrun-compact-actions .primary{background:#fee500}.bokrun-compact-actions button:disabled{opacity:.35}
      .bokrun-detail-grid{display:grid;grid-template-columns:120px 1fr;gap:16px;margin-top:14px}.bokrun-detail-hero{display:grid;place-items:center;border-radius:20px;min-height:120px;font-size:58px;background:#f5f5f5}.bokrun-detail-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:12px}.bokrun-detail-stats div{background:#f7f7f7;border-radius:11px;padding:9px}.bokrun-detail-stats small{display:block;color:#999;font-size:8px}.bokrun-detail-stats b{font-size:11px}
      .bokrun-preitems{margin-top:12px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.bokrun-preitem{border:1px solid #eee;border-radius:13px;padding:9px;background:#fafafa}.bokrun-preitem-top{display:flex;align-items:center;gap:7px}.bokrun-preitem-top input{accent-color:#fee500}.bokrun-preitem-top span{font-size:18px}.bokrun-preitem-top b{font-size:9px}.bokrun-preitem-top small{margin-left:auto;font-size:8px;color:#777}.bokrun-preitem button{width:100%;border:0;border-radius:8px;background:#eee;padding:6px;margin-top:6px;font-size:8px;font-weight:850}.bokrun-preitem button.buy{background:#fff2a0}.bokrun-buyall{display:flex;align-items:flex-start;gap:8px;padding:10px;margin-top:9px;background:#fffbe3;border:1px solid #f2e37a;border-radius:12px;font-size:9px;font-weight:800}.bokrun-buyall input{accent-color:#fee500;margin-top:1px}
      .bokrun-guidebar{display:grid;grid-template-columns:1fr 1.25fr;gap:8px;background:#252525;color:#fff;padding:8px 10px;border-top:1px solid #393939}.bokrun-controls-guide,.bokrun-item-guide{display:flex;gap:5px;flex-wrap:wrap;align-items:center}.bokrun-guide-chip{background:#333;border:1px solid #444;border-radius:8px;padding:5px 7px;font-size:8px;color:#ddd}.bokrun-guide-chip strong{color:#fff}.bokrun-skill-guide{grid-column:1/-1;display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;background:#151515;border-radius:10px;padding:7px 9px}.bokrun-skill-guide b{font-size:9px}.bokrun-skill-guide span{font-size:8px;color:#aaa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bokrun-cooltrack{height:5px;background:#3d3d3d;border-radius:999px;overflow:hidden;min-width:110px}.bokrun-cooltrack i{display:block;height:100%;background:#fee500;width:100%}.bokrun-activebuffs{padding:7px 10px;background:#1e1e1e;color:#ddd;font-size:8px;min-height:26px}
      .bokrun-hpbar{width:105px;height:6px;background:#4b2b2b;border-radius:999px;overflow:hidden;margin-top:3px}.bokrun-hpbar i{display:block;height:100%;background:#ff6b6b;width:100%}
      .bokrun-map-badge{position:absolute;right:10px;top:66px;z-index:3;padding:5px 7px;border-radius:8px;background:rgba(0,0,0,.45);color:#fff;font-size:8px;pointer-events:none}
      @media(max-width:800px){.bokrun-collection-list{grid-template-columns:1fr}.bokrun-guidebar{grid-template-columns:1fr}.bokrun-skill-guide{grid-column:auto}.bokrun-detail-grid{grid-template-columns:1fr}.bokrun-detail-hero{min-height:90px}.bokrun-preitems{grid-template-columns:1fr}}
    `;
    document.head.appendChild(styleExtra);

    function header(){
      return '<div class="bokrun-hero"><div><div class="bokrun-kicker">BOKRUN · RELIC RUSH</div><h2>BokRun</h2><p>캐릭터와 유물의 조합을 만들고, 새로운 월드와 라운드를 하나씩 해금하세요.</p></div><div class="bokrun-wallet"><span>🪙 골드 <strong>'+profile.gold.toLocaleString()+'</strong></span><span>💎 젬 <strong>'+profile.gems.toLocaleString()+'</strong></span><span>🏆 클리어 <strong>'+profile.lifetime.clears+'</strong></span></div></div>';
    }
    function nav(){
      const tabs=[['play','PLAY'],['collection','COLLECTION'],['gacha','GACHA'],['shop','SHOP']];
      return '<div class="bokrun-nav">'+tabs.map(t=>'<button data-br-view="'+t[0]+'" class="'+(view===t[0]?'active':'')+'">'+t[1]+'</button>').join('')+'</div>';
    }
    function render(){
      if(running){renderGame();return;}
      section.innerHTML='<div class="bokrun-shell">'+header()+nav()+'<div class="bokrun-body">'+(view==='play'?renderPlay():view==='collection'?renderCollection():view==='gacha'?renderGacha():renderShop())+'</div></div>';
      bind();
    }

    function objectiveText(r){
      if(r.mode==='coins')return '코인 '+r.goal+'개 수집';
      if(r.mode==='score')return r.goal.toLocaleString()+'점 달성';
      if(r.mode==='combo')return r.goal+' COMBO 달성';
      return r.goal+'m 도달';
    }

    function renderPlay(){
      const round=roundBy(selectedRound),world=WORLDS[round.world],character=charBy(profile.selectedCharacter);
      const equipped=profile.equippedRelics.map(relicBy);
      const worlds=WORLDS.map((item,idx)=>{
        const first=idx*5+1,locked=profile.unlockedRound<first;
        return '<button class="bokrun-world '+(round.world===idx?'active ':'')+(locked?'locked':'')+'" data-world="'+idx+'" '+(locked?'disabled':'')+'><span>'+item.emoji+'</span><b>'+esc(item.name)+'</b><small>'+(locked?'ROUND '+(first-1)+' 1★ 클리어 시 해금':'ROUND '+first+'-'+(first+4))+'</small></button>';
      }).join('');
      const start=round.world*5+1;
      const rounds=Array.from({length:5},(_,i)=>{
        const id=start+i,locked=id>profile.unlockedRound,stars=profile.roundStars[id]||0;
        return '<button class="bokrun-round '+(selectedRound===id?'active ':'')+(locked?'locked':'')+'" data-round="'+id+'" '+(locked?'disabled':'')+' title="'+(locked?'직전 라운드 1★ 클리어 시 해금':'클리어 기록 '+stars+'★')+'">'+world.emoji+'<br>'+id+'<span class="bokrun-stars">'+('★'.repeat(stars)+'☆'.repeat(3-stars))+'</span></button>';
      }).join('');

      const preItems=Object.values(CONSUMABLES).map(it=>{
        const count=profile.inventory[it.id]||0,active=profile.selectedConsumables.includes(it.id),canBuy=profile.gold>=it.price;
        return '<div class="bokrun-preitem '+(active?'active':'')+'"><label class="bokrun-preitem-top"><input type="checkbox" data-consume="'+it.id+'" '+(active?'checked':'')+' '+(!count?'disabled':'')+'><span>'+it.emoji+'</span><b>'+esc(it.name)+'</b><small>보유 '+count+'</small></label><button class="buy" data-buy-pre="'+it.id+'" '+(!canBuy?'disabled':'')+'>+1 구매 · 🪙 '+it.price+'</button></div>';
      }).join('');
      const missingCost=Object.values(CONSUMABLES).reduce((sum,it)=>sum+((profile.inventory[it.id]||0)>0?0:it.price),0);
      const buyAll='<label class="bokrun-buyall"><input id="br-buy-all" type="checkbox" '+(profile.gold<missingCost?'disabled':'')+'><span><b>4종 모두 구매 + 모두 장착</b><br>없는 아이템만 1개씩 구매합니다. 필요 골드 🪙 '+missingCost.toLocaleString()+'</span></label>';

      const loadout='<div class="bokrun-loadout"><div class="bokrun-slot"><span class="bokrun-avatar" style="background:'+character.accent+'">'+character.emoji+'</span><span><b>'+esc(character.name)+' · '+character.rarity+'</b><small>HP '+getCharacterMaxHealth(character,profile.ownedCharacters[character.id]?.level||1)+' · '+esc(character.skill)+' · '+esc(character.desc)+'</small></span><span class="rarity '+rarityClass(character.rarity)+'">Lv.'+(profile.ownedCharacters[character.id]?.level||1)+'</span></div>'+equipped.map(x=>'<div class="bokrun-slot"><span class="bokrun-avatar" style="background:#f4f4f4">'+x.emoji+'</span><span><b>'+esc(x.name)+' · '+x.rarity+'</b><small>'+esc(x.desc)+'</small></span></div>').join('')+'</div>';
      const recordsHtml=records.length?records.slice(0,5).map((x,i)=>'<li><span>'+(i+1)+'. '+esc(x.character)+' · '+esc(x.stage)+'</span><strong>'+Number(x.score||0).toLocaleString()+'</strong></li>').join(''):'<li><span>아직 기록이 없습니다.</span></li>';
      const build=recommendedBuild(round),buildChar=charBy(build.character),buildRelics=build.relics.map(relicBy),canApply=ownsBuild(build);
      const activeSets=activeSetIds();
      const setHtml=activeSets.length?activeSets.map(s=>'<div class="bokrun-set-active"><b>'+s.emoji+' '+esc(s.name)+'</b><small>'+esc(s.desc)+'</small></div>').join(''):'<div class="bokrun-set-empty">현재 활성 세트 없음 · 같은 테마 캐릭터 + 관련 유물 2개를 맞추면 세트 효과가 발동합니다.</div>';
      const recommendation='<div class="bokrun-recommend"><div><span>추천 조합 · '+esc(build.title)+'</span><b>'+buildChar.emoji+' '+esc(buildChar.name)+' + '+buildRelics.map(x=>x.emoji+' '+x.name).join(' / ')+'</b><small>'+esc(build.reason)+'</small></div><button data-apply-build="'+round.mode+'" '+(canApply?'':'disabled')+'>'+(canApply?'추천 장착':'미보유 포함')+'</button></div>';
      const starPct=Math.round(round.star2Multiplier*100);
      const ruleHtml='<div class="bokrun-star-rules"><b>별 · 해금 기준</b><span>★ 목표 100% 달성 = 클리어</span><span>★★ 목표 '+starPct+'% 이상</span><span>★★★ 목표 '+starPct+'% 이상 + 무피격</span><span>→ 다음 라운드: 1★ 클리어</span><span>→ 다음 월드: 5라운드 1★ 클리어</span></div>';
      const firstGem=35+round.world*8+(round.round===5?25:0);
      const repeatGem=8+round.world*2+Math.max(1,profile.roundStars[round.id]||1)*3;
      return '<div class="bokrun-grid"><div class="bokrun-card"><h3>스테이지 선택</h3><p>1월드는 튜토리얼 난이도로 완화했습니다. 먹을거리와 파워업을 충분히 챙기면 자연스럽게 클리어됩니다.</p><div class="bokrun-worlds">'+worlds+'</div><div class="bokrun-rounds">'+rounds+'</div><div class="bokrun-objective"><div><b>'+world.emoji+' '+esc(world.name)+' · ROUND '+round.title+'</b><small>'+objectiveText(round)+' · 2★ 기준 '+round.bonusGoal.toLocaleString()+' · 총 '+round.distance+'m · 첫 클리어 💎 '+firstGem+' / 재클리어 💎 '+repeatGem+'</small></div><em>'+(profile.roundStars[round.id]?'★'.repeat(profile.roundStars[round.id]):'NEW')+'</em></div>'+ruleHtml+recommendation+'</div><aside class="bokrun-card"><h3>RUN BUILD</h3><p>체력·고유스킬·유물·세트 효과가 모두 실제 런에 적용됩니다.</p>'+loadout+'<div class="bokrun-set-box"><h4>활성 세트 시너지</h4>'+setHtml+'</div><h3 style="margin-top:12px">시작 아이템</h3><p>여기서 바로 구매하고 체크해서 들고 갈 수 있습니다.</p><div class="bokrun-preitems">'+preItems+'</div>'+buyAll+'<button class="bokrun-start" id="bokrun-start">▶ ROUND '+round.title+' 시작</button></aside></div><div class="bokrun-card" style="margin-top:16px"><h3>BEST RUNS</h3><ul class="bokrun-record-list">'+recordsHtml+'</ul></div>';
    }

    function needShards(level){return 2+level*2;}
    function renderCollection(){
      const filters=['ALL','N','R','SR','SSR'].map(x=>'<button data-rarity-filter="'+x+'" class="'+(collectionRarity===x?'active':'')+'">'+x+'</button>').join('');
      const typeTabs='<div class="bokrun-collection-tabs"><button data-collection-type="character" class="'+(collectionType==='character'?'active':'')+'">🍪 캐릭터 '+Object.keys(profile.ownedCharacters).length+'/'+CHARACTERS.length+'</button><button data-collection-type="relic" class="'+(collectionType==='relic'?'active':'')+'">🔮 유물 '+Object.keys(profile.ownedRelics).length+'/'+RELICS.length+'</button><button data-collection-type="set" class="'+(collectionType==='set'?'active':'')+'">✨ 세트 '+SETS.length+'</button></div>';
      const filterBar=collectionType==='set'?'':'<div class="bokrun-rarity-filter">'+filters+'</div>';

      let body='';
      if(collectionType==='character'){
        const visible=collectionRarity==='ALL'?CHARACTERS:CHARACTERS.filter(c=>c.rarity===collectionRarity);
        body=visible.map(c=>{
          const own=profile.ownedCharacters[c.id],selected=profile.selectedCharacter===c.id,level=own?.level||1,need=own?needShards(level):0;
          return '<article class="bokrun-compact '+(!own?'locked ':'')+(selected?'selected':'')+'"><span class="bokrun-avatar" style="background:'+c.accent+'">'+c.emoji+'</span><div class="bokrun-compact-main"><b>'+esc(c.name)+' <span class="'+rarityClass(c.rarity)+'">'+c.rarity+'</span></b><small>HP '+getCharacterMaxHealth(c,level)+' · '+esc(c.skill)+' · '+(own?'Lv.'+level:'미보유')+'</small></div><div class="bokrun-compact-actions"><button data-detail-char="'+c.id+'">상세</button>'+(own?'<button class="primary" data-select-char="'+c.id+'">'+(selected?'선택됨':'선택')+'</button><button data-up-char="'+c.id+'" '+(own.shards<need||level>=levelCap()?'disabled':'')+'>강화</button>':'')+'</div></article>';
        }).join('');
      }else if(collectionType==='relic'){
        const visible=collectionRarity==='ALL'?RELICS:RELICS.filter(x=>x.rarity===collectionRarity);
        body=visible.map(x=>{
          const own=profile.ownedRelics[x.id],eq=profile.equippedRelics.includes(x.id),level=own?.level||1,need=own?needShards(level):0;
          return '<article class="bokrun-compact '+(!own?'locked ':'')+(eq?'selected':'')+'"><span class="bokrun-avatar" style="background:#f4f4f4">'+x.emoji+'</span><div class="bokrun-compact-main"><b>'+esc(x.name)+' <span class="'+rarityClass(x.rarity)+'">'+x.rarity+'</span></b><small>'+esc(x.desc)+' · '+(own?'Lv.'+level:'미보유')+'</small></div><div class="bokrun-compact-actions"><button data-detail-relic="'+x.id+'">상세</button>'+(own?'<button class="primary" data-equip-relic="'+x.id+'">'+(eq?'해제':'장착')+'</button><button data-up-relic="'+x.id+'" '+(own.shards<need||level>=levelCap()?'disabled':'')+'>강화</button>':'')+'</div></article>';
        }).join('');
      }else{
        body=SETS.map(s=>'<article class="bokrun-compact"><span class="bokrun-avatar" style="background:#fff8cf">'+s.emoji+'</span><div class="bokrun-compact-main"><b>'+esc(s.name)+'</b><small>'+esc(s.desc)+'</small></div><div class="bokrun-compact-actions"><button data-detail-set="'+s.id+'">구성 보기</button></div></article>').join('');
      }
      return '<div class="bokrun-card"><h3>COLLECTION</h3><p>한꺼번에 다 펼치지 않고 캐릭터 / 유물 / 세트를 나눠서 봅니다. 항목을 누르면 상세 능력치를 확인할 수 있습니다.</p>'+typeTabs+filterBar+'</div><div class="bokrun-card" style="margin-top:12px"><div class="bokrun-collection-list">'+body+'</div></div>';
    }

    function showCollectionDetail(type,id){
      const overlay=document.createElement('div');overlay.className='bokrun-overlay';
      let html='';
      if(type==='character'){
        const c=charBy(id),own=profile.ownedCharacters[c.id],level=own?.level||1,hp=getCharacterMaxHealth(c,level);
        html='<h3>'+c.emoji+' '+esc(c.name)+'</h3><p>'+c.rarity+' · '+(own?'Lv.'+level:'미보유')+'</p><div class="bokrun-detail-grid"><div class="bokrun-detail-hero" style="background:'+c.accent+'">'+c.emoji+'</div><div><b>'+esc(c.skill)+'</b><p style="margin-top:5px">'+esc(c.desc)+'</p><div class="bokrun-detail-stats"><div><small>체력</small><b>'+hp+'</b></div><div><small>기본 쿨타임</small><b>'+c.active.cooldown+'s</b></div><div><small>최대 점프</small><b>'+((c.passive&&c.passive.maxJumps)||2)+'회</b></div></div><p style="margin-top:10px">'+(own?charLevelSummary(c,level):'가챠에서 획득하면 사용할 수 있습니다.')+'</p></div></div>';
      }else if(type==='relic'){
        const x=relicBy(id),own=profile.ownedRelics[x.id],level=own?.level||1;
        html='<h3>'+x.emoji+' '+esc(x.name)+'</h3><p>'+x.rarity+' · '+(own?'Lv.'+level:'미보유')+'</p><div class="bokrun-detail-grid"><div class="bokrun-detail-hero">'+x.emoji+'</div><div><b>고유 효과</b><p style="margin-top:5px">'+esc(x.desc)+'</p><div class="bokrun-detail-stats"><div><small>장착</small><b>'+(profile.equippedRelics.includes(x.id)?'장착 중':'미장착')+'</b></div><div><small>레벨</small><b>'+level+'/10</b></div><div><small>강화</small><b>레벨당 +15%</b></div></div><p style="margin-top:10px">'+(own?relicLevelSummary(level):'가챠에서 획득하면 장착할 수 있습니다.')+'</p></div></div>';
      }else{
        const s=SETS.find(x=>x.id===id)||SETS[0];
        const chars=s.characterIds.map(charBy),rels=s.relicIds.map(relicBy);
        html='<h3>'+s.emoji+' '+esc(s.name)+'</h3><p>'+esc(s.desc)+'</p><div class="bokrun-card" style="margin-top:12px"><b>세트 캐릭터</b><p style="margin-top:7px">'+chars.map(c=>c.emoji+' '+esc(c.name)).join(' · ')+'</p></div><div class="bokrun-card" style="margin-top:8px"><b>세트 유물</b><p style="margin-top:7px">'+rels.map(x=>x.emoji+' '+esc(x.name)).join(' · ')+'</p></div>';
      }
      overlay.innerHTML='<div class="bokrun-modal">'+html+'<div class="bokrun-modal-actions" style="margin-top:14px"><button class="primary" id="br-detail-close">확인</button></div></div>';
      document.body.appendChild(overlay);
      overlay.querySelector('#br-detail-close').onclick=()=>overlay.remove();
      overlay.onclick=e=>{if(e.target===overlay)overlay.remove();};
    }

    function renderGacha(){
      const poolSummary=list=>['N','R','SR','SSR'].map(r=>r+' '+list.filter(x=>x.rarity===r).length+'종').join(' · ');
      const banners=[['character','CHARACTER GACHA','새 러너와 중복 조각을 획득합니다. · '+poolSummary(CHARACTERS),100],['relic','RELIC GACHA','새 유물과 강화 조각을 획득합니다. · '+poolSummary(RELICS),80]].map(b=>{
        const active=selectedGacha===b[0],cost=b[3],pity=profile.pity[b[0]]||0;
        return '<div class="bokrun-banner '+(active?'active':'')+'" data-gacha-banner="'+b[0]+'"><h3>'+b[1]+'</h3><p>'+b[2]+'</p><div class="bokrun-rates"><span>N 72%</span><span>R 22%</span><span>SR 5%</span><span>SSR 1%</span><span>SSR PITY '+pity+'/40</span></div><div class="bokrun-gacha-actions"><button data-pull="'+b[0]+'" data-count="1" '+(profile.gems<cost?'disabled':'')+'>1회 💎 '+cost+'</button><button class="ten" data-pull="'+b[0]+'" data-count="10" '+(profile.gems<cost*9?'disabled':'')+'>10회 💎 '+(cost*9)+'</button></div></div>';
      }).join('');
      return '<div class="bokrun-card"><h3>GACHA</h3><p>실제 결제는 없습니다. 첫 클리어·재클리어·3성 달성으로 젬을 꾸준히 얻습니다. 10회는 R 이상 1개 보장, 40회 내 SSR 보장.</p><div class="bokrun-gacha-grid">'+banners+'</div></div>';
    }

    function renderShop(){
      const items=Object.values(CONSUMABLES).map(it=>'<div class="bokrun-shop-item"><div class="icon">'+it.emoji+'</div><h4>'+esc(it.name)+'</h4><p>'+esc(it.desc)+'</p><div class="bokrun-sub">보유 '+(profile.inventory[it.id]||0)+'개</div><button data-buy="'+it.id+'" '+(profile.gold<it.price?'disabled':'')+'>🪙 '+it.price.toLocaleString()+' 구매</button></div>').join('');
      return '<div class="bokrun-card"><h3>RUN SHOP</h3><p>골드는 런 결과로 획득합니다. 구매한 아이템은 PLAY 화면에서 선택해서 사용합니다.</p><div class="bokrun-shop">'+items+'</div></div>';
    }

    function bind(){
      section.querySelectorAll('[data-br-view]').forEach(b=>b.onclick=()=>{view=b.dataset.brView;render();});
      section.querySelectorAll('[data-rarity-filter]').forEach(b=>b.onclick=()=>{collectionRarity=b.dataset.rarityFilter;render();});
      section.querySelectorAll('[data-collection-type]').forEach(b=>b.onclick=()=>{collectionType=b.dataset.collectionType;render();});
      section.querySelectorAll('[data-detail-char]').forEach(b=>b.onclick=()=>showCollectionDetail('character',b.dataset.detailChar));
      section.querySelectorAll('[data-detail-relic]').forEach(b=>b.onclick=()=>showCollectionDetail('relic',b.dataset.detailRelic));
      section.querySelectorAll('[data-detail-set]').forEach(b=>b.onclick=()=>showCollectionDetail('set',b.dataset.detailSet));
      section.querySelectorAll('[data-apply-build]').forEach(b=>b.onclick=()=>{const build=recommendedBuild(roundBy(selectedRound));if(!ownsBuild(build))return;profile.selectedCharacter=build.character;profile.equippedRelics=build.relics.slice(0,3);persist();render();});
      section.querySelectorAll('[data-world]').forEach(b=>b.onclick=()=>{const w=Number(b.dataset.world),id=w*5+1;if(id<=profile.unlockedRound){selectedRound=Math.max(id,Math.min(profile.unlockedRound,id+4));render();}});
      section.querySelectorAll('[data-round]').forEach(b=>b.onclick=()=>{const id=Number(b.dataset.round);if(id<=profile.unlockedRound){selectedRound=id;render();}});
      section.querySelectorAll('[data-consume]').forEach(b=>b.onchange=()=>toggleConsume(b.dataset.consume));
      section.querySelectorAll('[data-buy-pre]').forEach(b=>b.onclick=()=>buyPre(b.dataset.buyPre));
      const buyAll=section.querySelector('#br-buy-all');if(buyAll)buyAll.onchange=()=>{if(buyAll.checked)buyAllPreItems();};
      const start=section.querySelector('#bokrun-start');if(start)start.onclick=startRun;
      section.querySelectorAll('[data-select-char]').forEach(b=>b.onclick=()=>{profile.selectedCharacter=b.dataset.selectChar;persist();render();});
      section.querySelectorAll('[data-up-char]').forEach(b=>b.onclick=()=>upgrade('character',b.dataset.upChar));
      section.querySelectorAll('[data-equip-relic]').forEach(b=>b.onclick=()=>equipRelic(b.dataset.equipRelic));
      section.querySelectorAll('[data-up-relic]').forEach(b=>b.onclick=()=>upgrade('relic',b.dataset.upRelic));
      section.querySelectorAll('[data-gacha-banner]').forEach(b=>b.onclick=e=>{if(e.target.closest('[data-pull]'))return;selectedGacha=b.dataset.gachaBanner;render();});
      section.querySelectorAll('[data-pull]').forEach(b=>b.onclick=()=>pull(b.dataset.pull,Number(b.dataset.count)));
      section.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>buy(b.dataset.buy));
    }

    function buyPre(id){
      const item=CONSUMABLES[id];if(!item||profile.gold<item.price)return;
      profile.gold-=item.price;profile.inventory[id]=(profile.inventory[id]||0)+1;
      if(!profile.selectedConsumables.includes(id))profile.selectedConsumables.push(id);
      persist();render();
    }
    function buyAllPreItems(){
      const list=Object.values(CONSUMABLES);
      const cost=list.reduce((sum,it)=>sum+((profile.inventory[it.id]||0)>0?0:it.price),0);
      if(profile.gold<cost)return;
      list.forEach(it=>{
        if((profile.inventory[it.id]||0)<=0){profile.gold-=it.price;profile.inventory[it.id]=1;}
        if(!profile.selectedConsumables.includes(it.id))profile.selectedConsumables.push(it.id);
      });
      persist();render();
    }

    function toggleConsume(id){
      if(!(profile.inventory[id]>0))return;
      const i=profile.selectedConsumables.indexOf(id);
      if(i>=0)profile.selectedConsumables.splice(i,1);else profile.selectedConsumables.push(id);
      persist();render();
    }
    function equipRelic(id){
      const i=profile.equippedRelics.indexOf(id);
      if(i>=0)profile.equippedRelics.splice(i,1);
      else{if(profile.equippedRelics.length>=3)profile.equippedRelics.shift();profile.equippedRelics.push(id);}
      persist();render();
    }
    function upgrade(type,id){
      const map=type==='character'?profile.ownedCharacters:profile.ownedRelics,own=map[id];if(!own)return;
      if(own.level>=levelCap())return;
      const need=needShards(own.level);if(own.shards<need)return;
      own.shards-=need;own.level=Math.min(levelCap(),own.level+1);persist();render();
    }
    function buy(id){
      const item=CONSUMABLES[id];if(!item||profile.gold<item.price)return;
      profile.gold-=item.price;profile.inventory[id]=(profile.inventory[id]||0)+1;persist();render();
    }

    function rarityRoll(type,forceR){
      if((profile.pity[type]||0)>=39)return 'SSR';
      const x=Math.random()*100;
      if(x<1)return 'SSR';if(x<6)return 'SR';if(x<28)return 'R';if(forceR)return 'R';return 'N';
    }
    function pull(type,count){
      selectedGacha=type;
      const cost=(type==='character'?100:80)*(count===10?9:1);
      if(profile.gems<cost)return;
      profile.gems-=cost;
      const pool=type==='character'?CHARACTERS:RELICS,map=type==='character'?profile.ownedCharacters:profile.ownedRelics;
      const results=[];
      for(let i=0;i<count;i++){
        const guaranteed=count===10&&i===count-1&&!results.some(x=>['R','SR','SSR'].includes(x.item.rarity));
        const rarity=rarityRoll(type,guaranteed),candidates=pool.filter(x=>x.rarity===rarity),item=candidates[Math.floor(Math.random()*candidates.length)]||pool[0],isNew=!map[item.id];
        if(isNew)map[item.id]={level:1,shards:0};else map[item.id].shards+=item.rarity==='SSR'?4:item.rarity==='SR'?3:item.rarity==='R'?2:1;
        profile.pity[type]=item.rarity==='SSR'?0:(profile.pity[type]||0)+1;results.push({item,isNew});
      }
      persist();showGachaResult(results,type);
    }

    function showGachaResult(results,type){
      const overlay=document.createElement('div');overlay.className='bokrun-overlay';
      overlay.innerHTML='<div class="bokrun-modal"><h3>'+(type==='character'?'CHARACTER':'RELIC')+' RESULT</h3><p>중복 획득은 강화 조각으로 전환됩니다.</p><div class="bokrun-pulls">'+results.map(r=>'<div class="bokrun-pull '+rarityClass(r.item.rarity)+'"><span>'+r.item.emoji+'</span><b>'+esc(r.item.name)+'</b><small>'+r.item.rarity+(r.isNew?' · NEW':' · 조각')+'</small></div>').join('')+'</div><div class="bokrun-modal-actions"><button class="primary" id="bokrun-gacha-close">확인</button></div></div>';
      document.body.appendChild(overlay);overlay.querySelector('#bokrun-gacha-close').onclick=()=>{overlay.remove();render();};
    }

    function consumeSelected(){
      const used={};profile.selectedConsumables.forEach(id=>{if(profile.inventory[id]>0){profile.inventory[id]--;used[id]=true;}});profile.selectedConsumables=[];return used;
    }

    function startRun(){
      const used=consumeSelected();persist();
      engine=new RunnerEngine(Math.random);engine.configure({characterId:profile.selectedCharacter,characterLevel:profile.ownedCharacters[profile.selectedCharacter]?.level||1,relicIds:profile.equippedRelics,relicLevels:Object.fromEntries(profile.equippedRelics.map(id=>[id,profile.ownedRelics[id]?.level||1])),roundId:selectedRound,consumables:used});
      running=true;paused=false;last=0;renderGame();requestAnimationFrame(()=>{resizeCanvas();updateHud();raf=requestAnimationFrame(frame);});
    }

    function renderGame(){
      const c=charBy(profile.selectedCharacter),round=roundBy(selectedRound),world=WORLDS[round.world],relics=profile.equippedRelics.map(relicBy),sets=activeSetIds();
      const itemLegend=Object.values(POWERUPS).map(x=>'<span class="bokrun-guide-chip" title="'+esc(x.desc)+'">'+x.emoji+' '+esc(x.name)+'</span>').join('');
      const relicLegend=relics.map(x=>x.emoji+' '+x.name+' ['+x.desc+']').join(' · ');
      const setLegend=sets.length?sets.map(x=>x.emoji+' '+x.name).join(' · '):'세트 없음';
      section.innerHTML='<div class="bokrun-shell"><div class="bokrun-hero"><div><div class="bokrun-kicker">RUNNING · '+esc(world.name)+'</div><h2>'+c.emoji+' '+esc(c.name)+' · '+round.title+'</h2><p>'+objectiveText(round)+' · 체력과 부활을 관리하면서 파워업 콤보를 노리세요.</p></div><div class="bokrun-wallet"><span>'+world.emoji+' '+esc(world.name)+'</span></div></div><div class="bokrun-body"><div class="bokrun-game"><div class="bokrun-game-top"><div class="bokrun-hud"><span>점수<strong id="br-score">0</strong></span><span>거리<strong id="br-distance">0m</strong></span><span>골드<strong id="br-coins">0</strong></span><span>콤보<strong id="br-combo">0</strong></span><span>실드<strong id="br-shield">0</strong></span><span>부활<strong id="br-revive">0</strong></span><span>체력<strong id="br-health">0/0</strong><span class="bokrun-hpbar"><i id="br-hpbar"></i></span></span><span>목표<strong id="br-objective">-</strong></span></div><button class="bokrun-skill" id="br-skill">'+esc(c.skill)+'</button></div><div class="bokrun-progress"><i id="br-progress"></i></div><div class="bokrun-map-badge">먹을거리 ●골드 ◆젤리 · 아이템은 아래 범례 확인</div><canvas id="bokrun-canvas" width="1100" height="390" tabindex="0" aria-label="BokRun 러닝 게임"></canvas><div class="bokrun-runmsg" id="br-message" hidden><b></b><span></span></div><div class="bokrun-activebuffs" id="br-buffs">활성 효과 없음</div><div class="bokrun-guidebar"><div class="bokrun-controls-guide"><span class="bokrun-guide-chip"><strong>SPACE / ↑</strong> 점프</span><span class="bokrun-guide-chip"><strong>↓ / S</strong> 슬라이드</span><span class="bokrun-guide-chip"><strong>Q / SHIFT</strong> 고유스킬</span><span class="bokrun-guide-chip"><strong>P</strong> 일시정지</span></div><div class="bokrun-item-guide">'+itemLegend+'</div><div class="bokrun-skill-guide"><b>'+c.emoji+' '+esc(c.skill)+'</b><span>'+esc(c.desc)+' · 유물: '+esc(relicLegend||'없음')+' · 세트: '+esc(setLegend)+'</span><div><div id="br-cooltext" style="font-size:8px;text-align:right;margin-bottom:3px">READY</div><div class="bokrun-cooltrack"><i id="br-coolbar"></i></div></div></div></div><div class="bokrun-mobile-controls"><button id="br-jump">⬆ 점프</button><button id="br-slide">⬇ 슬라이드</button><button class="skill" id="br-skill2">'+esc(c.skill)+'</button><button id="br-pause">Ⅱ 일시정지</button></div></div></div></div>';
      canvas=section.querySelector('#bokrun-canvas');ctx=canvas.getContext('2d');
      section.querySelector('#br-jump').onpointerdown=jump;
      const slide=section.querySelector('#br-slide');slide.onpointerdown=()=>engine.slide(true);slide.onpointerup=()=>engine.slide(false);slide.onpointerleave=()=>engine.slide(false);
      section.querySelector('#br-skill').onclick=useSkill;section.querySelector('#br-skill2').onclick=useSkill;section.querySelector('#br-pause').onclick=togglePause;
      canvas.onpointerdown=e=>{e.preventDefault();jump();};canvas.focus({preventScroll:true});new ResizeObserver(resizeCanvas).observe(canvas);
    }

    function showRunMessage(title,sub){const el=section.querySelector('#br-message');if(!el)return;el.hidden=false;el.querySelector('b').textContent=title;el.querySelector('span').textContent=sub;}
    function hideRunMessage(){const el=section.querySelector('#br-message');if(el)el.hidden=true;}
    function jump(){if(running&&!paused&&engine)engine.jump();}
    function useSkill(){if(running&&!paused&&engine&&engine.useSkill())updateHud();}
    function togglePause(){if(!running)return;paused=!paused;const b=section.querySelector('#br-pause');if(b)b.textContent=paused?'계속하기':'일시정지';if(paused){cancelAnimationFrame(raf);showRunMessage('PAUSED','계속하기를 누르면 이어집니다.');}else{hideRunMessage();last=0;raf=requestAnimationFrame(frame);}}

    function resizeCanvas(){if(!canvas||!canvas.clientWidth)return;width=Math.max(620,Math.min(1100,canvas.clientWidth));const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=390*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);draw();}

    function updateHud(){
      if(!engine)return;
      const set=(id,v)=>{const el=section.querySelector('#'+id);if(el)el.textContent=v;};
      set('br-score',engine.score.toLocaleString());set('br-distance',Math.floor(engine.distance)+'m');set('br-coins',engine.coins);set('br-combo',engine.combo);set('br-shield',engine.shield);set('br-revive',engine.revives);set('br-health',Math.ceil(engine.health)+'/'+engine.maxHealth);set('br-objective',engine.objectiveLabel);
      const hp=section.querySelector('#br-hpbar');if(hp)hp.style.width=(Math.max(0,engine.health)/engine.maxHealth*100).toFixed(1)+'%';
      const prog=section.querySelector('#br-progress');if(prog)prog.style.width=(engine.progress*100).toFixed(1)+'%';
      const c=charBy(profile.selectedCharacter),ready=engine.skillReady,label=ready?c.skill:c.skill+' '+engine.skillCooldown.toFixed(1)+'s';
      [section.querySelector('#br-skill'),section.querySelector('#br-skill2')].forEach(b=>{if(b){b.textContent=label;b.disabled=!ready;}});
      const cooldownTotal=Math.max(.01,engine.activeCooldownTotal),coolPct=ready?100:Math.max(0,100*(1-engine.skillCooldown/cooldownTotal));
      const coolbar=section.querySelector('#br-coolbar');if(coolbar)coolbar.style.width=coolPct.toFixed(1)+'%';
      set('br-cooltext',ready?'READY':engine.skillCooldown.toFixed(1)+'s');
      const buffs=[];
      if(engine.magnetFor>0)buffs.push('🧲 자석 '+engine.magnetFor.toFixed(1)+'s');
      if(engine.boosterFor>0)buffs.push('⚡ 부스터 '+engine.boosterFor.toFixed(1)+'s');
      if(engine.giantFor>0)buffs.push('🦣 거인 '+engine.giantFor.toFixed(1)+'s');
      if(engine.invincibleFor>0)buffs.push('⭐ 무적 '+engine.invincibleFor.toFixed(1)+'s');
      if(engine.doubleScoreFor>0)buffs.push('2X 점수 '+engine.doubleScoreFor.toFixed(1)+'s');
      if(engine.coinRushFor>0)buffs.push('🪙 코인러시 '+engine.coinRushFor.toFixed(1)+'s');
      if(engine.giantFor>0&&engine.boosterFor>0)buffs.unshift('💥 부스터+거인 COMBO · 모든 장애물 파괴');
      set('br-buffs',buffs.length?buffs.join('  ·  '):'활성 효과 없음');
    }

    function frame(time){if(!running||paused||!engine)return;const dt=last?(time-last)/1000:0;last=time;engine.step(dt,width);updateHud();draw();if(engine.dead||engine.cleared)finishRun();else raf=requestAnimationFrame(frame);}

    function finishRun(){
      running=false;paused=false;cancelAnimationFrame(raf);
      const rewards=engine.getRewards(),r=roundBy(selectedRound),w=WORLDS[r.world],c=charBy(profile.selectedCharacter);
      let first=false,stars=0,firstThreeStar=false;
      const previousStars=profile.roundStars[r.id]||0;
      if(rewards.clear){
        first=!profile.firstClear[r.id];profile.firstClear[r.id]=true;profile.unlockedRound=Math.max(profile.unlockedRound,Math.min(25,r.id+1));
        const bonusMet=engine.objectiveValue>=r.bonusGoal;stars=1+(bonusMet?1:0)+(bonusMet&&engine.hitCount===0?1:0);
        firstThreeStar=stars===3&&previousStars<3&&!profile.firstThreeStar[r.id];
        if(firstThreeStar)profile.firstThreeStar[r.id]=true;
        profile.roundStars[r.id]=Math.max(previousStars,stars);profile.lifetime.clears++;
      }
      const firstClearGem=35+r.world*8+(r.round===5?25:0);
      const repeatGem=8+r.world*2+Math.max(1,stars||previousStars||1)*3;
      const threeStarBonus=firstThreeStar?25:0;
      const gemReward=rewards.clear?(first?firstClearGem:repeatGem)+threeStarBonus:2;
      profile.gold+=rewards.gold;profile.gems+=gemReward;profile.lifetime.runs++;profile.lifetime.gold+=rewards.gold;profile.lifetime.gems+=gemReward;profile.lifetime.bestScore=Math.max(profile.lifetime.bestScore,rewards.score);profile.lifetime.bestCombo=Math.max(profile.lifetime.bestCombo,rewards.maxCombo);
      records.unshift({score:rewards.score,stage:w.name+' '+r.title,character:c.name,date:new Date().toLocaleDateString('ko-KR')});records.sort((a,b)=>b.score-a.score);records=records.slice(0,10);saveRecords();persist();showResult(rewards,gemReward,stars,first,firstThreeStar,r.id);
    }

    function showResult(rewards,gems,stars,first,firstThreeStar,clearedRoundId){
      const overlay=document.createElement('div');overlay.className='bokrun-overlay';
      overlay.innerHTML='<div class="bokrun-modal"><h3>'+(rewards.clear?'STAGE CLEAR!':'RUN END')+'</h3><p>'+(rewards.clear?(first?'첫 클리어 보너스를 획득했습니다.'+(firstThreeStar?' 3성 최초 달성 +25💎!':''):'재클리어 보상을 받았습니다.'+(firstThreeStar?' 3성 최초 달성 +25💎!':''))+(clearedRoundId<25?' · 다음 ROUND '+roundBy(clearedRoundId+1).title+' 해금!':' · 모든 스테이지 완료!'):'실패 보상 2💎를 받았습니다. 빌드와 아이템을 바꿔 다시 도전해보세요.')+'</p><div style="font-size:26px;margin-top:10px;color:#e0a600">'+(rewards.clear?'★'.repeat(stars)+'☆'.repeat(3-stars):'☆☆☆')+'</div><div class="bokrun-result-stats"><div><small>점수</small><b>'+rewards.score.toLocaleString()+'</b></div><div><small>최대 콤보</small><b>'+rewards.maxCombo+'</b></div><div><small>골드</small><b>+'+rewards.gold+'</b></div><div><small>젬</small><b>+'+gems+'</b></div></div><div class="bokrun-modal-actions"><button id="br-retry">다시 도전</button><button id="br-lobby">로비로</button>'+(rewards.clear&&clearedRoundId<25?'<button class="primary" id="br-next">다음 스테이지 ▶</button>':'')+'</div></div>';
      document.body.appendChild(overlay);
      overlay.querySelector('#br-lobby').onclick=()=>{overlay.remove();if(rewards.clear&&clearedRoundId<25)selectedRound=clearedRoundId+1;view='play';render();};
      overlay.querySelector('#br-retry').onclick=()=>{overlay.remove();selectedRound=clearedRoundId;startRun();};
      const nextBtn=overlay.querySelector('#br-next');
      if(nextBtn)nextBtn.onclick=()=>{overlay.remove();selectedRound=Math.min(25,clearedRoundId+1);view='play';render();};
    }

    function draw(){
      if(!ctx||!engine)return;
      const world=WORLDS[engine.round.world],pal=world.palette,ground=326,scroll=engine.distance*9;
      const grad=ctx.createLinearGradient(0,0,0,ground);grad.addColorStop(0,pal[0]);grad.addColorStop(1,pal[1]);ctx.fillStyle=grad;ctx.fillRect(0,0,width,390);
      drawWorld(world,ground,scroll);ctx.fillStyle=pal[4];ctx.fillRect(0,ground,width,64);ctx.fillStyle=engine.round.world===2?'#edfaff':'#ffffff35';ctx.fillRect(0,ground,width,6);
      for(let x=-50-(scroll%54);x<width+54;x+=54){ctx.fillStyle='#00000016';ctx.fillRect(x,ground+30,38,2);}
      engine.objects.forEach(o=>drawObject(o,ground));drawParticles(ground);drawRunner(engine.player.x,ground-engine.player.y-engine.player.height,charBy(profile.selectedCharacter),engine);
      if(engine.invincibleFor>0||engine.magnetFor>0||engine.doubleScoreFor>0||engine.skillFor>0||engine.giantFor>0||engine.boosterFor>0)drawAura(engine.player.x+17,ground-engine.player.y-22,engine);
    }

    function drawWorld(world,ground,scroll){
      const wi=engine.round.world,round=engine.round.round;ctx.globalAlpha=.28;
      for(let i=-1;i<8;i++){
        const x=i*220-(scroll*.17%220);ctx.fillStyle=world.palette[2];
        if(wi===0){ctx.beginPath();ctx.arc(x+90,ground-92,90,Math.PI,0);ctx.fill();}
        else if(wi===1){ctx.fillRect(x,ground-150-(i%3)*34,92,150+(i%3)*34);for(let y=ground-135;y<ground-25;y+=22){ctx.fillStyle=i%2?'#71e4ff':'#ff68ce';ctx.fillRect(x+16,y,5,8);ctx.fillStyle=world.palette[2];}}
        else if(wi===2){ctx.beginPath();ctx.moveTo(x,ground);ctx.lineTo(x+100,ground-220);ctx.lineTo(x+210,ground);ctx.fill();}
        else if(wi===3){ctx.beginPath();ctx.arc(x+100,ground+20,125,Math.PI,Math.PI*2);ctx.fill();ctx.fillStyle='#ff704f';ctx.fillRect(x+95,ground-55,10,75);}
        else{ctx.fillRect(x+20,ground-130,150,22);ctx.fillRect(x+45,ground-165,18,45);ctx.fillRect(x+130,ground-190,18,70);}
      }
      ctx.globalAlpha=1;const t=engine.elapsed;
      if(world.weather==='snow'){ctx.fillStyle='#fff';for(let i=0;i<30;i++){const x=(i*83+t*22*(i%3+1))%width,y=(i*47+t*36)%ground;ctx.globalAlpha=.4+(i%4)*.12;ctx.fillRect(x,y,2+(i%2),2+(i%2));}ctx.globalAlpha=1;}
      else if(world.weather==='ember'){ctx.fillStyle='#ffca73';for(let i=0;i<20;i++){const x=(i*97+t*18)%width,y=ground-((i*37+t*45)%ground);ctx.globalAlpha=.2+(i%3)*.2;ctx.fillRect(x,y,2,5);}ctx.globalAlpha=1;}
      else if(world.weather==='spark'){for(let i=0;i<12;i++){ctx.fillStyle=i%2?'#66e6ff':'#ff76d6';ctx.globalAlpha=.25;ctx.fillRect((i*137-scroll*.05)%width,45+(i%5)*43,28,2);}ctx.globalAlpha=1;}
      else if(world.weather==='petal'){ctx.fillStyle='#fff';for(let i=0;i<18;i++){ctx.globalAlpha=.35;ctx.fillRect((i*101+t*18)%width,60+(i*37+t*12)%210,5,3);}ctx.globalAlpha=1;}
      else{ctx.fillStyle='#fff';for(let i=0;i<9;i++){ctx.globalAlpha=.35;ctx.beginPath();ctx.ellipse((i*170-scroll*.09)%width,70+(i%3)*55,38,13,0,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;}
      ctx.fillStyle='#ffffffaa';ctx.font='800 11px sans-serif';ctx.fillText(world.name+' · ROUND '+engine.round.title+' · '+round+'/5',18,25);
      const laneShift=(scroll*.45)%240;
      ctx.globalAlpha=.20;
      for(let i=-1;i<6;i++){
        const px=i*240-laneShift;
        if(wi===0){ctx.fillStyle=round%2?'#ffffff':'#5aa657';ctx.fillRect(px+30,ground-45,5,45);ctx.beginPath();ctx.arc(px+32,ground-50,15+round*2,0,Math.PI*2);ctx.fill();}
        else if(wi===1){ctx.fillStyle=round%2?'#ff63d8':'#66e6ff';ctx.fillRect(px+25,ground-105,3,90);ctx.fillRect(px+10,ground-105,34,4);}
        else if(wi===2){ctx.fillStyle='#ffffff';ctx.beginPath();ctx.moveTo(px,ground);ctx.lineTo(px+65,ground-110-round*9);ctx.lineTo(px+130,ground);ctx.fill();}
        else if(wi===3){ctx.fillStyle='#ff8b52';ctx.beginPath();ctx.arc(px+70,ground+5,48+round*4,Math.PI,Math.PI*2);ctx.fill();}
        else{ctx.fillStyle='#ffffff';ctx.fillRect(px+25,ground-75,70,8);ctx.fillRect(px+54,ground-118,10,48);}
      }
      ctx.globalAlpha=1;
    }

    function drawObject(o,ground){
      const y=ground-o.y-o.height;
      if(o.type==='coin'){
        ctx.fillStyle='#f6bd18';ctx.beginPath();ctx.arc(o.x+9,y+9,9,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff1a0';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#7a5700';ctx.font='900 9px sans-serif';ctx.textAlign='center';ctx.fillText('G',o.x+9,y+12);ctx.textAlign='left';return;
      }
      if(o.type==='jelly'){
        ctx.save();ctx.translate(o.x+9,y+9);ctx.rotate(Math.PI/4);ctx.fillStyle='#4b74df';ctx.fillRect(-7,-7,14,14);ctx.fillStyle='#dce7ff';ctx.fillRect(-3,-3,5,5);ctx.restore();return;
      }
      if(o.type==='item'){
        const meta=POWERUPS[o.kind]||{emoji:'?',name:o.kind};const bg={magnet:'#61d3c0',booster:'#ffd447',giant:'#c8956b',shield:'#6fb2ff',heart:'#ff7d8a',star:'#ffe95d',double:'#9577ff',rush:'#f5b62e'}[o.kind]||'#eee';
        ctx.fillStyle=bg;ctx.beginPath();ctx.arc(o.x+15,y+15,14,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();ctx.font='15px sans-serif';ctx.textAlign='center';ctx.fillStyle='#191919';ctx.fillText(meta.emoji,o.x+15,y+20);ctx.textAlign='left';return;
      }
      const wi=engine.round.world,colors=[['#805d42','#b78a62'],['#472b68','#8e5ac0'],['#6c98a6','#d4f5ff'],['#552a2c','#d95742'],['#7d765e','#c7c09b']][wi];ctx.fillStyle=colors[0];
      if(o.kind==='drone'){roundRect(o.x,y,o.width,o.height,8,true);ctx.fillStyle=colors[1];ctx.fillRect(o.x+8,y+8,o.width-16,5);ctx.fillStyle='#fff';ctx.fillRect(o.x+4,y+11,5,3);ctx.fillRect(o.x+o.width-9,y+11,5,3);}
      else if(o.kind==='laser'){ctx.fillStyle='#ff4f5f';ctx.fillRect(o.x,y+4,o.width,o.height-8);ctx.fillStyle='#fff';ctx.globalAlpha=.5;ctx.fillRect(o.x,y+8,o.width,3);ctx.globalAlpha=1;}
      else if(o.kind==='gate'){roundRect(o.x,y,o.width,o.height,6,true);ctx.fillStyle=colors[1];ctx.fillRect(o.x+8,y+10,o.width-16,8);ctx.fillRect(o.x+8,y+32,o.width-16,8);}
      else{roundRect(o.x,y,o.width,o.height,5,true);ctx.fillStyle=colors[1];for(let yy=y+9;yy<y+o.height;yy+=18)ctx.fillRect(o.x+5,yy,o.width-10,3);}
    }

    function roundRect(x,y,w,h,r,fill){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();if(fill)ctx.fill();}

    function drawRunner(x,y,c,e){
      const p=e.player,giant=e.giantFor>0?1.55:1,scale=(p.slide?.72:1)*giant;ctx.save();ctx.translate(x+17,y+p.height/2);if(p.y>0)ctx.rotate(p.spin);ctx.scale(1,scale);ctx.translate(-17,-p.height/2);ctx.fillStyle=c.color;roundRect(1,4,32,38,12,true);ctx.fillStyle=c.accent;ctx.beginPath();ctx.arc(17,16,10,0,Math.PI*2);ctx.fill();
      if(c.id==='momo'){ctx.fillStyle=c.color;roundRect(6,-8,7,17,5,true);roundRect(21,-8,7,17,5,true);}
      if(c.id==='mint'){ctx.fillStyle=c.color;ctx.beginPath();ctx.moveTo(7,8);ctx.lineTo(10,-5);ctx.lineTo(17,6);ctx.fill();ctx.beginPath();ctx.moveTo(20,6);ctx.lineTo(27,-5);ctx.lineTo(29,9);ctx.fill();}
      if(c.id==='bolt'){ctx.fillStyle=c.color;ctx.beginPath();ctx.moveTo(5,9);ctx.lineTo(7,-7);ctx.lineTo(16,7);ctx.fill();ctx.beginPath();ctx.moveTo(21,7);ctx.lineTo(29,-7);ctx.lineTo(31,10);ctx.fill();}
      ctx.fillStyle='#191919';ctx.fillRect(11,14,3,4);ctx.fillRect(21,14,3,4);ctx.fillRect(15,23,6,2);ctx.fillStyle='#fff';ctx.globalAlpha=.35;ctx.fillRect(7,30,20,4);ctx.globalAlpha=1;ctx.restore();
      if(e.boosterFor>0||e.skillFor>0&&(c.active.type==='dash'||c.active.type==='airdash')){ctx.strokeStyle='#fee500';ctx.lineWidth=3;for(let i=0;i<4;i++){ctx.globalAlpha=.2+i*.15;ctx.beginPath();ctx.moveTo(x-15-i*16,y+16+i*5);ctx.lineTo(x-3,y+16+i*5);ctx.stroke();}ctx.globalAlpha=1;}
    }

    function drawAura(cx,cy,e){ctx.save();ctx.lineWidth=3;if(e.invincibleFor>0){ctx.strokeStyle='#fff06a';ctx.globalAlpha=.8;ctx.beginPath();ctx.arc(cx,cy,31+Math.sin(e.elapsed*9)*3,0,Math.PI*2);ctx.stroke();}if(e.magnetFor>0){ctx.strokeStyle='#6ce4d2';ctx.globalAlpha=.45;ctx.beginPath();ctx.arc(cx,cy,43+Math.sin(e.elapsed*5)*2,0,Math.PI*2);ctx.stroke();}if(e.doubleScoreFor>0){ctx.strokeStyle='#9a7dff';ctx.globalAlpha=.45;ctx.beginPath();ctx.arc(cx,cy,36,0,Math.PI*2);ctx.stroke();}if(e.giantFor>0){ctx.strokeStyle='#ffb86a';ctx.globalAlpha=.55;ctx.beginPath();ctx.arc(cx,cy,52,0,Math.PI*2);ctx.stroke();}if(e.boosterFor>0){ctx.strokeStyle='#fee500';ctx.globalAlpha=.7;ctx.beginPath();ctx.arc(cx,cy,46,0,Math.PI*2);ctx.stroke();}ctx.restore();}

    function drawParticles(ground){engine.particles.forEach(p=>{const colors={coin:'#ffd342',jelly:'#ff80b9',jump:'#fff',land:'#fff',item:'#fee500',skill:'#fee500',break:'#ff9b5c',hit:'#ff655c',revive:'#ff87c4'};ctx.fillStyle=colors[p.kind]||'#fff';ctx.globalAlpha=clamp(p.life/p.max,0,1);ctx.fillRect(p.x,ground-p.y,3,3);});ctx.globalAlpha=1;}

    document.addEventListener('keydown',e=>{
      if(!running||paused||e.isComposing||e.ctrlKey||e.metaKey||e.altKey)return;
      if(!section.contains(document.activeElement)&&document.activeElement!==document.body)return;
      if(e.code==='Space'||e.code==='ArrowUp'){e.preventDefault();if(!e.repeat)jump();}
      else if(e.code==='ArrowDown'||e.code==='KeyS'){e.preventDefault();engine.slide(true);}
      else if(e.code==='KeyQ'||e.code==='ShiftLeft'||e.code==='ShiftRight'){e.preventDefault();if(!e.repeat)useSkill();}
      else if(e.code==='KeyP'){e.preventDefault();if(!e.repeat)togglePause();}
    },true);
    document.addEventListener('keyup',e=>{if(running&&(e.code==='ArrowDown'||e.code==='KeyS'))engine.slide(false);},true);
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&running&&!paused)togglePause();});
    window.addEventListener('blur',()=>{if(running&&!paused)togglePause();});
    render();
  }
})();