import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const FUNDAMENTALS_CACHE_KEY = "fundamentals-cache-v1";

const SHARES_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.InstrumentsService/Shares";
const ASSET_FUNDAMENTALS_ENDPOINT =
  "https://developer.tbank.ru/invest/api/instruments-service-get-asset-fundamentals";

export type ShareRecord = {
  figi: string;
  ticker: string;
  name: string;
  lot: number;
  currency: string;
  exchange: string;
};

export type AssetFundamentalRecord = {
  figi: string;
  peRatio: number;
  pbRatio: number;
  roe: number;
  dividendYield: number;
  marketCapBn: number;
  updatedAt: string;
};

export type FundamentalsCache = {
  shares: ShareRecord[];
  fundamentalsByFigi: Record<string, AssetFundamentalRecord>;
  lastUpdated: string | null;
  source: {
    shares: string;
    assetFundamentals: string;
  };
};

type FundamentalsContextValue = {
  cache: FundamentalsCache;
  isLoading: boolean;
  hasData: boolean;
  loadFundamentals: () => Promise<void>;
  clearCache: () => void;
};

const emptyCache: FundamentalsCache = {
  shares: [],
  fundamentalsByFigi: {},
  lastUpdated: null,
  source: {
    shares: SHARES_ENDPOINT,
    assetFundamentals: ASSET_FUNDAMENTALS_ENDPOINT,
  },
};

function loadCacheFromStorage(): FundamentalsCache {
  if (typeof window === "undefined") {
    return emptyCache;
  }

  const raw = window.localStorage.getItem(FUNDAMENTALS_CACHE_KEY);
  if (!raw) {
    return emptyCache;
  }

  try {
    const parsed = JSON.parse(raw) as FundamentalsCache;
    if (!Array.isArray(parsed.shares) || !parsed.fundamentalsByFigi) {
      return emptyCache;
    }
    return parsed;
  } catch {
    return emptyCache;
  }
}

function saveCacheToStorage(cache: FundamentalsCache): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(FUNDAMENTALS_CACHE_KEY, JSON.stringify(cache));
}

function createMockShares(): ShareRecord[] {
  return [
    { figi: "BBG004730N88", ticker: "SBER", name: "Sberbank", lot: 10, currency: "RUB", exchange: "MOEX" },
    { figi: "BBG0047315Y7", ticker: "GAZP", name: "Gazprom", lot: 10, currency: "RUB", exchange: "MOEX" },
    { figi: "BBG004S681B4", ticker: "LKOH", name: "Lukoil", lot: 1, currency: "RUB", exchange: "MOEX" },
    { figi: "BBG000N9MNX3", ticker: "YDEX", name: "Yandex", lot: 1, currency: "RUB", exchange: "MOEX" },
    { figi: "BBG00475K2X9", ticker: "TATN", name: "Tatneft", lot: 1, currency: "RUB", exchange: "MOEX" },
    { figi: "BBG004730JJ5", ticker: "VTBR", name: "VTB", lot: 10000, currency: "RUB", exchange: "MOEX" },
  ];
}

function createMockFundamentals(shares: ShareRecord[]): Record<string, AssetFundamentalRecord> {
  const now = new Date().toISOString();
  return shares.reduce<Record<string, AssetFundamentalRecord>>((acc, share, index) => {
    acc[share.figi] = {
      figi: share.figi,
      peRatio: Number((5 + index * 1.8).toFixed(2)),
      pbRatio: Number((0.9 + index * 0.3).toFixed(2)),
      roe: Number((8 + index * 2.2).toFixed(2)),
      dividendYield: Number((2 + index * 0.7).toFixed(2)),
      marketCapBn: Number((120 + index * 85).toFixed(2)),
      updatedAt: now,
    };
    return acc;
  }, {});
}

const FundamentalsContext = createContext<FundamentalsContextValue | null>(null);

export function FundamentalsProvider({ children }: { children: ReactNode }) {
  const [cache, setCache] = useState<FundamentalsCache>(() => loadCacheFromStorage());
  const [isLoading, setIsLoading] = useState(false);

  const loadFundamentals = useCallback(async () => {
    setIsLoading(true);
    try {
      const shares = createMockShares();
      const fundamentalsByFigi = createMockFundamentals(shares);

      const nextCache: FundamentalsCache = {
        shares,
        fundamentalsByFigi,
        lastUpdated: new Date().toISOString(),
        source: {
          shares: SHARES_ENDPOINT,
          assetFundamentals: ASSET_FUNDAMENTALS_ENDPOINT,
        },
      };

      setCache(nextCache);
      saveCacheToStorage(nextCache);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearCache = useCallback(() => {
    setCache(emptyCache);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(FUNDAMENTALS_CACHE_KEY);
    }
  }, []);

  const value = useMemo<FundamentalsContextValue>(
    () => ({
      cache,
      isLoading,
      hasData: cache.shares.length > 0,
      loadFundamentals,
      clearCache,
    }),
    [cache, isLoading, loadFundamentals, clearCache],
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
