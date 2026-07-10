import type { AssetFundamentalRecord, ShareRecord } from "../../../entities/fundamentals";

export type PortfolioSimulationHolding = {
  figi?: string;
  ticker: string;
  name?: string | null;
  weight: number;
};

export type NormalizedHolding = PortfolioSimulationHolding & {
  figi: string;
  normalizedWeight: number;
  annualDividendYield: number;
};

export type AssetMonthlyRow = {
  month: string;
  ticker: string;
  monthlyReturn: number;
  cumulativeReturn: number;
};

export type PortfolioMonthlyRow = {
  month: string;
  monthlyReturn: number;
  cumulativeReturn: number;
};

export type SimulationResult = {
  portfolioRows: PortfolioMonthlyRow[];
  assetRows: AssetMonthlyRow[];
  metrics: {
    totalReturn: number;
    annualizedReturn: number;
    volatility: number;
    sharpe: number;
    sortino: number;
    months: number;
  };
};

export type SimulationCacheEntry = {
  key: string;
  savedAt: string;
  result: SimulationResult;
};

export type PortfolioSimulationPanelProps = {
  holdings: PortfolioSimulationHolding[];
  shares: ShareRecord[];
  fundamentalsByFigi: Record<string, AssetFundamentalRecord>;
  analysisName: string;
  filenamePrefix: string;
};
