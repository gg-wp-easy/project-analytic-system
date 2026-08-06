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
  { key: "pe", labelRu: "P/E", labelEn: "P/E" },
  { key: "ev_to_ebitda", labelRu: "EV/EBITDA", labelEn: "EV/EBITDA" },
  { key: "roe", labelRu: "ROE", labelEn: "ROE" },
  { key: "ps", labelRu: "P/S", labelEn: "P/S" },
  { key: "pfcf", labelRu: "P/FCF", labelEn: "P/FCF" },
  { key: "beta", labelRu: "Beta", labelEn: "Beta" },
  { key: "g", labelRu: "g / темпы роста", labelEn: "g / growth rate" },
  { key: "dividend_yield", labelRu: "Дивидендная доходность", labelEn: "Dividend yield" },
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
  tuningBudget: "fast",
  features: ["pe", "ev_to_ebitda", "roe", "ps", "pfcf", "beta", "g", "dividend_yield"],
};
