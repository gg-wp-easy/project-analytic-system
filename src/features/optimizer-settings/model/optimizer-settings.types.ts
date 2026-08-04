export type OptimizationObjective = "min_risk_target_return" | "max_return_target_risk";

export type OptimizerSettings = {
  minWeight: string;
  maxWeight: string;
  riskFreeRate: string;
  sharpeBlendWeight: string;
  minRiskBlendWeight: string;
  optimizationObjective: OptimizationObjective;
  targetReturn: string;
  targetRisk: string;
  portfolioAssetsCount: string;
  hideAnalysisDetails: boolean;
};

export type OptimizerSettingsFieldsProps = {
  settings: OptimizerSettings;
  onChange: (next: OptimizerSettings) => void;
  autoFitWeights?: boolean;
};
