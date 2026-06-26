export const PARTNER_POLICY_BUCKET = "partner-policy-documents";

export const POLICY_ALLOWED_EXTENSIONS = new Set(["pptx", "ppt", "pdf", "docx", "doc"]);

export const POLICY_UI_CATEGORIES = [
  { key: "Overview", label: "Overview" },
  { key: "Partner Type", label: "파트너 등급/유형" },
  { key: "Profit Program", label: "수익 프로그램" },
  { key: "Technical Program", label: "기술 프로그램" },
  { key: "Support Program", label: "지원 프로그램" },
  { key: "Contract Process", label: "계약 절차" },
  { key: "Deal Registration", label: "영업기회 등록" },
  { key: "KPI / Goal", label: "KPI/목표" },
  { key: "Appendix", label: "Appendix" },
  { key: "기타", label: "기타" }
] as const;

export type PolicyCategoryKey = (typeof POLICY_UI_CATEGORIES)[number]["key"];

export const POLICY_CHUNK_MIN = 500;
export const POLICY_CHUNK_MAX = 1500;
