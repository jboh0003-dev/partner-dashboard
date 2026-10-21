import { createClient } from '@/lib/supabase/server';
import { getDocumentDownloadFileName } from '@/lib/documents/display';
import type { Report } from '@/lib/platinum-report';
export async function fetchPlatinumReports(): Promise<Report[]> {
  const db=await createClient();
  const {data,error}=await db.from('platinum_partner_reports').select('partner_id,source_date,payload,overrides,version,updated_at');
  if(error) throw new Error('플래티넘 현황을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
  const reports=(data ?? []) as Report[];
  if(!reports.length) return [];
  // Fetch only the relevant platinum employees, not the complete company-wide personnel table.
  const partnerIds=reports.map(r=>r.partner_id);
  const [{data:documents,error:documentError},{data:people,error:peopleError}]=await Promise.all([
    db.from('partner_documents')
      .select('id,partner_id,original_filename,file_name,display_name,file_ext,document_type,created_at,is_active,document_status')
      .in('partner_id',partnerIds).eq('document_type','security_commitment')
      .is('deleted_at',null).order('created_at',{ascending:false}),
    db.from('partner_contacts')
      .select('id,partner_id,name,position,department,role_type,is_primary,is_contract_contact,is_active,deleted_at')
      .in('partner_id',partnerIds).is('deleted_at',null).eq('is_active',true)
  ]);
  if(documentError) throw new Error('보안확약서를 불러오지 못했습니다.');
  if(peopleError) throw new Error('담당자 구분을 불러오지 못했습니다.');
  const normalized=(value:string)=>value.replace(/\\s/g,'').toLocaleLowerCase();
  const peopleByPartner=new Map<string,typeof people>();
  for(const person of people??[]) {
    const group=peopleByPartner.get(person.partner_id)??[];
    group.push(person);
    peopleByPartner.set(person.partner_id,group);
  }
  const documentsByPartner=new Map<string,{id:string;filename:string;original_filename:string;registered_at:string}[]>();
  for(const d of documents??[]) {
    if(d.is_active===false||d.document_status==='archived') continue;
    const group=documentsByPartner.get(d.partner_id)??[];
    group.push({id:d.id,filename:getDocumentDownloadFileName(d),original_filename:d.original_filename??'',registered_at:d.created_at});
    documentsByPartner.set(d.partner_id,group);
  }
  for(const report of reports) {
    const group=peopleByPartner.get(report.partner_id)??[];
    report.payload={
      ...report.payload,
      contacts:report.payload.contacts.map(c=>{
        const matched=group.find(p=>p.id===c.connect_contact_id) ??
          group.find(p=>normalized(p.name??'')===normalized(c.name??''));
        if(!matched)return c;
        return {...c,connect_contact_id:matched.id,
          connect_is_primary:matched.is_primary??false,
          connect_is_contract_contact:matched.is_contract_contact??false,
          connect_role_type:matched.role_type??'',
          connect_department:matched.department??undefined};
      }),
      security_documents:documentsByPartner.get(report.partner_id)??[]
    };
  }
  return reports.filter(r => !r.payload.company_name.replace(/\s/g, '').includes('비씨피')).sort((a,b)=>a.payload.company_name.localeCompare(b.payload.company_name,'ko'));
}
