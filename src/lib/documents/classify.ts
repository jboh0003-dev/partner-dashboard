import type { DocumentType } from "@/lib/documents/constants";

type ClassifyRule = {
  type: DocumentType;
  pattern: RegExp;
};

/** 구체적인 규칙을 먼저 검사. 파일명 기준으로만 분류한다. */
const RULES: ClassifyRule[] = [
  {
    type: "partner_contract",
    pattern: /표준\s*파트너\s*계약서|파트너\s*계약서|파트너계약서|partner\s*contract/i
  },
  { type: "partner_contract", pattern: /계약서/i },
  {
    type: "partner_application",
    pattern: /파트너\s*신청서|파트너신청서|partner\s*application/i
  },
  { type: "partner_application", pattern: /(?<![a-z])신청서(?![a-z])/i },
  {
    type: "business_registration",
    pattern: /사업자\s*등록증|사업자등록증|business\s*registration/i
  },
  { type: "business_registration", pattern: /사업자/i },
  { type: "bank_account", pattern: /통장\s*사본|통장사본|bank\s*account|통장|계좌|은행/i },
  {
    type: "company_profile",
    pattern: /company\s*profile|회사\s*소개서|회사소개서|회사소개|소개서/i
  },
  {
    type: "credit_rating",
    pattern: /신용\s*평가\s*서|신용평가서|신용\s*등급|credit\s*rating|\bnice\b|\bclip\b/i
  },
  { type: "credit_rating", pattern: /신용평가|신용\s*평가/i },
  {
    type: "security_commitment",
    pattern: /보안\s*확약\s*서|보안확약서|security\s*commitment|확약\s*서|확약서/i
  }
];

const GENERIC_FILENAME =
  /^(?:\d{1,3}|document|file|scan|image|photo|attachment|doc)(?:\s*\(\d+\))?\.[a-z0-9]+$/i;

/** 파일명만으로 문서 유형 분류 (폴더명은 사용하지 않음) */
export function classifyDocumentType(filename: string, _relativePath = ""): DocumentType {
  const haystack = filename.replace(/\\/g, "/");

  for (const rule of RULES) {
    if (rule.pattern.test(haystack)) return rule.type;
  }

  return "other";
}

export function isGenericDocumentFilename(filename: string): boolean {
  return GENERIC_FILENAME.test(filename.trim());
}

export function isDocumentTypeConfident(filename: string, documentType: DocumentType): boolean {
  if (documentType !== "other") return true;
  return !isGenericDocumentFilename(filename);
}
