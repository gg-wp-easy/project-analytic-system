import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createTBankInstrumentsApi, type TBankLastPrice, type TBankOption } from "../../../shared/api/tbank";

const OPTIONS_CACHE_KEY = "options-cache-v1";
const OPTIONS_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.InstrumentsService/OptionsBy";
const CLOSE_PRICES_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.MarketDataService/GetClosePrices";
const LAST_PRICES_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.MarketDataService/GetLastPrices";
const PRICE_CACHE_TTL_MS = 60 * 60 * 1000;

type StoredOptionRecord = {
  figi: string;
  uid: string;
  positionUid: string;
  assetUid: string;
  basicAssetUid: string;
  basicAssetPositionUid: string;
  ticker: string;
  classCode: string;
  name: string;
  currency: string;
  settlementCurrency: string;
  assetType: string;
  basicAsset: string;
  exchange: string;
  lot: number;
  strikePrice: number;
  expirationDate: string;
  direction: string;
  style: string;
  realExchange: string;
  apiTradeAvailableFlag: boolean;
};

export type OptionsCache = {
  options: TBankOption[];
  optionClosePricesByInstrumentId: Record<string, number>;
  optionClosePricesMetaByUnderlyingKey: Record<string, { lastUpdated: string }>;
  underlyingLastPricesByKey: Record<string, { price: number; instrumentId: string; time: string; lastUpdated: string }>;
  lastUpdated: string | null;
  source: {
    options: string;
    closePrices: string;
    lastPrices: string;
  };
};

type LoadClosePricesParams = {
  underlyingKey: string;
  options: TBankOption[];
  force?: boolean;
};

type OptionsContextValue = {
  cache: OptionsCache;
  isLoading: boolean;
  isLoadingClosePrices: boolean;
  isLoadingUnderlyingPrice: boolean;
  hasData: boolean;
  error: string | null;
  loadOptions: (force?: boolean) => Promise<void>;
  loadClosePricesForUnderlying: (params: LoadClosePricesParams) => Promise<void>;
  loadUnderlyingPriceForUnderlying: (params: LoadClosePricesParams) => Promise<void>;
  clearCache: () => void;
  clearError: () => void;
};

const emptyCache: OptionsCache = {
  options: [],
  optionClosePricesByInstrumentId: {},
  optionClosePricesMetaByUnderlyingKey: {},
  underlyingLastPricesByKey: {},
  lastUpdated: null,
  source: {
    options: OPTIONS_ENDPOINT,
    closePrices: CLOSE_PRICES_ENDPOINT,
    lastPrices: LAST_PRICES_ENDPOINT,
  },
};

type OptionsContextGlobal = typeof globalThis & {
  __optionsContext__?: ReturnType<typeof createContext<OptionsContextValue | null>>;
};

function normalizeStoredOption(item: unknown): TBankOption | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const raw = item as Partial<StoredOptionRecord>;
  if (typeof raw.uid !== "string" || !raw.uid.trim() || typeof raw.ticker !== "string" || !raw.ticker.trim()) {
    return null;
  }

  return {
    figi: typeof raw.figi === "string" ? raw.figi : "",
    uid: raw.uid,
    positionUid: typeof raw.positionUid === "string" ? raw.positionUid : "",
    assetUid: typeof raw.assetUid === "string" ? raw.assetUid : "",
    basicAssetUid: typeof raw.basicAssetUid === "string" ? raw.basicAssetUid : "",
    basicAssetPositionUid: typeof raw.basicAssetPositionUid === "string" ? raw.basicAssetPositionUid : "",
    ticker: raw.ticker,
    classCode: typeof raw.classCode === "string" ? raw.classCode : "",
    name: typeof raw.name === "string" ? raw.name : "",
    currency: typeof raw.currency === "string" ? raw.currency : "",
    settlementCurrency: typeof raw.settlementCurrency === "string" ? raw.settlementCurrency : "",
    assetType: typeof raw.assetType === "string" ? raw.assetType : "",
    basicAsset: typeof raw.basicAsset === "string" ? raw.basicAsset : "",
    exchange: typeof raw.exchange === "string" ? raw.exchange : "",
    lot: typeof raw.lot === "number" && Number.isFinite(raw.lot) ? raw.lot : 0,
    strikePrice:
      typeof raw.strikePrice === "number" && Number.isFinite(raw.strikePrice) ? raw.strikePrice : 0,
    expirationDate: typeof raw.expirationDate === "string" ? raw.expirationDate : "",
    firstTradeDate: "",
    lastTradeDate: "",
    direction: typeof raw.direction === "string" ? raw.direction : "",
    paymentType: "",
    style: typeof raw.style === "string" ? raw.style : "",
    settlementType: "",
    realExchange: typeof raw.realExchange === "string" ? raw.realExchange : "",
    tradingStatus: "",
    apiTradeAvailableFlag: Boolean(raw.apiTradeAvailableFlag),
    buyAvailableFlag: false,
    sellAvailableFlag: false,
    shortEnabledFlag: false,
    forIisFlag: false,
    forQualInvestorFlag: false,
    weekendFlag: false,
    blockedTcaFlag: false,
    otcFlag: false,
    requiredTests: [],
  };
}

function toStoredOption(option: TBankOption): StoredOptionRecord {
  return {
    figi: option.figi,
    uid: option.uid,
    positionUid: option.positionUid,
    assetUid: option.assetUid,
    basicAssetUid: option.basicAssetUid,
    basicAssetPositionUid: option.basicAssetPositionUid,
    ticker: option.ticker,
    classCode: option.classCode,
    name: option.name,
    currency: option.currency,
    settlementCurrency: option.settlementCurrency,
    assetType: option.assetType,
    basicAsset: option.basicAsset,
    exchange: option.exchange,
    lot: option.lot,
    strikePrice: option.strikePrice,
    expirationDate: option.expirationDate,
    direction: option.direction,
    style: option.style,
    realExchange: option.realExchange,
    apiTradeAvailableFlag: option.apiTradeAvailableFlag,
  };
}

function loadCacheFromStorage(): OptionsCache {
  if (typeof window === "undefined") {
    return emptyCache;
  }

  const raw = window.localStorage.getItem(OPTIONS_CACHE_KEY);
  if (!raw) {
    return emptyCache;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<OptionsCache & { options: StoredOptionRecord[] }>;
    const options = Array.isArray(parsed.options)
      ? parsed.options
          .map((item) => normalizeStoredOption(item))
          .filter((item): item is TBankOption => Boolean(item))
      : [];

    return {
      options,
      optionClosePricesByInstrumentId: parsed.optionClosePricesByInstrumentId ?? {},
      optionClosePricesMetaByUnderlyingKey: parsed.optionClosePricesMetaByUnderlyingKey ?? {},
      underlyingLastPricesByKey: parsed.underlyingLastPricesByKey ?? {},
      lastUpdated: typeof parsed.lastUpdated === "string" ? parsed.lastUpdated : null,
      source: {
        options: parsed.source?.options ?? OPTIONS_ENDPOINT,
        closePrices: parsed.source?.closePrices ?? CLOSE_PRICES_ENDPOINT,
        lastPrices: parsed.source?.lastPrices ?? LAST_PRICES_ENDPOINT,
      },
    };
  } catch {
    return emptyCache;
  }
}

function saveCacheToStorage(cache: OptionsCache): void {
  if (typeof window === "undefined") {
    return;
  }

  const serializable = {
    ...cache,
    options: cache.options.map((option) => toStoredOption(option)),
  };
  window.localStorage.setItem(OPTIONS_CACHE_KEY, JSON.stringify(serializable));
}

function getUnderlyingInstrumentIds(options: TBankOption[]): string[] {
  return [
    ...new Set(
      options
        .flatMap((option) => [
          option.basicAssetPositionUid,
          option.basicAssetUid,
          option.assetUid,
          option.basicAsset,
        ])
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
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
  const [cache, setCache] = useState<OptionsCache>(() => loadCacheFromStorage());
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingClosePrices, setIsLoadingClosePrices] = useState(false);
  const [isLoadingUnderlyingPrice, setIsLoadingUnderlyingPrice] = useState(false);
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
            closePrices: CLOSE_PRICES_ENDPOINT,
            lastPrices: LAST_PRICES_ENDPOINT,
          },
        };
        saveCacheToStorage(nextCache);
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
        if (Number.isFinite(ageMs) && ageMs < PRICE_CACHE_TTL_MS) {
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
          saveCacheToStorage(nextCache);
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
    async ({ underlyingKey, options, force = false }: LoadClosePricesParams) => {
      if (!underlyingKey || options.length === 0) {
        return;
      }

      const cached = cache.underlyingLastPricesByKey[underlyingKey];
      if (!force && cached?.lastUpdated) {
        const lastUpdatedMs = new Date(cached.lastUpdated).getTime();
        const ageMs = Date.now() - lastUpdatedMs;
        if (Number.isFinite(ageMs) && ageMs < PRICE_CACHE_TTL_MS) {
          return;
        }
      }

      const underlyingInstrumentIds = getUnderlyingInstrumentIds(options);
      if (underlyingInstrumentIds.length === 0) {
        return;
      }

      setIsLoadingUnderlyingPrice(true);
      setError(null);

      try {
        const api = createTBankInstrumentsApi();
        const underlyingLastPrice = pickBestLastPrice(
          await api.fetchLastPricesByInstrumentIds(underlyingInstrumentIds),
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
          saveCacheToStorage(nextCache);
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

  const clearCache = useCallback(() => {
    setCache(emptyCache);
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
      hasData: cache.options.length > 0,
      error,
      loadOptions,
      loadClosePricesForUnderlying,
      loadUnderlyingPriceForUnderlying,
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
      isLoadingUnderlyingPrice,
      loadClosePricesForUnderlying,
      loadOptions,
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
