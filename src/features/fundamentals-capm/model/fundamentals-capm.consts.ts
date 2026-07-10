export const CAPM_LOOKBACK_DAYS = 370;
export const CAPM_TARGET_OFZ_YEARS = 2;
export const TRADING_DAYS_PER_YEAR = 252;
export const IMOEX_TICKER = "IMOEX";

export const FAMA_FRENCH_FACTORS = {
  largeCap: { query: "TMOS" },
  smallCap: { query: "RU000A109KS6" },
  value: { query: "TDIV" },
  growth: { query: "TITR" },
} as const;
