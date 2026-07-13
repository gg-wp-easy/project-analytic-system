export type SelectionMode = "all" | "manual";
export type TreeAlgorithm = "decision_tree" | "random_forest" | "gradient_boosting";
export type TreeCriterion = "gini" | "entropy" | "log_loss";
export type TreeTuningMetric = "f1" | "accuracy" | "roc_auc" | "balanced_accuracy";
export type TuningBudget = "fast" | "balanced" | "quality";

export type DecisionTreeSettings = {
  algorithm: TreeAlgorithm;
  criterion: TreeCriterion;
  maxDepth: number;
  minSamplesSplit: number;
  minSamplesLeaf: number;
  testSize: number;
  randomState: number;
  classBalance: boolean;
  autoTune: boolean;
  tuningMetric: TreeTuningMetric;
  tuningBudget: TuningBudget;
  features: string[];
};

export type TreeFeatureOption = {
  key: string;
  labelRu: string;
  labelEn: string;
};
