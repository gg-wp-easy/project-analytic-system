import type { NeuralAnalysisSettings, NeuralFeatureOption } from "./neural-analysis-page.types";

export const NEURAL_STATE_KEY = "neural-analysis-state-v2";

export const NEURAL_PALETTE = [
  "#0f766e",
  "#2563eb",
  "#7c3aed",
  "#0891b2",
  "#16a34a",
  "#db2777",
  "#475569",
  "#14b8a6",
];

export const NEURAL_FEATURE_OPTIONS: NeuralFeatureOption[] = [
  { key: "pe", labelRu: "P/E", labelEn: "P/E" },
  { key: "ev_to_ebitda", labelRu: "EV/EBITDA", labelEn: "EV/EBITDA" },
  { key: "roe", labelRu: "ROE", labelEn: "ROE" },
  { key: "ps", labelRu: "P/S", labelEn: "P/S" },
  { key: "pfcf", labelRu: "P/FCF", labelEn: "P/FCF" },
  { key: "beta", labelRu: "Beta", labelEn: "Beta" },
  { key: "g", labelRu: "g / темп роста", labelEn: "g / growth rate" },
  { key: "dividend_yield", labelRu: "Дивидендная доходность", labelEn: "Dividend yield" },
];

export const DEFAULT_NEURAL_SETTINGS: NeuralAnalysisSettings = {
  modelType: "auto",
  activation: "relu",
  optimizer: "adam",
  hiddenLayers: "64,32",
  epochs: 40,
  batchSize: 32,
  learningRate: 0.001,
  dropout: 0.2,
  validationSplit: 20,
  randomState: 42,
  earlyStopping: true,
  autoTune: true,
  searchFeatureCombinations: true,
  dividendPriority: true,
  reuseCachedModels: true,
  tuningMetric: "val_loss",
  tuningBudget: "fast",
  features: ["pe", "ev_to_ebitda", "roe", "ps", "pfcf", "beta", "g", "dividend_yield"],
};
