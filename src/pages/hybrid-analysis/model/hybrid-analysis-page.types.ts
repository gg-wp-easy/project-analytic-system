export type HybridModelWeights = {
  cluster: number;
  tree: number;
  neural: number;
};

export type HybridPortfolioSettingsInput = {
  minWeight: string;
  maxWeight: string;
  riskFreeRate: string;
  sharpeBlendWeight: string;
  minRiskBlendWeight: string;
  optimizationObjective: "max_sharpe" | "min_risk";
  portfolioAssetsCount: string;
};
