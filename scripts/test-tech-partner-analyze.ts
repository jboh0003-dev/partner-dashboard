/**
 * 기술파트너 교육 업로드 분석 로직 검증
 *
 * Usage: npx tsx scripts/test-tech-partner-analyze.ts
 */
import { analyzeTechPartnerTrainingUpload } from "../src/lib/imports/tech-partner-training";
import type { ParsedTechPartnerExamRow } from "../src/lib/excel/parse-tech-partner-exam";
import type { ParsedTechPartnerRosterRow } from "../src/lib/excel/parse-tech-partner-roster";
import { interpretAttendanceCell } from "../src/lib/excel/parse-tech-partner-roster";

const partners = [
  { id: "p-sockl", company_name: "소클" },
  { id: "p-nexias", company_name: "넥시아스" },
  { id: "p-beomil", company_name: "범일정보" },
  { id: "p-dianc", company_name: "디아이앤씨" },
  { id: "p-hongje", company_name: "홍제기술" }
];

function roster(
  company: string,
  name: string,
  opts: { attended?: boolean; days?: number } = {}
): ParsedTechPartnerRosterRow {
  const attended = opts.attended ?? true;
  const days = opts.days ?? (attended ? 15 : 0);
  return {
    row_number: 0,
    company_name: company,
    participant_name: name,
    title: "대리",
    group_name: "A",
    phone: null,
    email: null,
    daily_attendance: {},
    attendance_days: days,
    partial_days: attended ? 1 : 0,
    absent_days: attended ? 1 : 0,
    attendance_rate: attended ? 88.2 : 0,
    has_any_attendance_record: attended,
    no_show: !attended,
    source_file: "roster.xlsx"
  };
}

function exam(
  company: string,
  name: string,
  phone: string,
  total: number,
  rank: number
): ParsedTechPartnerExamRow {
  return {
    row_number: 0,
    rank,
    company_name: company,
    participant_name: name,
    phone,
    total_score: total,
    converted_score: total,
    solution_understanding_score: 18,
    technical_test_score: 15,
    advanced_basic_score: 5,
    operation_score: 5,
    troubleshooting_score: 5,
    raw_json: {},
    source_file: "exam.xlsx"
  };
}

const rosterRows: ParsedTechPartnerRosterRow[] = [
  ...["김A", "김B", "김C", "김D", "김E"].map((name) => roster("소클", name)),
  ...["이A", "박B"].map((name) => roster("넥시아스", name)),
  roster("범일정보", "서동훈"),
  roster("범일정보", "이지환"),
  roster("디아이앤씨", "오정훈", { attended: false }),
  roster("디아이앤씨", "김은총", { attended: false }),
  roster("홍제기술", "이성옥", { attended: false })
];

const examRows: ParsedTechPartnerExamRow[] = [
  ...["김A", "김B", "김C", "김D", "김E"].map((name, i) =>
    exam("소클", name, `0101111000${i}`, 80 + i, i + 1)
  ),
  exam("넥시아스", "이A", "01022220000", 85, 1),
  exam("넥시아스", "박B", "01022220001", 82, 2),
  exam("범일정보", "서동훈", "01033330001", 78, 3),
  exam("범일정보", "김동현", "01099990001", 70, 10)
];

const result = analyzeTechPartnerTrainingUpload({
  examRows,
  rosterRows,
  partners,
  contacts: []
});

function find(company: string, name: string) {
  return result.participants.find(
    (p) => p.company_name.includes(company) && p.participant_name === name
  );
}

const checks: Array<{ label: string; ok: boolean }> = [
  {
    label: "소클 응시 5명",
    ok: result.partner_summaries.find((s) => s.company_name === "소클")?.exam_taken_count === 5
  },
  {
    label: "소클 참석 5명",
    ok: result.partner_summaries.find((s) => s.company_name === "소클")?.attended_count === 5
  },
  {
    label: "범일정보 서동훈 응시+출석",
    ok: find("범일정보", "서동훈")?.exam_status === "응시" && (find("범일정보", "서동훈")?.attendance_days ?? 0) > 0
  },
  {
    label: "범일정보 김동현 result_only",
    ok:
      find("범일정보", "김동현")?.education_status === "result_only" &&
      find("범일정보", "김동현")?.exam_status === "응시"
  },
  {
    label: "범일정보 이지환 미응시",
    ok: find("범일정보", "이지환")?.exam_status === "미응시"
  },
  {
    label: "디아이앤씨 오정훈 미참석",
    ok: find("디아이앤씨", "오정훈")?.no_show === true
  },
  {
    label: "전체 응시 9명",
    ok: result.summary.exam_taken_count === 9
  },
  {
    label: "정상 매칭 8명",
    ok: result.summary.normal_match_count === 8
  },
  {
    label: "분석 유효",
    ok: result.summary.analysis_valid === true
  },
  {
    label: "출석인정 파싱",
    ok: interpretAttendanceCell("출석인정\n(지각)") === "present"
  }
];

let failed = 0;
for (const check of checks) {
  const status = check.ok ? "PASS" : "FAIL";
  if (!check.ok) failed += 1;
  console.log(`${status}  ${check.label}`);
}

console.log("\n요약:", result.summary);
if (failed > 0) process.exit(1);
console.log("\n모든 분석 로직 검증 통과");
