import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createTBankInstrumentsApi } from "../../../shared/api/tbank";

const FUNDAMENTALS_CACHE_KEY = "fundamentals-cache-v1";
const ENABLE_TEMP_LOGS = true;

const SHARES_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.InstrumentsService/Shares";
const ASSET_FUNDAMENTALS_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.InstrumentsService/GetAssetFundamentals";
const CLOSE_PRICES_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.MarketDataService/GetClosePrices";

export type ShareRecord = {
  figi: string;
  assetUid: string;
  ticker: string;
  name: string;
  lot: number;
  currency: string;
  exchange: string;
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
  evToEbitda: number;
  roa: number;
  netMargin: number;
  netDebtToEbitda: number;
  totalDebt: number;
  roe: number;
  dividendYield: number;
  beta: number;
  updatedAt: string;
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

type FundamentalsContextValue = {
  cache: FundamentalsCache;
  isLoading: boolean;
  hasData: boolean;
  error: string | null;
  loadFundamentals: () => Promise<void>;
  loadClosePricesForFigi: (figi: string, force?: boolean) => Promise<void>;
  clearCache: () => void;
};

const emptyCache: FundamentalsCache = {
  shares: [],
  fundamentalsByFigi: {},
  closePricesByFigi: {},
  closePricesMetaByFigi: {},
  lastUpdated: null,
  source: {
    shares: SHARES_ENDPOINT,
    assetFundamentals: ASSET_FUNDAMENTALS_ENDPOINT,
    closePrices: CLOSE_PRICES_ENDPOINT,
  },
};

type FundamentalsContextGlobal = typeof globalThis & {
  __fundamentalsContext__?: ReturnType<typeof createContext<FundamentalsContextValue | null>>;
};

function loadCacheFromStorage(): FundamentalsCache {
  if (typeof window === "undefined") {
    return emptyCache;
  }

  const raw = window.localStorage.getItem(FUNDAMENTALS_CACHE_KEY);
  if (!raw) {
    if (ENABLE_TEMP_LOGS) {
      console.info("[Fundamentals][Cache][Load]", {
        ts: new Date().toISOString(),
        key: FUNDAMENTALS_CACHE_KEY,
        found: false,
      });
    }
    return emptyCache;
  }

  try {
    const parsed = JSON.parse(raw) as FundamentalsCache;
    if (!Array.isArray(parsed.shares) || !parsed.fundamentalsByFigi) {
      if (ENABLE_TEMP_LOGS) {
        console.warn("[Fundamentals][Cache][Load][Invalid]", {
          ts: new Date().toISOString(),
          key: FUNDAMENTALS_CACHE_KEY,
        });
      }
      return emptyCache;
    }
    if (ENABLE_TEMP_LOGS) {
      console.info("[Fundamentals][Cache][Load][OK]", {
        ts: new Date().toISOString(),
        sharesCount: parsed.shares.length,
        fundamentalsCount: Object.keys(parsed.fundamentalsByFigi).length,
        closePricesCount: Object.keys(parsed.closePricesByFigi ?? {}).length,
        lastUpdated: parsed.lastUpdated,
      });
    }
    return {
      ...parsed,
      closePricesByFigi: parsed.closePricesByFigi ?? {},
      closePricesMetaByFigi: parsed.closePricesMetaByFigi ?? {},
      source: {
        shares: parsed.source?.shares ?? SHARES_ENDPOINT,
        assetFundamentals: parsed.source?.assetFundamentals ?? ASSET_FUNDAMENTALS_ENDPOINT,
        closePrices: parsed.source?.closePrices ?? CLOSE_PRICES_ENDPOINT,
      },
    };
  } catch {
    if (ENABLE_TEMP_LOGS) {
      console.error("[Fundamentals][Cache][Load][ParseError]", {
        ts: new Date().toISOString(),
        key: FUNDAMENTALS_CACHE_KEY,
      });
    }
    return emptyCache;
  }
}

function saveCacheToStorage(cache: FundamentalsCache): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(FUNDAMENTALS_CACHE_KEY, JSON.stringify(cache));
  if (ENABLE_TEMP_LOGS) {
    console.info("[Fundamentals][Cache][Save]", {
      ts: new Date().toISOString(),
      key: FUNDAMENTALS_CACHE_KEY,
      sharesCount: cache.shares.length,
      fundamentalsCount: Object.keys(cache.fundamentalsByFigi).length,
      closePricesCount: Object.keys(cache.closePricesByFigi).length,
      lastUpdated: cache.lastUpdated,
    });
  }
}

// Reuse a single context instance across dev HMR / duplicated module paths.
const fundamentalsContextGlobal = globalThis as FundamentalsContextGlobal;
const FundamentalsContext =
  fundamentalsContextGlobal.__fundamentalsContext__ ?? createContext<FundamentalsContextValue | null>(null);

if (!fundamentalsContextGlobal.__fundamentalsContext__) {
  fundamentalsContextGlobal.__fundamentalsContext__ = FundamentalsContext;
}

export function FundamentalsProvider({ children }: { children: ReactNode }) {
  const [cache, setCache] = useState<FundamentalsCache>(() => loadCacheFromStorage());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFundamentals = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const start = performance.now();

    try {
      const api = createTBankInstrumentsApi();
      const shares = await api.fetchShares();
      const fundamentalsByFigi = await api.fetchAssetFundamentals(shares);
      const closePricesByFigi = await api.fetchClosePrices(shares);

      const nextCache: FundamentalsCache = {
        shares,
        fundamentalsByFigi,
        closePricesByFigi,
        closePricesMetaByFigi: {},
        lastUpdated: new Date().toISOString(),
        source: {
          shares: SHARES_ENDPOINT,
          assetFundamentals: ASSET_FUNDAMENTALS_ENDPOINT,
          closePrices: CLOSE_PRICES_ENDPOINT,
        },
      };

      setCache(nextCache);
      saveCacheToStorage(nextCache);
      if (ENABLE_TEMP_LOGS) {
        console.info("[Fundamentals][Load][Done]", {
          ts: new Date().toISOString(),
          durationMs: Number((performance.now() - start).toFixed(1)),
          sharesCount: shares.length,
          fundamentalsCount: Object.keys(fundamentalsByFigi).length,
          closePricesCount: Object.keys(closePricesByFigi).length,
          firstTickers: shares.slice(0, 5).map((s) => s.ticker),
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load fundamentals";
      setError(message);
      console.error("Failed to load fundamentals from market data service", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadClosePricesForFigi = useCallback(
    async (figi: string, force = false) => {
      if (!figi) {
        return;
      }
      const meta = cache.closePricesMetaByFigi?.[figi];
      if (!force && meta?.lastUpdated) {
        const last = new Date(meta.lastUpdated).getTime();
        const ageMs = Date.now() - last;
        if (Number.isFinite(ageMs) && ageMs < 60 * 60 * 1000) {
          return;
        }
      }
      try {
        const api = createTBankInstrumentsApi();
        const to = new Date();
        const from = new Date();
        from.setFullYear(to.getFullYear() - 1);

        const candles = await api.fetchCandles({
          figi,
          from: from.toISOString(),
          to: to.toISOString(),
          interval: "CANDLE_INTERVAL_DAY",
          limit: 400,
        });

        const points = candles
          .filter((row) => Number.isFinite(row.close))
          .map((row) => ({
            figi: row.figi,
            price: row.close,
            time: row.time,
          }));

        setCache((prev) => {
          const next: FundamentalsCache = {
            ...prev,
            closePricesByFigi: {
              ...prev.closePricesByFigi,
              [figi]: points,
            },
            closePricesMetaByFigi: {
              ...prev.closePricesMetaByFigi,
              [figi]: { lastUpdated: new Date().toISOString() },
            },
          };
          saveCacheToStorage(next);
          return next;
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load close prices";
        setError(message);
        console.error("Failed to load close prices from market data service", err);
      }
    },
    [cache.closePricesByFigi, cache.closePricesMetaByFigi],
  );

  const clearCache = useCallback(() => {
    setCache(emptyCache);
    setError(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(FUNDAMENTALS_CACHE_KEY);
      if (ENABLE_TEMP_LOGS) {
        console.info("[Fundamentals][Cache][Clear]", {
          ts: new Date().toISOString(),
          key: FUNDAMENTALS_CACHE_KEY,
        });
      }
    }
  }, []);

  const value = useMemo<FundamentalsContextValue>(
    () => ({
      cache,
      isLoading,
      hasData: cache.shares.length > 0,
      error,
      loadFundamentals,
      loadClosePricesForFigi,
      clearCache,
    }),
    [cache, isLoading, error, loadFundamentals, loadClosePricesForFigi, clearCache],
  );

  return <FundamentalsContext.Provider value={value}>{children}</FundamentalsContext.Provider>;
}

export function useFundamentals(): FundamentalsContextValue {
  const ctx = useContext(FundamentalsContext);
  if (!ctx) {
    throw new Error("useFundamentals must be used inside FundamentalsProvider");
  }
  return ctx;
}
