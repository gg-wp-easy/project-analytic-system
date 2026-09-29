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
  optimizationObjective: "min_risk" | "min_risk_target_return" | "max_return_target_risk" | "max_sharpe";
  targetReturn: string;
  targetRisk: string;
  portfolioAssetsCount: string;
  hideAnalysisDetails: boolean;
  autoModelTuning: boolean;
  autoPortfolioOptimization: boolean;
};
