export type ApplicationDatePrecision = "year" | "month" | "day";

export type NormalizedApplicationDate = {
  /** DB date 컬럼용 YYYY-MM-DD */
  iso: string | null;
  /** 화면 표시용 (가능하면 원문 의미 유지) */
  display: string | null;
  precision: ApplicationDatePrecision | null;
  raw: string | null;
  ok: boolean;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toIso(year: number, month: number, day: number): string | null {
  if (!Number.isFinite(year) || year < 1900 || year > 2100) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function excelSerialToParts(serial: number): { y: number; m: number; d: number } | null {
  // Excel 1900 date system (with leap bug) approx via UTC epoch offset used by SheetJS SSF
  // Keep simple: serial days since 1899-12-30
  if (!Number.isFinite(serial) || serial < 1 || serial > 80000) return null;
  const utc = Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000;
  const dt = new Date(utc);
  return {
    y: dt.getUTCFullYear(),
    m: dt.getUTCMonth() + 1,
    d: dt.getUTCDate()
  };
}

/**
 * 신청서/폼의 설립일자 등을 DB date(YYYY-MM-DD)로 정규화한다.
 * - 월만 있으면 해당 월 1일
 * - 연도만 있으면 1월 1일
 */
export function normalizeApplicationDate(value: unknown): NormalizedApplicationDate {
  if (value == null || value === "") {
    return { iso: null, display: null, precision: null, raw: null, ok: true };
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parts = excelSerialToParts(value);
    if (!parts) {
      return {
        iso: null,
        display: String(value),
        precision: null,
        raw: String(value),
        ok: false
      };
    }
    const iso = toIso(parts.y, parts.m, parts.d);
    return {
      iso,
      display: iso ? `${parts.y}년 ${parts.m}월 ${parts.d}일` : String(value),
      precision: "day",
      raw: String(value),
      ok: Boolean(iso)
    };
  }

  const raw = String(value).trim();
  if (!raw) {
    return { iso: null, display: null, precision: null, raw: null, ok: true };
  }

  // already ISO
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (m) {
    const iso = toIso(Number(m[1]), Number(m[2]), Number(m[3]));
    return {
      iso,
      display: iso ? `${Number(m[1])}년 ${Number(m[2])}월 ${Number(m[3])}일` : raw,
      precision: "day",
      raw,
      ok: Boolean(iso)
    };
  }

  // YYYY년 M월 D일
  m = /^(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일$/.exec(raw);
  if (m) {
    const y = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    const iso = toIso(y, month, day);
    return {
      iso,
      display: `${y}년 ${month}월 ${day}일`,
      precision: "day",
      raw,
      ok: Boolean(iso)
    };
  }

  // YYYY년 M월 / YYYY년 MM월
  m = /^(\d{4})\s*년\s*(\d{1,2})\s*월$/.exec(raw);
  if (m) {
    const y = Number(m[1]);
    const month = Number(m[2]);
    const iso = toIso(y, month, 1);
    return {
      iso,
      display: `${y}년 ${month}월`,
      precision: "month",
      raw,
      ok: Boolean(iso)
    };
  }

  // YYYY.MM.DD / YYYY/MM/DD / YYYY-MM-DD variants with 1-digit
  m = /^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/.exec(raw);
  if (m) {
    const y = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    const iso = toIso(y, month, day);
    return {
      iso,
      display: `${y}년 ${month}월 ${day}일`,
      precision: "day",
      raw,
      ok: Boolean(iso)
    };
  }

  // YYYY.MM / YYYY-MM / YYYY/MM
  m = /^(\d{4})[./-](\d{1,2})$/.exec(raw);
  if (m) {
    const y = Number(m[1]);
    const month = Number(m[2]);
    const iso = toIso(y, month, 1);
    return {
      iso,
      display: `${y}년 ${month}월`,
      precision: "month",
      raw,
      ok: Boolean(iso)
    };
  }

  // YYYY년 / YYYY
  m = /^(\d{4})\s*년?$/.exec(raw);
  if (m) {
    const y = Number(m[1]);
    const iso = toIso(y, 1, 1);
    return {
      iso,
      display: `${y}년`,
      precision: "year",
      raw,
      ok: Boolean(iso)
    };
  }

  return {
    iso: null,
    display: raw,
    precision: null,
    raw,
    ok: false
  };
}

export const FOUNDED_DATE_FORMAT_HINT =
  "설립일자 형식을 확인해주세요. 월까지만 입력된 경우 자동으로 해당 월 1일 기준으로 저장됩니다.";
