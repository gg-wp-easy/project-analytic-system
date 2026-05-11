import { useEffect, useState } from "react";
import { API_BASE_URL } from "../../../config/api";

export type OptimizerSettings = {
  minWeight: string;
  maxWeight: string;
  riskFreeRate: string;
  sharpeBlendWeight: string;
  minRiskBlendWeight: string;
  optimizationObjective: "max_sharpe" | "min_risk";
  portfolioAssetsCount: string;
};

const OPTIMIZER_SETTINGS_STORAGE_KEY = "optimizer-settings-v1";

const defaultOptimizerSettings: OptimizerSettings = {
  riskFreeRate: "0",
  minWeight: "1",
  maxWeight: "1",
  sharpeBlendWeight: "0",
  minRiskBlendWeight: "0",
  optimizationObjective: "max_sharpe",
  portfolioAssetsCount: "0",
};

function normalizeOptimizationObjective(value: unknown): OptimizerSettings["optimizationObjective"] {
  return value === "min_risk" ? "min_risk" : "max_sharpe";
}

function numberOr(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

export function useOptimizerSettings() {
  const [settings, setSettings] = useState<OptimizerSettings>(defaultOptimizerSettings);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(OPTIMIZER_SETTINGS_STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as Partial<OptimizerSettings>;
      const legacyObjective =
        numberOr(parsed.minRiskBlendWeight, 0) > numberOr(parsed.sharpeBlendWeight, 0)
          ? "min_risk"
          : "max_sharpe";
      setSettings({
        minWeight: String(parsed.minWeight ?? defaultOptimizerSettings.minWeight),
        maxWeight: String(parsed.maxWeight ?? defaultOptimizerSettings.maxWeight),
        riskFreeRate: String(parsed.riskFreeRate ?? defaultOptimizerSettings.riskFreeRate),
        sharpeBlendWeight: String(parsed.sharpeBlendWeight ?? defaultOptimizerSettings.sharpeBlendWeight),
        minRiskBlendWeight: String(parsed.minRiskBlendWeight ?? defaultOptimizerSettings.minRiskBlendWeight),
        optimizationObjective: normalizeOptimizationObjective(parsed.optimizationObjective ?? legacyObjective),
        portfolioAssetsCount: String(parsed.portfolioAssetsCount ?? defaultOptimizerSettings.portfolioAssetsCount),
      });
    } catch {
      // ignore broken persisted state
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(OPTIMIZER_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  return { settings, setSettings };
}

export async function submitOptimizerSettings(settings: OptimizerSettings): Promise<void> {
  const minWeight = numberOr(settings.minWeight, numberOr(defaultOptimizerSettings.minWeight, 1));
  const maxWeight = numberOr(settings.maxWeight, numberOr(defaultOptimizerSettings.maxWeight, 1));
  const riskFreeRate = numberOr(settings.riskFreeRate, numberOr(defaultOptimizerSettings.riskFreeRate, 0));
  const sharpeBlendWeight = numberOr(
    settings.sharpeBlendWeight,
    numberOr(defaultOptimizerSettings.sharpeBlendWeight, 0),
  );
  const minRiskBlendWeight = numberOr(
    settings.minRiskBlendWeight,
    numberOr(defaultOptimizerSettings.minRiskBlendWeight, 0),
  );
  const portfolioAssetsCount = numberOr(
    settings.portfolioAssetsCount,
    numberOr(defaultOptimizerSettings.portfolioAssetsCount, 0),
  );
  const optimizationObjective = normalizeOptimizationObjective(settings.optimizationObjective);

  const payload = {
    risk_free_rate: riskFreeRate,
    min_weight: minWeight,
    max_weight: maxWeight,
    sharpe_blend_weight: optimizationObjective === "max_sharpe" ? Math.max(sharpeBlendWeight, 100) : 0,
    min_risk_blend_weight: optimizationObjective === "min_risk" ? Math.max(minRiskBlendWeight, 100) : 0,
    optimization_objective: optimizationObjective,
    portfolio_assets_count: portfolioAssetsCount,
  };

  const response = await fetch(`${API_BASE_URL}/optimizer-settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}${text ? `: ${text}` : ""}`);
  }
}
