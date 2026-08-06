export type SelectionMode = "all" | "manual";
export type NeuralModelType = "mlp" | "deep_mlp" | "auto";
export type NeuralActivation = "relu" | "tanh" | "gelu";
export type NeuralOptimizer = "adam" | "sgd" | "rmsprop";
export type NeuralTuningMetric = "val_loss" | "sharpe_ratio" | "expected_return";
export type TuningBudget = "fast" | "balanced" | "quality";

export type NeuralAnalysisSettings = {
  modelType: NeuralModelType;
  activation: NeuralActivation;
  optimizer: NeuralOptimizer;
  hiddenLayers: string;
  epochs: number;
  batchSize: number;
  learningRate: number;
  dropout: number;
  validationSplit: number;
  randomState: number;
  earlyStopping: boolean;
  autoTune: boolean;
  searchFeatureCombinations: boolean;
  dividendPriority: boolean;
  reuseCachedModels: boolean;
  tuningMetric: NeuralTuningMetric;
  tuningBudget: TuningBudget;
  features: string[];
};

export type NeuralFeatureOption = {
  key: string;
  labelRu: string;
  labelEn: string;
};
