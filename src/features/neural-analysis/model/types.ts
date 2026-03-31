export type NeuralMetricItem = {
  label: string;
  value: string;
};

export type NeuralFeatureImportanceItem = {
  feature: string;
  importance: number;
};

export type NeuralPortfolioPosition = {
  ticker: string;
  name: string;
  weight: number;
  expectedReturn: number;
  risk: number;
  sharpe: number;
  sortino?: number;
  value_at_risk?: number;
};

export type NeuralPortfolioStrategy = {
  key: string;
  name: string;
  expectedReturn: number;
  risk: number;
  sharpe: number;
  diversification: number;
  assetsCount: number;
  positions: NeuralPortfolioPosition[];
};

export type NeuralTrainingPoint = {
  epoch: number;
  trainLoss: number;
  valLoss: number;
};

