import type { MetricKey, MetricRule } from "./data-preprocessing.types";

export const DATA_PREPROCESSING_PALETTE = [
  "#2563eb",
  "#059669",
  "#f59e0b",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#65a30d",
  "#475569",
];

export const METRIC_RULES: Record<MetricKey, MetricRule> = {
  pe: { min: 0.01, max: 120, lowerQuantile: 0.02, upperQuantile: 0.98 },
  g: { min: -80, max: 80, lowerQuantile: 0.02, upperQuantile: 0.98 },
  pbv: { min: 0.01, max: 25, lowerQuantile: 0.02, upperQuantile: 0.98 },
  roe: { min: -80, max: 80, lowerQuantile: 0.02, upperQuantile: 0.98 },
  debtEbitda: { min: -10, max: 15, lowerQuantile: 0.02, upperQuantile: 0.98 },
  evEbitda: { min: 0.01, max: 60, lowerQuantile: 0.02, upperQuantile: 0.98 },
  dividendYield: { min: 0, max: 25, lowerQuantile: 0, upperQuantile: 0.95 },
  marketCapBn: { min: 0.01, lowerQuantile: 0.01, upperQuantile: 1 },
  beta: { min: -5, max: 5, lowerQuantile: 0.02, upperQuantile: 0.98 },
  score: { min: 0, max: 100, lowerQuantile: 0, upperQuantile: 1 },
};
