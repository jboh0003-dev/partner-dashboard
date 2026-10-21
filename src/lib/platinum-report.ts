export type Security = 'submitted' | 'not_submitted' | 'unknown';
export const SECURITY_LABELS: Record<Security, string> = { submitted: '제출', not_submitted: '미제출', unknown: '확인 필요' };
export type Contact = { key: string; name: string; position: string; role: string; phone: string; email: string; mail_role: string; cohorts: string; note: string; excluded: boolean; technical: boolean; security: Security; recent_attended?: boolean; source_row: number; connect_contact_id?: string; connect_is_primary?: boolean; connect_is_contract_contact?: boolean; connect_role_type?: string; connect_department?: string; connect_contact?: { name: string; position: string; phone: string; email: string; updated_at: string } };
export type Equipment = { node: string; form_factor: string; cpu: string; memory: string; os_disk: string; ceph_disk: string; nic: string; note: string; status_note: string; source_row: number };
export type Issue = { key: string; category: string; detail: string };
export type Report = {
  partner_id: string; source_date: string; version: number; updated_at: string;
  payload: { company_name: string; grade_note: string; owner: string; region_group: string; region: string; city: string; service_region?: string; sources: string[]; security_documents?: {id:string;filename:string;original_filename?:string;registered_at:string;signers?:string[]}[]; contract_row: number; contract_contact: { name: string; position: string; phone: string; email: string }; education: { cohort: number; period: string; score: number | null; rank: number | null }[]; average_score?: number; overall_rank?: number; evaluation?: Record<string,number>; education_source_row?: number; contacts: Contact[]; dedicated_count_source?: number; equipment: Equipment[]; equipment_note?: string; pocs: { project: string; period: string; rating: string; comment: string; source_row: number }[]; issues: Issue[] };
  overrides: { contact_points?: string[]; security?: Record<string, { status: Security; note: string; checked_at: string; checked_by: string }>; issues?: Record<string, { note: string; checked_at: string; checked_by: string }> };
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

export function securityPresence(r: Report, c: Contact) { return contactSecurity(r,c)==='submitted'?'있음':'없음'; }
export function reportContactNote(note: string) { return note.replace(/보[안완]확약서\s*(미제출|제출|제출여부[^,]*),?\s*/g,'').replace(/정보변경 필요|확인\s*필요/g,'').replace(/^[,\s]+|[,\s]+$/g,''); }
export const RECENT_TRAINING='설치툴·QA 교육 (9/30~10/2)';

/** 3기는 기술파트너 교육이며, 최근 설치툴 QA 교육은 별도 이력입니다. */
export const TRAINING_COHORT_LABELS: Record<number,string> = {1:'1기',2:'2기',3:'3기 (기술파트너 교육)'};
export function contactTrainingLabels(c:Contact): string[] {
 const input=c.cohorts ?? '';
 const labels=[1,2,3].filter(n=>new RegExp('(?:^|[^0-9])'+n+'\\s*기').test(input)).map(n=>TRAINING_COHORT_LABELS[n]);
 if(c.recent_attended)labels.push('설치툴·QA 교육');
 return labels;
}
export function isPlatinumEngineer(c:Contact):boolean { return !c.excluded && (c.technical || c.connect_role_type==='engineer' || /엔지니어/.test(c.role??'')); }
export function isPlatinumContactPoint(c:Contact,r?:Report):boolean { return !c.excluded && (r?.overrides.contact_points !== undefined ? r.overrides.contact_points.includes(c.key) : !!(c.connect_is_primary || c.connect_is_contract_contact)); }
/** Filename-only matches are strict; avoid marking entire companies as signed from one file. */
export function matchingSecurityDocuments(r:Report,c:Contact) {
 const name=(c.name??'').replace(/\s/g,'');
 if(!name)return [];
 return (r.payload.security_documents??[]).filter(d=>(d.signers??[]).some(s=>s.replace(/\s/g,'')===name)|| (d.original_filename??'').replace(/\s/g,'').includes(name));
}
export function verifiedSecurityMark(r:Report,c:Contact):'O'|'—' {
 return matchingSecurityDocuments(r,c).length ? 'O' : '—';
}
