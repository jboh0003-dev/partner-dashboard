import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/require-admin';
import { createClient } from '@/lib/supabase/server';
import type { Report } from '@/lib/platinum-report';
const schema=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('security'),key:z.string().min(1).max(100),version:z.number().int().positive(),status:z.enum(['submitted','not_submitted','unknown']),note:z.string().trim().min(1).max(2000)}),
 z.object({kind:z.literal('issue'),key:z.string().min(1).max(100),version:z.number().int().positive(),resolved:z.boolean(),note:z.string().trim().min(1).max(2000)})
]);
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}) {
 const auth=await requireAdmin(); if(!auth.ok)return Response.json({message:auth.message},{status:auth.status});
 const {id}=await params;
 if(!z.string().uuid().safeParse(id).success)return Response.json({message:'잘못된 파트너입니다.'},{status:400});
 let body;try {body=schema.parse(await request.json());}catch{return Response.json({message:'확인 근거와 입력값을 확인해주세요.'},{status:400});}
 const db=await createClient();
 const {data,error}=await db.from('platinum_partner_reports').select('*').eq('partner_id',id).maybeSingle();
 if(error)return Response.json({message:'조회하지 못했습니다.'},{status:500});
 if(!data)return Response.json({message:'현황이 없습니다.'},{status:404});
 const row=data as Report;
 if(row.version!==body.version)return Response.json({message:'다른 변경사항이 있습니다. 새로고침 후 다시 저장해주세요.'},{status:409});
 const overrides=structuredClone(row.overrides);
 const stamp={note:body.note,checked_at:new Date().toISOString(),checked_by:auth.userId!};
 if(body.kind==='security') {
  if(!row.payload.contacts.some(c=>c.key===body.key && c.technical && !c.excluded))return Response.json({message:'확인 대상 인원이 아닙니다.'},{status:400});
  overrides.security={...overrides.security,[body.key]:{...stamp,status:body.status}};
 } else {
  if(!row.payload.issues.some(i=>i.key===body.key))return Response.json({message:'확인 항목이 없습니다.'},{status:400});
  overrides.issues={...overrides.issues};
  if(body.resolved)overrides.issues[body.key]=stamp;else delete overrides.issues[body.key];
 }
 const {data:updated,error:saveError}=await db.from('platinum_partner_reports').update({overrides,version:row.version+1,updated_at:stamp.checked_at}).eq('partner_id',id).eq('version',body.version).select('partner_id').maybeSingle();
 if(saveError)return Response.json({message:'저장하지 못했습니다. 다시 시도해주세요.'},{status:500});
 if(!updated)return Response.json({message:'다른 변경사항이 있습니다. 새로고침 후 다시 저장해주세요.'},{status:409});
 return Response.json({ok:true},{headers:{'Cache-Control':'private, no-store'}});
}
