import type { PreReviewFinding } from "@/lib/partner-applications/pre-review";
import type {
  ApplicationCustomerInput,
  ApplicationDocumentType,
  ApplicationEngineerProfileInput,
  ApplicationEquipmentInput,
  ApplicationPersonInput,
  PartnerApplicationFormPayload
} from "@/lib/partner-applications/types";
import { coerceApplicationForm } from "@/lib/partner-applications/pre-review";

export const DOCUMENT_TYPE_LABEL: Record<ApplicationDocumentType, string> = {
  business_registration: "사업자등록증",
  company_intro: "회사소개서",
  financial: "재무자료",
  other: "기타"
};

const AUTOSAVE_EVENT_TYPES = new Set(["draft_saved", "autosave"]);

const BUSINESS_EVENT_LABELS: Record<string, string> = {
  created: "신청 생성",
  document_uploaded: "파일 업로드",
  document_deleted: "파일 삭제",
  submitted: "신청 제출",
  ai_pre_review_started: "AI Agent 사전검토 시작",
  ai_pre_review: "AI Agent 사전검토 완료",
  revision_requested: "보완 요청",
  resubmitted: "재제출",
  under_review: "관리자 검토 시작",
  approved: "승인",
  rejected: "반려",
  partner_registered: "partners 등록 완료"
};

export type ApplicationEventRow = {
  id?: unknown;
  created_at?: unknown;
  event_type?: unknown;
  message?: unknown;
  payload?: unknown;
};

export function isAutosaveEvent(eventType: string): boolean {
  return AUTOSAVE_EVENT_TYPES.has(eventType);
}

export function isBusinessHistoryEvent(eventType: string): boolean {
  if (isAutosaveEvent(eventType)) return false;
  return eventType in BUSINESS_EVENT_LABELS || eventType === "memo";
}

export function historyEventLabel(eventType: string): string {
  if (eventType === "memo") return "관리자 메모";
  return BUSINESS_EVENT_LABELS[eventType] ?? "처리 기록";
}

export function documentTypeLabel(type: string): string {
  return DOCUMENT_TYPE_LABEL[type as ApplicationDocumentType] ?? "첨부파일";
}

function looksInternalId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f-]{4,}$/i.test(value.trim()) || /^[0-9a-f]{20,}$/i.test(value.trim());
}

export function historyEventMessage(event: ApplicationEventRow): string | null {
  const type = String(event.event_type ?? "");
  const raw = String(event.message ?? "").trim();
  if (!raw || looksInternalId(raw)) {
    if (type === "document_uploaded") {
      const payload = event.payload && typeof event.payload === "object" ? (event.payload as Record<string, unknown>) : {};
      const docType = String(payload.document_type ?? payload.type ?? raw);
      if (docType && !looksInternalId(docType)) return documentTypeLabel(docType);
    }
    return null;
  }
  if (type === "document_uploaded") return documentTypeLabel(raw);
  if (type === "ai_pre_review" && /실패/.test(raw)) return "검토를 완료하지 못했습니다.";
  if (type === "ai_pre_review") return null;
  if (type === "ai_pre_review_started") return null;
  if (type === "created") return null;
  if (type === "submitted") return null;
  if (type === "under_review") return null;
  if (type === "approved") return "파트너로 등록되었습니다.";
  return raw;
}

export function formatAdminDateTime(value: unknown): string {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "—";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}.${m}.${d} ${hh}:${mm}`;
}

export function formatAdminDate(value: unknown): string {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("ko-KR");
}

function hasText(value: unknown): boolean {
  return Boolean(String(value ?? "").trim());
}

export function personHasContent(person: ApplicationPersonInput | Record<string, unknown> | null | undefined): boolean {
  if (!person) return false;
  return ["name", "department", "position", "phone", "email", "duty", "note", "skill_level", "main_skills"].some(
    (key) => hasText((person as Record<string, unknown>)[key])
  );
}

export function customerHasContent(row: ApplicationCustomerInput | Record<string, unknown> | null | undefined): boolean {
  if (!row) return false;
  return ["customer_name", "proposal_status", "business_timing", "revenue_target", "note"].some((key) =>
    hasText((row as Record<string, unknown>)[key])
  );
}

export function equipmentHasContent(row: ApplicationEquipmentInput | Record<string, unknown> | null | undefined): boolean {
  if (!row) return false;
  return ["equipment_name", "model", "quantity", "note"].some((key) => hasText((row as Record<string, unknown>)[key]));
}

export function engineerProfileHasContent(
  row: ApplicationEngineerProfileInput | Record<string, unknown> | null | undefined
): boolean {
  if (!row) return false;
  return ["name", "career_years", "main_skills", "certifications", "note"].some((key) =>
    hasText((row as Record<string, unknown>)[key])
  );
}

export function findingSectionId(finding: PreReviewFinding): string | undefined {
  if (finding.sectionId) return finding.sectionId;
  if (finding.id.startsWith("missing.contact") || finding.id === "contact.basic") return "section-contact";
  if (finding.id.includes("docs.") || finding.id.startsWith("docs")) return "section-documents";
  if (finding.id.includes("customers")) return "section-customers";
  if (finding.id.includes("equipment")) return "section-equipment";
  if (finding.id.includes("engineer")) return "section-engineer-profiles";
  if (finding.id.includes("people") || finding.id.includes("ceo") || finding.id === "mismatch.ceo") return "section-ceo";
  if (finding.id.startsWith("company") || finding.id.startsWith("missing.") || finding.id.startsWith("parse.")) {
    return "section-company";
  }
  return undefined;
}

export function mergeApplicationForm(
  payload: unknown,
  extras?: {
    people?: Array<Record<string, unknown>>;
    customers?: Array<Record<string, unknown>>;
    equipment?: Array<Record<string, unknown>>;
    engineers?: Array<Record<string, unknown>>;
  }
): PartnerApplicationFormPayload {
  const form = coerceApplicationForm(payload);
  const dbPeople = extras?.people ?? [];
  const bySection = (section: "ceo" | "sales" | "engineer") => {
    const fromForm = form.people[section].filter(personHasContent);
    if (fromForm.length) return fromForm;
    return dbPeople
      .filter((row) => String(row.section ?? "") === section)
      .filter(personHasContent) as ApplicationPersonInput[];
  };
  const customers = form.customers.filter(customerHasContent);
  const equipment = form.equipment.filter(equipmentHasContent);
  const profiles = form.engineer_profiles.filter(engineerProfileHasContent);
  return {
    ...form,
    people: {
      ceo: bySection("ceo"),
      sales: bySection("sales"),
      engineer: bySection("engineer")
    },
    customers: customers.length
      ? customers
      : (extras?.customers ?? []).filter(customerHasContent) as ApplicationCustomerInput[],
    equipment: equipment.length
      ? equipment
      : (extras?.equipment ?? []).filter(equipmentHasContent) as ApplicationEquipmentInput[],
    engineer_profiles: profiles.length
      ? profiles
      : (extras?.engineers ?? []).filter(engineerProfileHasContent) as ApplicationEngineerProfileInput[]
  };
}
