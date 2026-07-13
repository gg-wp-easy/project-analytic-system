import type { NeuralAnalysisSettings, NeuralFeatureOption } from "./neural-analysis-page.types";

export const NEURAL_STATE_KEY = "neural-analysis-state-v1";

export const NEURAL_PALETTE = [
  "#f97316",
  "#ea580c",
  "#fb923c",
  "#f59e0b",
  "#f43f5e",
  "#ef4444",
  "#facc15",
  "#fdba74",
];

export const NEURAL_FEATURE_OPTIONS: NeuralFeatureOption[] = [
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

export const DEFAULT_NEURAL_SETTINGS: NeuralAnalysisSettings = {
  modelType: "mlp",
  activation: "relu",
  optimizer: "adam",
  hiddenLayers: "64,32",
  epochs: 120,
  batchSize: 32,
  learningRate: 0.001,
  dropout: 0.2,
  validationSplit: 20,
  randomState: 42,
  earlyStopping: true,
  autoTune: true,
  tuningMetric: "val_loss",
  tuningBudget: "balanced",
  features: ["g", "pe_ratio", "pb_ratio", "ev_to_ebitda", "roe", "net_margin", "dividend_yield"],
};
