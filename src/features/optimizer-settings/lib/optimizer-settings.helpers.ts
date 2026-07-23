import { numberOr } from "../../../shared/lib/number/numberOr";
import { DEFAULT_OPTIMIZER_SETTINGS, type OptimizationObjective, type OptimizerSettings } from "../model";

export function normalizeOptimizationObjective(value: unknown): OptimizationObjective {
  return value === "min_risk" ? "min_risk" : "max_sharpe";
}

export function normalizeOptimizerSettings(value: Partial<OptimizerSettings>): OptimizerSettings {
  const legacyObjective =
    numberOr(value.minRiskBlendWeight, 0) > numberOr(value.sharpeBlendWeight, 0)
      ? "min_risk"
      : "max_sharpe";
  const normalizedRiskFreeRate = numberOr(value.riskFreeRate, NaN);
  const riskFreeRate =
    Number.isFinite(normalizedRiskFreeRate) && normalizedRiskFreeRate > 0
      ? String(value.riskFreeRate)
      : DEFAULT_OPTIMIZER_SETTINGS.riskFreeRate;

  return {
    minWeight: String(value.minWeight ?? DEFAULT_OPTIMIZER_SETTINGS.minWeight),
    maxWeight: String(value.maxWeight ?? DEFAULT_OPTIMIZER_SETTINGS.maxWeight),
    riskFreeRate,
    sharpeBlendWeight: String(value.sharpeBlendWeight ?? DEFAULT_OPTIMIZER_SETTINGS.sharpeBlendWeight),
    minRiskBlendWeight: String(value.minRiskBlendWeight ?? DEFAULT_OPTIMIZER_SETTINGS.minRiskBlendWeight),
    optimizationObjective: normalizeOptimizationObjective(value.optimizationObjective ?? legacyObjective),
    portfolioAssetsCount: String(value.portfolioAssetsCount ?? DEFAULT_OPTIMIZER_SETTINGS.portfolioAssetsCount),
  };
}

export function buildOptimizerSettingsPayload(settings: OptimizerSettings) {
  const minWeight = numberOr(settings.minWeight, numberOr(DEFAULT_OPTIMIZER_SETTINGS.minWeight, 1));
  const maxWeight = numberOr(settings.maxWeight, numberOr(DEFAULT_OPTIMIZER_SETTINGS.maxWeight, 1));
  const rawRiskFreeRate = numberOr(settings.riskFreeRate, numberOr(DEFAULT_OPTIMIZER_SETTINGS.riskFreeRate, 14));
  const riskFreeRate = rawRiskFreeRate > 0 ? rawRiskFreeRate : numberOr(DEFAULT_OPTIMIZER_SETTINGS.riskFreeRate, 14);
  const sharpeBlendWeight = numberOr(
    settings.sharpeBlendWeight,
    numberOr(DEFAULT_OPTIMIZER_SETTINGS.sharpeBlendWeight, 0),
  );
  const minRiskBlendWeight = numberOr(
    settings.minRiskBlendWeight,
    numberOr(DEFAULT_OPTIMIZER_SETTINGS.minRiskBlendWeight, 0),
  );
  const portfolioAssetsCount = numberOr(
    settings.portfolioAssetsCount,
    numberOr(DEFAULT_OPTIMIZER_SETTINGS.portfolioAssetsCount, 0),
  );
  const optimizationObjective = normalizeOptimizationObjective(settings.optimizationObjective);

  return {
    risk_free_rate: riskFreeRate,
    min_weight: minWeight,
    max_weight: maxWeight,
    sharpe_blend_weight: optimizationObjective === "max_sharpe" ? Math.max(sharpeBlendWeight, 100) : 0,
    min_risk_blend_weight: optimizationObjective === "min_risk" ? Math.max(minRiskBlendWeight, 100) : 0,
    optimization_objective: optimizationObjective,
    ...(portfolioAssetsCount > 0 ? { portfolio_assets_count: portfolioAssetsCount } : {}),
  };
}
