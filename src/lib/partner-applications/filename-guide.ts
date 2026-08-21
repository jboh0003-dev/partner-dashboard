import type { ApplicationDocumentType } from "@/lib/partner-applications/types";

export function companyNameForFileHint(companyName: string | null | undefined): string {
  const name = String(companyName ?? "").replace(/\s+/g, "").trim();
  return name || "회사명";
}

export function recommendedDocumentFileName(
  type: ApplicationDocumentType,
  companyName: string | null | undefined
): string {
  const company = companyNameForFileHint(companyName);
  switch (type) {
    case "business_registration":
      return `사업자등록증_${company}.pdf`;
    case "company_intro":
      return `회사소개서_${company}.pdf`;
    case "financial":
      return `재무자료_${company}.pdf 또는 .xlsx`;
    case "other":
      return `문서명_${company}.pdf`;
    default:
      return `문서명_${company}.pdf`;
  }
}
