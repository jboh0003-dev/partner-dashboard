/* BokRun: original runner RPG simulation for BokDesk. No application data access. */
(function (root) {
  'use strict';

  const RARITY_ORDER = ['N','R','SR','SSR'];
  const RARITY_WEIGHT = { N: 72, R: 22, SR: 5, SSR: 1 };

  const CHARACTERS = [
    {id:'momo',name:'모모 래빗',rarity:'N',emoji:'🐰',color:'#ffb8c8',accent:'#fff1f4',skill:'토끼 스텝',desc:'점프 착지 후 2초간 속도 +12%.',passive:{landingBoost:.12},active:{type:'dash',cooldown:16,duration:2.4,power:.35}},
    {id:'mint',name:'민트 캣',rarity:'R',emoji:'🐱',color:'#79d8c3',accent:'#e7fff8',skill:'민트 마그넷',desc:'기본 자석 범위 +55%. 스킬 사용 시 6초간 초대형 자석.',passive:{magnet:.55},active:{type:'magnet',cooldown:19,duration:6,power:220}},
    {id:'bolt',name:'볼트 폭스',rarity:'R',emoji:'🦊',color:'#ff9b64',accent:'#fff0e7',skill:'라이트닝 점프',desc:'3단 점프 가능. 공중 코인 점수 +35%.',passive:{maxJumps:3,airCoin:.35},active:{type:'airdash',cooldown:17,duration:1.4,power:.45}},
    {id:'bobo',name:'보보 베어',rarity:'SR',emoji:'🐻',color:'#c69a70',accent:'#fff1e4',skill:'허니 가드',desc:'매 런 실드 1개로 시작. 피격 후 3초 무적.',passive:{startShield:1,hitInvincible:3},active:{type:'shield',cooldown:23,duration:0,power:1}},
    {id:'nova',name:'노바 위습',rarity:'SR',emoji:'✨',color:'#9678ff',accent:'#f1edff',skill:'스타 오버드라이브',desc:'무적 아이템 지속시간 +60%. 스킬 중 점수 ×2.2.',passive:{starDuration:.6},active:{type:'score',cooldown:21,duration:5,power:2.2}},
    {id:'goldy',name:'골디 카피',rarity:'SSR',emoji:'🦫',color:'#f3c54e',accent:'#fff7d6',skill:'골든 타임',desc:'골드 획득 +40%, 런당 1회 자동 부활.',passive:{gold:.4,revive:1},active:{type:'coinrush',cooldown:25,duration:6,power:1.8}}
  ];

  const RELICS = [
    {id:'feather',name:'바람깃털',rarity:'N',emoji:'🪶',desc:'점프 높이 +10%.',effect:{jump:.10}},
    {id:'coinbell',name:'코인벨',rarity:'N',emoji:'🔔',desc:'코인 점수 +18%.',effect:{coinScore:.18}},
    {id:'magnet',name:'마그넷 코어',rarity:'R',emoji:'🧲',desc:'자석 범위 +70.',effect:{magnetFlat:70}},
    {id:'hourglass',name:'미니 모래시계',rarity:'R',emoji:'⌛',desc:'스킬 쿨타임 -12%.',effect:{cooldown:.12}},
    {id:'clover',name:'럭키 클로버',rarity:'R',emoji:'🍀',desc:'파워업 등장 확률 +35%.',effect:{itemChance:.35}},
    {id:'boots',name:'제트 부츠',rarity:'R',emoji:'🥾',desc:'대시/속도 스킬 효과 +22%.',effect:{dashPower:.22}},
    {id:'prism',name:'스타 프리즘',rarity:'SR',emoji:'🔮',desc:'무적/2배점수 지속시간 +30%.',effect:{powerDuration:.30}},
    {id:'shield',name:'수호 부적',rarity:'SR',emoji:'🛡️',desc:'실드 1개로 시작.',effect:{startShield:1}},
    {id:'combo',name:'콤보 메트로놈',rarity:'SR',emoji:'🎵',desc:'콤보 유지시간 +55%, 콤보 점수 +15%.',effect:{comboWindow:.55,comboScore:.15}},
    {id:'rocket',name:'하늘 로켓',rarity:'SR',emoji:'🚀',desc:'스킬 게이지 회복 +18%.',effect:{cooldown:.18}},
    {id:'phoenix',name:'피닉스 깃털',rarity:'SSR',emoji:'🔥',desc:'런당 1회 50% 체력 대신 즉시 부활.',effect:{revive:1}},
    {id:'crown',name:'골든 크라운',rarity:'SSR',emoji:'👑',desc:'최종 점수 +22%, 골드 +20%.',effect:{finalScore:.22,gold:.20}}
  ];

  const WORLDS = [
    {id:'meadow',name:'젤리 초원',theme:'MEADOW',emoji:'🌼',unlock:1,palette:['#86d9ee','#e7f8ff','#8fd074','#5ca65b','#7e593d'],weather:'petal'},
    {id:'metro',name:'네온 메트로',theme:'METRO',emoji:'🌃',unlock:6,palette:['#171d45','#4c4078','#2a2f65','#161a36','#24263d'],weather:'spark'},
    {id:'frost',name:'프로스트 랩',theme:'FROST',emoji:'❄️',unlock:11,palette:['#9ddbf3','#e9faff','#b5d7df','#709eae','#7999a3'],weather:'snow'},
    {id:'volcano',name:'마그마 키친',theme:'VOLCANO',emoji:'🌋',unlock:16,palette:['#482238','#ff805f','#6d2e34','#341c28','#562d28'],weather:'ember'},
    {id:'sky',name:'스카이 루인',theme:'SKY',emoji:'☁️',unlock:21,palette:['#78c8ff','#eefaff','#b7d79b','#789b78','#8c7459'],weather:'cloud'}
  ];

  const ROUNDS = [];
  for (let i=0;i<25;i++) {
    const world = Math.floor(i/5);
    const within = i%5;
    const modes = ['distance','coins','score','combo','distance'];
    ROUNDS.push({
      id:i+1,
      world,
      round:within+1,
      mode:modes[within],
      goal: within===0 ? 520 + world*120 : within===1 ? 45 + world*15 : within===2 ? 22000 + world*8500 : within===3 ? 28 + world*8 : 850 + world*160,
      distance: 650 + within*110 + world*140,
      baseSpeed: 250 + world*18 + within*5,
      difficulty: 1 + world*.18 + within*.08,
      rewardGold: 180 + i*22,
      rewardGem: within===4 ? 18 + world*3 : 6 + world,
      title: (world+1)+'-'+(within+1)
    });
  }

  const CONSUMABLES = {
    shield:{id:'shield',name:'스타트 실드',emoji:'🛡️',price:180,desc:'실드 1개를 들고 시작'},
    booster:{id:'booster',name:'터보 부스터',emoji:'⚡',price:220,desc:'첫 12초 속도 +20%, 점수 +15%'},
    magnet:{id:'magnet',name:'포켓 마그넷',emoji:'🧲',price:160,desc:'첫 15초 자석 효과'},
    revive:{id:'revive',name:'리바이브 캔디',emoji:'💗',price:300,desc:'1회 추가 부활'}
  };

  function byId(list,id){ return list.find(function(x){return x.id===id;}) || list[0]; }
  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }

  function buildEffects(character,relics,characterLevel,relicLevels) {
    const c=character||CHARACTERS[0], rs=relics||[], cLevel=Math.max(1,Number(characterLevel)||1), rLevels=relicLevels||{};
    const e={
      maxJumps:2,jump:1,magnet:92,coinScore:1,itemChance:1,cooldown:1,dashPower:1,
      starDuration:1,powerDuration:1,startShield:0,comboWindow:1,comboScore:1,
      finalScore:1,gold:1,revive:0,airCoin:0,landingBoost:0,hitInvincible:0
    };
    const p=c.passive||{};
    if(p.maxJumps)e.maxJumps=p.maxJumps;
    if(p.magnet)e.magnet*=1+p.magnet;
    if(p.startShield)e.startShield+=p.startShield;
    if(p.starDuration)e.starDuration*=1+p.starDuration;
    if(p.gold)e.gold*=1+p.gold;
    if(p.revive)e.revive+=p.revive;
    if(p.airCoin)e.airCoin+=p.airCoin;
    if(p.landingBoost)e.landingBoost+=p.landingBoost;
    if(p.hitInvincible)e.hitInvincible=Math.max(e.hitInvincible,p.hitInvincible);

    rs.forEach(function(r){
      const x=(r&&r.effect)||{}, amp=1+Math.max(0,(Number(rLevels[r.id])||1)-1)*.12;
      if(x.jump)e.jump*=1+x.jump*amp;
      if(x.coinScore)e.coinScore*=1+x.coinScore*amp;
      if(x.magnetFlat)e.magnet+=x.magnetFlat*amp;
      if(x.cooldown)e.cooldown*=1-x.cooldown*amp;
      if(x.itemChance)e.itemChance*=1+x.itemChance*amp;
      if(x.dashPower)e.dashPower*=1+x.dashPower*amp;
      if(x.powerDuration)e.powerDuration*=1+x.powerDuration*amp;
      if(x.startShield)e.startShield+=Math.max(1,Math.round(x.startShield*amp));
      if(x.comboWindow)e.comboWindow*=1+x.comboWindow*amp;
      if(x.comboScore)e.comboScore*=1+x.comboScore*amp;
      if(x.revive)e.revive+=Math.max(1,Math.round(x.revive*amp));
      if(x.finalScore)e.finalScore*=1+x.finalScore*amp;
      if(x.gold)e.gold*=1+x.gold*amp;
    });
    e.finalScore*=1+(cLevel-1)*.025;
    return e;
  }

  class RunnerEngine {
    constructor(random) {
      this.random=random||Math.random;
      this.configure({});
    }

    configure(opts) {
      opts=opts||{};
      this.character=byId(CHARACTERS,opts.characterId||'momo');
      this.relics=(opts.relicIds||[]).slice(0,3).map(function(id){return byId(RELICS,id);});
      this.round=ROUNDS[clamp((opts.roundId||1)-1,0,ROUNDS.length-1)];
      this.world=WORLDS[this.round.world];
      this.characterLevel=Math.max(1,Number(opts.characterLevel)||1);
      this.relicLevels=opts.relicLevels||{};
      this.effects=buildEffects(this.character,this.relics,this.characterLevel,this.relicLevels);
      this.consumables=Object.assign({},opts.consumables||{});
      this.reset();
    }

    reset() {
      const e=this.effects||buildEffects(this.character,[]);
      this.distance=0;
      this.coins=0;
      this.jellies=0;
      this.items=0;
      this.elapsed=0;
      this.speed=this.round.baseSpeed;
      this.objects=[];
      this.particles=[];
      this.spawnIn=.9;
      this.dead=false;
      this.cleared=false;
      this.failed=false;
      this.shield=e.startShield+(this.consumables.shield?1:0);
      this.revives=e.revive+(this.consumables.revive?1:0);
      this.invincibleFor=0;
      this.magnetFor=this.consumables.magnet?15:0;
      this.doubleScoreFor=0;
      this.coinRushFor=0;
      this.boosterFor=this.consumables.booster?12:0;
      this.skillFor=0;
      this.skillCooldown=0;
      this.skillReady=true;
      this.skillUses=0;
      this.hitCount=0;
      this.combo=0;
      this.maxCombo=0;
      this.comboTimer=0;
      this.comboPoints=0;
      this.bonusScore=0;
      this.lastEvent='';
      this.lastLandingAt=-99;
      this.player={x:108,y:0,vy:0,jumps:0,width:34,height:46,baseHeight:46,slide:false,slideFor:0,spin:0,spinRate:0};
      this.stats={coins:0,jellies:0,items:0,obstacles:0,nearMiss:0};
    }

    get activeCooldownTotal() {
      const base=(this.character.active&&this.character.active.cooldown)||20;
      return Math.max(5,base*this.effects.cooldown);
    }

    get scoreMultiplier() {
      let m=this.doubleScoreFor>0?2:1;
      if(this.skillFor>0&&this.character.active.type==='score')m*=this.character.active.power||2;
      if(this.boosterFor>0)m*=1.15;
      return m;
    }

    get score() {
      const base=this.distance*8 + this.coins*115*this.effects.coinScore + this.jellies*42 + this.comboPoints + this.bonusScore;
      return Math.floor(base*this.scoreMultiplier*this.effects.finalScore);
    }

    get progress() { return clamp(this.distance/this.round.distance,0,1); }

    get objectiveValue() {
      if(this.round.mode==='coins')return this.coins;
      if(this.round.mode==='score')return this.score;
      if(this.round.mode==='combo')return this.maxCombo;
      return Math.floor(this.distance);
    }

    get objectiveMet() { return this.objectiveValue>=this.round.goal; }

    get objectiveLabel() {
      if(this.round.mode==='coins')return '코인 '+this.coins+'/'+this.round.goal;
      if(this.round.mode==='score')return '점수 '+this.score.toLocaleString()+'/'+this.round.goal.toLocaleString();
      if(this.round.mode==='combo')return '콤보 '+this.maxCombo+'/'+this.round.goal;
      return '거리 '+Math.floor(this.distance)+'m/'+this.round.goal+'m';
    }

    jump() {
      const p=this.player;
      if(this.dead||this.cleared||p.slide||p.jumps>=this.effects.maxJumps)return false;
      const mult=this.effects.jump;
      p.vy=(p.jumps===0?650:560)*mult;
      p.spinRate=p.jumps===0?8.4:11.8;
      p.jumps++;
      this.emit('jump',p.x+16,p.y+4,8);
      return true;
    }

    slide(active) {
      const p=this.player;
      if(this.dead||this.cleared)return false;
      p.slide=Boolean(active)&&p.y<=2;
      p.height=p.slide?25:p.baseHeight;
      return p.slide;
    }

    useSkill() {
      if(this.dead||this.cleared||!this.skillReady)return false;
      const a=this.character.active;
      this.skillReady=false;
      this.skillCooldown=this.activeCooldownTotal;
      this.skillUses++;
      this.lastEvent=this.character.skill;
      if(a.type==='shield')this.shield+=Math.max(1,Math.round(a.power||1));
      if(a.type==='magnet')this.magnetFor=Math.max(this.magnetFor,a.duration);
      if(a.type==='score')this.skillFor=a.duration;
      if(a.type==='coinrush')this.coinRushFor=a.duration;
      if(a.type==='dash'||a.type==='airdash')this.skillFor=a.duration;
      this.emit('skill',this.player.x+18,this.player.y+20,24);
      return true;
    }

    addCombo(amount) {
      this.combo+=amount||1;
      this.maxCombo=Math.max(this.maxCombo,this.combo);
      this.comboTimer=2.4*this.effects.comboWindow;
      this.comboPoints+=Math.floor((8+this.combo*.8)*this.effects.comboScore);
    }

    breakCombo() {
      if(this.combo>=12)this.bonusScore+=this.combo*18;
      this.combo=0;
      this.comboTimer=0;
    }

    emit(kind,x,y,count) {
      count=count||5;
      for(let i=0;i<count;i++){
        this.particles.push({kind:kind,x:x,y:y,vx:(this.random()-.5)*160,vy:50+this.random()*180,life:.35+this.random()*.45,max:.8});
      }
      if(this.particles.length>120)this.particles.splice(0,this.particles.length-120);
    }

    collectPower(kind) {
      const dur=5*this.effects.powerDuration;
      if(kind==='shield')this.shield=Math.min(4,this.shield+1);
      else if(kind==='star')this.invincibleFor=Math.max(this.invincibleFor,dur*this.effects.starDuration);
      else if(kind==='magnet')this.magnetFor=Math.max(this.magnetFor,8*this.effects.powerDuration);
      else if(kind==='double')this.doubleScoreFor=Math.max(this.doubleScoreFor,7*this.effects.powerDuration);
      else if(kind==='rush')this.coinRushFor=Math.max(this.coinRushFor,6*this.effects.powerDuration);
      else return;
      this.items++;
      this.stats.items++;
      this.addCombo(2);
      this.lastEvent=kind;
      this.emit('item',this.player.x+20,this.player.y+28,16);
    }

    spawn(width) {
      const d=this.round.difficulty;
      const x=width+50;
      const roll=this.random();
      let obstacle;
      if(roll<.28){
        obstacle={type:'obstacle',kind:'crate',x:x,y:0,width:38,height:40};
      }else if(roll<.50){
        obstacle={type:'obstacle',kind:'wall',x:x,y:0,width:34,height:78+Math.round(28*d)};
      }else if(roll<.72){
        obstacle={type:'obstacle',kind:'drone',x:x,y:48,width:54,height:28};
      }else if(roll<.88){
        obstacle={type:'obstacle',kind:'laser',x:x,y:0,width:72,height:18};
      }else{
        obstacle={type:'obstacle',kind:'gate',x:x,y:0,width:48,height:94};
      }
      this.objects.push(obstacle);

      const arcHigh=obstacle.kind==='wall'||obstacle.kind==='gate';
      const count=5+Math.floor(this.random()*4);
      for(let i=0;i<count;i++){
        const t=i/Math.max(1,count-1);
        const y=(arcHigh?95:55)+Math.sin(t*Math.PI)*(arcHigh?135:70);
        this.objects.push({type:i%3===0?'jelly':'coin',kind:i%3===0?'jelly':'coin',x:x-15+i*34,y:y,width:18,height:18});
      }

      if(this.random()<.35*this.effects.itemChance){
        const kinds=['shield','magnet','double','star','rush'];
        const kind=kinds[Math.floor(this.random()*kinds.length)];
        this.objects.push({type:'item',kind:kind,x:x+70+this.random()*80,y:120+this.random()*95,width:28,height:28});
      }

      if(this.coinRushFor>0){
        for(let i=0;i<7;i++)this.objects.push({type:'coin',kind:'coin',x:x+i*29,y:80+Math.sin(i*.8)*42,width:18,height:18});
      }

      const pace=Math.max(.72,1.42-(this.speed-250)/900);
      this.spawnIn=pace+this.random()*.42;
    }

    revive() {
      if(this.revives<=0)return false;
      this.revives--;
      this.dead=false;
      this.invincibleFor=3;
      this.player.y=0;
      this.player.vy=0;
      this.player.jumps=0;
      this.objects=this.objects.filter(o=>o.x>this.player.x+180||o.type!=='obstacle');
      this.breakCombo();
      this.emit('revive',this.player.x+20,20,30);
      this.lastEvent='revive';
      return true;
    }

    resolveHit(o) {
      if(this.invincibleFor>0||this.skillFor>0&&(this.character.active.type==='dash'||this.character.active.type==='airdash')){
        o.taken=true;
        this.stats.obstacles++;
        this.addCombo(1);
        this.bonusScore+=120;
        this.emit('break',o.x,o.y,10);
        return;
      }
      if(this.shield>0){
        this.shield--;
        o.taken=true;
        this.hitCount++;
        this.invincibleFor=Math.max(this.invincibleFor,this.effects.hitInvincible||1.1);
        this.breakCombo();
        this.emit('hit',this.player.x+18,this.player.y+20,18);
        return;
      }
      if(this.revives>0){
        this.revive();
        o.taken=true;
        return;
      }
      this.dead=true;
      this.failed=true;
      this.breakCombo();
    }

    step(dt,width) {
      if(this.dead||this.cleared)return;
      width=width||1100;
      let remaining=Math.min(Math.max(dt,0),.1);
      while(remaining>0&&!this.dead&&!this.cleared){
        const d=Math.min(remaining,1/120);
        remaining-=d;
        this.elapsed+=d;
        this.invincibleFor=Math.max(0,this.invincibleFor-d);
        this.magnetFor=Math.max(0,this.magnetFor-d);
        this.doubleScoreFor=Math.max(0,this.doubleScoreFor-d);
        this.coinRushFor=Math.max(0,this.coinRushFor-d);
        this.boosterFor=Math.max(0,this.boosterFor-d);
        this.skillFor=Math.max(0,this.skillFor-d);
        this.skillCooldown=Math.max(0,this.skillCooldown-d);
        if(this.skillCooldown<=0)this.skillReady=true;
        if(this.comboTimer>0){this.comboTimer-=d;if(this.comboTimer<=0)this.breakCombo();}

        let speed=this.round.baseSpeed+this.distance*.12;
        if(this.boosterFor>0)speed*=1.2;
        if(this.skillFor>0&&(this.character.active.type==='dash'||this.character.active.type==='airdash'))speed*=1+(this.character.active.power||.35)*this.effects.dashPower;
        speed=Math.min(720,speed);
        this.speed=speed;
        this.distance+=speed*d/10;

        const p=this.player;
        const wasGround=p.y<=0;
        p.vy-=1780*d;
        p.y+=p.vy*d;
        if(p.y<=0){
          p.y=0;p.vy=0;p.jumps=0;p.spin=0;p.spinRate=0;
          if(!wasGround){
            this.lastLandingAt=this.elapsed;
            if(this.effects.landingBoost>0)this.boosterFor=Math.max(this.boosterFor,2);
            this.emit('land',p.x+18,0,8);
          }
        }else{
          p.slide=false;p.height=p.baseHeight;
          p.spin=(p.spin+p.spinRate*d)%(Math.PI*2);
        }

        this.spawnIn-=d;
        if(this.spawnIn<=0)this.spawn(width);

        const magnet=this.magnetFor>0?this.effects.magnet+160:this.effects.magnet;
        for(const o of this.objects){
          o.x-=speed*d;
          if(o.taken)continue;

          if((o.type==='coin'||o.type==='jelly')&&Math.abs((o.x+o.width/2)-(p.x+p.width/2))<magnet){
            const dy=Math.abs((o.y+o.height/2)-(p.y+p.height/2));
            if(dy<magnet*.72){
              o.x+=(p.x-o.x)*Math.min(1,d*8);
              o.y+=(p.y-o.y)*Math.min(1,d*8);
            }
          }

          const overlap=p.x+4<o.x+o.width&&p.x+p.width-4>o.x&&p.y+3<o.y+o.height&&p.y+p.height-3>o.y;
          if(!overlap)continue;

          if(o.type==='coin'){
            o.taken=true;this.coins++;this.stats.coins++;this.addCombo(1);
            if(p.y>20&&this.effects.airCoin>0)this.bonusScore+=Math.floor(20*this.effects.airCoin);
            this.emit('coin',o.x,o.y,3);
          }else if(o.type==='jelly'){
            o.taken=true;this.jellies++;this.stats.jellies++;this.addCombo(1);this.emit('jelly',o.x,o.y,3);
          }else if(o.type==='item'){
            o.taken=true;this.collectPower(o.kind);
          }else if(o.type==='obstacle'){
            this.resolveHit(o);
          }
        }

        for(const pt of this.particles){
          pt.x+=pt.vx*d;pt.y+=pt.vy*d;pt.vy-=420*d;pt.life-=d;
        }
        this.particles=this.particles.filter(pt=>pt.life>0);
        this.objects=this.objects.filter(o=>o.x+o.width>-60&&!o.taken);

        if(this.distance>=this.round.distance){
          this.cleared=this.objectiveMet;
          this.failed=!this.objectiveMet;
          if(!this.cleared)this.dead=true;
        }
      }
    }

    getRewards() {
      const clear=this.cleared;
      const comboBonus=Math.min(120,this.maxCombo*2);
      const gold=Math.floor((this.round.rewardGold+(this.coins*4)+comboBonus)*(clear?1:.45)*this.effects.gold);
      const gems=clear?this.round.rewardGem:0;
      return {gold:Math.max(0,gold),gems:gems,clear:clear,score:this.score,maxCombo:this.maxCombo,coins:this.coins,distance:Math.floor(this.distance)};
    }
  }

  const api={RunnerEngine:RunnerEngine,CHARACTERS:CHARACTERS,RELICS:RELICS,WORLDS:WORLDS,ROUNDS:ROUNDS,CONSUMABLES:CONSUMABLES,RARITY_ORDER:RARITY_ORDER,RARITY_WEIGHT:RARITY_WEIGHT,buildEffects:buildEffects};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.WorkHubRunner=api;
})(typeof window==='undefined'?{}:window);