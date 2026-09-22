(() => {
  'use strict';
  if(document.getElementById('workhub-runner'))return;
  const script=document.createElement('script');script.src='/work-hub/runner-engine.js?v=1';
  script.onload=mount;
  script.onerror=()=>console.error('미니게임을 불러오지 못했습니다. 새로고침해주세요.');
  document.body.appendChild(script);
  function mount(){
    const {RunnerEngine,stages}=window.WorkHubRunner;
    const engine=new RunnerEngine();
    const section=document.createElement('section');section.id='workhub-runner';section.className='runner';
    section.setAttribute('aria-label','슈퍼마리오 미니게임');
    section.innerHTML=`<div class="runner-heading"><div><div class="runner-kicker">THE ARCADE · 잠깐의 휴식</div><h2>슈퍼마리오 런</h2><p>장애물을 뛰어넘고, 코인을 모아 최고 기록에 도전하세요.</p></div><div class="runner-controls"><button type="button" class="btn primary" id="runner-start">▶ START · 시작</button><button type="button" class="btn" id="runner-pause" disabled>일시정지</button><button type="button" class="btn" id="runner-jump" disabled>↑ 점프</button></div></div><div class="runner-layout"><div class="runner-play"><div class="runner-hud"><span>거리<strong id="runner-distance">0 m</strong></span><span>코인<strong id="runner-coins">0</strong></span><span>점수<strong id="runner-score">0</strong></span><span id="runner-stage">STAGE 1 · 초록 들판</span></div><canvas id="runner-canvas" width="1100" height="360" tabindex="0" role="img" aria-label="오른쪽으로 달리는 마리오. 스페이스 또는 위쪽 화살표로 점프, 공중에서 한 번 더 누르면 이단 점프."></canvas><div class="runner-message" id="runner-message" role="status"><b>READY TO RUN?</b><span>START를 누르면 모험이 시작됩니다.</span></div></div><aside class="runner-records"><h3>명예의 기록판</h3><p id="runner-storage-note">이 브라우저의 최고 기록 TOP 5</p><ol id="runner-scores"></ol></aside></div><div class="runner-foot">Space / ↑ / 화면 터치 = 점프 · 공중에서 한 번 더 = 이단 점프 · P = 일시정지 · 점수 = 거리(m) + 코인 × 100 · 250m마다 새로운 스테이지</div>`;
    document.querySelector('.main').appendChild(section);
    const $=id=>section.querySelector('#'+id);
    const canvas=$('runner-canvas'),ctx=canvas.getContext('2d');
    let running=false,paused=false,raf=0,last=0,width=1100,records=[],storageOK=true;
    const KEY='workhub_runner_scores_v1';
    function readRecords(){try{const a=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(a)?a.filter(r=>r&&Number.isFinite(r.score)&&Number.isFinite(r.distance)&&Number.isFinite(r.coins)&&typeof r.date==='string').sort((a,b)=>b.score-a.score).slice(0,5):[];}catch{return [];}}
    records=readRecords();
    function leaderboard(){
      $('runner-scores').replaceChildren();
      if(!records.length){const li=document.createElement('li');li.textContent='첫 기록의 주인공이 되어보세요.';$('runner-scores').appendChild(li);}
      records.forEach((r,i)=>{const li=document.createElement('li'),left=document.createElement('span'),right=document.createElement('strong'),small=document.createElement('small');left.textContent=`${i+1}. ${Math.floor(r.distance)}m · ${r.coins}코인`;small.textContent=r.date;left.appendChild(small);right.textContent=r.score.toLocaleString()+'점';li.append(left,right);$('runner-scores').appendChild(li);});
      if(!storageOK)$('runner-storage-note').textContent='저장 공간에 접근할 수 없어 이번 화면에서만 기록됩니다.';
    }
    function message(title,sub){$('runner-message').hidden=false;$('runner-message').querySelector('b').textContent=title;$('runner-message').querySelector('span').textContent=sub;}
    function hud(){ $('runner-distance').textContent=Math.floor(engine.distance)+' m';$('runner-coins').textContent=engine.coins;$('runner-score').textContent=engine.score.toLocaleString();$('runner-stage').textContent=`STAGE ${engine.stage+1} · ${stages[engine.stage%4]}`;}
    function finish(){running=false;paused=false;cancelAnimationFrame(raf);$('runner-start').disabled=false;$('runner-start').textContent='↻ 다시 시작';$('runner-pause').disabled=true;$('runner-jump').disabled=true;
      records=[...readRecords(),...(!storageOK?records:[]),{score:engine.score,distance:Math.floor(engine.distance),coins:engine.coins,date:new Date().toLocaleDateString('ko-KR')}].sort((a,b)=>b.score-a.score).slice(0,5);
      try{localStorage.setItem(KEY,JSON.stringify(records));}catch{storageOK=false;}leaderboard();message('GAME OVER',`${engine.score.toLocaleString()}점 · ${Math.floor(engine.distance)}m · ${engine.coins}코인`);
    }
    function pause(){if(!running||paused)return;paused=true;cancelAnimationFrame(raf);$('runner-pause').textContent='계속하기';$('runner-jump').disabled=true;message('잠시 쉬어가기','계속하기를 누르면 이어서 달립니다.');}
    function resume(){if(!running||!paused)return;paused=false;last=0;$('runner-pause').textContent='일시정지';$('runner-jump').disabled=false;$('runner-message').hidden=true;canvas.focus({preventScroll:true});raf=requestAnimationFrame(frame);}
    function jump(){if(running&&!paused){engine.jump();canvas.focus({preventScroll:true});}}
    $('runner-start').onclick=()=>{cancelAnimationFrame(raf);engine.reset();running=true;paused=false;last=0;$('runner-message').hidden=true;$('runner-start').disabled=true;$('runner-pause').disabled=false;$('runner-pause').textContent='일시정지';$('runner-jump').disabled=false;canvas.focus({preventScroll:true});hud();raf=requestAnimationFrame(frame);};
    $('runner-pause').onclick=()=>paused?resume():pause();$('runner-jump').onclick=jump;
    canvas.addEventListener('pointerdown',e=>{if(running&&!paused){e.preventDefault();jump();}});
    section.addEventListener('keydown',e=>{if(e.target.matches('input,textarea,select'))return;if(['Space','ArrowUp'].includes(e.code)&&e.target===canvas){e.preventDefault();if(!e.repeat)jump();}if(e.code==='KeyP'&&!e.repeat){e.preventDefault();paused?resume():pause();}});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
    window.addEventListener('blur',pause);
    new IntersectionObserver(entries=>{if(!entries[0].isIntersecting)pause();},{threshold:0}).observe(canvas);
    function resize(){width=Math.max(640,Math.min(1100,canvas.clientWidth));const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=360*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);draw();}
    new ResizeObserver(resize).observe(canvas);
    const palettes=[['#8bcfdf','#d8ecda','#76a876','#41674b','#a67646'],['#edb082','#f5d49c','#c18b62','#905c52','#98684c'],['#9daecd','#e6e8ed','#a9bacc','#768ba9','#94a9b5'],['#242a49','#4b4262','#494366','#302f48','#6f6278']];
    function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),w,h);}
    function draw(){
      const pal=palettes[engine.stage%4],ground=304,scroll=engine.distance*10;
      const grad=ctx.createLinearGradient(0,0,0,304);grad.addColorStop(0,pal[0]);grad.addColorStop(1,pal[1]);ctx.fillStyle=grad;ctx.fillRect(0,0,width,360);
      ctx.fillStyle=engine.stage%4===3?'#f5e4bd':'#fff4c9';ctx.beginPath();ctx.arc(width-95,62,24,0,Math.PI*2);ctx.fill();
      // Parallax terrain changes its silhouette as well as its palette between stages.
      for(let i=-1;i<9;i++){
        const x=i*210-(scroll*.17%210);
        ctx.fillStyle=pal[2];ctx.beginPath();ctx.moveTo(x,ground);
        if(engine.stage%4===2){ctx.lineTo(x+110,105);ctx.lineTo(x+235,ground);ctx.fill();ctx.fillStyle='#fff8ed';ctx.beginPath();ctx.moveTo(x+110,105);ctx.lineTo(x+83,155);ctx.lineTo(x+125,145);ctx.lineTo(x+143,157);ctx.closePath();ctx.fill();}
        else if(engine.stage%4===3){rect(x,155,120,149,pal[2]);for(let k=0;k<4;k++)rect(x+k*32,142,20,16,pal[2]);rect(x+45,212,30,92,pal[3]);}
        else {ctx.quadraticCurveTo(x+90,engine.stage%4===1?150:110,x+240,ground);ctx.fill();}
      }
      for(let i=-1;i<7;i++){const x=i*250-(scroll*.4%250);if(engine.stage%4===0){rect(x+24,236,12,68,'#7a6248');ctx.fillStyle=pal[3];ctx.beginPath();ctx.arc(x+30,221,35,0,Math.PI*2);ctx.fill();}else if(engine.stage%4===1){rect(x+25,238,12,66,pal[3]);rect(x+7,254,20,10,pal[3]);rect(x+7,238,9,20,pal[3]);}else if(engine.stage%4===2){ctx.fillStyle='#f4f8fc';for(let k=0;k<6;k++)ctx.fillRect((x+k*39+scroll*.1)%width,45+k*33,3,3);}else{rect(x,265,180,39,pal[3]);}}
      rect(0,ground,width,56,pal[4]);rect(0,ground,width,7,engine.stage%4===2?'#f7fafc':engine.stage%4===0?'#567b44':'#d1ae79');
      for(let i=-1;i<width/48+1;i++){const x=i*48-(scroll%48);rect(x,ground+26,46,2,'#ffffff25');rect(x,ground+8,2,18,'#00000022');rect(x+24,ground+28,2,26,'#00000022');}
      for(const o of engine.objects){const y=ground-o.y-o.height;if(o.type==='coin'){ctx.fillStyle='#ae701c';ctx.beginPath();ctx.ellipse(o.x+10,y+10,9,11,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffdf63';ctx.beginPath();ctx.ellipse(o.x+10,y+9,7,9,0,0,Math.PI*2);ctx.fill();rect(o.x+9,y+3,2,12,'#bf8620');}else if(o.kind==='pipe'){rect(o.x,y,o.width,o.height,'#377946');rect(o.x+5,y+8,7,o.height-8,'#79b962');rect(o.x-4,y,o.width+8,14,'#285c38');rect(o.x-2,y+2,o.width+4,8,'#69a65b');}else{rect(o.x,y,o.width,o.height,'#96654e');for(let j=0;j<o.height;j+=22){rect(o.x,y+j,o.width,2,'#e2b58a');rect(o.x+(j%44===0?12:30),y+j,2,22,'#583c38');}}}
      drawMario(engine.player.x,ground-engine.player.y-44,engine.elapsed,engine.player.y>0);
      if(running&&!paused){ctx.fillStyle='#ffffffba';ctx.font='12px sans-serif';ctx.fillText(`${(engine.speed/260).toFixed(1)}× SPEED`,18,26);}
    }
    // Pixel-art Mario: red cap, moustache, blue overalls and a two-frame run cycle.
    const sprite=['.....RRRRRR.....','....RRRRRRRRRR..','....BBBSSBS.....','...BSBSSSBS.....','...BSBBSSSSBSS..','....BSSSSBBBB...','.....SSSSSSS....','....RRBRRRB.....','...RRRBRRRBRR...','..SSRRBBBBBRSS..','..SSSBBYBBYBSS..','.....BBBBBBB....','....BBBBBBBB....','....BBB..BBB....','...BBB....BBB...','..KKKK....KKKK..'];
    function drawMario(x,y,t,air){const colors={R:'#e43a34',B:'#225baa',S:'#ffd2a0',K:'#593d33',Y:'#f8d65b'};sprite.forEach((row,j)=>[...row].forEach((ch,i)=>{if(ch==='.')return;let dx=0;if(j>12&&!air)dx=Math.sin(t*20)*(i<8?2:-2);let color=colors[ch];if(j>=2&&j<=5&&ch==='B')color='#593d33';rect(x+i*2+dx,y+j*2.75,2.2,2.9,color);}));}
    function frame(time){if(!running||paused)return;const dt=last?(time-last)/1000:0;last=time;engine.step(dt,width);hud();draw();if(engine.dead)finish();else raf=requestAnimationFrame(frame);}
    leaderboard();resize();
  }
})();
