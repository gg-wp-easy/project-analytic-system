import type { MarketAnalysisPeriod } from "./market-yfinance-analysis.types";

export const MARKET_ANALYSIS_CACHE_KEY = "analytic-system.market-yfinance-analysis.v1";

export const MARKET_ANALYSIS_PERIOD_OPTIONS: MarketAnalysisPeriod[] = ["1y", "2y", "3y", "5y"];

export const DEFAULT_MARKET_ANALYSIS_PERIOD: MarketAnalysisPeriod = "3y";
