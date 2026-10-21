import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/require-admin';
import { createClient } from '@/lib/supabase/server';
import type { Report } from '@/lib/platinum-report';
const text=z.string().max(5000);
const contact=z.object({key:z.string().min(1).max(100),name:text,position:text,role:text,phone:text,email:text,cohorts:text,mail_role:text,note:text,excluded:z.boolean(),technical:z.boolean(),security:z.enum(['submitted','not_submitted','unknown']),recent_attended:z.boolean().optional()});
const equipment=z.object({node:text,form_factor:text,cpu:text,memory:text,os_disk:text,ceph_disk:text,nic:text,status_note:text,note:text});
const detailsSchema=z.object({kind:z.literal('details'),version:z.number().int().positive(),details:z.object({
 owner:text,contract_contact:z.object({name:text,position:text,phone:text,email:text}),
 education:z.array(z.object({cohort:z.number().int().positive(),period:text,score:z.number().min(0).nullable(),rank:z.number().int().positive().nullable()})).max(100),
 average_score:z.number().min(0).nullable(),overall_rank:z.number().int().positive().nullable(),evaluation:z.record(z.string(),z.number().min(0)).optional(),
 equipment:z.array(equipment).max(200),equipment_note:text,contacts:z.array(contact).max(500),
 pocs:z.array(z.object({project:text,period:text,rating:text,comment:text})).max(200)
})});
const schema=z.discriminatedUnion('kind',[detailsSchema,z.object({kind:z.literal('contact_points'),version:z.number().int().positive(),keys:z.array(z.string().min(1).max(100)).max(500)})]);
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}) {
 const auth=await requireAdmin(); if(!auth.ok)return Response.json({message:auth.message},{status:auth.status});
 const {id}=await params;
 if(!z.string().uuid().safeParse(id).success)return Response.json({message:'잘못된 파트너입니다.'},{status:400});
 let body;try {body=schema.parse(await request.json());}catch{return Response.json({message:'입력값을 확인해주세요.'},{status:400});}
 const db=await createClient();
 const {data,error}=await db.from('platinum_partner_reports').select('*').eq('partner_id',id).maybeSingle();
 if(error)return Response.json({message:'조회하지 못했습니다.'},{status:500});
 if(!data)return Response.json({message:'현황이 없습니다.'},{status:404});
 const row=data as Report;
 if(row.version!==body.version)return Response.json({message:'다른 변경사항이 있습니다. 새로고침 후 다시 저장해주세요.'},{status:409});
 if(body.kind==='contact_points'){
  const keys=[...new Set(body.keys)];
  if(keys.some(key=>!row.payload.contacts.some(c=>c.key===key&&!c.excluded)))return Response.json({message:'등록된 인력에서 담당자를 선택해주세요.'},{status:400});
  const {data:updated,error:saveError}=await db.from('platinum_partner_reports').update({overrides:{...row.overrides,contact_points:keys},version:row.version+1,updated_at:new Date().toISOString()}).eq('partner_id',id).eq('version',body.version).select('partner_id').maybeSingle();
  if(saveError)return Response.json({message:'저장하지 못했습니다. 다시 시도해주세요.'},{status:500});
  if(!updated)return Response.json({message:'다른 변경사항이 있습니다. 새로고침 후 다시 저장해주세요.'},{status:409});
  return Response.json({ok:true},{headers:{'Cache-Control':'private, no-store'}});
 }
 const details=body.details;
 if(new Set(details.contacts.map(c=>c.key)).size!==details.contacts.length || new Set(details.education.map(e=>e.cohort)).size!==details.education.length)return Response.json({message:'중복된 인원 또는 교육기수가 있습니다.'},{status:400});
 const payload={...row.payload,...details,
 average_score:details.average_score??undefined,overall_rank:details.overall_rank??undefined,
 contacts:details.contacts.map(c=>({source_row:0,...row.payload.contacts.find(old=>old.key===c.key),...c})),
 equipment:details.equipment.map((e,i)=>({...row.payload.equipment[i],source_row:row.payload.equipment[i]?.source_row??0,...e})),
 pocs:details.pocs.map((p,i)=>({...row.payload.pocs[i],source_row:row.payload.pocs[i]?.source_row??0,...p}))
 };
 const overrides={...row.overrides,security:{...row.overrides.security}};
 for(const c of details.contacts) { if(overrides.security[c.key]) overrides.security[c.key]={...overrides.security[c.key],status:c.security}; }
 const {data:updated,error:saveError}=await db.from('platinum_partner_reports').update({payload,overrides,version:row.version+1,updated_at:new Date().toISOString()}).eq('partner_id',id).eq('version',body.version).select('partner_id').maybeSingle();
 if(saveError)return Response.json({message:'저장하지 못했습니다. 다시 시도해주세요.'},{status:500});
 if(!updated)return Response.json({message:'다른 변경사항이 있습니다. 새로고침 후 다시 저장해주세요.'},{status:409});
 return Response.json({ok:true},{headers:{'Cache-Control':'private, no-store'}});
}
