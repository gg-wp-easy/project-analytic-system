import {
  EMPTY_FUNDAMENTALS_CACHE,
  FUNDAMENTALS_ASSET_FUNDAMENTALS_ENDPOINT,
  FUNDAMENTALS_CACHE_KEY,
  FUNDAMENTALS_CLOSE_PRICES_ENDPOINT,
  FUNDAMENTALS_SHARES_ENDPOINT,
} from "../model/fundamentals.consts";
import type { AssetFundamentalRecord, FundamentalsCache, ShareRecord } from "../model/fundamentals.types";

export function loadFundamentalsCacheFromStorage(): FundamentalsCache {
  if (typeof window === "undefined") {
    return EMPTY_FUNDAMENTALS_CACHE;
  }

  const raw = window.localStorage.getItem(FUNDAMENTALS_CACHE_KEY);
  if (!raw) {
    return EMPTY_FUNDAMENTALS_CACHE;
  }

  try {
    const parsed = JSON.parse(raw) as FundamentalsCache;
    if (!Array.isArray(parsed.shares) || !parsed.fundamentalsByFigi) {
      return EMPTY_FUNDAMENTALS_CACHE;
    }
    const fundamentalsByFigi = parsed.fundamentalsByFigi ?? {};
    return {
      ...parsed,
      shares: sortSharesByMarketCap(parsed.shares, fundamentalsByFigi),
      fundamentalsByFigi,
      closePricesByFigi: parsed.closePricesByFigi ?? {},
      closePricesMetaByFigi: parsed.closePricesMetaByFigi ?? {},
      source: {
        shares: parsed.source?.shares ?? FUNDAMENTALS_SHARES_ENDPOINT,
        assetFundamentals: parsed.source?.assetFundamentals ?? FUNDAMENTALS_ASSET_FUNDAMENTALS_ENDPOINT,
        closePrices: parsed.source?.closePrices ?? FUNDAMENTALS_CLOSE_PRICES_ENDPOINT,
      },
    };
  } catch {
    return EMPTY_FUNDAMENTALS_CACHE;
  }
}

export function sortSharesByMarketCap(
  shares: ShareRecord[],
  fundamentalsByFigi: Record<string, AssetFundamentalRecord>,
): ShareRecord[] {
  return [...shares].sort((left, right) => {
    const leftValue = fundamentalsByFigi[left.figi]?.marketCapBn;
    const rightValue = fundamentalsByFigi[right.figi]?.marketCapBn;
    const leftValid = typeof leftValue === "number" && Number.isFinite(leftValue);
    const rightValid = typeof rightValue === "number" && Number.isFinite(rightValue);

    if (!leftValid && !rightValid) {
      return left.ticker.localeCompare(right.ticker);
    }
    if (!leftValid) {
      return 1;
    }
    if (!rightValid) {
      return -1;
    }
    return rightValue - leftValue || left.ticker.localeCompare(right.ticker);
  });
}

export function saveFundamentalsCacheToStorage(cache: FundamentalsCache): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(FUNDAMENTALS_CACHE_KEY, JSON.stringify(cache));
}
