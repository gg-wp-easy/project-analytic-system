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
  { key: "g", labelRu: "g / темпы роста", labelEn: "g / growth rate" },
  { key: "pe_ratio", labelRu: "P/E", labelEn: "P/E" },
  { key: "pb_ratio", labelRu: "P/B", labelEn: "P/B" },
  { key: "ps_ratio", labelRu: "P/S", labelEn: "P/S" },
  { key: "ev_to_ebitda", labelRu: "EV/EBITDA", labelEn: "EV/EBITDA" },
  { key: "roe", labelRu: "ROE", labelEn: "ROE" },
  { key: "roa", labelRu: "ROA", labelEn: "ROA" },
  { key: "net_margin", labelRu: "Маржа", labelEn: "Margin" },
  { key: "dividend_yield", labelRu: "Дивиденды", labelEn: "Dividend yield" },
  { key: "market_cap_bn", labelRu: "Капитализация", labelEn: "Market cap" },
  { key: "beta", labelRu: "Beta", labelEn: "Beta" },
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
  tuningBudget: "balanced",
  features: ["g", "pe_ratio", "pb_ratio", "ev_to_ebitda", "roe", "net_margin", "dividend_yield"],
};
