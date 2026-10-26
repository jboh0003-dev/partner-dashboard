import 'server-only';
import { database } from './database';
const ident=(s:string)=>{if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(s))throw new Error('Invalid identifier');return '"'+s+'"';};
export function splitTop(s:string){let depth=0,quoted=false,start=0;const out:string[]=[];for(let i=0;i<s.length;i++){if(s[i]==='"'&&s[i-1]!=='\\')quoted=!quoted;if(!quoted){if(s[i]==='(')depth++;if(s[i]===')')depth--;if(s[i]===','&&depth===0){out.push(s.slice(start,i).trim());start=i+1;}}}out.push(s.slice(start).trim());return out.filter(Boolean);}
type FK={source:string;target:string;column:string;foreign_column:string};
let fks: Promise<FK[]>|undefined;
function relationships(){return fks??=database().unsafe<FK[]>(`select c.conrelid::regclass::text as source,c.confrelid::regclass::text as target,a.attname as column,b.attname as foreign_column from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1] join pg_attribute b on b.attrelid=c.confrelid and b.attnum=c.confkey[1] where c.contype='f' and c.connamespace='public'::regnamespace`).then(rows=>rows.map(r=>({...r,source:r.source.replace(/^public\./,''),target:r.target.replace(/^public\./,'')})));}
export async function nativeFetch(input:RequestInfo|URL,init?:RequestInit):Promise<Response>{
 const url=new URL(typeof input==='string'?input:input instanceof URL?input.toString():input.url);
 const method=(init?.method||'GET').toUpperCase();
 if(!url.pathname.startsWith('/rest/v1/')) return fetch(input,init);
 if(!['GET','HEAD'].includes(method))return Response.json({message:'복구 모드에서는 조회만 가능합니다.',code:'READ_ONLY'},{status:503});
 try{
 const table=decodeURIComponent(url.pathname.slice('/rest/v1/'.length));ident(table);
 const params:any[]=[];const param=(v:unknown)=>{params.push(v);return '$'+params.length;};
 function condition(column:string,value:string,alias='t'):string{
  if(column==='or'||column==='and'){const inner=value.replace(/^\(|\)$/g,'');return '('+splitTop(inner).map(x=>{const i=x.indexOf('.');return condition(x.slice(0,i),x.slice(i+1),alias);}).join(column==='or'?' OR ':' AND ')+')';}
  if(column==='not.or'||column==='not.and')return 'NOT '+condition(column.slice(4),value,alias);
  const col=ident(alias)+'.'+ident(column);let neg=false;if(value.startsWith('not.')){neg=true;value=value.slice(4);}const i=value.indexOf('.');const op=value.slice(0,i),v=value.slice(i+1);let expr:string;
  if(op==='is'){if(!['null','true','false','unknown'].includes(v))throw new Error('Invalid is filter');expr=`${col} IS ${v.toUpperCase()}`;}
  else if(op==='in'){const list=splitTop(v.replace(/^\(|\)$/g,'')).map(x=>x.replace(/^"|"$/g,''));expr=list.length?`${col} IN (${list.map(param).join(',')})`:'FALSE';}
  else if(['eq','neq','gt','gte','lt','lte','like','ilike'].includes(op)){const ops:Record<string,string>={eq:'=',neq:'<>',gt:'>',gte:'>=',lt:'<',lte:'<=',like:'LIKE',ilike:'ILIKE'};expr=`${col} ${ops[op]} ${param(['like','ilike'].includes(op)?v.replace(/\*/g,'%'):v)}`;}
  else if(op==='cs'||op==='cd'||op==='ov')expr=`${col} ${{cs:'@>',cd:'<@',ov:'&&'}[op]} ${param(v)}`;
  else throw new Error('Unsupported filter '+op);
  return neg?'NOT ('+expr+')':expr;
 }
 let serial=0;const foreign=await relationships();
 function projection(source:string,selection:string,alias:string):string{
  const parts=splitTop(selection);const objects:string[]=[];
  for(const part of parts){if(part==='*'){objects.push(`to_jsonb(${ident(alias)})`);continue;}
   const open=part.indexOf('(');
   if(open>=0){const head=part.slice(0,open).trim(),inner=part.slice(open+1,-1);const [label,refRaw]=head.includes(':')?head.split(':'):[head,head];const ref=refRaw.split('!')[0];ident(ref);ident(label);const next='r'+(++serial);
    const options=foreign.filter(f=>(f.source===source&&f.target===ref)||(f.source===ref&&f.target===source));const hint=refRaw.split('!')[1];const fk=options.find(f=>hint&&f.column===hint)||options[0];if(!fk)throw new Error('Relationship unavailable '+source+' '+ref);
    const forward=fk.source===source;const join=forward?`${ident(next)}.${ident(fk.foreign_column)}=${ident(alias)}.${ident(fk.column)}`:`${ident(next)}.${ident(fk.column)}=${ident(alias)}.${ident(fk.foreign_column)}`;
    const value=projection(ref,inner,next);const query=forward?`(SELECT ${value} FROM public.${ident(ref)} ${ident(next)} WHERE ${join} LIMIT 1)`:`(SELECT coalesce(jsonb_agg(${value}),'[]'::jsonb) FROM public.${ident(ref)} ${ident(next)} WHERE ${join})`;
    objects.push(`jsonb_build_object(${param(label)},${query})`);
   }else{const [label,col]=part.includes(':')?part.split(':'):[part,part];objects.push(`jsonb_build_object(${param(label)},${ident(alias)}.${ident(col)})`);}
  }return objects.length?'('+objects.join(' || ')+')':`'{}'::jsonb`;
 }
 const select=projection(table,url.searchParams.get('select')||'*','t');
 const where:string[]=[];for(const [k,v]of url.searchParams){if(['select','order','limit','offset'].includes(k)||k.endsWith('.order')||k.endsWith('.limit'))continue;where.push(condition(k,v));}
 const filter=where.length?' WHERE '+where.join(' AND '):'';
 const order=url.searchParams.get('order');const ordering=order?' ORDER BY '+splitTop(order).map(x=>{const [col,dir,...nulls]=x.split('.');return `t.${ident(col)} ${dir==='desc'?'DESC':'ASC'} ${nulls.includes('nullsfirst')?'NULLS FIRST':nulls.includes('nullslast')?'NULLS LAST':''}`;}).join(','):'';
 const limit=Math.min(10000,Math.max(0,Number(url.searchParams.get('limit')||1000)));const offset=Math.max(0,Number(url.searchParams.get('offset')||0));if(!Number.isFinite(limit)||!Number.isFinite(offset))throw new Error('Invalid range');
 const headers=new Headers(init?.headers);const count=headers.get('prefer')?.includes('count=');
 const result=await database().begin('read only',async tx=>{const rows=method==='HEAD'?[]:await tx.unsafe(`SELECT ${select} AS data FROM public.${ident(table)} t${filter}${ordering} LIMIT ${limit} OFFSET ${offset}`,params as never[]);const total=count?await tx.unsafe(`SELECT count(*)::int as n FROM (SELECT ${select} AS data FROM public.${ident(table)} t${filter}) counted`,params as never[]):null;return{rows,total};});
 const rows=result.rows.map(x=>x.data);const responseHeaders=new Headers({'Content-Type':'application/json','Cache-Control':'private, no-store'});if(result.total)responseHeaders.set('Content-Range',`${offset}-${offset+rows.length-1}/${result.total[0].n}`);
 const single=headers.get('accept')?.includes('vnd.pgrst.object');if(single&&rows.length!==1)return Response.json({code:'PGRST116',details:`The result contains ${rows.length} rows`,message:'JSON object requested, multiple (or no) rows returned'},{status:406});
 return new Response(method==='HEAD'?null:JSON.stringify(single?rows[0]:rows),{status:200,headers:responseHeaders});
 }catch(error){console.error('Native read failed',url.pathname,error instanceof Error?error.message:'unknown');return Response.json({message:error instanceof Error?error.message:'Database query failed',code:'NATIVE_QUERY_FAILED'},{status:400});}
}
