import { redirect } from 'next/navigation';
import { getCachedViewerAuthContext } from '@/lib/auth/require-admin';
import { fetchPlatinumReports } from '@/lib/data/platinum-report';
import { PlatinumReportView } from '@/components/platinum-report/report-view';
export const dynamic='force-dynamic';
export default async function PlatinumReportPage() {
 const auth=await getCachedViewerAuthContext();
 if(!auth.user)redirect('/login?redirect=/dashboard/platinum-report');
 if(!auth.profile || !['admin','viewer','user'].includes(auth.role ?? ''))return <p>사내 계정 권한이 필요합니다.</p>;
 try {
  const rows=await fetchPlatinumReports();
  return <PlatinumReportView rows={rows} isAdmin={auth.isAdmin}/>;
 } catch { return <div className="rounded-xl border border-red-200 bg-white p-6 text-red-700">플래티넘 현황을 불러오지 못했습니다. 잠시 후 새로고침해주세요.</div>; }
}
