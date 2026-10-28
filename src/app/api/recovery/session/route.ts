import { archiveRecoveryDocuments } from '@/lib/recovery/blob-archive';
import { NextRequest, NextResponse } from 'next/server';
import { database, recoveryEnabled } from '@/lib/recovery/database';
import { RECOVERY_COOKIE, signRecovery, verifyRecovery } from '@/lib/recovery/session';
export const runtime='nodejs';
export const maxDuration=300;
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
const failures=new Map<string,{count:number;until:number}>();
export async function GET(req:NextRequest){
 if(req.nextUrl.searchParams.has('archive'))return archiveRecoveryDocuments(req);
 if(req.nextUrl.searchParams.get('health')==='1'){
  try{
   const base=process.env.NEXT_PUBLIC_SUPABASE_URL;
   const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
   if(!base||!key)return NextResponse.json({available:false},{headers});
   const result=await fetch(base+'/auth/v1/health',{headers:{apikey:key},cache:'no-store',signal:AbortSignal.timeout(8000)});
   return NextResponse.json({available:result.ok,status:result.status},{headers});
  }catch{return NextResponse.json({available:false},{headers});}
 }

 if(!recoveryEnabled())return NextResponse.json({enabled:false},{headers});
 const user=await verifyRecovery(req.cookies.get(RECOVERY_COOKIE)?.value);
 return NextResponse.json({enabled:true,user:user?{id:user.id,email:user.email}:null},{headers});
}
export async function POST(req:NextRequest){
 if(!recoveryEnabled())return NextResponse.json({message:'비활성 상태입니다.'},{status:404,headers});
 if(req.headers.get('origin')!==req.nextUrl.origin)return NextResponse.json({message:'잘못된 요청입니다.'},{status:403,headers});
 const ip=req.headers.get('x-vercel-forwarded-for')||req.headers.get('x-forwarded-for')||'unknown';const now=Date.now();const prev=failures.get(ip);
 if(prev&&prev.until>now&&prev.count>=8)return NextResponse.json({message:'잠시 후 다시 시도해주세요.'},{status:429,headers});
 try{
 const raw=await req.text();if(raw.length>2048)throw new Error('INVALID_REQUEST');
 const {email,password}=JSON.parse(raw);if(typeof email!=='string'||typeof password!=='string'||!password||password.length>256)throw new Error('INVALID_REQUEST');
 const rows=await database()`select id,email,role from connect_recovery_private.authenticate(${email.trim()},${password})`;
 if(!rows.length){failures.set(ip,{count:prev&&prev.until>now?prev.count+1:1,until:now+600000});return NextResponse.json({message:'이메일 또는 비밀번호를 확인해주세요.'},{status:401,headers});}
 failures.delete(ip); if(failures.size>2000)for(const [k,v]of failures)if(v.until<now)failures.delete(k);
 const user=rows[0];const response=NextResponse.json({ok:true},{headers});response.cookies.set(RECOVERY_COOKIE,await signRecovery({id:String(user.id),email:String(user.email),role:String(user.role)}),{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:28800});return response;
 }catch(e){console.error('Native login failed',e instanceof Error?e.message:'unknown');return NextResponse.json({message:'DB 연결을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.'},{status:503,headers});}
}
export async function DELETE(req:NextRequest){if(req.headers.get('origin')!==req.nextUrl.origin)return new NextResponse(null,{status:403}); const r=NextResponse.json({ok:true},{headers});r.cookies.set(RECOVERY_COOKIE,'',{httpOnly:true,secure:true,path:'/',maxAge:0});return r;}
