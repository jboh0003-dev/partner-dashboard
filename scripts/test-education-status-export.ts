import assert from "assert";
import {
  educationStatusExcelAoA,
  educationStatusFilename,
  filterEducationStatusAttendees,
  formatEducationDate,
  formatTitleDepartment,
  toEducationStatusExcelRows,
  type EducationStatusAttendeeRow
} from "../src/lib/trainings/education-status-export";

function row(partial: Partial<EducationStatusAttendeeRow>): EducationStatusAttendeeRow {
  return {
    id: "1",
    training_id: "t1",
    partner_id: "p1",
    partner_name: "오케스트로",
    is_non_partner: false,
    attendee_name: "홍길동",
    training_year: 2026,
    training_month: 6,
    training_start_date: "2026-06-10",
    training_end_date: "2026-06-11",
    training_name: "정기교육 6월",
    training_type: "정기교육",
    training_level: null,
    product: null,
    attendee_position: "과장",
    attendee_department: "영업",
    attendee_phone: "010-0000-0000",
    attendee_email: "a@test.com",
    attended: true,
    attendance_status: "참석",
    completion_status: "수료",
    score: null,
    evaluation_result: null,
    note: "메모",
    ...partial
  };
}

function run() {
  const all = [
    row({ id: "1" }),
    row({
      id: "2",
      training_id: "t2",
      training_year: 2026,
      training_month: 7,
      training_name: "정기교육 7월",
      attendee_name: "김철수"
    }),
    row({
      id: "3",
      training_id: "tech1",
      training_name: "기술파트너 교육",
      training_type: "기술파트너",
      training_month: 6
    })
  ];

  assert.strictEqual(filterEducationStatusAttendees(all, { month: "all" }).length, 3);
  assert.strictEqual(filterEducationStatusAttendees(all, { month: "2026-6" }).length, 1);
  assert.strictEqual(filterEducationStatusAttendees(all, { month: "2026-6-tech" }).length, 1);
  assert.strictEqual(filterEducationStatusAttendees(all, { q: "김철수" }).length, 1);
  assert.strictEqual(filterEducationStatusAttendees(all, { training: "t2" }).length, 1);

  assert.strictEqual(educationStatusFilename("all", new Date("2026-09-07T15:00:00+09:00")), "education_status_all_20260907.xlsx");
  assert.strictEqual(educationStatusFilename("2026-6"), "education_status_2026_06.xlsx");
  assert.strictEqual(educationStatusFilename("2026-6-tech"), "education_status_2026_06.xlsx");

  assert.strictEqual(formatEducationDate("2026-06-10", "2026-06-11"), "2026-06-10 ~ 2026-06-11");
  assert.strictEqual(formatTitleDepartment("과장", "영업"), "과장 / 영업");

  const excelRows = toEducationStatusExcelRows([row({})]);
  const aoa = educationStatusExcelAoA(excelRows);
  assert.deepStrictEqual(aoa[0], [
    "교육일자",
    "교육월",
    "교육과정",
    "파트너사",
    "참석자명",
    "직함/부서",
    "연락처",
    "이메일",
    "참석상태",
    "수료여부",
    "비고"
  ]);
  assert.strictEqual(excelRows[0].교육월, "2026년 6월");
  assert.strictEqual(excelRows[0].교육과정, "정기교육 6월");

  console.log("test-education-status-export: ok");
}

run();
