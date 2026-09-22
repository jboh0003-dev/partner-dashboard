// Regression tests for runner physics and browser-controller behavior, without user data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { RunnerEngine } = require('../public/work-hub/runner-engine.js');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS', name); }
function advance(e, seconds, rate = 120) { for (let n = 0; n < seconds * rate; n++) e.step(1 / rate); }

test('double jump, third-jump rejection, landing reset', () => {
  const e = new RunnerEngine(); e.spawnIn = Infinity;
  assert(e.jump()); advance(e, .1); assert(e.jump()); assert(!e.jump());
  advance(e, 2); assert.equal(e.player.y, 0); assert.equal(e.player.spin, 0); assert(e.jump());
});
test('coin, mushroom and star score; shield and invincibility expire correctly', () => {
  const e = new RunnerEngine(); e.spawnIn = Infinity;
  const object = type => ({type, x:94, y:0, width:25, height:30});
  e.objects.push(object('coin')); e.step(.01); assert.equal(e.coins, 1);
  e.collectItem('mushroom'); e.objects.push(object('obstacle')); e.step(.01);
  assert.equal(e.shield, 0); assert(!e.dead);
  e.collectItem('star'); e.objects.push(object('obstacle')); e.step(.01); assert(!e.dead);
  assert.equal(e.score, Math.floor(e.distance) + 100 + 500);
  advance(e, 5); assert.equal(e.invincibleFor, 0);
  e.objects.push(object('obstacle')); e.step(.01); assert(e.dead);
  const score = e.score; e.step(1); assert.equal(e.score, score);
});
test('stages and capped acceleration stay frame-rate independent', () => {
  const a = new RunnerEngine(), b = new RunnerEngine(); a.spawnIn = b.spawnIn = Infinity;
  advance(a, 30, 60); advance(b, 30, 120);
  assert(Math.abs(a.distance - b.distance) < .01);
  assert.equal(a.stage, Math.floor(a.distance / 250)); assert(a.stage >= 4); assert.equal(a.speed, 680);
});
test('high-speed collision cannot tunnel through obstacles', () => {
  const e = new RunnerEngine(); e.distance = 900; e.spawnIn = Infinity;
  e.objects.push({type:'obstacle', x:140, y:0, width:5, height:60});
  e.step(.1); assert(e.dead);
});

function controller({failRead=false, failWrite=false, stored=[]} = {}) {
  const nodes = new Map(), events = {}, frames = new Map(), observers = [];
  let nextFrame=1, engine, width=800;
  class Element {
    constructor(id='') { this.id=id; this.style={}; this.dataset={}; this.children=[]; this.textContent=''; this.hidden=false; this.disabled=false; this.classList={toggle(){}}; }
    set innerHTML(html) { for(const match of html.matchAll(/id="([^"]+)"/g)) nodes.set(match[1],new Element(match[1])); }
    get clientWidth(){return width;}
    appendChild(child){this.children.push(child); if(child.onload)child.onload();return child;}
    append(...children){this.children.push(...children);}
    replaceChildren(){this.children=[];}
    setAttribute(){}
    querySelector(selector){if(selector[0]==='#')return nodes.get(selector.slice(1)); if(!this[selector])this[selector]=new Element();return this[selector];}
    closest(){return null;}
    contains(){return true;}
    getClientRects(){return [1];}
    focus(){document.activeElement=this;}
    addEventListener(name,fn){this[name]=fn;}
    getContext(){return new Proxy({}, {get:(_, key)=>key==='createLinearGradient'?()=>({addColorStop(){}}):()=>{}});}
  }
  const main=new Element(), document={body:new Element(),activeElement:null,hidden:false,
    getElementById:id=>nodes.get(id),createElement:()=>new Element(),querySelector:()=>main,
    addEventListener:(name,fn)=>events[name]=fn};
  const localStorage={getItem(){if(failRead)throw Error('blocked');return JSON.stringify(stored);},setItem(_,value){if(failWrite)throw Error('full');stored=JSON.parse(value);}};
  const context={document,Element,localStorage,console,devicePixelRatio:1,
    requestAnimationFrame:fn=>{const id=nextFrame++;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),
    ResizeObserver:class {constructor(fn){observers.push(fn);}observe(){}},IntersectionObserver:class {observe(){}},
    window:{WorkHubRunner:{RunnerEngine:class extends RunnerEngine {constructor(){super(()=>.3);engine=this;}},stages:['a','b','c','d']},addEventListener(){},matchMedia:()=>({matches:false})}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/work-hub/runner.js'),'utf8'),context);
  const get=id=>nodes.get('runner-'+id);
  function tick(time){const entries=[...frames.values()];frames.clear();entries.forEach(fn=>fn(time));}
  return {get,engine,events,tick,resize:w=>{width=w;observers[0]();},get stored(){return stored;}};
}
test('canvas ratio matches the rendering width; hidden panels retain dimensions', () => {
  const c=controller(); assert.equal(c.get('canvas').style.aspectRatio,'800 / 360');
  c.resize(320); assert.equal(c.get('canvas').style.aspectRatio,'640 / 360');
  c.resize(0); assert.equal(c.get('canvas').style.aspectRatio,'640 / 360');
});
test('start, pause, resume, double-jump keys, game over and restart', () => {
  const c=controller(); c.get('start').onclick(); assert(c.get('start').disabled);
  const key=code=>c.events.keydown({code,target:c.get('canvas'),preventDefault(){}});
  key('Space'); key('ArrowUp'); key('Space'); assert.equal(c.engine.player.jumps,2);
  key('KeyP'); assert.equal(c.get('pause').textContent,'계속하기'); assert(c.get('jump').disabled);
  key('KeyP'); assert.equal(c.get('pause').textContent,'일시정지');
  c.engine.dead=true;c.tick(10);assert.equal(c.get('start').textContent,'↻ 다시 시작');assert.equal(c.stored.length,1);
  c.get('start').onclick();assert(!c.engine.dead);assert.equal(c.engine.score,0);
  c.resize(900);assert.equal(c.get('pause').textContent,'계속하기');
});
test('write failures retain records without duplication across repeated games', () => {
  const c=controller({failWrite:true,stored:[{score:100,distance:100,coins:0,date:'2026. 9. 22.'}]});
  for(let i=0;i<2;i++){c.get('start').onclick();c.engine.dead=true;c.tick(i+1);}
  assert.equal(c.get('scores').children.length,3);
  assert(c.get('storage-note').textContent.includes('이번 화면'));
});
test('read failure is visible; invalid saved records are ignored', () => {
  assert(controller({failRead:true}).get('storage-note').textContent.includes('이번 화면'));
  const c=controller({stored:[{score:-1,distance:1,coins:0,date:'x'}]});
  assert.equal(c.get('scores').children[0].textContent,'첫 기록의 주인공이 되어보세요.');
});
console.log(`${passed} regression checks passed`);
