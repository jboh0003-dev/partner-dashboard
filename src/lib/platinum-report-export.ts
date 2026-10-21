import ExcelJS from 'exceljs';
import { verifiedSecurityMark, reportContactNote, RECENT_TRAINING, isPlatinumEngineer, isPlatinumContactPoint, contactTrainingLabels, TRAINING_COHORT_LABELS, type Report } from './platinum-report';
export async function buildPlatinumWorkbook(rows:Report[]) {
 const wb=new ExcelJS.Workbook();wb.creator='OKESTRO';wb.created=new Date();
 function sheet(name:string,headers:string[],widths:number[],data:(string|number|null)[][]) {
  const s=wb.addWorksheet(name,{views:[{state:'frozen',ySplit:1}]});
  s.addRow(headers);s.addRows(data);s.columns=widths.map(width=>({width}));s.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,s.rowCount),column:headers.length}};
  s.getRow(1).height=30;s.getRow(1).eachCell(c=>{c.font={name:'맑은 고딕',bold:true,color:{argb:'FFFFFFFF'},size:11};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF17365D'}};c.alignment={vertical:'middle',wrapText:true};});
  s.eachRow((r,i)=>{if(i===1)return;r.height=48;r.eachCell(c=>{c.font={name:'맑은 고딕',size:10};c.alignment={vertical:'top',wrapText:true};if(i%2===0)c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF3F6FA'}};});});return s;
 }
 sheet('요약',['파트너','권역','지역','1기 점수','2기 점수','3기 점수','평균','장비(노드)','컨택(명)','이번 교육 참석(명)','보안확약서 있음','보안확약서 없음','계약 담당자','전화','이메일'],[22,13,12,12,12,12,14,14,14,20,20,20,16,20,32],rows.map(r=>{const p=r.payload;return [p.company_name,p.region_group,p.region,...[1,2,3].map(n=>p.education.find(e=>e.cohort===n)?.score??null),p.average_score??null,p.equipment.length,p.contacts.filter(c=>!c.excluded).length,p.contacts.filter(c=>c.recent_attended&&!c.excluded).length,p.contacts.filter(c=>isPlatinumEngineer(c)&&verifiedSecurityMark(r,c)==='O').length,p.contacts.filter(c=>isPlatinumEngineer(c)&&verifiedSecurityMark(r,c)!=='O').length,p.contract_contact.name,p.contract_contact.phone,p.contract_contact.email];}));
 sheet('교육결과',['파트너','기수','기간','점수','순위','PoC 점수','설계서','결과서','이슈관리','System-Check','교육점수'],[22,10,24,12,12,16,16,16,16,20,16],rows.flatMap(r=>r.payload.education.map(e=>[r.payload.company_name,TRAINING_COHORT_LABELS[e.cohort]??`${e.cohort}기`,e.period,e.score,e.rank,...['poc_score','design','result','issue_log','system_check','education_score'].map(k=>e.cohort===3?r.payload.evaluation?.[k]??null:null)])));
 sheet('장비현황',['파트너','노드','모델','CPU','Memory','OS Disk','Ceph Disk','NIC','상태','비고','장비 비고'],[22,17,35,50,35,40,45,55,22,55,55],rows.flatMap(r=>r.payload.equipment.map(e=>[r.payload.company_name,e.node,e.form_factor,e.cpu,e.memory,e.os_disk,e.ceph_disk,e.nic,e.status_note,e.note,r.payload.equipment_note??''])));
 sheet('컨택포인트',['파트너','이름','직급','담당업무','컨택포인트','엔지니어','전화','이메일','교육참석기수','보안확약서','비고'],[22,14,12,25,14,14,21,34,40,16,48],rows.flatMap(r=>r.payload.contacts.filter(c=>!c.excluded).map(c=>[r.payload.company_name,c.name,c.position,c.connect_department||c.role,isPlatinumContactPoint(c)?'O':'',isPlatinumEngineer(c)?'O':'',c.phone,c.email,contactTrainingLabels(c).join(', '),verifiedSecurityMark(r,c),reportContactNote(c.note)])));

 sheet('PoC 수행평가',['파트너','프로젝트','기간','평가','코멘트'],[22,55,28,12,100],rows.flatMap(r=>r.payload.pocs.map(v=>[r.payload.company_name,v.project,v.period,v.rating,v.comment])));
 sheet('이번 교육 참석자',['교육','파트너','이름','직급','전화','이메일','보안확약서'],[38,22,14,12,22,34,16],rows.flatMap(r=>r.payload.contacts.filter(c=>c.recent_attended&&!c.excluded).map(c=>[RECENT_TRAINING,r.payload.company_name,c.name,c.position,c.phone,c.email,verifiedSecurityMark(r,c)])));
 return wb;
}
