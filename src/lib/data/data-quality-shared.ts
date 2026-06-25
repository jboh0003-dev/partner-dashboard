import { PARTNER_GRADE_LABEL } from "@/lib/constants";
import {
  getDocumentTypeShortLabel,
  hasPartnerNameMismatch
} from "@/lib/documents/display";
import { isSamplePartner } from "@/lib/partners/sample-filter";
import type { PartnerAsset } from "@/types/asset";
import type { Partner, PartnerContact } from "@/types/partner";
import type { TrainingAttendance } from "@/types/training";

export type DataQualitySection = "documents" | "contacts" | "assets" | "training";

export type DataQualityIssueType =
  | "missing_partner_contract"
  | "missing_partner_application"
  | "missing_business_registration"
  | "missing_bank_account"
  | "document_needs_review"
  | "document_unmatched"
  | "document_name_mismatch"
  | "no_contacts"
  | "contact_missing_email"
  | "contact_missing_phone"
  | "contact_missing_position"
  | "contact_duplicate_email"
  | "asset_holding_partner"
  | "platinum_no_assets"
  | "asset_empty_detail"
  | "no_training_history"
  | "contacts_but_no_training"
  | "attendance_missing_contact"
  | "attendance_possible_duplicate";

export const DATA_QUALITY_ISSUE_LABEL: Record<DataQualityIssueType, string> = {
  missing_partner_contract: "계약서 없음",
  missing_partner_application: "신청서 없음",
  missing_business_registration: "사업자등록증 없음",
  missing_bank_account: "통장사본 없음",
  document_needs_review: "확인 필요 문서",
  document_unmatched: "매칭 실패 문서",
  document_name_mismatch: "파트너명 불일치 문서",
  no_contacts: "담당자 없음",
  contact_missing_email: "이메일 없는 담당자",
  contact_missing_phone: "연락처 없는 담당자",
  contact_missing_position: "직급 없는 담당자",
  contact_duplicate_email: "이메일 중복 담당자",
  asset_holding_partner: "장비 보유 파트너",
  platinum_no_assets: "Platinum 장비 미등록",
  asset_empty_detail: "장비 상세 누락",
  no_training_history: "교육 이력 없음",
  contacts_but_no_training: "담당자 있음 · 교육 없음",
  attendance_missing_contact: "참석자 연락처 누락",
  attendance_possible_duplicate: "교육 데이터 중복 가능"
};

export const DATA_QUALITY_SECTION_LABEL: Record<DataQualitySection, string> = {
  documents: "문서 점검",
  contacts: "담당자 점검",
  assets: "장비/리소스 점검",
  training: "교육 데이터 점검"
};

export type DataQualityRow = {
  id: string;
  section: DataQualitySection;
  issueType: DataQualityIssueType;
  issueLabel: string;
  partnerId: string | null;
  partnerName: string;
  grade: string | null;
  gradeLabel: string;
  contractDate: string | null;
  documentType: string | null;
  needsReview: boolean;
  detail: string;
  entityId: string | null;
  links: {
    partnerDetail: string | null;
    documentsTab: string | null;
    organizationTab: string | null;
    assetsTab: string | null;
    trainingsTab: string | null;
    documentManage: string | null;
    contactsList: string | null;
  };
};

export type DataQualitySummary = {
  totalPartners: number;
  withContract: number;
  withoutContract: number;
  withApplication: number;
  withoutApplication: number;
  withoutContacts: number;
  withAssets: number;
  needsReviewDocuments: number;
  unmatchedDocuments: number;
};

export type DataQualityBundle = {
  summary: DataQualitySummary;
  rows: DataQualityRow[];
  errors: string[];
  fetchedAt: string;
};

type DocumentRow = {
  id: string;
  partner_id: string;
  partner_name: string;
  document_type: string | null;
  extracted_partner_name: string | null;
  match_status: string | null;
  review_status: string | null;
  original_filename: string | null;
  display_name: string | null;
  file_name: string;
};

type AssetRow = PartnerAsset & { partner_name: string };
type AttendanceRow = TrainingAttendance & {
  partner_name: string;
  training_name?: string | null;
  training_year?: number | null;
  training_month?: number | null;
};

function partnerLinks(partnerId: string | null) {
  if (!partnerId) {
    return {
      partnerDetail: null,
      documentsTab: null,
      organizationTab: null,
      assetsTab: null,
      trainingsTab: null,
      documentManage: null,
      contactsList: null
    };
  }

  return {
    partnerDetail: `/dashboard/partners/${partnerId}`,
    documentsTab: `/dashboard/partners/${partnerId}?tab=documents`,
    organizationTab: `/dashboard/partners/${partnerId}?tab=organization`,
    assetsTab: `/dashboard/partners/${partnerId}?tab=assets`,
    trainingsTab: `/dashboard/partners/${partnerId}?tab=trainings`,
    documentManage: `/dashboard/documents`,
    contactsList: `/dashboard/contacts?partnerId=${partnerId}`
  };
}

function gradeLabel(grade: string | null | undefined): string {
  return PARTNER_GRADE_LABEL[grade ?? "none"] ?? grade ?? "미분류";
}

function buildPartnerRow(
  section: DataQualitySection,
  issueType: DataQualityIssueType,
  partner: Partner,
  detail: string,
  options: {
    documentType?: string | null;
    needsReview?: boolean;
    entityId?: string | null;
    documentManage?: string | null;
  } = {}
): DataQualityRow {
  const links = partnerLinks(partner.id);
  return {
    id: `${issueType}:${partner.id}:${options.entityId ?? "partner"}`,
    section,
    issueType,
    issueLabel: DATA_QUALITY_ISSUE_LABEL[issueType],
    partnerId: partner.id,
    partnerName: partner.company_name,
    grade: partner.grade,
    gradeLabel: gradeLabel(partner.grade),
    contractDate: partner.contract_start_date,
    documentType: options.documentType ?? null,
    needsReview: options.needsReview ?? false,
    detail,
    entityId: options.entityId ?? partner.id,
    links: {
      ...links,
      documentManage: options.documentManage ?? links.documentManage
    }
  };
}

function isAssetDetailEmpty(asset: AssetRow): boolean {
  const fields = [
    asset.node_name,
    asset.spec_summary,
    asset.cpu,
    asset.memory,
    asset.os_disk,
    asset.ceph_disk,
    asset.model_name,
    asset.vendor
  ];
  return fields.every((value) => !value?.trim());
}

export function computeDataQualityBundle(input: {
  partners: Partner[];
  contacts: PartnerContact[];
  documents: DocumentRow[];
  assets: AssetRow[];
  attendances: AttendanceRow[];
  errors: string[];
  fetchedAt: string;
}): DataQualityBundle {
  const { partners, contacts, documents, assets, attendances, errors, fetchedAt } = input;
  const rows: DataQualityRow[] = [];

  const partnerMap = new Map(partners.map((partner) => [partner.id, partner]));
  const contactsByPartner = new Map<string, PartnerContact[]>();
  for (const contact of contacts) {
    const list = contactsByPartner.get(contact.partner_id) ?? [];
    list.push(contact);
    contactsByPartner.set(contact.partner_id, list);
  }

  const docsByPartner = new Map<string, Set<string>>();
  for (const doc of documents) {
    if (!doc.document_type) continue;
    const set = docsByPartner.get(doc.partner_id) ?? new Set<string>();
    set.add(doc.document_type);
    docsByPartner.set(doc.partner_id, set);
  }

  const assetPartnerIds = new Set(assets.map((asset) => asset.partner_id));
  const attendancePartnerIds = new Set(attendances.map((row) => row.partner_id));

  let withContract = 0;
  let withApplication = 0;
  let withoutContacts = 0;

  const missingDocChecks: Array<{
    type: DataQualityIssueType;
    docType: string;
  }> = [
    { type: "missing_partner_contract", docType: "partner_contract" },
    { type: "missing_partner_application", docType: "partner_application" },
    { type: "missing_business_registration", docType: "business_registration" },
    { type: "missing_bank_account", docType: "bank_account" }
  ];

  for (const partner of partners) {
    const partnerDocs = docsByPartner.get(partner.id) ?? new Set<string>();
    if (partnerDocs.has("partner_contract")) withContract += 1;
    if (partnerDocs.has("partner_application")) withApplication += 1;

    const partnerContacts = contactsByPartner.get(partner.id) ?? [];
    if (partnerContacts.length === 0) {
      withoutContacts += 1;
      rows.push(
        buildPartnerRow("contacts", "no_contacts", partner, "등록된 담당자가 없습니다.")
      );
    }

    for (const check of missingDocChecks) {
      if (!partnerDocs.has(check.docType)) {
        rows.push(
          buildPartnerRow(
            "documents",
            check.type,
            partner,
            `${getDocumentTypeShortLabel(check.docType)} 문서가 등록되지 않았습니다.`,
            { documentType: check.docType }
          )
        );
      }
    }

    if (partner.grade === "platinum" && !assetPartnerIds.has(partner.id)) {
      rows.push(
        buildPartnerRow(
          "assets",
          "platinum_no_assets",
          partner,
          "Platinum 등급이지만 장비/리소스 정보가 없습니다."
        )
      );
    }

    if (!attendancePartnerIds.has(partner.id)) {
      rows.push(
        buildPartnerRow(
          "training",
          "no_training_history",
          partner,
          "교육 참석 이력이 없습니다."
        )
      );
    }

    if (partnerContacts.length > 0 && !attendancePartnerIds.has(partner.id)) {
      rows.push(
        buildPartnerRow(
          "training",
          "contacts_but_no_training",
          partner,
          `담당자 ${partnerContacts.length}명이 있으나 교육 이력이 없습니다.`
        )
      );
    }
  }

  for (const doc of documents) {
    const partner = partnerMap.get(doc.partner_id);
    if (!partner) continue;

    const fileLabel = doc.display_name ?? doc.original_filename ?? doc.file_name;
    const mismatch = hasPartnerNameMismatch({
      partner_name: doc.partner_name,
      extracted_partner_name: doc.extracted_partner_name,
      match_status: doc.match_status
    });

    if (doc.match_status === "needs_review" || doc.review_status === "needs_review") {
      rows.push(
        buildPartnerRow("documents", "document_needs_review", partner, fileLabel, {
          documentType: doc.document_type,
          needsReview: true,
          entityId: doc.id,
          documentManage: "/dashboard/documents?status=needs_review"
        })
      );
    }

    if (doc.match_status === "unmatched") {
      rows.push(
        buildPartnerRow("documents", "document_unmatched", partner, fileLabel, {
          documentType: doc.document_type,
          entityId: doc.id,
          documentManage: "/dashboard/documents?status=unmatched"
        })
      );
    }

    if (mismatch && doc.match_status !== "needs_review") {
      rows.push(
        buildPartnerRow("documents", "document_name_mismatch", partner, fileLabel, {
          documentType: doc.document_type,
          needsReview: true,
          entityId: doc.id,
          documentManage: "/dashboard/documents?status=needs_review"
        })
      );
    }

    if (mismatch && doc.extracted_partner_name) {
      const existing = rows.find(
        (row) => row.issueType === "document_name_mismatch" && row.entityId === doc.id
      );
      if (existing) {
        existing.detail = `${fileLabel} · 추출명: ${doc.extracted_partner_name}`;
      }
    }
  }

  for (const contact of contacts) {
    const partner = partnerMap.get(contact.partner_id);
    if (!partner || isSamplePartner(partner)) continue;

    if (!contact.email?.trim()) {
      rows.push(
        buildPartnerRow("contacts", "contact_missing_email", partner, `${contact.name} · 이메일 없음`, {
          entityId: contact.id
        })
      );
    }
    if (!contact.phone?.trim()) {
      rows.push(
        buildPartnerRow("contacts", "contact_missing_phone", partner, `${contact.name} · 연락처 없음`, {
          entityId: contact.id
        })
      );
    }
    if (!contact.position?.trim()) {
      rows.push(
        buildPartnerRow(
          "contacts",
          "contact_missing_position",
          partner,
          `${contact.name} · 직급 없음`,
          { entityId: contact.id }
        )
      );
    }
  }

  const emailGroups = new Map<string, PartnerContact[]>();
  for (const contact of contacts) {
    const email = contact.email?.trim().toLowerCase();
    if (!email) continue;
    const list = emailGroups.get(email) ?? [];
    list.push(contact);
    emailGroups.set(email, list);
  }

  for (const [email, group] of emailGroups) {
    if (group.length < 2) continue;
    for (const contact of group) {
      const partner = partnerMap.get(contact.partner_id);
      if (!partner) continue;
      rows.push(
        buildPartnerRow(
          "contacts",
          "contact_duplicate_email",
          partner,
          `${contact.name} · ${email} (${group.length}건 중복)`,
          { entityId: contact.id }
        )
      );
    }
  }

  for (const partnerId of assetPartnerIds) {
    const partner = partnerMap.get(partnerId);
    if (!partner) continue;
    const partnerAssets = assets.filter((asset) => asset.partner_id === partnerId);
    rows.push(
      buildPartnerRow(
        "assets",
        "asset_holding_partner",
        partner,
        `장비/리소스 ${partnerAssets.length}건 등록`
      )
    );
  }

  for (const asset of assets) {
    const partner = partnerMap.get(asset.partner_id);
    if (!partner || !isAssetDetailEmpty(asset)) continue;
    rows.push(
      buildPartnerRow(
        "assets",
        "asset_empty_detail",
        partner,
        `${asset.node_name ?? asset.asset_name ?? "장비"} · 상세 스펙/내용 없음`,
        { entityId: asset.id }
      )
    );
  }

  const attendanceGroups = new Map<string, AttendanceRow[]>();
  for (const row of attendances) {
    const key = [
      row.partner_id,
      row.training_id,
      (row.attendee_name ?? "").trim().toLowerCase(),
      (row.attendee_email ?? "").trim().toLowerCase()
    ].join("::");
    const list = attendanceGroups.get(key) ?? [];
    list.push(row);
    attendanceGroups.set(key, list);
  }

  for (const row of attendances) {
    const partner = partnerMap.get(row.partner_id);
    if (!partner) continue;

    if (!row.attendee_email?.trim() || !row.attendee_phone?.trim()) {
      const missing = [
        !row.attendee_email?.trim() ? "이메일" : null,
        !row.attendee_phone?.trim() ? "연락처" : null
      ]
        .filter(Boolean)
        .join(", ");
      rows.push(
        buildPartnerRow(
          "training",
          "attendance_missing_contact",
          partner,
          `${row.attendee_name ?? "참석자"} · ${missing} 누락 · ${row.training_name ?? "교육"}`,
          { entityId: row.id }
        )
      );
    }
  }

  for (const group of attendanceGroups.values()) {
    if (group.length < 2) continue;
    for (const row of group) {
      const partner = partnerMap.get(row.partner_id);
      if (!partner) continue;
      rows.push(
        buildPartnerRow(
          "training",
          "attendance_possible_duplicate",
          partner,
          `${row.attendee_name ?? "참석자"} · ${row.training_name ?? "교육"} (${group.length}건 중복 가능)`,
          { entityId: row.id }
        )
      );
    }
  }

  const needsReviewDocuments = documents.filter(
    (doc) => doc.match_status === "needs_review" || doc.review_status === "needs_review"
  ).length;
  const unmatchedDocuments = documents.filter((doc) => doc.match_status === "unmatched").length;

  return {
    summary: {
      totalPartners: partners.length,
      withContract,
      withoutContract: partners.length - withContract,
      withApplication,
      withoutApplication: partners.length - withApplication,
      withoutContacts,
      withAssets: assetPartnerIds.size,
      needsReviewDocuments,
      unmatchedDocuments
    },
    rows,
    errors,
    fetchedAt
  };
}

export function filterDataQualityRows(
  rows: DataQualityRow[],
  filters: {
    section?: DataQualitySection | "all";
    issueType?: string;
    grade?: string;
    documentType?: string;
    needsReview?: string;
    q?: string;
  }
): DataQualityRow[] {
  const q = filters.q?.trim().toLowerCase() ?? "";

  return rows.filter((row) => {
    if (filters.section && filters.section !== "all" && row.section !== filters.section) {
      return false;
    }
    if (filters.issueType && filters.issueType !== "all" && row.issueType !== filters.issueType) {
      return false;
    }
    if (filters.grade && filters.grade !== "all" && (row.grade ?? "none") !== filters.grade) {
      return false;
    }
    if (
      filters.documentType &&
      filters.documentType !== "all" &&
      row.documentType !== filters.documentType
    ) {
      return false;
    }
    if (filters.needsReview === "yes" && !row.needsReview) return false;
    if (filters.needsReview === "no" && row.needsReview) return false;
    if (!q) return true;

    const haystack = [row.partnerName, row.detail, row.issueLabel, row.gradeLabel]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function rowsToCsv(rows: DataQualityRow[]) {
  return rows.map((row) => ({
    섹션: DATA_QUALITY_SECTION_LABEL[row.section],
    문제유형: row.issueLabel,
    파트너사: row.partnerName,
    등급: row.gradeLabel,
    계약일자: row.contractDate ?? "",
    문서구분: row.documentType ? getDocumentTypeShortLabel(row.documentType) : "",
    확인필요: row.needsReview ? "Y" : "N",
    상세내용: row.detail
  }));
}
