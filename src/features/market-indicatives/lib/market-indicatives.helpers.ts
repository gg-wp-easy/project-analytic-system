import {
  createTBankInstrumentsApi,
  type TBankCurrency,
  type TBankIndicative,
  type TBankLastPrice,
} from "../../../shared/api/tbank";
import {
  CURRENCY_TARGETS,
  MARKET_INDICATIVES_CACHE_KEY,
  MARKET_INDICATIVES_CACHE_TTL_MS,
  MARKET_PRIORITY,
} from "../model/market-indicatives.consts";
import type {
  CurrencyTarget,
  IndicatorGroup,
  MarketIndicativesCachePayload,
  MarketIndicator,
} from "../model/market-indicatives.types";

export function loadMarketIndicativesCache(): MarketIndicativesCachePayload | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(MARKET_INDICATIVES_CACHE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as MarketIndicativesCachePayload;
    if (!Array.isArray(parsed.items) || !parsed.savedAt) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveMarketIndicativesCache(items: MarketIndicator[]): void {
  if (typeof window === "undefined" || items.length === 0) {
    return;
  }
  try {
    window.localStorage.setItem(
      MARKET_INDICATIVES_CACHE_KEY,
      JSON.stringify({ savedAt: new Date().toISOString(), items }),
    );
  } catch {
    // Ignore storage failures: the marquee can still work from memory.
  }
}

export function isMarketIndicativesCacheFresh(cache: MarketIndicativesCachePayload | null): boolean {
  if (!cache) {
    return false;
  }
  const savedAtMs = Date.parse(cache.savedAt);
  return Number.isFinite(savedAtMs) && Date.now() - savedAtMs < MARKET_INDICATIVES_CACHE_TTL_MS;
}

export function formatMarketIndicativePrice(value: number, locale: string): string {
  const digits = value >= 1000 ? 2 : value >= 100 ? 2 : value >= 10 ? 3 : 4;
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "ru-RU", {
    maximumFractionDigits: digits,
  }).format(value);
}

export function shortMarketIndicativeName(value: string): string {
  const normalized = value.replace(/Индекс МосБиржи|Индекс Московской Биржи/gi, "MOEX").trim();
  return normalized.length > 42 ? `${normalized.slice(0, 39)}...` : normalized;
}

export function getMarketIndicativeDotClass(group: IndicatorGroup): string {
  if (group === "currency") {
    return "bg-emerald-500";
  }
  if (group === "metal") {
    return "bg-amber-500";
  }
  return "bg-blue-500";
}

export async function loadMarketIndicators(): Promise<MarketIndicator[]> {
  const api = createTBankInstrumentsApi();
  const [indicativesResult, currenciesResult] = await Promise.allSettled([
    api.fetchIndicatives(),
    api.fetchCurrencies(),
  ]);

  const indicatives = indicativesResult.status === "fulfilled" ? pickIndicatives(indicativesResult.value) : [];
  const currencies = currenciesResult.status === "fulfilled" ? pickCurrencies(currenciesResult.value) : [];
  const instrumentIds = [
    ...new Set(
      [
        ...indicatives.flatMap((item) => [item.uid, item.figi]),
        ...currencies.flatMap(({ item }) => [item.uid, item.figi]),
      ]
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];

  if (instrumentIds.length === 0) {
    return [];
  }

  const prices = await api.fetchLastPricesByInstrumentIds(instrumentIds).catch(() => []);
  const priceById = priceMapFromLastPrices(prices);

  const marketItems = indicatives.flatMap((item) => {
    const price = priceById.get(item.uid) ?? priceById.get(item.figi) ?? 0;
    if (!Number.isFinite(price) || price <= 0) {
      return [];
    }
    return [{
      id: item.uid || item.figi || item.ticker,
      ticker: item.ticker,
      label: item.ticker,
      name: item.name || item.ticker,
      group: "market" as const,
      price,
    }];
  });

  const currencyItems = currencies.flatMap(({ item, target }) => {
    const price = priceById.get(item.uid) ?? priceById.get(item.figi) ?? 0;
    if (!Number.isFinite(price) || price <= 0) {
      return [];
    }
    return [{
      id: target.key,
      ticker: item.ticker,
      label: target.label,
      name: item.name || item.ticker,
      group: target.group,
      price,
    }];
  });

  return [...marketItems, ...currencyItems];
}

function compactTicker(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

function makeSearchText(value: TBankCurrency): string {
  return [value.ticker, value.name, value.isoCurrencyName, value.currency, value.classCode]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();
}

function classifyIndicative(item: TBankIndicative): "market" | null {
  const ticker = compactTicker(item.ticker);
  const name = item.name.toLowerCase();
  const kind = item.instrumentKind.toLowerCase();

  if (
    MARKET_PRIORITY.includes(ticker) ||
    kind.includes("index") ||
    /(индекс|index|moex|мосбирж|ртс|rgbi)/i.test(name)
  ) {
    return "market";
  }

  return null;
}

function priorityIndex(item: TBankIndicative): number {
  const ticker = compactTicker(item.ticker);
  const index = MARKET_PRIORITY.indexOf(ticker);
  return index === -1 ? 1000 : index;
}

function pickIndicatives(items: TBankIndicative[]): TBankIndicative[] {
  return items
    .filter((item) => classifyIndicative(item) === "market")
    .sort((left, right) => {
      const byPriority = priorityIndex(left) - priorityIndex(right);
      if (byPriority !== 0) {
        return byPriority;
      }
      return left.ticker.localeCompare(right.ticker, "ru");
    })
    .filter((item, index, source) => source.findIndex((candidate) => compactTicker(candidate.ticker) === compactTicker(item.ticker)) === index)
    .slice(0, 8);
}

function targetMatchesCurrency(item: TBankCurrency, target: CurrencyTarget): boolean {
  const text = makeSearchText(item);
  return target.aliases.some((alias) => text.includes(alias.toUpperCase()));
}

function scoreCurrency(item: TBankCurrency, target: CurrencyTarget): number {
  const ticker = compactTicker(item.ticker);
  const text = makeSearchText(item);
  let score = 0;

  if (ticker.includes("RUB")) {
    score += 30;
  }
  if (ticker.startsWith(target.aliases[0])) {
    score += 24;
  }
  if (text.includes(`${target.aliases[0]}RUB`)) {
    score += 18;
  }
  if (item.currency.toUpperCase() === "RUB") {
    score += 12;
  }
  if (item.buyAvailableFlag || item.sellAvailableFlag || item.apiTradeAvailableFlag) {
    score += 8;
  }
  if (item.otcFlag !== true) {
    score += 3;
  }
  if (item.lot === 1) {
    score += 2;
  }

  return score;
}

function pickCurrencies(items: TBankCurrency[]): Array<{ item: TBankCurrency; target: CurrencyTarget }> {
  return CURRENCY_TARGETS.flatMap((target) => {
    const item = items
      .filter((currency) => targetMatchesCurrency(currency, target))
      .sort((left, right) => scoreCurrency(right, target) - scoreCurrency(left, target))[0];

    return item ? [{ item, target }] : [];
  });
}

function priceMapFromLastPrices(prices: TBankLastPrice[]): Map<string, number> {
  const priceById = new Map<string, number>();

  prices.forEach((price) => {
    [price.instrumentUid, price.figi, price.instrumentId].forEach((id) => {
      if (id && Number.isFinite(price.price) && price.price > 0) {
        priceById.set(id, price.price);
      }
    });
  });

  return priceById;
}
