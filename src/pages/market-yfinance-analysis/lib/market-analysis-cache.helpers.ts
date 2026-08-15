import {
  MARKET_ANALYSIS_CACHE_KEY,
  type MarketAnalysisCacheEntry,
  type MarketAnalysisPeriod,
  type MarketAnalysisResponse,
  type MarketMode,
} from "../model";

type MarketAnalysisCache = Record<string, MarketAnalysisCacheEntry>;

function getCacheEntryKey(mode: MarketMode, period: MarketAnalysisPeriod): string {
  return `${mode}:${period}`;
}

function readCache(): MarketAnalysisCache {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(MARKET_ANALYSIS_CACHE_KEY) ?? "{}") as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as MarketAnalysisCache
      : {};
  } catch {
    return {};
  }
}

export function readMarketAnalysisCache(
  mode: MarketMode,
  period: MarketAnalysisPeriod,
): MarketAnalysisCacheEntry | null {
  const entry = readCache()[getCacheEntryKey(mode, period)];
  if (!entry || entry.mode !== mode || entry.period !== period || !entry.result) {
    return null;
  }
  return entry;
}

export function saveMarketAnalysisCache(
  mode: MarketMode,
  period: MarketAnalysisPeriod,
  result: MarketAnalysisResponse,
): MarketAnalysisCacheEntry | null {
  const entry: MarketAnalysisCacheEntry = {
    mode,
    period,
    result,
    savedAt: new Date().toISOString(),
  };

  if (typeof window === "undefined") {
    return null;
  }

  try {
    const cache = readCache();
    cache[getCacheEntryKey(mode, period)] = entry;
    window.localStorage.setItem(MARKET_ANALYSIS_CACHE_KEY, JSON.stringify(cache));
    return entry;
  } catch {
    // The calculated result should remain usable even when browser storage is unavailable.
    return null;
  }
}
