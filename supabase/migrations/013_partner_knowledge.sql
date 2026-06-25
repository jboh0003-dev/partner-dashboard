-- 파트너 정책/FAQ/운영 가이드 지식베이스 (오케 AI 검색용)
create table if not exists public.partner_knowledge (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  title text not null,
  content text not null,
  keywords text,
  source text,
  sort_order int default 0,
  is_active boolean default true,
  updated_at timestamptz default now()
);

create index if not exists partner_knowledge_category_idx
  on public.partner_knowledge (category, is_active);

create index if not exists partner_knowledge_active_idx
  on public.partner_knowledge (is_active);

insert into public.partner_knowledge (category, title, content, keywords, source, sort_order)
values
  (
    '등급',
    '파트너 등급 기준',
    'Platinum: 최상위 매출·기술 역량, 정기교육 이수율 우수, 전략 협력 파트너 (연 1회 갱신). Gold: 안정적 매출·기술 지원, 제품교육 이수, PoC 수행 이력 (연 1회). Silver: 기본 파트너 자격, 정기교육 참여, 계약 유지 (연 1회). Strategic: 전략적 협력·공동 GTM, 별도 심사 (수시).',
    '등급,플래티넘,골드,실버,기준,승급,갱신',
    '파트너 정책 PPT',
    10
  ),
  (
    '등급',
    '플래티넘 파트너 기준',
    'Platinum 등급은 최상위 매출·기술 역량, 정기교육 이수율 우수, 전략 협력 파트너를 대상으로 연 1회 갱신합니다. PoC 우선 지원과 장비/리소스 우선 배정 혜택이 있습니다.',
    '플래티넘,platinum,기준,등급',
    '파트너 정책 PPT',
    11
  ),
  (
    '등급',
    '파트너 승급 기준',
    '등급 승급은 연간 실적, 기술 인증, 교육 이수, PoC 수행 이력 등을 종합해 심사합니다. 갱신 시 실적 요약, 교육 이수 현황, PoC 결과(해당 시)를 제출합니다.',
    '승급,갱신,등급,상향',
    '파트너 정책 PPT',
    12
  ),
  (
    '정책',
    '등급별 혜택',
    'Platinum: 전담 SE·AM, 우선 영업기회, PoC·장비 우선, 상위등급·심화교육 우선 초대. Gold: 공동 영업, 제안서 템플릿, PoC 자문, 정기·제품교육. Silver: 기본 영업 자료, 기술 Q&A, 정기교육. Strategic: 맞춤 협력·교육 프로그램.',
    '혜택,등급,영업,기술,교육',
    '파트너 정책 PPT',
    20
  ),
  (
    '교육',
    '교육 운영 기준',
    '정기교육은 월별 정기 세션으로 파트너 담당자 필수 참석을 권장합니다. 제품교육(CONTRABASS, VIOLA, CMP 등), 상위등급·심화교육(Platinum·Gold), CI/CD·TROMBONE 기술 심화 과정이 있습니다. 교육 미참석 파트너는 차기 모객 대상으로 우선 안내합니다.',
    '교육,운영,정기교육,제품교육,심화교육,미수강',
    '파트너 정책 PPT',
    30
  ),
  (
    '계약',
    '신규 계약 제출 서류',
    '신규 계약 시 필수 서류: 사업자등록증, 파트너 계약서, 담당자 명단. 계약일 기준 포털 등록이 필요합니다.',
    '신청,신규,계약,서류,사업자등록,담당자',
    '파트너 정책 PPT',
    40
  ),
  (
    '계약',
    '파트너 신청 필요 문서',
    '파트너 신청·신규 계약 시 사업자등록증, 파트너 계약서, 담당자 명단이 필요합니다. 등급 갱신 시 실적 요약, 교육 이수 현황, PoC 결과(해당 시)를 추가 제출합니다.',
    '신청서,필요,문서,제출,등록',
    '파트너 정책 PPT',
    41
  ),
  (
    '운영기준',
    '계약 담당자 기준',
    '계약 담당자는 파트너사의 공식 계약·서류 창구 역할을 합니다. partner_contacts에서 is_contract_contact로 지정하며, 계약서·신청서 관련 문의의 1차 연락 창구입니다.',
    '계약담당,담당자,연락,기준',
    '운영 가이드',
    50
  ),
  (
    '운영기준',
    'PoC / 기술지원 정책',
    'PoC는 파트너 포털 또는 담당 SE를 통해 접수합니다. Gold 이상은 PoC 우선 검토·기술 자원 배정. PoC 성공 시 영업기회 연계 가능. Platinum 우선 장비/리소스 지원.',
    'poc,기술지원,장비,리소스',
    '파트너 정책 PPT',
    60
  ),
  (
    'FAQ',
    '파트너 정책 개요',
    '오케스트로 파트너 정책은 등급 기준, 등급별 혜택, 교육 프로그램, PoC/기술지원, 계약·제출 서류로 구성됩니다. 상세는 파트너 정책 메뉴 또는 정책 PPT를 참고하세요.',
    '정책,개요,가이드,faq',
    'FAQ',
    70
  ),
  (
    'FAQ',
    '문서 등록 기준',
    '파트너 문서는 계약서, 신청서, 사업자등록증, 통장사본, 회사소개서, 신용평가서, 보안확약서 등 유형별로 partner_documents에 등록합니다. 중복 업로드 시 대표 문서만 표시됩니다.',
    '문서,등록,업로드,기준',
    'FAQ',
    71
  )
on conflict do nothing;

notify pgrst, 'reload schema';
