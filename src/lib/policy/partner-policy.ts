export const PARTNER_POLICY_PPT_PATH = "/documents/partner-policy-260623.pptx";
export const PARTNER_POLICY_PPT_FILENAME = "파트너 정책 260623 업데이트.pptx";
export const PARTNER_POLICY_UPDATED_AT = "2026-06-23";

export type PolicyTableRow = Record<string, string>;

export type PolicySection = {
  id: string;
  title: string;
  description?: string;
  columns?: string[];
  rows?: PolicyTableRow[];
  bullets?: string[];
};

export const PARTNER_POLICY_SECTIONS: PolicySection[] = [
  {
    id: "grades",
    title: "파트너 등급 기준",
    description:
      "연간 실적, 기술 인증, 교육 이수, PoC 수행 이력 등을 종합해 등급을 산정합니다.",
    columns: ["등급", "주요 기준", "갱신 주기"],
    rows: [
      {
        등급: "Platinum",
        "주요 기준": "최상위 매출·기술 역량, 정기교육 이수율 우수, 전략 협력 파트너",
        "갱신 주기": "연 1회"
      },
      {
        등급: "Gold",
        "주요 기준": "안정적 매출·기술 지원 역량, 제품교육 이수, PoC 수행 이력",
        "갱신 주기": "연 1회"
      },
      {
        등급: "Silver",
        "주요 기준": "기본 파트너 자격 충족, 정기교육 참여, 계약 유지",
        "갱신 주기": "연 1회"
      },
      {
        등급: "Strategic",
        "주요 기준": "전략적 협력·공동 GTM 대상, 별도 심사",
        "갱신 주기": "수시"
      }
    ]
  },
  {
    id: "benefits",
    title: "등급별 혜택",
    columns: ["등급", "영업 지원", "기술 지원", "교육·행사"],
    rows: [
      {
        등급: "Platinum",
        "영업 지원": "전담 SE·AM 배정, 우선 영업기회 배분",
        "기술 지원": "PoC 우선 지원, 장비/리소스 우선 배정",
        "교육·행사": "상위등급·심화교육 우선 초대"
      },
      {
        등급: "Gold",
        "영업 지원": "공동 영업 활동, 제안서 템플릿 제공",
        "기술 지원": "PoC 기술 자문, 제품 교육 우선 배정",
        "교육·행사": "정기·제품교육 전체 참여"
      },
      {
        등급: "Silver",
        "영업 지원": "기본 영업 자료·가격 정책 제공",
        "기술 지원": "기술 Q&A, 표준 PoC 가이드",
        "교육·행사": "정기교육 참여"
      },
      {
        등급: "Strategic",
        "영업 지원": "맞춤 협력 프로그램",
        "기술 지원": "공동 기술 개발·인증 지원",
        "교육·행사": "맞춤 교육·워크숍"
      }
    ]
  },
  {
    id: "training",
    title: "교육 프로그램",
    bullets: [
      "정기교육: 월별 정기 세션, 파트너 담당자 필수 참석 권장",
      "제품교육: CONTRABASS, VIOLA, CMP 등 제품별 실습·이론 과정",
      "상위등급교육: Platinum·Gold 대상 심화 과정",
      "심화교육: CI/CD, TROMBONE 등 기술 심화 트랙",
      "교육 미참석 파트너는 차기 모객 대상으로 우선 안내"
    ]
  },
  {
    id: "poc",
    title: "PoC / 기술지원 정책",
    bullets: [
      "PoC 요청은 파트너 포털 또는 담당 SE를 통해 접수",
      "Gold 이상 파트너는 PoC 우선 검토 및 기술 자원 배정",
      "PoC 성공 시 영업기회 연계 및 사례 공유 가능",
      "기술지원 범위: 아키텍처 검토, 설치·구성 가이드, 이슈 트러블슈팅",
      "장비/리소스 지원은 Platinum 우선, 재고·일정에 따라 조정"
    ]
  },
  {
    id: "contract",
    title: "계약 / 제출 서류",
    columns: ["구분", "필수 서류", "비고"],
    rows: [
      {
        구분: "신규 계약",
        "필수 서류": "사업자등록증, 파트너 계약서, 담당자 명단",
        비고: "계약일 기준 포털 등록"
      },
      {
        구분: "등급 갱신",
        "필수 서류": "실적 요약, 교육 이수 현황, PoC 결과(해당 시)",
        비고: "연 1회 제출"
      },
      {
        구분: "PoC 신청",
        "필수 서류": "PoC 계획서, 고객사 정보(NDA 범위 내)",
        비고: "승인 후 진행"
      },
      {
        구분: "정보변경",
        "필수 서류": "담당자 변경 신청서",
        비고: "포털 또는 엑셀 업로드"
      }
    ]
  }
];
