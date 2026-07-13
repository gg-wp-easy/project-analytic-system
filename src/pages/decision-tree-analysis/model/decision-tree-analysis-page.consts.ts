import type { DecisionTreeSettings, TreeFeatureOption } from "./decision-tree-analysis-page.types";

export const TREE_STATE_KEY = "decision-tree-analysis-state-v1";

export const TREE_PALETTE = [
  "#10b981",
  "#059669",
  "#34d399",
  "#0ea5a4",
  "#22c55e",
  "#84cc16",
  "#14b8a6",
  "#2dd4bf",
];

export const TREE_FEATURE_OPTIONS: TreeFeatureOption[] = [
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

export const DEFAULT_TREE_SETTINGS: DecisionTreeSettings = {
  algorithm: "decision_tree",
  criterion: "gini",
  maxDepth: 5,
  minSamplesSplit: 4,
  minSamplesLeaf: 2,
  testSize: 25,
  randomState: 42,
  classBalance: true,
  autoTune: true,
  tuningMetric: "f1",
  tuningBudget: "balanced",
  features: ["g", "pe_ratio", "pb_ratio", "ev_to_ebitda", "roe", "net_margin", "dividend_yield"],
};
