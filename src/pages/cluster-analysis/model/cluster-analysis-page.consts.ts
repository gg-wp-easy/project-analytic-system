import type { ClusterAnalysisSettings, ClusterFeatureOption } from "./cluster-analysis-page.types";

export const CLUSTER_STATE_KEY = "cluster-analysis-state-v2";

export const CLUSTER_PALETTE = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#14b8a6",
  "#f97316",
];

export const CLUSTER_FEATURE_OPTIONS: ClusterFeatureOption[] = [
  { key: "pe", labelRu: "P/E", labelEn: "P/E" },
  { key: "ev_to_ebitda", labelRu: "EV/EBITDA", labelEn: "EV/EBITDA" },
  { key: "roe", labelRu: "ROE", labelEn: "ROE" },
  { key: "ps", labelRu: "P/S", labelEn: "P/S" },
  { key: "pfcf", labelRu: "P/FCF", labelEn: "P/FCF" },
  { key: "beta", labelRu: "Beta", labelEn: "Beta" },
  { key: "g", labelRu: "g / темпы роста", labelEn: "g / growth rate" },
  { key: "dividend_yield", labelRu: "Дивидендная доходность", labelEn: "Dividend yield" },
];

export const DEFAULT_CLUSTER_SETTINGS: ClusterAnalysisSettings = {
  algorithm: "kmeans",
  clustersCount: 4,
  distanceMetric: "euclidean",
  scalingMethod: "standard",
  randomState: 42,
  includeOutliers: true,
  autoTune: true,
  tuningMetric: "silhouette",
  tuningBudget: "fast",
  features: ["pe", "ev_to_ebitda", "roe", "ps", "pfcf", "beta", "g", "dividend_yield"],
};
