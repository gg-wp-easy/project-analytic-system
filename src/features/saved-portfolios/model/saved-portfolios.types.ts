import type { AssetFundamentalRecord, ShareRecord } from "../../../entities/fundamentals";

export const SAVED_PORTFOLIOS_STORAGE_KEY = "analytic-system.saved-portfolios.v1";

export type SavedPortfolioAssetClass = "stock" | "bond" | "index" | "commodity";

export type SavedPortfolioSourceKey =
  | "cluster"
  | "decision-tree"
  | "neural-network"
  | "hybrid"
  | "bonds"
  | "indexes"
  | "commodities";

export type SavedPortfolioMetric = {
  label: string;
  value: string;
  rawValue?: number | string | null;
};

export type SavedPortfolioHolding = {
  figi?: string;
  ticker: string;
  name?: string | null;
  weight: number;
  currency?: string | null;
  annualDividendYield?: number | null;
  expectedReturn?: number | null;
  risk?: number | null;
  sharpe?: number | null;
};

export type SavedPortfolio = {
  id: string;
  name: string;
  sourceKey: SavedPortfolioSourceKey;
  sourceLabel: string;
  assetClass: SavedPortfolioAssetClass;
  createdAt: string;
  savedAt: string;
  holdings: SavedPortfolioHolding[];
  metrics: SavedPortfolioMetric[];
};

export type SavePortfolioHoldingInput = {
  figi?: string;
  ticker: string;
  name?: string | null;
  weight: number;
  currency?: string | null;
  annualDividendYield?: number | null;
  dividendYield?: number | null;
  currentYield?: number | null;
  expectedReturn?: number | null;
  risk?: number | null;
  sharpe?: number | null;
};

export type SavePortfolioButtonProps = {
  holdings: SavePortfolioHoldingInput[];
  metrics: SavedPortfolioMetric[];
  sourceKey: SavedPortfolioSourceKey;
  sourceLabel: string;
  assetClass: SavedPortfolioAssetClass;
  defaultName: string;
  shares?: ShareRecord[];
  fundamentalsByFigi?: Record<string, AssetFundamentalRecord>;
  disabled?: boolean;
  className?: string;
};
