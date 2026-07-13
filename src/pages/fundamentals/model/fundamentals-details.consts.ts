import type { ChartRange, FundamentalMetricItem, RangeConfig } from "./fundamentals-details.types";

export const FUNDAMENTALS_RANGE_CONFIG: Record<ChartRange, RangeConfig> = {
  "1D": {
    from: (to) => {
      const from = new Date(to);
      from.setDate(from.getDate() - 1);
      return from;
    },
    interval: "CANDLE_INTERVAL_HOUR",
    limit: 48,
    candleBucket: "raw",
  },
  "1W": {
    from: (to) => {
      const from = new Date(to);
      from.setDate(from.getDate() - 7);
      return from;
    },
    interval: "CANDLE_INTERVAL_HOUR",
    limit: 240,
    candleBucket: "day",
  },
  "1M": {
    from: (to) => {
      const from = new Date(to);
      from.setMonth(from.getMonth() - 1);
      return from;
    },
    interval: "CANDLE_INTERVAL_DAY",
    limit: 45,
    candleBucket: "raw",
  },
  "1Y": {
    from: (to) => {
      const from = new Date(to);
      from.setFullYear(from.getFullYear() - 1);
      return from;
    },
    interval: "CANDLE_INTERVAL_DAY",
    limit: 400,
    candleBucket: "raw",
  },
};

export const FUNDAMENTALS_RANGE_ORDER: ChartRange[] = ["1D", "1W", "1M", "1Y"];

export const FUNDAMENTALS_CHART_UP_COLOR = "#16a34a";
export const FUNDAMENTALS_CHART_DOWN_COLOR = "#64748b";
export const FUNDAMENTALS_CHART_UP_MUTED_COLOR = "rgba(22, 163, 74, 0.16)";
export const FUNDAMENTALS_CANDLE_DOWN_COLOR = "#e11d48";
export const FUNDAMENTALS_CANDLE_DOWN_MUTED_COLOR = "rgba(225, 29, 72, 0.16)";

export const FUNDAMENTAL_METRIC_ITEMS: FundamentalMetricItem[] = [
  { key: "marketCapBn", metric: "marketCapBn", labelRu: "Капитализация, млрд", labelEn: "Market Cap, bn" },
  { key: "peRatio", metric: "peRatio", labelRu: "P/E", labelEn: "P/E" },
  { key: "pbRatio", metric: "pbRatio", labelRu: "P/B", labelEn: "P/B" },
  { key: "psRatio", metric: "psRatio", labelRu: "P/S", labelEn: "P/S" },
  { key: "evToEbitda", metric: "evToEbitda", labelRu: "EV/EBITDA", labelEn: "EV/EBITDA" },
  { key: "roe", metric: "roe", labelRu: "ROE", labelEn: "ROE" },
  { key: "roa", metric: "roa", labelRu: "ROA", labelEn: "ROA" },
  { key: "netMargin", metric: "netMargin", labelRu: "Чистая маржа", labelEn: "Net Margin" },
  {
    key: "netDebtToEbitda",
    metric: "netDebtToEbitda",
    labelRu: "Чистый долг / EBITDA",
    labelEn: "Net Debt / EBITDA",
  },
  { key: "totalDebt", metric: "totalDebt", labelRu: "Общий долг, млрд", labelEn: "Total Debt, bn" },
  { key: "dividendYield", metric: "dividendYield", labelRu: "Див. доходность", labelEn: "Dividend Yield" },
  { key: "beta", metric: "beta", labelRu: "Бета", labelEn: "Beta" },
];
