export type Security = 'submitted' | 'not_submitted' | 'unknown';
export const SECURITY_LABELS: Record<Security, string> = { submitted: '제출', not_submitted: '미제출', unknown: '확인 필요' };
export type Contact = { key: string; name: string; position: string; role: string; phone: string; email: string; mail_role: string; cohorts: string; note: string; excluded: boolean; technical: boolean; security: Security; source_row: number; connect_contact_id?: string; connect_contact?: { name: string; position: string; phone: string; email: string; updated_at: string } };
export type Equipment = { node: string; form_factor: string; cpu: string; memory: string; os_disk: string; ceph_disk: string; nic: string; note: string; status_note: string; source_row: number };
export type Issue = { key: string; category: string; detail: string };
export type Report = {
  partner_id: string; source_date: string; version: number; updated_at: string;
  payload: { company_name: string; grade_note: string; owner: string; region_group: string; region: string; city: string; service_region?: string; sources: string[]; security_documents?: {id:string;filename:string;registered_at:string}[]; contract_row: number; contract_contact: { name: string; position: string; phone: string; email: string }; education: { cohort: number; period: string; score: number | null; rank: number | null }[]; average_score?: number; overall_rank?: number; evaluation?: Record<string,number>; education_source_row?: number; contacts: Contact[]; dedicated_count_source?: number; equipment: Equipment[]; equipment_note?: string; pocs: { project: string; period: string; rating: string; comment: string; source_row: number }[]; issues: Issue[] };
  overrides: { security?: Record<string, { status: Security; note: string; checked_at: string; checked_by: string }>; issues?: Record<string, { note: string; checked_at: string; checked_by: string }> };
};
export function contactSecurity(r: Report, c: Contact): Security { return r.overrides.security?.[c.key]?.status ?? c.security; }
export function securityCounts(r: Report) {
  const counts = { submitted: 0, not_submitted: 0, unknown: 0 };
  for (const c of r.payload.contacts.filter(c => c.technical && !c.excluded)) counts[contactSecurity(r,c)]++;
  return counts;
}
export function openIssues(r: Report) { return r.payload.issues.filter(i => !r.overrides.issues?.[i.key]); }
export function requiresReview(r: Report) { const c=securityCounts(r); return !!(openIssues(r).length || c.not_submitted || c.unknown); }
export function filterReports(rows: Report[], q = '', review = false) {
  const query=q.trim().toLocaleLowerCase();
  return rows.filter(r => (!review || requiresReview(r)) && (!query || [r.payload.company_name,r.payload.region,r.payload.region_group,r.payload.owner,...r.payload.contacts.flatMap(c=>[c.name,c.email,c.phone])].join(' ').toLocaleLowerCase().includes(query)));
}
export function scoreLabel(score: number | null | undefined) { return score == null ? '결과 없음' : `${Number(score.toFixed(2))}점`; }
