export type OptimizationObjective = "max_sharpe" | "min_risk";

export type OptimizerSettings = {
  minWeight: string;
  maxWeight: string;
  riskFreeRate: string;
  sharpeBlendWeight: string;
  minRiskBlendWeight: string;
  optimizationObjective: OptimizationObjective;
  portfolioAssetsCount: string;
};
