import { VIZ_COLORS } from "../../../shared/brand";
import type { MetricKey, MetricRule } from "./data-preprocessing.types";

export const DATA_PREPROCESSING_PALETTE = [...VIZ_COLORS, "var(--nk-viz-muted)"];

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
