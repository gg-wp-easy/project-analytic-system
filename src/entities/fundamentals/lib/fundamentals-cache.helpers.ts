import {
  EMPTY_FUNDAMENTALS_CACHE,
  FUNDAMENTALS_ASSET_FUNDAMENTALS_ENDPOINT,
  FUNDAMENTALS_CACHE_KEY,
  FUNDAMENTALS_CLOSE_PRICES_ENDPOINT,
  FUNDAMENTALS_SHARES_ENDPOINT,
} from "../model/fundamentals.consts";
import type {
  AssetFundamentalRecord,
  DividendHistorySummary,
  FundamentalsCache,
  ShareRecord,
} from "../model/fundamentals.types";
import type { TBankDividend } from "../../../shared/api/tbank";

export function summarizeDividendHistory(
  events: TBankDividend[] | undefined,
  referenceDate = new Date(),
): DividendHistorySummary {
  if (!events) {
    return {
      dividendYearsCount: 0,
      consecutiveDividendYears: 0,
      dividendConsistency: 0,
      lastDividendYear: undefined,
      dividendPaymentsCount: 0,
      dividendHistoryAvailable: false,
    };
  }

  const currentYear = referenceDate.getUTCFullYear();
  const firstYear = currentYear - 5;
  const paidEvents = events.filter((event) => {
    const recordDate = new Date(event.recordDate);
    const type = event.dividendType.trim().toLowerCase();
    return (
      Number.isFinite(recordDate.getTime()) &&
      recordDate <= referenceDate &&
      recordDate.getUTCFullYear() >= firstYear &&
      event.dividendNet > 0 &&
      !type.includes("cancel")
    );
  });
  const paidYears = new Set(paidEvents.map((event) => new Date(event.recordDate).getUTCFullYear()));
  const completedYears = Array.from({ length: 5 }, (_, index) => firstYear + index);
  const dividendYearsCount = completedYears.filter((year) => paidYears.has(year)).length;
  let consecutiveDividendYears = 0;
  for (let year = currentYear - 1; year >= firstYear; year -= 1) {
    if (!paidYears.has(year)) {
      break;
    }
    consecutiveDividendYears += 1;
  }

  return {
    dividendYearsCount,
    consecutiveDividendYears,
    dividendConsistency: dividendYearsCount / completedYears.length,
    lastDividendYear: paidYears.size ? Math.max(...paidYears) : undefined,
    dividendPaymentsCount: paidEvents.length,
    dividendHistoryAvailable: true,
  };
}

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
