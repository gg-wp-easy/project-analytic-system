import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createTBankInstrumentsApi,
  type TBankAssetInstrumentReference,
  type TBankCandle,
  type TBankInstrumentReference,
  type TBankLastPrice,
  type TBankOption,
  type TBankShare,
} from "../../../shared/api/tbank";
import {
  EMPTY_OPTIONS_CACHE,
  OPTIONS_CACHE_KEY,
  OPTIONS_CANDLES_ENDPOINT,
  OPTIONS_CLOSE_PRICES_ENDPOINT,
  OPTIONS_ENDPOINT,
  OPTIONS_HISTORY_CACHE_TTL_MS,
  OPTIONS_LAST_PRICES_ENDPOINT,
  OPTIONS_PRICE_CACHE_TTL_MS,
} from "./options.consts";
import type { LoadClosePricesParams, OptionsCache, OptionsContextValue } from "./options.types";
import {
  loadOptionsCacheFromStorage,
  saveOptionsCacheToStorage,
} from "../lib/options-cache.helpers";

const underlyingReferenceCache = new Map<string, Promise<TBankInstrumentReference[]>>();
const underlyingAssetReferenceCache = new Map<string, Promise<TBankAssetInstrumentReference[]>>();
const underlyingMarketDataIdsCache = new Map<string, string[]>();
let underlyingSharesCache: Promise<TBankShare[]> | null = null;

type OptionsContextGlobal = typeof globalThis & {
  __optionsContext__?: ReturnType<typeof createContext<OptionsContextValue | null>>;
};

function getUnderlyingFallbackInstrumentIds(options: TBankOption[]): string[] {
  return [
    ...new Set(
      options
        .flatMap((option) => [
          option.basicAsset,
          option.basicAssetPositionUid,
        ])
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
}

function getUnderlyingAssetUids(options: TBankOption[]): string[] {
  return [
    ...new Set(
      options
        .flatMap((option) => [
          option.basicAssetUid,
          option.assetUid,
        ])
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
}

function getUnderlyingSearchQueries(options: TBankOption[]): string[] {
  const basicAssets = [
    ...new Set(options.map((option) => option.basicAsset.trim()).filter(Boolean)),
  ];

  if (basicAssets.length > 0) {
    return basicAssets.slice(0, 3);
  }

  const firstTickerBase = options[0]?.ticker.split("-")[0]?.trim() ?? "";
  return firstTickerBase && !firstTickerBase.includes(" ") ? [firstTickerBase] : [];
}

function getUnderlyingTickerHints(options: TBankOption[]): string[] {
  return [
    ...new Set(
      options
        .flatMap((option) => [
          option.basicAsset,
          option.ticker.split("-")[0] ?? "",
        ])
        .map((value) => value.trim())
        .filter((value) => value && !value.includes(" ")),
    ),
  ];
}

function getInstrumentReferenceId(instrument: TBankInstrumentReference): string {
  return instrument.uid || instrument.figi || [instrument.ticker, instrument.classCode].filter(Boolean).join("_");
}

function scoreUnderlyingReference(instrument: TBankInstrumentReference, query: string): number {
  const normalizedQuery = query.trim().toLowerCase();
  const ticker = instrument.ticker.trim().toLowerCase();
  const instrumentType = instrument.instrumentType.trim().toLowerCase();
  let score = 0;

  if (ticker && ticker === normalizedQuery) {
    score += 100;
  }
  if (instrument.uid) {
    score += 10;
  }
  if (instrument.figi) {
    score += 8;
  }
  if (instrumentType.includes("share")) {
    score += 40;
  } else if (instrumentType.includes("etf")) {
    score += 30;
  } else if (instrumentType.includes("future")) {
    score += 20;
  } else if (instrumentType.includes("option")) {
    score -= 200;
  }

  return score;
}

async function fetchUnderlyingAssetReferences(
  api: ReturnType<typeof createTBankInstrumentsApi>,
  assetUids: string[],
): Promise<TBankAssetInstrumentReference[]> {
  const uniqueAssetUids = [...new Set(assetUids.map((value) => value.trim()).filter(Boolean))];
  if (uniqueAssetUids.length === 0) {
    return [];
  }

  const cacheKey = uniqueAssetUids.sort().join("|");
  const promise =
    underlyingAssetReferenceCache.get(cacheKey) ??
    api.fetchAssetInstrumentReferences(uniqueAssetUids).catch((error) => {
      underlyingAssetReferenceCache.delete(cacheKey);
      throw error;
    });
  underlyingAssetReferenceCache.set(cacheKey, promise);
  return promise;
}

async function fetchUnderlyingShareInstrumentIds(
  api: ReturnType<typeof createTBankInstrumentsApi>,
  tickerHints: string[],
): Promise<string[]> {
  const normalizedHints = new Set(tickerHints.map((value) => value.trim().toLowerCase()).filter(Boolean));
  if (normalizedHints.size === 0) {
    return [];
  }

  underlyingSharesCache ??= api.fetchShares().catch((error) => {
    underlyingSharesCache = null;
    throw error;
  });

  const shares = await underlyingSharesCache;
  return shares
    .filter((share) => normalizedHints.has(share.ticker.trim().toLowerCase()))
    .map((share) => share.figi)
    .filter(Boolean);
}

async function resolveUnderlyingMarketDataInstrumentIds(
  api: ReturnType<typeof createTBankInstrumentsApi>,
  options: TBankOption[],
  preferredInstrumentIds: string[] = [],
): Promise<string[]> {
  const preferredIds = [...new Set(preferredInstrumentIds.map((value) => value.trim()).filter(Boolean))];
  const resolvedIds: string[] = [...preferredIds];
  const tickerHints = getUnderlyingTickerHints(options);
  const assetUids = getUnderlyingAssetUids(options);
  const searchQueries = getUnderlyingSearchQueries(options);
  const fallbackIds = getUnderlyingFallbackInstrumentIds(options);
  const cacheKey = [
    ...preferredIds,
    "shares",
    ...tickerHints,
    "asset",
    ...assetUids,
    "search",
    ...searchQueries,
    "fallback",
    ...fallbackIds,
  ].join("|");
  const cached = underlyingMarketDataIdsCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    resolvedIds.push(...await fetchUnderlyingShareInstrumentIds(api, tickerHints));
  } catch {
    // Fall through to asset and search based resolution.
  }

  try {
    const references = await fetchUnderlyingAssetReferences(api, assetUids);
    for (const assetUid of assetUids) {
      const best = references
        .filter((reference) => reference.assetUid === assetUid)
        .filter((reference) => !reference.instrumentType.toLowerCase().includes("option"))
        .sort((left, right) => scoreUnderlyingReference(right, "") - scoreUnderlyingReference(left, ""))[0];
      const id = best ? getInstrumentReferenceId(best) : "";
      if (id) {
        resolvedIds.push(id);
      }
    }
  } catch {
    // Fall through to FindInstrument by ticker/name hints.
  }

  for (const query of searchQueries) {
    try {
      const normalizedQuery = query.trim().toLowerCase();
      const referencesPromise =
        underlyingReferenceCache.get(normalizedQuery) ??
        api.findInstrumentReferences(query).catch((error) => {
          underlyingReferenceCache.delete(normalizedQuery);
          throw error;
        });
      underlyingReferenceCache.set(normalizedQuery, referencesPromise);

      const references = await referencesPromise;
      const best = references
        .filter((reference) => !reference.instrumentType.toLowerCase().includes("option"))
        .sort((left, right) => scoreUnderlyingReference(right, query) - scoreUnderlyingReference(left, query))[0];
      const id = best ? getInstrumentReferenceId(best) : "";
      if (id) {
        resolvedIds.push(id);
      }
    } catch {
      // Try the next query and then fall back to raw ids below.
    }
  }

  const uniqueResolvedIds = [...new Set(resolvedIds)];
  const result = uniqueResolvedIds.length > 0 ? uniqueResolvedIds : fallbackIds;
  underlyingMarketDataIdsCache.set(cacheKey, result);
  return result;
}

async function fetchLastPricesForInstrumentCandidates(
  api: ReturnType<typeof createTBankInstrumentsApi>,
  instrumentIds: string[],
): Promise<TBankLastPrice[]> {
  const result: TBankLastPrice[] = [];

  for (const instrumentId of instrumentIds) {
    try {
      result.push(...await api.fetchLastPricesByInstrumentIds([instrumentId]));
    } catch {
      // Try the next candidate; some option asset ids are not valid market-data ids.
    }
  }

  return result;
}

function pickBestLastPrice(items: TBankLastPrice[]): TBankLastPrice | null {
  const valid = items.filter((item) => Number.isFinite(item.price) && item.price > 0);
  if (valid.length === 0) {
    return null;
  }

  return [...valid].sort((left, right) => {
    const leftTime = Date.parse(left.time);
    const rightTime = Date.parse(right.time);
    if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
      return rightTime - leftTime;
    }
    return right.price - left.price;
  })[0] ?? null;
}

const optionsContextGlobal = globalThis as OptionsContextGlobal;
const OptionsContext =
  optionsContextGlobal.__optionsContext__ ?? createContext<OptionsContextValue | null>(null);

if (!optionsContextGlobal.__optionsContext__) {
  optionsContextGlobal.__optionsContext__ = OptionsContext;
}

export function OptionsProvider({ children }: { children: ReactNode }) {
  const [cache, setCache] = useState<OptionsCache>(() => loadOptionsCacheFromStorage());
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingClosePrices, setIsLoadingClosePrices] = useState(false);
  const [isLoadingUnderlyingPrice, setIsLoadingUnderlyingPrice] = useState(false);
  const [isLoadingUnderlyingHistory, setIsLoadingUnderlyingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOptions = useCallback(async (force = true) => {
    setIsLoading(true);
    setError(null);

    try {
      const api = createTBankInstrumentsApi();
      const options = await api.fetchOptions({ force });

      setCache((prev) => {
        const nextCache: OptionsCache = {
          ...prev,
          options,
          lastUpdated: new Date().toISOString(),
          source: {
            options: OPTIONS_ENDPOINT,
            closePrices: OPTIONS_CLOSE_PRICES_ENDPOINT,
            lastPrices: OPTIONS_LAST_PRICES_ENDPOINT,
            candles: OPTIONS_CANDLES_ENDPOINT,
          },
        };
        saveOptionsCacheToStorage(nextCache);
        return nextCache;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load options";
      setError(message);
      throw err instanceof Error ? err : new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadClosePricesForUnderlying = useCallback(
    async ({ underlyingKey, options, force = false }: LoadClosePricesParams) => {
      if (!underlyingKey || options.length === 0) {
        return;
      }

      const meta = cache.optionClosePricesMetaByUnderlyingKey[underlyingKey];
      if (!force && meta?.lastUpdated) {
        const lastUpdatedMs = new Date(meta.lastUpdated).getTime();
        const ageMs = Date.now() - lastUpdatedMs;
        if (Number.isFinite(ageMs) && ageMs < OPTIONS_PRICE_CACHE_TTL_MS) {
          return;
        }
      }

      const instrumentIds = [...new Set(options.map((option) => option.figi || option.uid).filter(Boolean))];
      if (instrumentIds.length === 0) {
        return;
      }

      setIsLoadingClosePrices(true);
      setError(null);

      try {
        const api = createTBankInstrumentsApi();
        const payload = await api.fetchClosePricesByInstrumentIds(instrumentIds);
        const nextPrices: Record<string, number> = {};

        for (const points of Object.values(payload)) {
          for (const point of points) {
            if (!Number.isFinite(point.price)) {
              continue;
            }

            if (point.figi) {
              nextPrices[point.figi] = point.price;
            }
            if (point.instrumentUid) {
              nextPrices[point.instrumentUid] = point.price;
            }
          }
        }

        setCache((prev) => {
          const nextCache: OptionsCache = {
            ...prev,
            optionClosePricesByInstrumentId: {
              ...prev.optionClosePricesByInstrumentId,
              ...nextPrices,
            },
            optionClosePricesMetaByUnderlyingKey: {
              ...prev.optionClosePricesMetaByUnderlyingKey,
              [underlyingKey]: { lastUpdated: new Date().toISOString() },
            },
          };
          saveOptionsCacheToStorage(nextCache);
          return nextCache;
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load option close prices";
        setError(message);
        throw err instanceof Error ? err : new Error(message);
      } finally {
        setIsLoadingClosePrices(false);
      }
    },
    [cache.optionClosePricesMetaByUnderlyingKey],
  );

  const loadUnderlyingPriceForUnderlying = useCallback(
    async ({ underlyingKey, options, force = false, preferredInstrumentIds = [] }: LoadClosePricesParams) => {
      if (!underlyingKey || options.length === 0) {
        return;
      }

      const cached = cache.underlyingLastPricesByKey[underlyingKey];
      if (!force && cached?.lastUpdated) {
        const lastUpdatedMs = new Date(cached.lastUpdated).getTime();
        const ageMs = Date.now() - lastUpdatedMs;
        if (Number.isFinite(ageMs) && ageMs < OPTIONS_PRICE_CACHE_TTL_MS) {
          return;
        }
      }

      const api = createTBankInstrumentsApi();
      const underlyingInstrumentIds = await resolveUnderlyingMarketDataInstrumentIds(api, options, preferredInstrumentIds);
      if (underlyingInstrumentIds.length === 0) {
        return;
      }

      setIsLoadingUnderlyingPrice(true);
      setError(null);

      try {
        const underlyingLastPrice = pickBestLastPrice(
          await fetchLastPricesForInstrumentCandidates(api, underlyingInstrumentIds),
        );

        if (!underlyingLastPrice) {
          throw new Error("market data service did not return a valid underlying last price for this option chain.");
        }

        setCache((prev) => {
          const nextCache: OptionsCache = {
            ...prev,
            underlyingLastPricesByKey: {
              ...prev.underlyingLastPricesByKey,
              [underlyingKey]: {
                price: underlyingLastPrice.price,
                instrumentId:
                  underlyingLastPrice.instrumentUid ||
                  underlyingLastPrice.figi ||
                  underlyingLastPrice.instrumentId ||
                  underlyingInstrumentIds[0] ||
                  "",
                time: underlyingLastPrice.time,
                lastUpdated: new Date().toISOString(),
              },
            },
          };
          saveOptionsCacheToStorage(nextCache);
          return nextCache;
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load underlying last price";
        setError(message);
        throw err instanceof Error ? err : new Error(message);
      } finally {
        setIsLoadingUnderlyingPrice(false);
      }
    },
    [cache.underlyingLastPricesByKey],
  );

  const loadUnderlyingHistoryForUnderlying = useCallback(
    async ({ underlyingKey, options, force = false, preferredInstrumentIds = [] }: LoadClosePricesParams) => {
      if (!underlyingKey || options.length === 0) {
        return;
      }

      const cached = cache.underlyingHistoryByKey[underlyingKey];
      if (!force && cached?.lastUpdated) {
        const lastUpdatedMs = new Date(cached.lastUpdated).getTime();
        const ageMs = Date.now() - lastUpdatedMs;
        if (Number.isFinite(ageMs) && ageMs < OPTIONS_HISTORY_CACHE_TTL_MS && cached.candles.length > 0) {
          return;
        }
      }

      const api = createTBankInstrumentsApi();
      const underlyingInstrumentIds = await resolveUnderlyingMarketDataInstrumentIds(api, options, preferredInstrumentIds);
      if (underlyingInstrumentIds.length === 0) {
        return;
      }

      setIsLoadingUnderlyingHistory(true);
      setError(null);

      try {
        const to = new Date();
        const from = new Date(to.getTime() - 220 * 24 * 60 * 60 * 1000);
        let selectedInstrumentId = "";
        let selectedCandles: TBankCandle[] = [];
        let lastError: unknown = null;

        for (const instrumentId of underlyingInstrumentIds) {
          try {
            const candles = await api.fetchCandles({
              figi: instrumentId,
              from: from.toISOString(),
              to: to.toISOString(),
              interval: "CANDLE_INTERVAL_DAY",
              limit: 240,
            });
            const validCandles = candles.filter((candle) => Number.isFinite(candle.close) && candle.close > 0);
            if (validCandles.length > selectedCandles.length) {
              selectedInstrumentId = instrumentId;
              selectedCandles = validCandles;
            }
            if (validCandles.length >= 50) {
              break;
            }
          } catch (err) {
            lastError = err;
          }
        }

        if (selectedCandles.length === 0) {
          throw lastError instanceof Error
            ? lastError
            : new Error("market data service did not return underlying price history for this option chain.");
        }

        setCache((prev) => {
          const nextCache: OptionsCache = {
            ...prev,
            underlyingHistoryByKey: {
              ...prev.underlyingHistoryByKey,
              [underlyingKey]: {
                instrumentId: selectedInstrumentId,
                candles: selectedCandles,
                from: from.toISOString(),
                to: to.toISOString(),
                interval: "CANDLE_INTERVAL_DAY",
                lastUpdated: new Date().toISOString(),
              },
            },
          };
          saveOptionsCacheToStorage(nextCache);
          return nextCache;
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load underlying price history";
        setError(message);
        throw err instanceof Error ? err : new Error(message);
      } finally {
        setIsLoadingUnderlyingHistory(false);
      }
    },
    [cache.underlyingHistoryByKey],
  );

  const clearCache = useCallback(() => {
    setCache(EMPTY_OPTIONS_CACHE);
    setError(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(OPTIONS_CACHE_KEY);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value = useMemo<OptionsContextValue>(
    () => ({
      cache,
      isLoading,
      isLoadingClosePrices,
      isLoadingUnderlyingPrice,
      isLoadingUnderlyingHistory,
      hasData: cache.options.length > 0,
      error,
      loadOptions,
      loadClosePricesForUnderlying,
      loadUnderlyingPriceForUnderlying,
      loadUnderlyingHistoryForUnderlying,
      clearCache,
      clearError,
    }),
    [
      cache,
      clearCache,
      clearError,
      error,
      isLoading,
      isLoadingClosePrices,
      isLoadingUnderlyingHistory,
      isLoadingUnderlyingPrice,
      loadClosePricesForUnderlying,
      loadOptions,
      loadUnderlyingHistoryForUnderlying,
      loadUnderlyingPriceForUnderlying,
    ],
  );

  return <OptionsContext.Provider value={value}>{children}</OptionsContext.Provider>;
}

export function useOptionsData(): OptionsContextValue {
  const context = useContext(OptionsContext);
  if (!context) {
    throw new Error("useOptionsData must be used inside OptionsProvider");
  }
  return context;
}
