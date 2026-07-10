import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createTBankInstrumentsApi } from "../../../shared/api/tbank";
import {
  EMPTY_FUNDAMENTALS_CACHE,
  FUNDAMENTALS_ASSET_FUNDAMENTALS_ENDPOINT,
  FUNDAMENTALS_CACHE_KEY,
  FUNDAMENTALS_CLOSE_PRICES_ENDPOINT,
  FUNDAMENTALS_SHARES_ENDPOINT,
} from "./fundamentals.consts";
import type { FundamentalsCache, FundamentalsContextValue } from "./fundamentals.types";
import {
  loadFundamentalsCacheFromStorage,
  saveFundamentalsCacheToStorage,
  sortSharesByMarketCap,
} from "../lib/fundamentals-cache.helpers";

type FundamentalsContextGlobal = typeof globalThis & {
  __fundamentalsContext__?: ReturnType<typeof createContext<FundamentalsContextValue | null>>;
};

// Reuse a single context instance across dev HMR / duplicated module paths.
const fundamentalsContextGlobal = globalThis as FundamentalsContextGlobal;
const FundamentalsContext =
  fundamentalsContextGlobal.__fundamentalsContext__ ?? createContext<FundamentalsContextValue | null>(null);

if (!fundamentalsContextGlobal.__fundamentalsContext__) {
  fundamentalsContextGlobal.__fundamentalsContext__ = FundamentalsContext;
}

export function FundamentalsProvider({ children }: { children: ReactNode }) {
  const [cache, setCache] = useState<FundamentalsCache>(() => loadFundamentalsCacheFromStorage());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFundamentals = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const api = createTBankInstrumentsApi();
      const shares = await api.fetchShares();
      const fundamentalsByFigi = await api.fetchAssetFundamentals(shares);
      const closePricesByFigi = await api.fetchClosePrices(shares);
      const sortedShares = sortSharesByMarketCap(shares, fundamentalsByFigi);

      const nextCache: FundamentalsCache = {
        shares: sortedShares,
        fundamentalsByFigi,
        closePricesByFigi,
        closePricesMetaByFigi: {},
        lastUpdated: new Date().toISOString(),
        source: {
          shares: FUNDAMENTALS_SHARES_ENDPOINT,
          assetFundamentals: FUNDAMENTALS_ASSET_FUNDAMENTALS_ENDPOINT,
          closePrices: FUNDAMENTALS_CLOSE_PRICES_ENDPOINT,
        },
      };

      setCache(nextCache);
      saveFundamentalsCacheToStorage(nextCache);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load fundamentals";
      setError(message);
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
          saveFundamentalsCacheToStorage(next);
          return next;
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load close prices";
        setError(message);
      }
    },
    [cache.closePricesByFigi, cache.closePricesMetaByFigi],
  );

  const clearCache = useCallback(() => {
    setCache(EMPTY_FUNDAMENTALS_CACHE);
    setError(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(FUNDAMENTALS_CACHE_KEY);
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
