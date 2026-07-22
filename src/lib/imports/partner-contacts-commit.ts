import type { SupabaseClient } from "@supabase/supabase-js";
import { mergeContactsIntoMaster } from "@/lib/contacts/contact-merge";
import { buildPersonKey, normalizePersonName } from "@/lib/contacts/person-key";
import {
  activateBaselineContacts,
  chunkArray,
  countActiveBaselineContacts,
  excludeContactsNotInBaseline
} from "@/lib/imports/contact-baseline";
import {
  analyzePartnerContactRows,
  isEducationOrEventOnlyContact,
  type PartnerContactsAnalysisItem,
  type PartnerContactsDbRow,
  type PartnerContactsPartnerRow
} from "@/lib/imports/partner-contacts";
import {
  applySanitizedEmailPhoneToPayload,
  buildContactDataPayload,
  buildRoleLabelsFromImportRow,
  emptyImportStats,
  type ImportStatsAccumulator
} from "@/lib/imports/partner-contacts-sync";
import {
  completeImportJob,
  isImportJobCancelled,
  updateImportJobProgress
} from "@/lib/imports/import-jobs";

/** baseline 전환 전 최소 반영 비율 (actionable 대비) */
const MIN_BASELINE_COVERAGE = 0.9;

export type CommitContactRow = {
  row_number: number;
  excluded: boolean;
  excluded_reason: string | null;
  partner_no: string | null;
  company_name: string;
  normalized_company_name: string | null;
  contract_date: string | null;
  grade: string | null;
  region_group: string | null;
  contact_name: string;
  role_raw: string | null;
  role_type: "sales" | "engineer" | "admin" | "executive" | "contract" | "etc";
  department: string | null;
  position: string | null;
  phone: string | null;
  email: string | null;
  is_contract_contact: boolean;
  source_file: string;
  warnings: string[];
};

export type CommitRowResult = {
  company_name: string;
  contact_name: string;
  status:
    | "created"
    | "updated"
    | "merged"
    | "skipped"
    | "review"
    | "baseline_excluded"
    | "cancelled";
  partner_id: string | null;
  message: string | null;
};

export type CommitContactsResult = {
  stats: ImportStatsAccumulator;
  skippedCount: number;
  reviewCount: number;
  results: CommitRowResult[];
  analysis: ReturnType<typeof analyzePartnerContactRows>;
  cancelled: boolean;
  sourceRowCount: number;
  dedupedPersonCount: number;
  actionableCount: number;
  syncedCount: number;
};

type StagingRow = {
  import_job_id: string;
  row_number: number;
  partner_id: string | null;
  existing_contact_id: string | null;
  action: string;
  validation_status: string;
  person_key: string | null;
  payload: Record<string, unknown>;
  email: string | null;
  phone: string | null;
  role_labels: string[];
};

/**
 * 파일 내부 동일 partner+이름 중복을 먼저 병합한다.
 * 이후 create 시 메모리 map으로 재생성 방지.
 */
export function dedupeFileRowsByPerson(
  items: PartnerContactsAnalysisItem[],
  rowsByNumber: Map<number, CommitContactRow>
): {
  primaryItems: PartnerContactsAnalysisItem[];
  skippedDuplicates: PartnerContactsAnalysisItem[];
} {
  const seen = new Map<string, PartnerContactsAnalysisItem>();
  const primaryItems: PartnerContactsAnalysisItem[] = [];
  const skippedDuplicates: PartnerContactsAnalysisItem[] = [];

  for (const item of items) {
    if (
      item.action === "skip" ||
      item.action === "review" ||
      item.action === "duplicate" ||
      !item.matched_partner_id
    ) {
      primaryItems.push(item);
      continue;
    }

    const key = buildPersonKey(item.matched_partner_id, item.contact_name);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, item);
      primaryItems.push(item);
      continue;
    }

    // 동일 인물 후속 행: 이메일/전화/역할만 보강 가능하도록 primary에 merge 힌트
    const primaryRow = rowsByNumber.get(existing.row_number);
    const dupRow = rowsByNumber.get(item.row_number);
    if (primaryRow && dupRow) {
      if (!primaryRow.email && dupRow.email) primaryRow.email = dupRow.email;
      if (!primaryRow.phone && dupRow.phone) primaryRow.phone = dupRow.phone;
      if (!primaryRow.department && dupRow.department) primaryRow.department = dupRow.department;
      if (!primaryRow.position && dupRow.position) primaryRow.position = dupRow.position;
      if (!primaryRow.role_raw && dupRow.role_raw) {
        primaryRow.role_raw = dupRow.role_raw;
        primaryRow.role_type = dupRow.role_type;
      }
      if (!primaryRow.is_contract_contact && dupRow.is_contract_contact) {
        primaryRow.is_contract_contact = true;
      }
    }

    skippedDuplicates.push(item);
  }

  return { primaryItems, skippedDuplicates };
}

export async function commitPartnerContactsFullDb(
  supabase: SupabaseClient,
  input: {
    importJobId: string;
    rows: CommitContactRow[];
    partners: PartnerContactsPartnerRow[];
    contacts: PartnerContactsDbRow[];
  }
): Promise<CommitContactsResult> {
  const stats = emptyImportStats();
  const baselinePersonKeys = new Set<string>();
  const syncedContactIds = new Set<string>();
  const reviewRequiredIds = new Set<string>();
  const createdPersonKeys = new Map<string, string>(); // personKey -> contactId
  const results: CommitRowResult[] = [];
  let skippedCount = 0;
  let reviewCount = 0;
  let cancelled = false;

  const rowsByNumber = new Map(input.rows.map((row) => [row.row_number, { ...row }]));

  // 저장 중에는 기존 baseline을 유지한다 (초기 reset 금지).
  const analysis = analyzePartnerContactRows(
    input.rows,
    input.partners,
    input.contacts
  );

  const { primaryItems, skippedDuplicates } = dedupeFileRowsByPerson(
    analysis.items,
    rowsByNumber
  );

  for (const dup of skippedDuplicates) {
    skippedCount += 1;
    results.push({
      company_name: dup.company_name,
      contact_name: dup.contact_name,
      status: "skipped",
      partner_id: dup.matched_partner_id,
      message: "파일 내 동일 담당자 중복 — 선행 행에 병합"
    });
  }

  // staging 기록 (실패 시 baseline 미전환, job 추적용)
  const stagingRows: StagingRow[] = [];
  for (const item of primaryItems) {
    const row = rowsByNumber.get(item.row_number);
    if (!row) continue;
    stagingRows.push({
      import_job_id: input.importJobId,
      row_number: item.row_number,
      partner_id: item.matched_partner_id,
      existing_contact_id: item.matched_contact_id,
      action: item.action,
      validation_status: item.action === "review" || item.action === "duplicate" ? "review" : "ok",
      person_key: item.matched_partner_id
        ? buildPersonKey(item.matched_partner_id, item.contact_name)
        : null,
      payload: { company_name: row.company_name, contact_name: row.contact_name },
      email: row.email,
      phone: row.phone,
      role_labels: buildRoleLabelsFromImportRow({
        contact_name: row.contact_name,
        role_raw: row.role_raw,
        role_type: row.role_type,
        department: row.department,
        position: row.position,
        phone: row.phone,
        email: row.email,
        is_contract_contact: row.is_contract_contact,
        source_file: row.source_file
      })
    });
  }

  for (const chunk of chunkArray(stagingRows, 100)) {
    const { error } = await supabase.from("contact_import_staging").upsert(chunk, {
      onConflict: "import_job_id,row_number"
    });
    // staging 테이블 미적용(migration 전)이어도 본 저장은 계속
    if (error && !isMissingRelationError(error.message)) {
      throw new Error(`staging 저장 실패: ${error.message}`);
    }
  }

  const contactIndex = buildContactIndex(input.contacts);
  let processed = 0;
  const actionableItems = primaryItems.filter(
    (item) => item.action === "create" || item.action === "update" || item.action === "merge"
  );
  const actionableCount = actionableItems.length;

  for (const item of primaryItems) {
    if (processed > 0 && processed % 40 === 0) {
      if (await isImportJobCancelled(supabase, input.importJobId)) {
        cancelled = true;
        break;
      }
      await updateImportJobProgress(supabase, input.importJobId, processed);
    }

    const row = rowsByNumber.get(item.row_number);
    if (!row) continue;
    processed += 1;

    if (item.action === "skip") {
      skippedCount += 1;
      results.push(rowResult(row, "skipped", null, item.reason));
      continue;
    }

    if (item.action === "review" || item.action === "duplicate") {
      reviewCount += 1;
      await enqueueReview(supabase, input.importJobId, row, item.reason);
      results.push(rowResult(row, "review", item.matched_partner_id, item.reason));
      continue;
    }

    if (!item.matched_partner_id) {
      throw new Error("담당자 저장 대상 partner_id가 없습니다.");
    }

    const personKey = buildPersonKey(item.matched_partner_id, item.contact_name);
    let contactId =
      item.matched_contact_id ??
      createdPersonKeys.get(personKey) ??
      contactIndex.get(personKey) ??
      null;

    const importRow = {
      contact_name: row.contact_name,
      role_raw: row.role_raw,
      role_type: row.role_type,
      department: row.department,
      position: row.position,
      phone: row.phone,
      email: row.email,
      is_contract_contact: row.is_contract_contact,
      source_file: row.source_file
    };

    if (!contactId) {
      const payload = buildContactDataPayload({
        row: importRow,
        matchConfidence: item.match_confidence,
        matchMethod: item.match_method
      });
      const fieldResult = applySanitizedEmailPhoneToPayload(payload, row.email, row.phone);
      if (fieldResult.corrected) stats.corrected_count += 1;

      const { data: created, error } = await supabase
        .from("partner_contacts")
        .insert({ ...payload, partner_id: item.matched_partner_id })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      contactId = created?.id as string;
      createdPersonKeys.set(personKey, contactId);
      contactIndex.set(personKey, contactId);
      if (fieldResult.needsReview) reviewRequiredIds.add(contactId);
      stats.created += 1;
      results.push(rowResult(row, "created", item.matched_partner_id, item.reason));
    } else {
      const existing = input.contacts.find((c) => c.id === contactId);
      const payload = buildContactDataPayload({
        row: importRow,
        existingContact: existing,
        matchConfidence: item.match_confidence,
        matchMethod: item.match_method
      });
      const fieldResult = applySanitizedEmailPhoneToPayload(payload, row.email, row.phone);
      if (fieldResult.corrected) stats.corrected_count += 1;

      const { error } = await supabase
        .from("partner_contacts")
        .update(payload)
        .eq("id", contactId);
      if (error) throw new Error(error.message);
      if (fieldResult.needsReview) reviewRequiredIds.add(contactId);

      if (item.review_duplicate) {
        const duplicateReviewReason = item.reason.includes("수동 확인")
          ? item.reason
          : "중복 후보 수동 확인 필요";
        const idsToReview = [contactId, ...item.manual_duplicate_ids];
        for (const reviewId of idsToReview) reviewRequiredIds.add(reviewId);
        await supabase
          .from("partner_contacts")
          .update({
            review_required: true,
            review_reason: duplicateReviewReason
          })
          .in("id", idsToReview);
      }

      if (item.action === "merge" && item.merge_contact_ids.length > 0) {
        const mergeResult = await mergeContactsIntoMaster(
          supabase,
          contactId,
          item.merge_contact_ids,
          row.source_file
        );
        stats.merged += mergeResult.merged_ids.length;
        for (const mergedId of mergeResult.merged_ids) {
          syncedContactIds.add(mergedId);
        }
        results.push(
          rowResult(
            row,
            "merged",
            item.matched_partner_id,
            `${item.reason} (${mergeResult.merged_ids.length}건 병합)`
          )
        );
      } else if (item.action === "create") {
        stats.updated += 1;
        results.push(
          rowResult(row, "updated", item.matched_partner_id, "기존 담당자 재사용 (중복 방지)")
        );
      } else {
        stats.updated += 1;
        results.push(rowResult(row, "updated", item.matched_partner_id, item.reason));
      }
    }

    if (contactId && item.matched_partner_id) {
      syncedContactIds.add(contactId);
      for (const dupId of item.manual_duplicate_ids) syncedContactIds.add(dupId);
      baselinePersonKeys.add(personKey);
      // email/phone 은 partner_contacts 컬럼에 이미 반영.
      // contact_emails/phones 행단위 sync 는 생략 (Vercel timeout → 부분 baseline 원인).
    }
  }

  await updateImportJobProgress(supabase, input.importJobId, processed);

  if (cancelled) {
    await completeImportJob(supabase, input.importJobId, {
      status: "cancelled",
      createdCount: stats.created,
      updatedCount: stats.updated + stats.merged,
      skippedCount,
      reviewCount,
      processedRows: processed,
      errorMessage: "작업이 취소되었습니다. 기존 baseline은 유지됩니다."
    });
    return {
      stats,
      skippedCount,
      reviewCount,
      results,
      analysis,
      cancelled: true,
      sourceRowCount: input.rows.length,
      dedupedPersonCount: primaryItems.length - skippedDuplicates.length,
      actionableCount,
      syncedCount: syncedContactIds.size
    };
  }

  if (syncedContactIds.size === 0) {
    throw new Error(
      "전체DB 저장 실패: 저장된 contact가 0건입니다. 파트너 매칭/분석 결과를 확인하세요."
    );
  }

  // 부분 반영 방지: actionable 대비 synced 비율이 낮으면 baseline 전환 금지
  const coverage = actionableCount > 0 ? syncedContactIds.size / actionableCount : 1;
  if (actionableCount >= 50 && coverage < MIN_BASELINE_COVERAGE) {
    throw new Error(
      `전체DB baseline 전환 중단: 저장 대상 ${actionableCount}명 중 ${syncedContactIds.size}명만 반영됨 (` +
        `${Math.round(coverage * 100)}%). 기존 current baseline을 유지합니다. 재시도하거나 강제 재실행하세요.`
    );
  }

  // 성공 시에만 baseline 전환
  await activateBaselineContacts(supabase, [...syncedContactIds], reviewRequiredIds);

  const excludedRows = await excludeContactsNotInBaseline(supabase, syncedContactIds);
  stats.baseline_excluded = excludedRows.length;

  const excludedIds = excludedRows.map((row) => row.id);
  const historyOnlyFromSource = excludedRows.filter((row) =>
    isEducationOrEventOnlyContact(row as PartnerContactsDbRow)
  ).length;

  let historyOnlyFromTraining = 0;
  if (excludedIds.length > 0) {
    for (const chunk of chunkArray(excludedIds, 200)) {
      const { data: trainingLinks } = await supabase
        .from("training_attendance")
        .select("contact_id")
        .in("contact_id", chunk)
        .not("contact_id", "is", null);
      historyOnlyFromTraining += new Set(
        (trainingLinks ?? []).map((row) => row.contact_id as string)
      ).size;
    }
  }

  stats.history_only_excluded = Math.max(historyOnlyFromSource, historyOnlyFromTraining);
  stats.current_baseline_count = baselinePersonKeys.size;
  stats.active_current_count = await countActiveBaselineContacts(supabase);

  if (stats.active_current_count === 0) {
    throw new Error(
      `baseline 전환 오류: 처리 contact ${syncedContactIds.size}건이지만 active/current contact가 0명입니다.`
    );
  }

  // 전환 후 검증: 화면 표시 수와 synced 수가 크게 다르면 실패
  if (
    actionableCount >= 50 &&
    stats.active_current_count < Math.floor(actionableCount * MIN_BASELINE_COVERAGE)
  ) {
    throw new Error(
      `baseline 검증 실패: synced ${syncedContactIds.size} / actionable ${actionableCount} 이지만 ` +
        `active_current=${stats.active_current_count}. completed 처리하지 않습니다.`
    );
  }

  for (const excluded of analysis.baselineExcluded) {
    results.push({
      company_name: excluded.partner_name,
      contact_name: excluded.contact_name,
      status: "baseline_excluded",
      partner_id: excluded.partner_id,
      message: excluded.reason
    });
  }

  return {
    stats,
    skippedCount,
    reviewCount,
    results,
    analysis,
    cancelled: false,
    sourceRowCount: input.rows.length,
    dedupedPersonCount: primaryItems.length - skippedDuplicates.length,
    actionableCount,
    syncedCount: syncedContactIds.size
  };
}

function buildContactIndex(contacts: PartnerContactsDbRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const contact of contacts) {
    if (!contact.partner_id || !contact.name) continue;
    const key = buildPersonKey(contact.partner_id, contact.name);
    if (!map.has(key)) map.set(key, contact.id);
    // name_normalized 기반도 보강
    const norm = normalizePersonName(contact.name);
    if (norm) {
      const alt = `${contact.partner_id}|${norm}`;
      if (!map.has(alt)) map.set(alt, contact.id);
    }
  }
  return map;
}

function rowResult(
  row: CommitContactRow,
  status: CommitRowResult["status"],
  partnerId: string | null,
  message: string
): CommitRowResult {
  return {
    company_name: row.company_name,
    contact_name: row.contact_name,
    status,
    partner_id: partnerId,
    message
  };
}

async function enqueueReview(
  supabase: SupabaseClient,
  importJobId: string,
  row: CommitContactRow,
  reason: string
) {
  const { error } = await supabase.from("import_review_queue").insert({
    import_job_id: importJobId,
    import_type: "contact_full_db_upload",
    row_number: row.row_number,
    company_name: row.company_name,
    reason,
    raw_data: row,
    status: "pending"
  });
  if (error) throw new Error(error.message);
}

function isMissingRelationError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("contact_import_staging") &&
    (lower.includes("does not exist") || lower.includes("schema cache"))
  );
}
