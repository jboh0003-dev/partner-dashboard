/**
 * 전체DB full sync: Excel 빈칸 email/phone → DB null 덮어쓰기 단위 테스트 (DB 미사용)
 */
import assert from "node:assert/strict";
import {
  applySanitizedEmailPhoneToPayload,
  buildContactDataPayload
} from "../src/lib/imports/partner-contacts-sync";

function basePayload() {
  return buildContactDataPayload({
    row: {
      contact_name: "손영무",
      role_raw: "영업",
      role_type: "sales",
      department: null,
      position: null,
      phone: null,
      email: null,
      is_contract_contact: false,
      source_file: "test-full-db.xlsx"
    }
  });
}

function run() {
  // 1) 기존 email → Excel 빈칸 → payload.email = null (full sync)
  {
    const payload = basePayload();
    payload.email = "symoo83@ishowtech.co.kr";
    payload.phone = "010-1234-5678";
    payload.phone_raw = "01012345678";
    payload.phone_normalized = "01012345678";
    payload.phone_display = "010-1234-5678";

    applySanitizedEmailPhoneToPayload(payload, "", "", { clearEmptyFields: true });

    assert.equal(payload.email, null, "empty excel email must clear to null");
    assert.equal(payload.phone, null, "empty excel phone must clear phone");
    assert.equal(payload.phone_raw, null);
    assert.equal(payload.phone_normalized, null);
    assert.equal(payload.phone_display, null);
  }

  // 2) 기존 email → 새 email → 새 값으로 변경
  {
    const payload = basePayload();
    applySanitizedEmailPhoneToPayload(
      payload,
      "new@ishowtech.co.kr",
      "010-9999-8888",
      { clearEmptyFields: true }
    );
    assert.equal(payload.email, "new@ishowtech.co.kr");
    assert.ok(String(payload.phone).includes("9999") || String(payload.phone_display).includes("9999"));
  }

  // 3) 신규 담당자 → email/phone 포함 정상 생성 payload
  {
    const payload = buildContactDataPayload({
      row: {
        contact_name: "신규담당",
        role_raw: "영업",
        role_type: "sales",
        department: "영업팀",
        position: "과장",
        phone: "010-1111-2222",
        email: "new.person@example.com",
        is_contract_contact: false,
        source_file: "test-full-db.xlsx"
      },
      matchConfidence: 1,
      matchMethod: "exact"
    });
    applySanitizedEmailPhoneToPayload(
      payload,
      "new.person@example.com",
      "010-1111-2222",
      { clearEmptyFields: true }
    );
    assert.equal(payload.name, "신규담당");
    assert.equal(payload.email, "new.person@example.com");
    assert.ok(payload.phone);
    assert.equal(payload.department, "영업팀");
  }

  // 4) clearEmptyFields 없으면 빈칸이 기존 값을 지우지 않음 (비-full-sync 호환)
  {
    const payload: Record<string, unknown> = {
      email: "keep@example.com",
      phone: "010-0000-0000"
    };
    applySanitizedEmailPhoneToPayload(payload, null, null);
    assert.equal(payload.email, "keep@example.com");
    assert.equal(payload.phone, "010-0000-0000");
  }

  console.log("partner-contacts full-sync clear-fields tests OK");
}

run();
