export const PIPELINE_FY26 = "FY26";
export const PIPELINE_NEW_REG_YEAR = "2026년";

export const INVENTORY_SHEET_PATTERN = /인벤토리\s*rawdata/i;
export const WIN_FORECAST_SUMMARY_PATTERN = /26년\s*수주확도\s*summary/i;
export const NEW_REG_SUMMARY_PATTERN = /신규등록\s*summary/i;
export const REVENUE_PARTNER_SHEET_PATTERN = /25년\s*파트너\s*실적/i;
export const REVENUE_PIVOT_SHEET_PATTERN = /25년\s*매출\s*pivot/i;

/**
 * 260805 인벤토리 rawdata 기준 참고값 (summary 시트는 260703이라 사용하지 않음).
 * FY26 + 파트너딜 O + 제품매출 O, 프로젝트코드 unique.
 */
export const REFERENCE_VALIDATION = {
  partner_pipeline_amount_million: 17678.996,
  partner_pipeline_count: 152,
  expected_win_partner_amount_million: 7595.796,
  expected_win_partner_count: 40
} as const;
