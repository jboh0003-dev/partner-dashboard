import assert from "node:assert/strict";
import {
  isCountedTrainingAttendee,
  monthlyAttendeeUniqueKey,
  trainingAttendeeUniqueKey
} from "../src/lib/trainings/attendance-stats";

function run() {
  assert.equal(isCountedTrainingAttendee({ attended: true }), true);
  assert.equal(isCountedTrainingAttendee({ attended: false }), false);
  assert.equal(isCountedTrainingAttendee({ attended: true, attendance_status: "불참" }), false);

  const dupA = { training_id: "t1", attendee_name: "홍 길동", partner_id: "p1", partner_name: "에이회사" };
  const dupB = { training_id: "t1", attendee_name: "홍길동", partner_id: "p1", partner_name: "에이회사" };
  assert.equal(trainingAttendeeUniqueKey(dupA), trainingAttendeeUniqueKey(dupB));

  const keys = new Set(
    [
      { attendee_name: "A", partner_id: "p1", partner_name: "회사1" },
      { attendee_name: "B", partner_id: "p1", partner_name: "회사1" },
      { attendee_name: "A", partner_id: "p1", partner_name: "회사1" },
      { attendee_name: "C", partner_id: "p2", partner_name: "회사2" }
    ].map((row) => monthlyAttendeeUniqueKey(2026, 7, false, row))
  );
  assert.equal(keys.size, 3);

  console.log("training monthly stats tests ok");
}

run();
