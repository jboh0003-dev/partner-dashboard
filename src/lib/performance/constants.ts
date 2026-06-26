export const PIPELINE_FY26 = "FY26";
export const PIPELINE_NEW_REG_YEAR = "2026년";

export const INVENTORY_SHEET_PATTERN = /인벤토리\s*rawdata/i;
export const WIN_FORECAST_SUMMARY_PATTERN = /26년\s*수주확도\s*summary/i;
export const NEW_REG_SUMMARY_PATTERN = /신규등록\s*summary/i;
export const REVENUE_PARTNER_SHEET_PATTERN = /25년\s*파트너\s*실적/i;
export const REVENUE_PIVOT_SHEET_PATTERN = /25년\s*매출\s*pivot/i;

export const REFERENCE_VALIDATION = {
  win_forecast_total_amount_million: 116047,
  win_forecast_total_count: 634,
  win_forecast_partner_amount_million: 19907,
  win_forecast_partner_count: 154,
  new_reg_total_amount_million: 41565,
  new_reg_total_count: 266,
  new_reg_partner_amount_million: 4910,
  new_reg_partner_count: 60
} as const;
