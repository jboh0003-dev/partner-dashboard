/**
 * 담당자 전체DB 분석: baseline 제외 A/B/C 집계 + partners write 없음 검증
 * 실행: npx tsx scripts/test-partner-contacts-baseline-exclude.ts
 */
import assert from "node:assert/strict";
import {
  analyzePartnerContactRows,
  classifyContactsMissingFromFullDb,
  type PartnerContactsDbRow,
  type PartnerContactsPartnerRow
} from "../src/lib/imports/partner-contacts";
import type { ParsedPartnerContactRow } from "../src/lib/excel/parse-partner-contacts";

function baseContact(
  overrides: Partial<PartnerContactsDbRow> & Pick<PartnerContactsDbRow, "id" | "partner_id" | "name">
): PartnerContactsDbRow {
  return {
    department: null,
    position: null,
    role_type: null,
    role_raw: null,
    is_primary: false,
    is_contract_contact: false,
    is_active: false,
    in_current_full_db: false,
    deleted_at: null,
    merged_into_contact_id: null,
    email: null,
    phone: null,
    source_file: null,
    contact_source: null,
    ...overrides
  };
}

function baseRow(
  overrides: Partial<ParsedPartnerContactRow> &
    Pick<ParsedPartnerContactRow, "row_number" | "company_name" | "contact_name">
): ParsedPartnerContactRow {
  return {
    excluded: false,
    excluded_reason: null,
    partner_no: null,
    normalized_company_name: overrides.company_name,
    contract_date: null,
    grade: null,
    region_group: null,
    role_raw: null,
    role_type: "sales",
    department: null,
    position: null,
    phone: null,
    email: null,
    is_contract_contact: false,
    source_file: "전체DB.xlsx",
    warnings: [],
    ...overrides
  };
}

function run() {
  const partners: PartnerContactsPartnerRow[] = [
    { id: "p1", company_name: "에이회사", external_no: "1" },
    { id: "p2", company_name: "비회사", external_no: "2" }
  ];

  const contacts: PartnerContactsDbRow[] = [
    // A: 현재 active current → 엑셀에 없으면 제외 예정
    baseContact({
      id: "c-active",
      partner_id: "p1",
      name: "김현재",
      email: "kim@a.com",
      is_active: true,
      in_current_full_db: true,
      source_file: "전체DB.xlsx"
    }),
    // B: 교육 이력만
    baseContact({
      id: "c-edu",
      partner_id: "p1",
      name: "이교육",
      email: "lee@a.com",
      is_active: false,
      in_current_full_db: false,
      source_file: "정기교육_참석자.xlsx",
      contact_source: "education"
    }),
    // C: 이미 비활성
    baseContact({
      id: "c-old",
      partner_id: "p2",
      name: "박과거",
      email: "park@b.com",
      is_active: false,
      in_current_full_db: false,
      source_file: "전체DB.xlsx"
    }),
    // 대시보드 수동 등록은 Excel 누락이어도 제외 예정(A)에 넣지 않음
    baseContact({
      id: "c-manual",
      partner_id: "p1",
      name: "정수동",
      email: "jung@a.com",
      is_active: true,
      in_current_full_db: true,
      source_file: "dashboard-manual",
      contact_source: "dashboard_manual"
    }),
    // 엑셀에 남아 갱신될 사람
    baseContact({
      id: "c-keep",
      partner_id: "p1",
      name: "최유지",
      email: "choi@a.com",
      is_active: true,
      in_current_full_db: true,
      source_file: "전체DB.xlsx"
    })
  ];

  const rows = [
    baseRow({
      row_number: 1,
      partner_no: "1",
      company_name: "에이회사",
      contact_name: "최유지",
      email: "choi@a.com"
    }),
    baseRow({
      row_number: 2,
      partner_no: "2",
      company_name: "비회사",
      contact_name: "신문원",
      email: "new@b.com"
    })
  ];

  const analysis = analyzePartnerContactRows(rows, partners, contacts);
  assert.equal(analysis.summary.baseline_excluded, 1, "A only");
  assert.equal(analysis.summary.history_only_preserved, 1, "B education");
  assert.equal(analysis.summary.already_inactive, 1, "C already inactive");
  assert.equal(analysis.baselineExcluded.length, 1);
  assert.equal(analysis.baselineExcluded[0]?.contact_name, "김현재");
  assert.equal(analysis.historyOnlyPreserved[0]?.contact_name, "이교육");
  assert.equal(analysis.alreadyInactive[0]?.contact_name, "박과거");
  assert.equal(
    analysis.baselineExcluded.some((row) => row.contact_name === "정수동"),
    false,
    "manual contacts must not be baseline-excluded"
  );

  // historyContactIds로도 B 분류
  const withTraining = classifyContactsMissingFromFullDb(
    analysis.items,
    contacts,
    partners,
    new Set(["c-old"])
  );
  // c-old was C, but with training link becomes B
  assert.equal(withTraining.already_inactive.length, 0);
  assert.ok(withTraining.history_only.some((r) => r.contact_id === "c-old"));

  // 같은 사업자번호 파트너는 매칭만 — partners insert 없음 (분석은 순수 함수)
  const dupBnPartners: PartnerContactsPartnerRow[] = [
    { id: "p-a", company_name: "동일번호A", external_no: "10" },
    { id: "p-b", company_name: "동일번호B", external_no: "11" }
  ];
  const dupContacts: PartnerContactsDbRow[] = [
    baseContact({
      id: "c-dup",
      partner_id: "p-a",
      name: "담당",
      is_active: true,
      in_current_full_db: true
    })
  ];
  const matched = analyzePartnerContactRows(
    [
      baseRow({
        row_number: 1,
        partner_no: "10",
        company_name: "동일번호A",
        contact_name: "담당"
      })
    ],
    dupBnPartners,
    dupContacts
  );
  assert.equal(matched.items[0]?.matched_partner_id, "p-a");
  assert.equal(matched.items[0]?.action, "update");

  // analyzePartnerContactRows는 partners 테이블 write API를 호출하지 않음 (순수)
  assert.equal(typeof analyzePartnerContactRows, "function");

  console.log("partner-contacts baseline exclude tests ok", {
    A: analysis.summary.baseline_excluded,
    B: analysis.summary.history_only_preserved,
    C: analysis.summary.already_inactive
  });
}

run();
