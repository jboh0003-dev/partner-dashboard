import { createClient } from '@/lib/supabase/server';
import { getDocumentDisplayFileName } from '@/lib/documents/display';
import type { Report } from '@/lib/platinum-report';
export async function fetchPlatinumReports(): Promise<Report[]> {
  const db=await createClient();
  const {data,error}=await db.from('platinum_partner_reports').select('partner_id,source_date,payload,overrides,version,updated_at');
  if(error) throw new Error('플래티넘 현황을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
  const reports=(data ?? []) as Report[];
  if(!reports.length) return [];
  const {data:documents,error:documentError}=await db.from('partner_documents')
    .select('id,partner_id,original_filename,file_name,display_name,file_ext,document_type,created_at,is_active,document_status')
    .in('partner_id',reports.map(r=>r.partner_id)).eq('document_type','security_commitment')
    .is('deleted_at',null).order('created_at',{ascending:false});
  if(documentError) throw new Error('보안확약서를 불러오지 못했습니다.');
  for(const report of reports) report.payload={...report.payload,security_documents:(documents??[])
    .filter(d=>d.partner_id===report.partner_id&&d.is_active!==false&&d.document_status!=='archived')
    .map(d=>({id:d.id,filename:getDocumentDisplayFileName(d),registered_at:d.created_at}))};
  return reports.filter(r => !r.payload.company_name.replace(/\s/g, '').includes('비씨피')).sort((a,b)=>a.payload.company_name.localeCompare(b.payload.company_name,'ko'));
}
