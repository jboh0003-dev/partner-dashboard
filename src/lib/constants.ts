export const PARTNER_STATUS_LABEL: Record<string, string> = {
  active: "활성",
  inactive: "비활성",
  pending: "검토중",
  expired: "계약종료",
  blocked: "관리제외"
};

export const PARTNER_GRADE_LABEL: Record<string, string> = {
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
  strategic: "Strategic",
  none: "미분류"
};

export const PARTNER_GRADE_ORDER = ["platinum", "gold", "silver", "strategic", "none"] as const;

export const CONTACT_ROLE_LABEL: Record<string, string> = {
  sales: "영업",
  engineer: "엔지니어",
  admin: "관리",
  executive: "대표/경영",
  contract: "계약담당",
  etc: "일반 담당자"
};

export type ManagementPriorityKey =
  | "p1_opportunity_no_training"
  | "p2_opportunity_theory_only"
  | "p3_recent_contract_no_training"
  | "p4_no_training_history"
  | "p5_general";

export const MANAGEMENT_PRIORITY_LABEL: Record<ManagementPriorityKey, string> = {
  p1_opportunity_no_training: "1순위 · 영업기회 + 교육 미참석",
  p2_opportunity_theory_only: "2순위 · 영업기회 + 이론만 수강",
  p3_recent_contract_no_training: "3순위 · 최근 계약 + 교육 미참석",
  p4_no_training_history: "4순위 · 교육 이력 없음",
  p5_general: "5순위 · 일반 관리"
};

export const MANAGEMENT_PRIORITY_RANK: Record<ManagementPriorityKey, number> = {
  p1_opportunity_no_training: 1,
  p2_opportunity_theory_only: 2,
  p3_recent_contract_no_training: 3,
  p4_no_training_history: 4,
  p5_general: 5
};

export const POC_RESULT_STATUS_LABEL: Record<string, string> = {
  success: "성공",
  failed: "실패",
  in_progress: "진행중",
  cancelled: "취소",
  pending: "대기"
};

export const DOCUMENT_TYPE_LABEL: Record<string, string> = {
  partner_contract: "파트너 계약서",
  partner_application: "파트너 신청서",
  business_registration: "사업자등록증",
  company_profile: "회사소개서",
  bank_account: "통장사본",
  credit_rating: "신용평가서",
  security_commitment: "보안확약서",
  other: "기타",
  contract: "계약서",
  proposal: "제안서",
  report: "보고서",
  certificate: "인증/자격",
  brochure: "브로셔",
  etc: "기타"
};
