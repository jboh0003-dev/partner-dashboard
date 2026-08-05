import type { SupabaseClient } from "@supabase/supabase-js";
import { PARTNER_DOCUMENTS_BUCKET } from "@/lib/documents/constants";
import { pickDocumentStoragePathForDelete } from "@/lib/documents/document-lifecycle";
import { normalizeContractCompanyName } from "@/lib/partner-application/contract-dates";
import { parsePartnerApplicationBuffer } from "@/lib/partner-application/parse-application";

export type FormalCompanyNameSource =
  | "partner_contract"
  | "contract_display_name"
  | "partner_application_contract"
  | "business_registration"
  | "partner_application"
  | "company_name";

export type FormalCompanyNameResult = {
  name: string;
  source: FormalCompanyNameSource;
  /** 화면 표시용 DB 회사명 */
  display_name: string;
};

type PartnerNameRow = {
  company_name?: string | null;
  contract_display_name?: string | null;
};

export type DocumentNameRow = {
  document_type: string | null;
  extracted_partner_name: string | null;
  partner_name_raw: string | null;
  original_filename?: string | null;
  source_file?: string | null;
  display_name?: string | null;
  created_at?: string | null;
};

/** 기존 계약서에서 읽은 법인 표기 방식 (회사명 철자는 DB 기준) */
export type CorporateFormStyle =
  | "prefix_jusik" // 주식회사 X
  | "prefix_ju" // (주)X
  | "prefix_circled" // ㈜X
  | "suffix_ju" // X(주)
  | "none";

const GRADE_SUFFIX_RE = /\((?:플래티넘|골드|실버|Silver|Gold|Platinum)[^)]*\)$/i;

function cleanName(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/^\[[^\]]+\]\s*/g, "")
    .replace(/^\d{6}[_-]?\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** 법인 표기 제거 후 회사명 본체만 */
export function stripCorporateFormMarkers(name: string): string {
  let text = cleanName(name);
  text = text.replace(/^주식회사\s*/u, "");
  text = text.replace(/^\(주\)\s*/u, "");
  text = text.replace(/^㈜\s*/u, "");
  text = text.replace(/\s*\(주\)\s*$/u, "");
  text = text.replace(/\s*주식회사\s*$/u, "");
  return text.trim();
}

export function detectCorporateFormStyle(name: string | null | undefined): CorporateFormStyle {
  const text = cleanName(name);
  if (!text) return "none";
  if (/^주식회사/u.test(text)) return "prefix_jusik";
  if (/^\(주\)/u.test(text)) return "prefix_ju";
  if (/^㈜/u.test(text)) return "prefix_circled";
  if (/\(주\)\s*$/u.test(text)) return "suffix_ju";
  return "none";
}

export function applyCorporateFormStyle(
  dbCompanyName: string,
  style: CorporateFormStyle
): string {
  const core = stripCorporateFormMarkers(dbCompanyName);
  if (!core) return "";
  switch (style) {
    case "prefix_jusik":
      return normalizeContractCompanyName(`주식회사 ${core}`);
    case "prefix_ju":
      return normalizeContractCompanyName(`(주)${core}`);
    case "prefix_circled":
      return normalizeContractCompanyName(`㈜${core}`);
    case "suffix_ju":
      return normalizeContractCompanyName(`${core}(주)`);
    case "none":
    default:
      return normalizeContractCompanyName(core);
  }
}

/**
 * DB 회사명 철자 + 계약서/메타의 법인 표기 방식만 결합.
 * 계약서에 적힌 다른 철자(예: 엔티에스)는 사용하지 않는다.
 */
export function combineFormalCompanyName(
  dbCompanyName: string,
  formHints: Array<string | null | undefined>
): { name: string; style: CorporateFormStyle; hintUsed: string | null } {
  const displayCore = stripCorporateFormMarkers(dbCompanyName);
  let style: CorporateFormStyle = "none";
  let hintUsed: string | null = null;

  for (const hint of formHints) {
    const cleaned = cleanName(hint);
    if (!cleaned) continue;
    const detected = detectCorporateFormStyle(cleaned);
    if (detected !== "none") {
      style = detected;
      hintUsed = cleaned;
      break;
    }
  }

  // DB 회사명 자체에 법인 표기가 있으면 그 방식 사용
  if (style === "none") {
    const fromDb = detectCorporateFormStyle(dbCompanyName);
    if (fromDb !== "none") {
      style = fromDb;
      hintUsed = cleanName(dbCompanyName);
    }
  }

  return {
    name: applyCorporateFormStyle(displayCore || cleanName(dbCompanyName), style),
    style,
    hintUsed
  };
}

export function hasCorporateFormMarker(name: string): boolean {
  return detectCorporateFormStyle(name) !== "none";
}

/**
 * 파트너 계약서 원본 파일명에서 상호 후보 추출 (법인 표기 방식 확인용).
 * 철자 자체는 최종값으로 쓰지 않는다.
 */
export function extractFormalCompanyNameFromContractFilename(
  originalFilename: string | null | undefined
): string | null {
  const rawName = String(originalFilename ?? "").trim();
  if (!rawName) return null;

  const withoutExt = rawName.replace(/\.[^.]+$/u, "");

  let companyPart: string | null = null;
  const contractTail = withoutExt.match(/파트너\s*계약서[_\s-]*(.+)$/iu);
  if (contractTail?.[1]) {
    companyPart = contractTail[1];
  } else {
    const genericTail = withoutExt.match(/계약서[_\s-]*(.+)$/iu);
    if (genericTail?.[1]) companyPart = genericTail[1];
  }
  if (!companyPart) return null;

  let name = companyPart
    .replace(/[_\s-]?(?:20)?\d{6,8}$/u, "")
    .replace(GRADE_SUFFIX_RE, "")
    .replace(/^OKESTRO[_-]표준[_-]*/iu, "")
    .replace(/^표준[_-]*/u, "")
    .replace(/^[_-\s]+|[_-\s]+$/g, "")
    .trim();

  if (!name || name.length < 2) return null;
  return normalizeContractCompanyName(cleanName(name)) || null;
}

function collectContractFormHints(docs: DocumentNameRow[]): string[] {
  const hints: string[] = [];
  for (const doc of docs.filter((d) => d.document_type === "partner_contract")) {
    const fromFilename = extractFormalCompanyNameFromContractFilename(doc.original_filename);
    if (fromFilename) hints.push(fromFilename);
    const fromSource = extractFormalCompanyNameFromContractFilename(
      doc.source_file?.split(/[/\\]/).pop() ?? null
    );
    if (fromSource) hints.push(fromSource);
    for (const value of [doc.extracted_partner_name, doc.partner_name_raw]) {
      const cleaned = cleanName(value);
      if (cleaned) hints.push(cleaned);
    }
  }
  return hints;
}

function collectDocHints(docs: DocumentNameRow[]): string[] {
  return docs
    .flatMap((doc) => [cleanName(doc.extracted_partner_name), cleanName(doc.partner_name_raw)])
    .filter(Boolean);
}

/**
 * 플래티넘 부속합의서용 정식 상호.
 * - 회사명 본체 철자: partners.company_name (DB)
 * - 법인 표기 방식만 계약서/신청서 메타에서 확인
 */
export function resolveFormalCompanyNameFromSources(input: {
  partner: PartnerNameRow;
  documents?: DocumentNameRow[];
  applicationContractName?: string | null;
}): FormalCompanyNameResult {
  const displayName = cleanName(input.partner.company_name);
  const contractDisplayName = cleanName(input.partner.contract_display_name);
  const applicationContractName = cleanName(input.applicationContractName);
  const docs = input.documents ?? [];

  const contractHints = collectContractFormHints(docs);
  const bizHints = collectDocHints(
    docs.filter((doc) => doc.document_type === "business_registration")
  );
  const appDocHints = collectDocHints(
    docs.filter(
      (doc) =>
        doc.document_type === "partner_application" ||
        doc.document_type === "partner_application_group"
    )
  );

  // 법인 표기 힌트 우선순위: 계약서 → 계약서표기명 → 신청서 contract → 사업자등록증 → 신청서 파일명
  const orderedHints: Array<{ hint: string; source: FormalCompanyNameSource }> = [];
  for (const hint of contractHints) {
    orderedHints.push({ hint, source: "partner_contract" });
  }
  if (contractDisplayName) {
    orderedHints.push({ hint: contractDisplayName, source: "contract_display_name" });
  }
  if (applicationContractName) {
    orderedHints.push({
      hint: applicationContractName,
      source: "partner_application_contract"
    });
  }
  for (const hint of bizHints) {
    orderedHints.push({ hint, source: "business_registration" });
  }
  for (const hint of appDocHints) {
    orderedHints.push({ hint, source: "partner_application" });
  }

  const styleHints = orderedHints.map((item) => item.hint);
  const combined = combineFormalCompanyName(displayName, styleHints);

  let source: FormalCompanyNameSource = "company_name";
  if (combined.style !== "none" && combined.hintUsed) {
    const matched = orderedHints.find(
      (item) => detectCorporateFormStyle(item.hint) === combined.style
    );
    source = matched?.source ?? "partner_contract";
  }

  return {
    name: combined.name || displayName,
    source,
    display_name: displayName
  };
}

export async function loadApplicationContractCompanyName(
  supabase: SupabaseClient,
  partnerId: string
): Promise<string | null> {
  const { data: doc, error } = await supabase
    .from("partner_documents")
    .select("id, storage_path, file_path, file_ext, original_filename")
    .eq("partner_id", partnerId)
    .eq("document_type", "partner_application")
    .is("deleted_at", null)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!doc) return null;

  const ext = String(doc.file_ext ?? doc.original_filename?.split(".").pop() ?? "")
    .toLowerCase()
    .replace(/^\./, "");
  if (ext && !["xlsx", "xls"].includes(ext)) return null;

  const storagePath = pickDocumentStoragePathForDelete(doc);
  if (!storagePath) return null;

  const { data: blob, error: downloadError } = await supabase.storage
    .from(PARTNER_DOCUMENTS_BUCKET)
    .download(storagePath);
  if (downloadError || !blob) return null;

  const buffer = Buffer.from(await blob.arrayBuffer());
  const parsed = parsePartnerApplicationBuffer(buffer);
  const contractName = cleanName(parsed.company.company_name_contract);
  return contractName || null;
}

export async function resolveFormalCompanyNameForPartner(
  supabase: SupabaseClient,
  partnerId: string,
  partner?: PartnerNameRow | null
): Promise<FormalCompanyNameResult | null> {
  let partnerRow = partner ?? null;

  if (!partnerRow) {
    const { data, error } = await supabase
      .from("partners")
      .select("id, company_name, contract_display_name")
      .eq("id", partnerId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    partnerRow = data;
  }

  const { data: documents, error: docsError } = await supabase
    .from("partner_documents")
    .select(
      "document_type, extracted_partner_name, partner_name_raw, original_filename, source_file, display_name, created_at"
    )
    .eq("partner_id", partnerId)
    .is("deleted_at", null)
    .eq("is_active", true)
    .in("document_type", [
      "business_registration",
      "partner_contract",
      "partner_application"
    ])
    .order("created_at", { ascending: false })
    .limit(30);

  if (docsError) throw new Error(docsError.message);

  const docs = (documents ?? []) as DocumentNameRow[];
  const preview = resolveFormalCompanyNameFromSources({
    partner: partnerRow,
    documents: docs
  });

  let applicationContractName: string | null = null;
  if (preview.source === "company_name" || !hasCorporateFormMarker(preview.name)) {
    if (!cleanName(partnerRow.contract_display_name)) {
      try {
        applicationContractName = await loadApplicationContractCompanyName(supabase, partnerId);
      } catch {
        applicationContractName = null;
      }
    }
  }

  return resolveFormalCompanyNameFromSources({
    partner: partnerRow,
    documents: docs,
    applicationContractName
  });
}

export const FORMAL_COMPANY_NAME_SOURCE_LABEL: Record<FormalCompanyNameSource, string> = {
  partner_contract: "파트너 계약서",
  contract_display_name: "파트너 계약서",
  partner_application_contract: "파트너 신청서",
  business_registration: "사업자등록증",
  partner_application: "파트너 신청서",
  company_name: "파트너 표시명"
};
