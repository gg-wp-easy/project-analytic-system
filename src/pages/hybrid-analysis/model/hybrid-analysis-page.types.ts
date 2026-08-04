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
  optimizationObjective: "min_risk_target_return" | "max_return_target_risk";
  targetReturn: string;
  targetRisk: string;
  portfolioAssetsCount: string;
  hideAnalysisDetails: boolean;
};
