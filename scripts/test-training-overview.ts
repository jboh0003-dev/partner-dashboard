import assert from "node:assert/strict";
import type { Training } from "../src/types/training";
import type { EducationStatusAttendeeRow } from "../src/lib/trainings/education-status-export";
import {
  buildEducationOverview,
  dedupeTrainingAttendanceRows,
  filterOfficialTrainingAttendees
} from "../src/lib/trainings/overview-stats";

function person(fields: Partial<EducationStatusAttendeeRow>): EducationStatusAttendeeRow {
  return {
    id: "sample", training_id: "t2025a", partner_id: "p1",
    partner_name: "파트너사", is_non_partner: false, attendee_name: "홍 길동",
    training_year: 2025, training_month: 8, training_start_date: "2025-08-01",
    training_end_date: null, training_name: "CONTRABASS", training_type: "정기교육",
    training_level: null, product: null, attendee_position: null,
    attendee_department: null, attendee_phone: null, attendee_email: null,
    attended: true, attendance_status: "참석", completion_status: null,
    score: null, evaluation_result: null, note: null,
    ...fields
  };
}

const trainings = [
  { id: "t2025a", training_year: 2025, training_month: 8, start_date: "2025-08-01", training_name: "CONTRABASS", training_type: "정기교육", product: null },
  { id: "t2025b", training_year: 2025, training_month: 8, start_date: "2025-08-01", training_name: "[CONTRABASS Basic]", training_type: "정기교육", product: null },
  { id: "t2026a", training_year: 2026, training_month: 4, start_date: "2026-04-21", training_name: "2026년 4월 정기교육 (CONTRABASS+VIOLA)", training_type: "정기교육", product: null },
  { id: "t2026b", training_year: 2026, training_month: 4, start_date: "2026-04-22", training_name: "2026년 4월 정기교육 (CONTRABASS+VIOLA)", training_type: "정기교육", product: null }
] as Training[];

const people = [
  person({ id: "a" }),
  person({ id: "b", training_id: "t2025b", training_name: "[CONTRABASS Basic]" }),
  person({ id: "c", training_id: "t2026a", training_year: 2026, training_month: 4, training_start_date: "2026-04-21", training_name: trainings[2].training_name }),
  person({ id: "d", training_id: "t2026b", training_year: 2026, training_month: 4, training_start_date: "2026-04-22", training_name: trainings[3].training_name }),
  person({ id: "e", partner_id: null, is_non_partner: true }),
  person({ id: "f", attended: false, attendance_status: "불참" })
];
const official = filterOfficialTrainingAttendees(
  people, new Set(["p1"]), new Set(trainings.map((training) => training.id))
);
assert.equal(official.length, 4, "비파트너와 불참은 집계에서 제외");
const cleaned = dedupeTrainingAttendanceRows(official);
assert.equal(cleaned.length, 3, "동일 교육 중복 자료만 하나로 병합");
const overview = buildEducationOverview(trainings, cleaned);
const august = overview.monthly.find((row) => row.year === 2025 && row.month === 8);
const april = overview.monthly.find((row) => row.year === 2026 && row.month === 4);
assert.equal(august?.attendanceCount, 1);
assert.equal(april?.attendanceCount, 1, "4월의 여러 날짜는 월간 참여자 중복을 만들지 않음");
assert.equal(overview.yearly.find((row) => row.year === 2026)?.uniqueAttendees, 1);
assert.equal(overview.yearly.find((row) => row.year === 2026)?.participationCount, 1);
console.log("training overview stats tests passed");
