import { DOCUMENT_TYPE_LABEL } from "@/lib/documents/constants";

/** 화면용 문서 구분 라벨 */
export const DOCUMENT_TYPE_SHORT_LABEL: Record<string, string> = {
  partner_contract: "파트너 계약서",
  partner_application: "파트너 신청서",
  business_registration: "사업자등록증",
  company_profile: "회사소개서",
  bank_account: "통장사본",
  credit_rating: "신용평가서",
  security_commitment: "보안확약서",
  tech_profile: "기술인력 프로필",
  other: "기타 문서",
  contract: "파트너 계약서",
  proposal: "제안서",
  report: "보고서",
  certificate: "인증/자격",
  brochure: "브로셔",
  etc: "기타 문서"
};

/** display_name 없을 때 document_type 기반 기본 파일명 */
export const DOCUMENT_TYPE_DEFAULT_FILE_NAME: Record<string, string> = {
  partner_contract: "파트너 계약서",
  partner_application: "파트너 신청서",
  business_registration: "사업자등록증",
  company_profile: "회사소개서",
  bank_account: "통장사본",
  credit_rating: "신용평가서",
  security_commitment: "보안확약서",
  other: "기타 문서",
  contract: "계약서",
  proposal: "제안서",
  report: "보고서",
  certificate: "인증/자격",
  brochure: "브로셔",
  etc: "기타 문서"
};

export { DOCUMENT_TYPE_LABEL };
