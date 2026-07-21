export type DecisionTreeMetricItem = {
  label: string;
  value: string;
};

export type DecisionTreeFeatureImportanceItem = {
  feature: string;
  importance: number;
};

export type DecisionTreeConfusionMatrixData = {
  labels: string[];
  matrix: number[][];
};

export type DecisionTreePortfolioPosition = {
  figi?: string;
  ticker: string;
  name: string;
  sector: string;
  weight: number;
  expectedReturn: number;
  risk: number;
  predictedText: string;
  sortino?: number;
  value_at_risk?: number;
};

export type DecisionTreeSectorAllocationItem = {
  sector: string;
  weight: number;
};

export type DecisionTreeNumericSummaryItem = {
  metric: string;
  mean: number;
  median: number;
  min: number;
  max: number;
};

export type DecisionTreeRuleItem = {
  conditions: string;
  prediction: string;
  samples: number;
  confidence: number | string;
};

export type DecisionTreePreviewNode = {
  id: number;
  depth: number;
  samples: number;
  prediction: string;
  confidence: number;
  kind: "split" | "leaf";
  truncated?: boolean;
  feature?: string;
  threshold?: number;
  left?: DecisionTreePreviewNode;
  right?: DecisionTreePreviewNode;
};
