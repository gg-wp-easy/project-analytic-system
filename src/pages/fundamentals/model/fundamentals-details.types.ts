import type { AssetFundamentalRecord } from "../../../entities/fundamentals";
import type { TBankCandle } from "../../../shared/api/tbank";

export type ChartRange = "1D" | "1W" | "1M" | "1Y";
export type ChartMode = "line" | "candles";
export type PriceCandle = TBankCandle;
export type CandleBucket = "raw" | "day" | "week";

export type RangeConfig = {
  from: (to: Date) => Date;
  interval: string;
  limit: number;
  candleBucket: CandleBucket;
};

export type FundamentalMetricItem = {
  key: keyof AssetFundamentalRecord;
  metric:
    | "marketCapBn"
    | "peRatio"
    | "pbRatio"
    | "psRatio"
    | "evToEbitda"
    | "roe"
    | "roa"
    | "netMargin"
    | "netDebtToEbitda"
    | "totalDebt"
    | "dividendYield"
    | "beta";
  labelRu: string;
  labelEn: string;
};

export type PriceSummary = {
  current: number;
  absoluteChange: number;
  percentChange: number;
  high: number;
  low: number;
  volume: number;
  updatedAt: string;
};

export type ChartPriceDomain = {
  minPrice: number;
  maxPrice: number;
};

export type CandleTone = {
  color: string;
  mutedColor: string;
  isUp: boolean;
};

export type RegressionScatterPoint = {
  date: string;
  x: number;
  y: number;
};

export type ModelTimeSeriesPoint = {
  date: string;
  actual: number;
  predicted: number;
};

export type ScatterTrend = {
  slope: number;
  intercept: number;
  startX: number;
  endX: number;
  startY: number;
  endY: number;
};

export type RegressionScatterDomain = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type CapmAdequacyCopy = {
  label: string;
  description: string;
  toneClass: string;
};
