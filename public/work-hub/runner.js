(() => {
  'use strict';
  if (document.getElementById('workhub-runner')) return;

  const script=document.createElement('script');
  script.src='/work-hub/runner-engine.js?v=5';
  script.onload=mount;
  script.onerror=()=>console.error('BokRun 엔진을 불러오지 못했습니다.');
  document.body.appendChild(script);

  function mount(){
    const API=window.WorkHubRunner;
    if(!API)return;
    const RunnerEngine=API.RunnerEngine, CHARACTERS=API.CHARACTERS, RELICS=API.RELICS, SETS=API.SETS||[], WORLDS=API.WORLDS, ROUNDS=API.ROUNDS, CONSUMABLES=API.CONSUMABLES;
    const section=document.createElement('section');
    section.id='workhub-runner';
    section.className='runner bokrun';
    section.dataset.version='5';
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
      p.unlockedRound=clamp(Number(p.unlockedRound)||1,1,25);
      if(raw&&typeof raw==='object'&&(Number(raw.economyVersion)||0)<2){
        p.gems=(Number(p.gems)||0)+800;
        p.economyVersion=2;
        p.version=Math.max(2,Number(p.version)||1);
        p._economyBonusGranted=true;
      }
      return p;
    }

    function loadProfile(){
      try{if(typeof S!=='undefined'&&S?.settings?.bokRunV1)return normalizeProfile(S.settings.bokRunV1);}catch{}
      try{return normalizeProfile(JSON.parse(localStorage.getItem(PROFILE_KEY)||'null'));}catch{return clone(DEFAULT_PROFILE);}
    }

    let profile=loadProfile();
    let view='play';
    let selectedRound=Math.min(profile.unlockedRound,25);
    let selectedGacha='character';
    let collectionRarity='ALL';
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
      const r=roundBy(selectedRound),w=WORLDS[r.world],c=charBy(profile.selectedCharacter);
      const eq=profile.equippedRelics.map(relicBy);
      const worlds=WORLDS.map((world,idx)=>{
        const first=idx*5+1,locked=profile.unlockedRound<first;
        return '<button class="bokrun-world '+(r.world===idx?'active ':'')+(locked?'locked':'')+'" data-world="'+idx+'" '+(locked?'disabled':'')+'><span>'+world.emoji+'</span><b>'+esc(world.name)+'</b><small>'+(locked?'ROUND '+(first-1)+' 1★ 클리어 시 해금':'ROUND '+first+'-'+(first+4))+'</small></button>';
      }).join('');
      const start=r.world*5+1;
      const rounds=Array.from({length:5},(_,i)=>{
        const id=start+i,locked=id>profile.unlockedRound,stars=profile.roundStars[id]||0;
        return '<button class="bokrun-round '+(selectedRound===id?'active ':'')+(locked?'locked':'')+'" data-round="'+id+'" '+(locked?'disabled':'')+' title="'+(locked?'직전 라운드 1★ 클리어 시 해금':'클리어 기록 '+stars+'★')+'">'+w.emoji+'<br>'+id+'<span class="bokrun-stars">'+('★'.repeat(stars)+'☆'.repeat(3-stars))+'</span></button>';
      }).join('');
      const consume=Object.values(CONSUMABLES).map(it=>{
        const count=profile.inventory[it.id]||0,active=profile.selectedConsumables.includes(it.id);
        return '<button class="bokrun-consume '+(active?'active':'')+'" data-consume="'+it.id+'" '+(!count?'disabled':'')+'><small>'+count+'</small><span>'+it.emoji+'</span><b>'+esc(it.name)+'</b></button>';
      }).join('');
      const loadout='<div class="bokrun-loadout"><div class="bokrun-slot"><span class="bokrun-avatar" style="background:'+c.accent+'">'+c.emoji+'</span><span><b>'+esc(c.name)+' · '+c.rarity+'</b><small>'+esc(c.desc)+'</small></span><span class="rarity '+rarityClass(c.rarity)+'">Lv.'+(profile.ownedCharacters[c.id]?.level||1)+'</span></div>'+eq.map(x=>'<div class="bokrun-slot"><span class="bokrun-avatar" style="background:#f4f4f4">'+x.emoji+'</span><span><b>'+esc(x.name)+' · '+x.rarity+'</b><small>'+esc(x.desc)+'</small></span></div>').join('')+'</div>';
      const recordsHtml=records.length?records.slice(0,5).map((x,i)=>'<li><span>'+(i+1)+'. '+esc(x.character)+' · '+esc(x.stage)+'</span><strong>'+Number(x.score||0).toLocaleString()+'</strong></li>').join(''):'<li><span>아직 기록이 없습니다.</span></li>';
      const build=recommendedBuild(r),buildChar=charBy(build.character),buildRelics=build.relics.map(relicBy),canApply=ownsBuild(build);
      const activeSets=activeSetIds();
      const setHtml=activeSets.length?activeSets.map(s=>'<div class="bokrun-set-active"><b>'+s.emoji+' '+esc(s.name)+'</b><small>'+esc(s.desc)+'</small></div>').join(''):'<div class="bokrun-set-empty">현재 활성 세트 없음 · 같은 테마 캐릭터 + 관련 유물 2개를 맞추면 세트 효과가 발동합니다.</div>';
      const recommendation='<div class="bokrun-recommend"><div><span>추천 조합 · '+esc(build.title)+'</span><b>'+buildChar.emoji+' '+esc(buildChar.name)+' + '+buildRelics.map(x=>x.emoji+' '+x.name).join(' / ')+'</b><small>'+esc(build.reason)+'</small></div><button data-apply-build="'+r.mode+'" '+(canApply?'':'disabled')+'>'+(canApply?'추천 장착':'미보유 포함')+'</button></div>';
      const ruleHtml='<div class="bokrun-star-rules"><b>별 · 해금 기준</b><span>★ 목표 100% 달성 = 클리어</span><span>★★ 목표 130% 이상</span><span>★★★ 목표 130% 이상 + 무피격</span><span>→ 다음 라운드: 1★ 클리어</span><span>→ 다음 월드: 현재 월드 5라운드 1★ 클리어</span></div>';
      const firstGem=35+r.world*8+(r.round===5?25:0);
      const repeatGem=8+r.world*2+Math.max(1,profile.roundStars[r.id]||1)*3;
      return '<div class="bokrun-grid"><div class="bokrun-card"><h3>스테이지 선택</h3><p>월드를 클리어할수록 다음 테마가 열립니다.</p><div class="bokrun-worlds">'+worlds+'</div><div class="bokrun-rounds">'+rounds+'</div><div class="bokrun-objective"><div><b>'+w.emoji+' '+esc(w.name)+' · ROUND '+r.title+'</b><small>'+objectiveText(r)+' · 2★ 기준 '+r.bonusGoal.toLocaleString()+' · 총 '+r.distance+'m · 첫 클리어 💎 '+firstGem+' / 재클리어 💎 '+repeatGem+'</small></div><em>'+(profile.roundStars[r.id]?'★'.repeat(profile.roundStars[r.id]):'NEW')+'</em></div>'+ruleHtml+recommendation+'</div><aside class="bokrun-card"><h3>RUN BUILD</h3><p>캐릭터와 유물 조합이 실제 런 능력에 적용됩니다.</p>'+loadout+'<div class="bokrun-set-box"><h4>활성 세트 시너지</h4>'+setHtml+'</div><div class="bokrun-consumables">'+consume+'</div><button class="bokrun-start" id="bokrun-start">▶ ROUND '+r.title+' 시작</button></aside></div><div class="bokrun-card" style="margin-top:16px"><h3>BEST RUNS</h3><ul class="bokrun-record-list">'+recordsHtml+'</ul></div>';
    }

    function needShards(level){return 2+level*2;}
    function renderCollection(){
      const visibleChars=collectionRarity==='ALL'?CHARACTERS:CHARACTERS.filter(c=>c.rarity===collectionRarity);
      const visibleRelics=collectionRarity==='ALL'?RELICS:RELICS.filter(r=>r.rarity===collectionRarity);
      const filters=['ALL','N','R','SR','SSR'].map(r=>'<button data-rarity-filter="'+r+'" class="'+(collectionRarity===r?'active':'')+'">'+r+'</button>').join('');
      const filterBar='<div class="bokrun-rarity-filter">'+filters+'</div>';
      const chars=visibleChars.map(c=>{
        const own=profile.ownedCharacters[c.id],selected=profile.selectedCharacter===c.id,need=own?needShards(own.level):0;
        return '<article class="bokrun-unit '+(!own?'locked ':'')+(selected?'selected':'')+'"><div class="bokrun-unit-top"><span class="bokrun-avatar" style="background:'+c.accent+'">'+c.emoji+'</span><div><h4>'+esc(c.name)+'</h4><span class="'+rarityClass(c.rarity)+'">'+c.rarity+' · '+(own?'Lv.'+own.level:'미보유')+'</span></div></div><p><b>'+esc(c.skill)+'</b><br>'+esc(c.desc)+'</p><div class="bokrun-unit-meta"><span>조각 '+(own?own.shards:0)+'/'+need+'</span><span>'+(own?charLevelSummary(c,own.level):c.active.cooldown+'초 스킬')+'</span></div><div class="bokrun-unit-actions">'+(own?'<button class="primary" data-select-char="'+c.id+'">'+(selected?'선택됨':'선택')+'</button><button data-up-char="'+c.id+'" '+(own.shards<need||own.level>=levelCap()?'disabled':'')+'>강화</button>':'<button disabled>가챠에서 획득</button>')+'</div></article>';
      }).join('');
      const relics=visibleRelics.map(r=>{
        const own=profile.ownedRelics[r.id],eq=profile.equippedRelics.includes(r.id),need=own?needShards(own.level):0;
        return '<article class="bokrun-unit '+(!own?'locked ':'')+(eq?'selected':'')+'"><div class="bokrun-unit-top"><span class="bokrun-avatar" style="background:#f4f4f4">'+r.emoji+'</span><div><h4>'+esc(r.name)+'</h4><span class="'+rarityClass(r.rarity)+'">'+r.rarity+' · '+(own?'Lv.'+own.level:'미보유')+'</span></div></div><p>'+esc(r.desc)+'</p><div class="bokrun-unit-meta"><span>조각 '+(own?own.shards:0)+'/'+need+'</span><span>'+(own?relicLevelSummary(own.level):(eq?'장착 중':'최대 3개 장착'))+'</span></div><div class="bokrun-unit-actions">'+(own?'<button class="primary" data-equip-relic="'+r.id+'">'+(eq?'해제':'장착')+'</button><button data-up-relic="'+r.id+'" '+(own.shards<need||own.level>=levelCap()?'disabled':'')+'>강화</button>':'<button disabled>가챠에서 획득</button>')+'</div></article>';
      }).join('');
      const setCards=SETS.map(s=>'<div class="bokrun-set-card"><b>'+s.emoji+' '+esc(s.name)+'</b><small>'+esc(s.desc)+'</small><em>캐릭터 1 + 관련 유물 '+s.requiredRelics+'개</em></div>').join('');
      return '<div class="bokrun-card"><h3>COLLECTION</h3><p>등급으로 빠르게 걸러보고 조합을 만들 수 있습니다.</p>'+filterBar+'</div><div class="bokrun-card" style="margin-top:16px"><h3>SET SYNERGY</h3><p>세트 캐릭터에 해당 테마 유물을 2개 이상 장착하면 추가 효과가 자동 발동합니다.</p><div class="bokrun-set-grid">'+setCards+'</div></div><div class="bokrun-card" style="margin-top:16px"><h3>캐릭터 '+Object.keys(profile.ownedCharacters).length+' / '+CHARACTERS.length+'</h3><p>액티브 스킬과 패시브가 실제 플레이에 반영됩니다.</p><div class="bokrun-collection-grid">'+chars+'</div></div><div class="bokrun-card" style="margin-top:16px"><h3>유물 '+Object.keys(profile.ownedRelics).length+' / '+RELICS.length+' · 장착 '+profile.equippedRelics.length+'/3</h3><p>유물 3개 조합으로 점프·자석·스킬·콤보·점수 빌드를 만듭니다.</p><div class="bokrun-collection-grid">'+relics+'</div></div>';
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
      section.querySelectorAll('[data-apply-build]').forEach(b=>b.onclick=()=>{const build=recommendedBuild(roundBy(selectedRound));if(!ownsBuild(build))return;profile.selectedCharacter=build.character;profile.equippedRelics=build.relics.slice(0,3);persist();render();});
      section.querySelectorAll('[data-world]').forEach(b=>b.onclick=()=>{const w=Number(b.dataset.world),id=w*5+1;if(id<=profile.unlockedRound){selectedRound=Math.max(id,Math.min(profile.unlockedRound,id+4));render();}});
      section.querySelectorAll('[data-round]').forEach(b=>b.onclick=()=>{const id=Number(b.dataset.round);if(id<=profile.unlockedRound){selectedRound=id;render();}});
      section.querySelectorAll('[data-consume]').forEach(b=>b.onclick=()=>toggleConsume(b.dataset.consume));
      const start=section.querySelector('#bokrun-start');if(start)start.onclick=startRun;
      section.querySelectorAll('[data-select-char]').forEach(b=>b.onclick=()=>{profile.selectedCharacter=b.dataset.selectChar;persist();render();});
      section.querySelectorAll('[data-up-char]').forEach(b=>b.onclick=()=>upgrade('character',b.dataset.upChar));
      section.querySelectorAll('[data-equip-relic]').forEach(b=>b.onclick=()=>equipRelic(b.dataset.equipRelic));
      section.querySelectorAll('[data-up-relic]').forEach(b=>b.onclick=()=>upgrade('relic',b.dataset.upRelic));
      section.querySelectorAll('[data-gacha-banner]').forEach(b=>b.onclick=e=>{if(e.target.closest('[data-pull]'))return;selectedGacha=b.dataset.gachaBanner;render();});
      section.querySelectorAll('[data-pull]').forEach(b=>b.onclick=()=>pull(b.dataset.pull,Number(b.dataset.count)));
      section.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>buy(b.dataset.buy));
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
      const c=charBy(profile.selectedCharacter),r=roundBy(selectedRound),w=WORLDS[r.world];
      section.innerHTML='<div class="bokrun-shell"><div class="bokrun-hero"><div><div class="bokrun-kicker">RUNNING · '+esc(w.name)+'</div><h2>'+c.emoji+' '+esc(c.name)+' · '+r.title+'</h2><p>'+objectiveText(r)+' · Q/Shift 스킬 · ↓ 슬라이드 · Space 점프</p></div><div class="bokrun-wallet"><span>'+w.emoji+' '+esc(w.name)+'</span></div></div><div class="bokrun-body"><div class="bokrun-game"><div class="bokrun-game-top"><div class="bokrun-hud"><span>점수<strong id="br-score">0</strong></span><span>거리<strong id="br-distance">0m</strong></span><span>코인<strong id="br-coins">0</strong></span><span>콤보<strong id="br-combo">0</strong></span><span>실드<strong id="br-shield">0</strong></span><span>목표<strong id="br-objective">-</strong></span></div><button class="bokrun-skill" id="br-skill">'+esc(c.skill)+'</button></div><div class="bokrun-progress"><i id="br-progress"></i></div><canvas id="bokrun-canvas" width="1100" height="390" tabindex="0" aria-label="BokRun 러닝 게임"></canvas><div class="bokrun-runmsg" id="br-message" hidden><b></b><span></span></div><div class="bokrun-mobile-controls"><button id="br-jump">점프</button><button id="br-slide">슬라이드</button><button class="skill" id="br-skill2">'+esc(c.skill)+'</button><button id="br-pause">일시정지</button></div></div></div></div>';
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
      if(!engine)return;const set=(id,v)=>{const el=section.querySelector('#'+id);if(el)el.textContent=v;};
      set('br-score',engine.score.toLocaleString());set('br-distance',Math.floor(engine.distance)+'m');set('br-coins',engine.coins);set('br-combo',engine.combo);set('br-shield',engine.shield);set('br-objective',engine.objectiveLabel);
      const prog=section.querySelector('#br-progress');if(prog)prog.style.width=(engine.progress*100).toFixed(1)+'%';
      const c=charBy(profile.selectedCharacter),label=engine.skillReady?c.skill:c.skill+' '+engine.skillCooldown.toFixed(1)+'s';
      [section.querySelector('#br-skill'),section.querySelector('#br-skill2')].forEach(b=>{if(b){b.textContent=label;b.disabled=!engine.skillReady;}});
    }

    function frame(time){if(!running||paused||!engine)return;const dt=last?(time-last)/1000:0;last=time;engine.step(dt,width);updateHud();draw();if(engine.dead||engine.cleared)finishRun();else raf=requestAnimationFrame(frame);}

    function finishRun(){
      running=false;paused=false;cancelAnimationFrame(raf);
      const rewards=engine.getRewards(),r=roundBy(selectedRound),w=WORLDS[r.world],c=charBy(profile.selectedCharacter);
      let first=false,stars=0,firstThreeStar=false;
      const previousStars=profile.roundStars[r.id]||0;
      if(rewards.clear){
        first=!profile.firstClear[r.id];profile.firstClear[r.id]=true;profile.unlockedRound=Math.max(profile.unlockedRound,Math.min(25,r.id+1));
        const performance=engine.objectiveValue/r.goal;stars=1+(performance>=1.3?1:0)+(performance>=1.3&&engine.hitCount===0?1:0);
        firstThreeStar=stars===3&&previousStars<3&&!profile.firstThreeStar[r.id];
        if(firstThreeStar)profile.firstThreeStar[r.id]=true;
        profile.roundStars[r.id]=Math.max(previousStars,stars);profile.lifetime.clears++;
      }
      const firstClearGem=35+r.world*8+(r.round===5?25:0);
      const repeatGem=8+r.world*2+Math.max(1,stars||previousStars||1)*3;
      const threeStarBonus=firstThreeStar?25:0;
      const gemReward=rewards.clear?(first?firstClearGem:repeatGem)+threeStarBonus:2;
      profile.gold+=rewards.gold;profile.gems+=gemReward;profile.lifetime.runs++;profile.lifetime.gold+=rewards.gold;profile.lifetime.gems+=gemReward;profile.lifetime.bestScore=Math.max(profile.lifetime.bestScore,rewards.score);profile.lifetime.bestCombo=Math.max(profile.lifetime.bestCombo,rewards.maxCombo);
      records.unshift({score:rewards.score,stage:w.name+' '+r.title,character:c.name,date:new Date().toLocaleDateString('ko-KR')});records.sort((a,b)=>b.score-a.score);records=records.slice(0,10);saveRecords();persist();showResult(rewards,gemReward,stars,first,firstThreeStar);
    }

    function showResult(rewards,gems,stars,first,firstThreeStar){
      const overlay=document.createElement('div');overlay.className='bokrun-overlay';
      overlay.innerHTML='<div class="bokrun-modal"><h3>'+(rewards.clear?'STAGE CLEAR!':'RUN END')+'</h3><p>'+(rewards.clear?(first?'첫 클리어 보너스를 획득했습니다.'+(firstThreeStar?' 3성 최초 달성 +25💎!':''):'재클리어 보상을 받았습니다.'+(firstThreeStar?' 3성 최초 달성 +25💎!':'')):'실패 보상 2💎를 받았습니다. 빌드와 아이템을 바꿔 다시 도전해보세요.')+'</p><div style="font-size:26px;margin-top:10px;color:#e0a600">'+(rewards.clear?'★'.repeat(stars)+'☆'.repeat(3-stars):'☆☆☆')+'</div><div class="bokrun-result-stats"><div><small>점수</small><b>'+rewards.score.toLocaleString()+'</b></div><div><small>최대 콤보</small><b>'+rewards.maxCombo+'</b></div><div><small>골드</small><b>+'+rewards.gold+'</b></div><div><small>젬</small><b>+'+gems+'</b></div></div><div class="bokrun-modal-actions"><button id="br-retry">다시 도전</button><button class="primary" id="br-lobby">로비로</button></div></div>';
      document.body.appendChild(overlay);overlay.querySelector('#br-lobby').onclick=()=>{overlay.remove();view='play';render();};overlay.querySelector('#br-retry').onclick=()=>{overlay.remove();startRun();};
    }

    function draw(){
      if(!ctx||!engine)return;
      const world=WORLDS[engine.round.world],pal=world.palette,ground=326,scroll=engine.distance*9;
      const grad=ctx.createLinearGradient(0,0,0,ground);grad.addColorStop(0,pal[0]);grad.addColorStop(1,pal[1]);ctx.fillStyle=grad;ctx.fillRect(0,0,width,390);
      drawWorld(world,ground,scroll);ctx.fillStyle=pal[4];ctx.fillRect(0,ground,width,64);ctx.fillStyle=engine.round.world===2?'#edfaff':'#ffffff35';ctx.fillRect(0,ground,width,6);
      for(let x=-50-(scroll%54);x<width+54;x+=54){ctx.fillStyle='#00000016';ctx.fillRect(x,ground+30,38,2);}
      engine.objects.forEach(o=>drawObject(o,ground));drawParticles(ground);drawRunner(engine.player.x,ground-engine.player.y-engine.player.height,charBy(profile.selectedCharacter),engine);
      if(engine.invincibleFor>0||engine.magnetFor>0||engine.doubleScoreFor>0||engine.skillFor>0)drawAura(engine.player.x+17,ground-engine.player.y-22,engine);
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
    }

    function drawObject(o,ground){
      const y=ground-o.y-o.height;
      if(o.type==='coin'){ctx.fillStyle='#ffca26';ctx.beginPath();ctx.arc(o.x+9,y+9,8,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff0a0';ctx.fillRect(o.x+7,y+3,3,12);return;}
      if(o.type==='jelly'){ctx.fillStyle='#ff78b4';roundRect(o.x,y,o.width,o.height,6,true);ctx.fillStyle='#fff';ctx.fillRect(o.x+5,y+6,3,3);ctx.fillRect(o.x+11,y+6,3,3);return;}
      if(o.type==='item'){const icons={shield:'S',magnet:'M',double:'2X',star:'★',rush:'R'};ctx.fillStyle=o.kind==='star'?'#fee500':o.kind==='double'?'#8e79ff':'#62d3c2';ctx.beginPath();ctx.arc(o.x+14,y+14,13,0,Math.PI*2);ctx.fill();ctx.fillStyle='#191919';ctx.font='900 9px sans-serif';ctx.textAlign='center';ctx.fillText(icons[o.kind]||'?',o.x+14,y+17);ctx.textAlign='left';return;}
      const wi=engine.round.world,colors=[['#805d42','#b78a62'],['#472b68','#8e5ac0'],['#6c98a6','#d4f5ff'],['#552a2c','#d95742'],['#7d765e','#c7c09b']][wi];ctx.fillStyle=colors[0];
      if(o.kind==='drone'){roundRect(o.x,y,o.width,o.height,8,true);ctx.fillStyle=colors[1];ctx.fillRect(o.x+8,y+8,o.width-16,5);}
      else if(o.kind==='laser'){ctx.fillStyle='#ff4f5f';ctx.fillRect(o.x,y+4,o.width,o.height-8);ctx.fillStyle='#fff';ctx.globalAlpha=.4;ctx.fillRect(o.x,y+8,o.width,3);ctx.globalAlpha=1;}
      else if(o.kind==='gate'){roundRect(o.x,y,o.width,o.height,6,true);ctx.fillStyle=colors[1];ctx.fillRect(o.x+8,y+10,o.width-16,8);ctx.fillRect(o.x+8,y+32,o.width-16,8);}
      else{roundRect(o.x,y,o.width,o.height,5,true);ctx.fillStyle=colors[1];for(let yy=y+9;yy<y+o.height;yy+=18)ctx.fillRect(o.x+5,yy,o.width-10,3);}
    }

    function roundRect(x,y,w,h,r,fill){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();if(fill)ctx.fill();}

    function drawRunner(x,y,c,e){
      const p=e.player,scale=p.slide?.72:1;ctx.save();ctx.translate(x+17,y+p.height/2);if(p.y>0)ctx.rotate(p.spin);ctx.scale(1,scale);ctx.translate(-17,-p.height/2);ctx.fillStyle=c.color;roundRect(1,4,32,38,12,true);ctx.fillStyle=c.accent;ctx.beginPath();ctx.arc(17,16,10,0,Math.PI*2);ctx.fill();
      if(c.id==='momo'){ctx.fillStyle=c.color;roundRect(6,-8,7,17,5,true);roundRect(21,-8,7,17,5,true);}
      if(c.id==='mint'){ctx.fillStyle=c.color;ctx.beginPath();ctx.moveTo(7,8);ctx.lineTo(10,-5);ctx.lineTo(17,6);ctx.fill();ctx.beginPath();ctx.moveTo(20,6);ctx.lineTo(27,-5);ctx.lineTo(29,9);ctx.fill();}
      if(c.id==='bolt'){ctx.fillStyle=c.color;ctx.beginPath();ctx.moveTo(5,9);ctx.lineTo(7,-7);ctx.lineTo(16,7);ctx.fill();ctx.beginPath();ctx.moveTo(21,7);ctx.lineTo(29,-7);ctx.lineTo(31,10);ctx.fill();}
      ctx.fillStyle='#191919';ctx.fillRect(11,14,3,4);ctx.fillRect(21,14,3,4);ctx.fillRect(15,23,6,2);ctx.fillStyle='#fff';ctx.globalAlpha=.35;ctx.fillRect(7,30,20,4);ctx.globalAlpha=1;ctx.restore();
      if(e.boosterFor>0||e.skillFor>0&&(c.active.type==='dash'||c.active.type==='airdash')){ctx.strokeStyle='#fee500';ctx.lineWidth=3;for(let i=0;i<4;i++){ctx.globalAlpha=.2+i*.15;ctx.beginPath();ctx.moveTo(x-15-i*16,y+16+i*5);ctx.lineTo(x-3,y+16+i*5);ctx.stroke();}ctx.globalAlpha=1;}
    }

    function drawAura(cx,cy,e){ctx.save();ctx.lineWidth=3;if(e.invincibleFor>0){ctx.strokeStyle='#fff06a';ctx.globalAlpha=.8;ctx.beginPath();ctx.arc(cx,cy,31+Math.sin(e.elapsed*9)*3,0,Math.PI*2);ctx.stroke();}if(e.magnetFor>0){ctx.strokeStyle='#6ce4d2';ctx.globalAlpha=.45;ctx.beginPath();ctx.arc(cx,cy,43+Math.sin(e.elapsed*5)*2,0,Math.PI*2);ctx.stroke();}if(e.doubleScoreFor>0){ctx.strokeStyle='#9a7dff';ctx.globalAlpha=.45;ctx.beginPath();ctx.arc(cx,cy,36,0,Math.PI*2);ctx.stroke();}ctx.restore();}

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