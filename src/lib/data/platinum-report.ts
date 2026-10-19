import { createClient } from '@/lib/supabase/server';
import type { Report } from '@/lib/platinum-report';
export async function fetchPlatinumReports(): Promise<Report[]> {
  const db=await createClient();
  const {data,error}=await db.from('platinum_partner_reports').select('partner_id,source_date,payload,overrides,version,updated_at');
  if(error) throw new Error('플래티넘 현황을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
  return ((data ?? []) as Report[]).sort((a,b)=>a.payload.company_name.localeCompare(b.payload.company_name,'ko'));
}
