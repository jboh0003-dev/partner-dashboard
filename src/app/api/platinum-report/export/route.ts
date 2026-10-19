import { getCachedViewerAuthContext } from '@/lib/auth/require-admin';
import { fetchPlatinumReports } from '@/lib/data/platinum-report';
import { filterReports } from '@/lib/platinum-report';
import { buildPlatinumWorkbook } from '@/lib/platinum-report-export';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function GET(request:Request) {
 const auth=await getCachedViewerAuthContext();
 if(!auth.user)return Response.json({message:'로그인이 필요합니다.'},{status:401});
 if(!auth.profile||!['admin','viewer','user'].includes(auth.role??''))return Response.json({message:'사내 계정 권한이 필요합니다.'},{status:403});
 try {
  const params=new URL(request.url).searchParams;
  const rows=filterReports(await fetchPlatinumReports(),params.get('q')??'',params.get('review')==='1');
  if(!rows.length)return Response.json({message:'내려받을 파트너가 없습니다.'},{status:404});
  const wb=await buildPlatinumWorkbook(rows);const buffer=await wb.xlsx.writeBuffer();
  const filename='플래티넘_파트너_현황_20261016_v1.xlsx';
  return new Response(new Uint8Array(buffer),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="platinum-report-v1.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,'Cache-Control':'private, no-store','Vary':'Cookie'}});
 }catch{return Response.json({message:'엑셀 생성에 실패했습니다. 잠시 후 다시 시도해주세요.'},{status:500});}
}
