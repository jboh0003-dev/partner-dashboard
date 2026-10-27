import { createHash, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { database, recoveryEnabled } from '@/lib/recovery/database';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function POST(req:NextRequest){
 const expected=process.env.CONNECT_DOCUMENT_IMPORT_TOKEN||'';
 const supplied=(req.headers.get('authorization')||'').replace(/^Bearer /,'');
 const hash=(v:string)=>createHash('sha256').update(v).digest();
 if(!recoveryEnabled()||!expected||!timingSafeEqual(hash(supplied),hash(expected)))return new NextResponse(null,{status:404});
 try{
 const id=req.nextUrl.searchParams.get('id')||'',part=Number(req.nextUrl.searchParams.get('part')),total=Number(req.nextUrl.searchParams.get('total'));
 const digest=req.headers.get('x-content-sha256')||'',name=decodeURIComponent(req.headers.get('x-document-name')||'');
 if(!/^[0-9a-f-]{36}$/.test(id)||!Number.isInteger(part)||!Number.isInteger(total)||Number(req.headers.get('content-length')||0)>3500000)return NextResponse.json({ok:false,code:'INVALID_REQUEST'},{status:400});
 const data=Buffer.from(await req.arrayBuffer());if(data.length>3500000)return new NextResponse(null,{status:413});
 const result=await database().begin('read write',async tx=>tx`select connect_recovery_private.put_document_chunk(${id}::uuid,${part}::int,${total}::int,${digest},${name},${data},${supplied}) as result`);
 return NextResponse.json({ok:true,...result[0].result},{headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error('Document recovery import failed',e instanceof Error?e.message:'unknown');return NextResponse.json({ok:false,code:'IMPORT_FAILED'},{status:400});}
}
