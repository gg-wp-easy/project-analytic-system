export type HybridMetricItem = {
  label: string;
  value: string;
};

export type HybridModelScore = {
  model: string;
  score: number;
};

export type HybridPortfolioPosition = {
  ticker: string;
  name: string;
  weight: number;
  expectedReturn: number;
  risk: number;
  sharpe: number;
  sortino?: number;
  value_at_risk?: number;
};

export type HybridStrategyPortfolio = {
  key: string;
  name: string;
  expectedReturn: number;
  risk: number;
  sharpe: number;
  diversification: number;
  assetsCount: number;
};

export type HybridTrainingPoint = {
  epoch: number;
  trainLoss: number;
  valLoss: number;
};

