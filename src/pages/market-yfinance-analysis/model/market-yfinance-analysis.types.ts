export type MarketMode = "indexes" | "commodities";

export type MarketAnalysisPeriod = "1y" | "2y" | "3y" | "5y";

export type SourceAsset = {
  key: string;
  ticker: string;
  name: string;
  region?: string;
  group?: string;
  loaded?: boolean;
};

export type MarketPosition = {
  asset: string;
  ticker: string;
  name: string;
  weight: number;
};

export type MarketMetricMap = Record<string, number | string | null | undefined>;

export type MarketAnalysisResponse = {
  statistics?: Array<Record<string, unknown>>;
  correlation_matrix?: Array<Record<string, unknown>>;
  top_correlations?: Array<Record<string, unknown>>;
  portfolios?: {
    max_sharpe?: {
      metrics?: MarketMetricMap;
      positions?: Array<{ asset?: string; weight?: number }>;
    };
  };
  efficient_frontier?: Array<Record<string, unknown>>;
  source?: {
    provider?: string;
    frequency?: string;
    period?: string;
    assets?: SourceAsset[];
    loaded_assets_count?: number;
    observations?: number;
    start_date?: string;
    end_date?: string;
  };
};

export type MarketAnalysisCacheEntry = {
  mode: MarketMode;
  period: MarketAnalysisPeriod;
  savedAt: string;
  result: MarketAnalysisResponse;
};
