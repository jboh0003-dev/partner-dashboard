'use client';

import { useEffect, useMemo, useState } from 'react';

type Status='todo'|'doing'|'done'|'blocked'|'failed';
type Scope='daily'|'weekly'|'monthly';
type Item={id:string;title:string;category:string;scope:Scope;target:string;status:Status;note?:string;completedAt?:string|null;createdAt:string};
type Market={ok:boolean;updatedAt?:string;kospi?:{value:any;change:any};usdkrw?:{value:any;change:any};stocks?:any[];hyundai?:any;message?:string};

const KEY='workhub_v5_state';
const STATUS:{value:Status;label:string;icon:string}[]=[
  {value:'todo',label:'예정',icon:'○'},{value:'doing',label:'진행',icon:'△'},{value:'done',label:'완료',icon:'✓'},{value:'blocked',label:'이슈',icon:'!'},{value:'failed',label:'못함',icon:'×'}
];
const today=()=>new Date().toISOString().slice(0,10);
const addDays=(d:string,n:number)=>{const x=new Date(d+'T12:00:00');x.setDate(x.getDate()+n);return x.toISOString().slice(0,10)};
const monday=(d:string)=>{const x=new Date(d+'T12:00:00');const diff=(x.getDay()+6)%7;x.setDate(x.getDate()-diff);return x.toISOString().slice(0,10)};
const monthKey=(d:string)=>d.slice(0,7);
const fmt=(d:string)=>{const x=new Date(d+'T12:00:00');return `${x.getMonth()+1}/${x.getDate()}`};
const uid=()=>crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`;

function inWeek(i:Item,w:string){if(i.scope==='weekly')return i.target===w;if(i.scope==='daily')return i.target>=w&&i.target<=addDays(w,6);return i.target===monthKey(w)}
function doneInWeek(i:Item,w:string){return i.status==='done'&&!!i.completedAt&&i.completedAt>=w&&i.completedAt<=addDays(w,6)}

export default function Home(){
 const [view,setView]=useState<'dashboard'|'planner'|'report'>('dashboard');
 const [items,setItems]=useState<Item[]>([]);
 const [market,setMarket]=useState<Market|null>(null);
 const [loadingMarket,setLoadingMarket]=useState(false);
 const [plannerTab,setPlannerTab]=useState<Scope>('weekly');
 const [edit,setEdit]=useState<Item|null>(null);
 const [partner,setPartner]=useState({contracted:'',consulting:'',applications:''});
 const week=monday(today()),last=addDays(week,-7),next=addDays(week,7);

 useEffect(()=>{try{const raw=localStorage.getItem(KEY);if(raw){const s=JSON.parse(raw);setItems(s.items||[]);setPartner(s.partner||{contracted:'',consulting:'',applications:''})}}catch{}},[]);
 useEffect(()=>{localStorage.setItem(KEY,JSON.stringify({items,partner}))},[items,partner]);
 const loadMarket=async()=>{setLoadingMarket(true);try{const r=await fetch('/api/market',{cache:'no-store'});setMarket(await r.json())}catch{setMarket({ok:false,message:'시세 연결 실패'})}finally{setLoadingMarket(false)}};
 useEffect(()=>{loadMarket();const t=setInterval(loadMarket,60000);return()=>clearInterval(t)},[]);

 const cur=items.filter(i=>inWeek(i,week)&&!['done','failed'].includes(i.status));
 const lastDone=items.filter(i=>doneInWeek(i,last));
 const nextItems=items.filter(i=>inWeek(i,next)&&!['done','failed'].includes(i.status));
 const doneThis=items.filter(i=>doneInWeek(i,week)).length;
 const doing=items.filter(i=>i.status==='doing').length;
 const blocked=items.filter(i=>i.status==='blocked').length;
 const changeStatus=(id:string,status:Status)=>setItems(v=>v.map(i=>i.id===id?{...i,status,completedAt:status==='done'?(i.completedAt||today()):null}:i));
 const addQuick=(title:string,target:string,scope:Scope='weekly')=>{if(!title.trim())return;setItems(v=>[...v,{id:uid(),title:title.trim(),category:'기타',scope,target,status:'todo',createdAt:today()}])};
 const saveItem=(i:Item)=>{setItems(v=>v.some(x=>x.id===i.id)?v.map(x=>x.id===i.id?i:x):[...v,i]);setEdit(null)};
 const del=(id:string)=>{if(confirm('이 업무를 삭제할까요?'))setItems(v=>v.filter(i=>i.id!==id))};

 const reportText=useMemo(()=>{
  const business=items.filter(i=>doneInWeek(i,week));
  const plan=nextItems;
  const lines=[
   `주간보고(${fmt(week)}-${fmt(addDays(week,6))})`,``,
   `1. 파트너 현황`,
   `계약 완료 파트너 수 ${partner.contracted||'-'}`,
   `협의 중인 파트너 ${partner.consulting||'-'}`,
   `신청서 수취 ${partner.applications||'-'}`,
   ``,`2. 업무 현황`,
   ...(business.length?business.map((x,n)=>`${n+1})${x.title}`):['1)완료 업무 없음']),
   ``,`3. 차주 주요 일정 및 계획`,
   ...(plan.length?plan.map((x,n)=>`${n+1})${x.title}`):['1)등록된 차주 계획 없음'])
  ];return lines.join('\n')
 },[items,partner,week,nextItems]);

 return <div className="wh-shell">
  <aside className="wh-side"><div className="wh-logo">Work Hub<small>MY WORKSPACE</small></div><div className="wh-nav">
   <button className={view==='dashboard'?'active':''} onClick={()=>setView('dashboard')}>▦ <span>대시보드</span></button>
   <button className={view==='planner'?'active':''} onClick={()=>setView('planner')}>✓ <span>업무계획</span></button>
   <button className={view==='report'?'active':''} onClick={()=>setView('report')}>▤ <span>주간보고</span></button>
  </div></aside>
  <main className="wh-main"><header className="wh-top"><div className="wh-title">{view==='dashboard'?'대시보드':view==='planner'?'업무계획':'주간보고'}</div><div className="wh-actions"><span className="wh-badge">● AUTO SAVE</span><button className="btn primary" onClick={()=>setEdit({id:uid(),title:'',category:'기타',scope:'weekly',target:week,status:'todo',createdAt:today()})}>+ 할 일 추가</button></div></header>
  <div className="wh-wrap">
   {view==='dashboard'&&<>
    <div className="scoreline"><Score label="이번주 할 일" value={cur.length}/><Score label="이번주 완료" value={doneThis}/><Score label="진행 중" value={doing}/><Score label="이슈·대기" value={blocked}/><Score label="다음주 계획" value={nextItems.length}/></div>
    <div className="dashboard-grid"><section className="work-zone"><div className="weekly-grid">
      <Lane title="지난주 한 일" sub={`${fmt(last)} ~ ${fmt(addDays(last,6))}`} items={lastDone} focus={false} onStatus={changeStatus} onEdit={setEdit} onDelete={del}/>
      <Lane title="이번주 할 일" sub={`${fmt(week)} ~ ${fmt(addDays(week,6))}`} items={cur} focus quickTarget={week} onQuick={addQuick} onStatus={changeStatus} onEdit={setEdit} onDelete={del}/>
      <Lane title="다음주 할 일" sub={`${fmt(next)} ~ ${fmt(addDays(next,6))}`} items={nextItems} focus={false} quickTarget={next} onQuick={addQuick} onStatus={changeStatus} onEdit={setEdit} onDelete={del}/>
    </div></section><MarketBoard market={market} loading={loadingMarket} refresh={loadMarket}/></div>
   </>}
   {view==='planner'&&<Planner items={items} tab={plannerTab} setTab={setPlannerTab} onAdd={(title,category)=>setItems(v=>[...v,{id:uid(),title,category:category||'기타',scope:plannerTab,target:plannerTab==='daily'?today():plannerTab==='weekly'?week:monthKey(today()),status:'todo',createdAt:today()}])} onStatus={changeStatus} onEdit={setEdit} onDelete={del}/>} 
   {view==='report'&&<Report partner={partner} setPartner={setPartner} text={reportText} lastDone={lastDone} cur={cur} next={nextItems}/>} 
  </div></main>
  {edit&&<Editor item={edit} onClose={()=>setEdit(null)} onSave={saveItem}/>} 
 </div>
}

function Score({label,value}:{label:string;value:number}){return <div className="score"><div className="label">{label}</div><div className="num">{value}</div></div>}
function Lane({title,sub,items,focus,quickTarget,onQuick,onStatus,onEdit,onDelete}:{title:string;sub:string;items:Item[];focus:boolean;quickTarget?:string;onQuick?:(t:string,target:string)=>void;onStatus:(id:string,s:Status)=>void;onEdit:(i:Item)=>void;onDelete:(id:string)=>void}){const [v,setV]=useState('');return <div className={`lane ${focus?'focus':''}`}><div className="lane-head"><div><h3>{title}</h3><p>{sub}</p></div><span className="count">{items.length}</span></div>{quickTarget&&<form className="quick-add" onSubmit={e=>{e.preventDefault();onQuick?.(v,quickTarget);setV('')}}><input value={v} onChange={e=>setV(e.target.value)} placeholder="빠르게 할 일 추가"/><button className="btn primary">+</button></form>}<div className="task-list">{items.length?items.map(i=><Task key={i.id} item={i} focus={focus} onStatus={onStatus} onEdit={onEdit} onDelete={onDelete}/>):<div className="empty">등록된 업무 없음</div>}</div></div>}
function Task({item,focus,onStatus,onEdit,onDelete}:{item:Item;focus:boolean;onStatus:(id:string,s:Status)=>void;onEdit:(i:Item)=>void;onDelete:(id:string)=>void}){return <div className={`task ${focus?'focus-card':''}`}><div className="task-top"><button className={`check ${item.status==='done'?'done':''}`} onClick={()=>onStatus(item.id,item.status==='done'?'todo':'done')}>✓</button><div className="task-title">{item.title}</div><div className="task-actions"><button onClick={()=>onEdit(item)}>수정</button><button onClick={()=>onDelete(item.id)}>삭제</button></div></div><div className="meta"><span className="chip cat">{item.category}</span><span className="chip">{item.scope==='daily'?'일간':item.scope==='weekly'?'주간':'월간'}</span><span className="chip">{item.target}</span></div><div className="statusbar">{STATUS.map(s=><button key={s.value} className={`status ${s.value} ${item.status===s.value?'active':''}`} onClick={()=>onStatus(item.id,s.value)}>{s.icon} {s.label}</button>)}</div></div>}
function MarketBoard({market,loading,refresh}:{market:Market|null;loading:boolean;refresh:()=>void}){const cls=(v:any)=>{const n=parseFloat(String(v??0));return n>0?'up':n<0?'down':'flat'};return <aside className="market"><div className="market-head"><div><div className="market-title">MARKET</div><div className="market-sub">LIVE SCOREBOARD · 60 SEC REFRESH</div></div><button className="market-refresh" onClick={refresh}>{loading?'…':'↻'}</button></div>{market?.ok?<><div className="ticker-top"><div className="ticker-box"><div className="k">KOSPI</div><div className="v">{market.kospi?.value||'-'}</div><div className={cls(market.kospi?.change)}>{market.kospi?.change??'-'}%</div></div><div className="ticker-box"><div className="k">USD/KRW</div><div className="v">₩ {market.usdkrw?.value||'-'}</div><div className={cls(market.usdkrw?.change)}>{market.usdkrw?.change??'-'}%</div></div></div>{market.hyundai&&<div className="hyundai"><div className="tag">FEATURED · HYUNDAI MOTOR</div><div className="name">현대차</div><div style={{display:'flex',justifyContent:'space-between'}}><strong>{market.hyundai.price}</strong><span className={cls(market.hyundai.change)}>{market.hyundai.change}%</span></div></div>}<div className="market-list">{(market.stocks||[]).map((s:any)=><div className="stock-row" key={s.code}><div className="rank">{s.rank}</div><div><div className="stock-name">{s.name}</div><div className="stock-meta">시총 {s.marketValue}</div></div><div className="stock-price">{s.price}<div className={cls(s.change)}>{s.change}%</div></div></div>)}</div><div className="market-note">실제 외부 시세 API를 서버에서 조회합니다. 장중 데이터는 제공처 정책에 따라 지연될 수 있습니다.</div></>:<div className="empty">{market?.message||'시세 연결 중…'}</div>}</aside>}
function Planner({items,tab,setTab,onAdd,onStatus,onEdit,onDelete}:{items:Item[];tab:Scope;setTab:(s:Scope)=>void;onAdd:(t:string,c:string)=>void;onStatus:(id:string,s:Status)=>void;onEdit:(i:Item)=>void;onDelete:(id:string)=>void}){const [t,setT]=useState(''),[c,setC]=useState('');const list=items.filter(i=>i.scope===tab);return <div className="planner-layout"><div className="panel"><div className="tabs">{(['daily','weekly','monthly'] as Scope[]).map(x=><button key={x} className={tab===x?'active':''} onClick={()=>setTab(x)}>{x==='daily'?'일간':x==='weekly'?'주간':'월간'}</button>)}</div><form className="quick-add" onSubmit={e=>{e.preventDefault();if(t.trim()){onAdd(t.trim(),c.trim());setT('');setC('')}}}><input value={t} onChange={e=>setT(e.target.value)} placeholder="해야 할 일 입력"/><input value={c} onChange={e=>setC(e.target.value)} placeholder="구분"/><button className="btn primary">추가</button></form><div className="plan-list">{list.length?list.map(i=><Task key={i.id} item={i} focus onStatus={onStatus} onEdit={onEdit} onDelete={onDelete}/>):<div className="empty">등록된 계획 없음</div>}</div></div></div>}
function Report({partner,setPartner,text,lastDone,cur,next}:{partner:any;setPartner:(v:any)=>void;text:string;lastDone:Item[];cur:Item[];next:Item[]}){const copy=()=>navigator.clipboard.writeText(text);return <><div className="panel"><h3 style={{marginTop:0}}>파트너 현황 입력</h3><div className="partner-fields"><div className="field"><label>계약 완료 파트너 수</label><input value={partner.contracted} onChange={e=>setPartner({...partner,contracted:e.target.value})}/></div><div className="field"><label>협의 중인 파트너</label><input value={partner.consulting} onChange={e=>setPartner({...partner,consulting:e.target.value})}/></div><div className="field"><label>신청서 수취</label><input value={partner.applications} onChange={e=>setPartner({...partner,applications:e.target.value})}/></div></div></div><div className="report-grid"><R title="지난주 한 일" items={lastDone}/><R title="이번주 할 일" items={cur}/><R title="다음주 할 일" items={next}/></div><div className="report-box"><div className="report-tools"><div><strong>메일용 주간보고</strong><div className="market-sub">첨부 예시 형식으로 바로 복사</div></div><button className="btn primary" onClick={copy}>주간보고 복사</button></div><textarea className="report-edit" value={text} readOnly/></div></>}
function R({title,items}:{title:string;items:Item[]}){return <div className="report-card"><h3>{title}</h3>{items.length?items.map((i,n)=><div className="report-line" key={i.id}>{n+1}. {i.title}</div>):<div className="empty">없음</div>}</div>}
function Editor({item,onClose,onSave}:{item:Item;onClose:()=>void;onSave:(i:Item)=>void}){const [v,setV]=useState(item);return <div className="modal" onMouseDown={e=>{if(e.currentTarget===e.target)onClose()}}><div className="modal-card"><h2>{item.title?'업무 수정':'할 일 추가'}</h2><div className="field"><label>업무명</label><input value={v.title} onChange={e=>setV({...v,title:e.target.value})}/></div><div className="field"><label>구분</label><input value={v.category} onChange={e=>setV({...v,category:e.target.value})}/></div><div className="field"><label>메모</label><textarea rows={3} value={v.note||''} onChange={e=>setV({...v,note:e.target.value})}/></div><div className="statusbar" style={{marginLeft:0}}>{STATUS.map(s=><button key={s.value} className={`status ${s.value} ${v.status===s.value?'active':''}`} onClick={()=>setV({...v,status:s.value,completedAt:s.value==='done'?(v.completedAt||today()):null})}>{s.icon} {s.label}</button>)}</div><div className="modal-actions"><button className="btn" onClick={onClose}>취소</button><button className="btn primary" onClick={()=>v.title.trim()&&onSave(v)}>저장</button></div></div></div>}
