export type ShareRecord = {
  figi: string;
  assetUid: string;
  ticker: string;
  name: string;
  lot: number;
  currency: string;
  exchange: string;
  sector?: string;
  liquidityFlag?: boolean;
  apiTradeAvailableFlag?: boolean;
  buyAvailableFlag?: boolean;
  sellAvailableFlag?: boolean;
  otcFlag?: boolean;
};

export type AssetFundamentalRecord = {
  figi: string;
  marketCapBn: number;
  peRatio: number;
  pbRatio: number;
  psRatio: number;
  pfcfRatio: number;
  evToEbitda: number;
  roa: number;
  netMargin: number;
  netDebtToEbitda: number;
  totalDebt: number;
  roe: number;
  dividendYield: number;
  fiveYearAverageDividendYield: number;
  fiveYearDividendGrowthRate: number;
  dividendPayoutRatio: number;
  dividendYearsCount?: number;
  consecutiveDividendYears?: number;
  dividendConsistency?: number;
  lastDividendYear?: number;
  dividendPaymentsCount?: number;
  dividendHistoryAvailable?: boolean;
  beta: number;
  updatedAt: string;
};

export type DividendHistorySummary = {
  dividendYearsCount: number;
  consecutiveDividendYears: number;
  dividendConsistency: number;
  lastDividendYear?: number;
  dividendPaymentsCount: number;
  dividendHistoryAvailable: boolean;
};

export type ClosePricePoint = {
  figi: string;
  price: number;
  time: string;
  instrumentUid?: string;
  ticker?: string;
  classCode?: string;
};

export type FundamentalsCache = {
  shares: ShareRecord[];
  fundamentalsByFigi: Record<string, AssetFundamentalRecord>;
  closePricesByFigi: Record<string, ClosePricePoint[]>;
  closePricesMetaByFigi: Record<string, { lastUpdated: string }>;
  lastUpdated: string | null;
  source: {
    shares: string;
    assetFundamentals: string;
    closePrices: string;
  };
};

export type FundamentalsContextValue = {
  cache: FundamentalsCache;
  isLoading: boolean;
  hasData: boolean;
  error: string | null;
  loadFundamentals: () => Promise<void>;
  loadClosePricesForFigi: (figi: string, force?: boolean) => Promise<void>;
  clearCache: () => void;
};
