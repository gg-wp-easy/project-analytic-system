export type ScreeningRow = {
  figi: string;
  ticker: string;
  name: string;
  sector: string;
  exchange: string;
  currency: string;
  logoUrl?: string | null;
  marketCapBn: number;
  pe: number;
  g: number;
  pbv: number;
  roe: number;
  debtEbitda: number;
  evEbitda: number;
  dividendYield: number;
  beta: number;
  score: number;
};

export type SectorRow = {
  sector: string;
  count: number;
  averageScore: number;
  color: string;
};

export type ScatterKey = "pe" | "g" | "pbv" | "roe" | "debtEbitda" | "evEbitda";
export type MetricKey = ScatterKey | "dividendYield" | "marketCapBn" | "beta" | "score";

export type MetricRange = {
  min: number;
  max: number;
};

export type MetricRule = {
  min?: number;
  max?: number;
  lowerQuantile?: number;
  upperQuantile?: number;
};

export type SummaryMetricConfig = {
  key: MetricKey;
  label: string;
  digits?: number;
  unit?: string;
};

export type SummaryMetricRow = SummaryMetricConfig & {
  average: number;
  median: number;
  min: number;
  max: number;
  count: number;
  filteredOut: number;
};

export type ScatterSectionProps = {
  title: string;
  description: string;
  rows: ScreeningRow[];
  sectors: SectorRow[];
  xKey: ScatterKey;
  yKey: ScatterKey;
  xLabel: string;
  yLabel: string;
  xUnit?: string;
  yUnit?: string;
};
