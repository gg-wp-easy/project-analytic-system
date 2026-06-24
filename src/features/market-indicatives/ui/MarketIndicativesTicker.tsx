import { useEffect, useMemo, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import { createTBankInstrumentsApi, type TBankCurrency, type TBankIndicative, type TBankLastPrice } from "../../../shared/api/tbank";

const CACHE_KEY = "market-indicatives-ticker-v2";
const CACHE_TTL_MS = 5 * 60 * 1000;
const MARKET_PRIORITY = ["IMOEX", "RTSI", "RGBI", "MOEXBC", "MOEXFN", "MOEXOG", "MOEXMM", "MOEXCN", "MOEXEU", "MOEXIT"];

type IndicatorGroup = "market" | "currency" | "metal";

type MarketIndicator = {
  id: string;
  ticker: string;
  label: string;
  name: string;
  group: IndicatorGroup;
  price: number;
};

type CachePayload = {
  savedAt: string;
  items: MarketIndicator[];
};

type CurrencyTarget = {
  key: string;
  label: string;
  group: Exclude<IndicatorGroup, "market">;
  aliases: string[];
};

const CURRENCY_TARGETS: CurrencyTarget[] = [
  { key: "usd", label: "USD/RUB", group: "currency", aliases: ["USD", "USDRUB", "USD000", "DOLLAR", "ДОЛЛАР"] },
  { key: "cny", label: "CNY/RUB", group: "currency", aliases: ["CNY", "CNYRUB", "YUAN", "ЮАН"] },
  { key: "eur", label: "EUR/RUB", group: "currency", aliases: ["EUR", "EURRUB", "EURO", "ЕВРО"] },
  { key: "aed", label: "AED/RUB", group: "currency", aliases: ["AED", "AEDRUB", "DIRHAM", "ДИРХАМ"] },
  { key: "gold", label: "GOLD", group: "metal", aliases: ["XAU", "GLD", "GOLD", "ЗОЛОТ"] },
  { key: "silver", label: "SILVER", group: "metal", aliases: ["XAG", "SLV", "SILVER", "СЕРЕБР"] },
];

function loadCache(): CachePayload | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as CachePayload;
    if (!Array.isArray(parsed.items) || !parsed.savedAt) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveCache(items: MarketIndicator[]): void {
  if (typeof window === "undefined" || items.length === 0) {
    return;
  }
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: new Date().toISOString(), items }));
  } catch {
    // Ignore storage failures: the marquee can still work from memory.
  }
}

function isFresh(cache: CachePayload | null): boolean {
  if (!cache) {
    return false;
  }
  const savedAtMs = Date.parse(cache.savedAt);
  return Number.isFinite(savedAtMs) && Date.now() - savedAtMs < CACHE_TTL_MS;
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

function formatPrice(value: number, locale: string): string {
  const digits = value >= 1000 ? 2 : value >= 100 ? 2 : value >= 10 ? 3 : 4;
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "ru-RU", {
    maximumFractionDigits: digits,
  }).format(value);
}

function shortName(value: string): string {
  const normalized = value.replace(/Индекс МосБиржи|Индекс Московской Биржи/gi, "MOEX").trim();
  return normalized.length > 42 ? `${normalized.slice(0, 39)}...` : normalized;
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

async function loadIndicators(): Promise<MarketIndicator[]> {
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

function dotClass(group: IndicatorGroup): string {
  if (group === "currency") {
    return "bg-emerald-500";
  }
  if (group === "metal") {
    return "bg-amber-500";
  }
  return "bg-blue-500";
}

export function MarketIndicativesTicker() {
  const { t, locale } = useAppSettings();
  const cached = useMemo(() => loadCache(), []);
  const [items, setItems] = useState<MarketIndicator[]>(() => (isFresh(cached) ? cached?.items ?? [] : []));
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isFresh(cached)) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    loadIndicators()
      .then((nextItems) => {
        if (cancelled || nextItems.length === 0) {
          return;
        }
        setItems(nextItems);
        saveCache(nextItems);
      })
      .catch(() => {
        // If market data is unavailable, keep the header clean and show nothing.
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cached]);

  const displayItems = items.length ? [...items, ...items] : [];

  if (!displayItems.length) {
    if (!isLoading) {
      return null;
    }

    return (
      <div className="border-b border-slate-200 bg-white/80 px-4 py-2 text-xs text-slate-500 backdrop-blur dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-400">
        <div className="mx-auto flex max-w-7xl items-center gap-2 sm:px-2">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          <span>{t({ ru: "Загружаем индикаторы рынков и валют", en: "Loading market and currency indicators" })}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-slate-200 bg-white/90 px-4 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex max-w-7xl items-center gap-3 sm:px-2">
        <div className="hidden shrink-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400 sm:flex">
          <Activity className="h-3.5 w-3.5 text-blue-500" />
          {t({ ru: "Рынки / валюты", en: "Markets / FX" })}
        </div>
        <div className="market-indicatives-marquee min-w-0 flex-1 overflow-hidden">
          <div className="market-indicatives-marquee-track flex w-max items-center gap-3">
            {displayItems.map((item, index) => (
              <div
                key={`${item.id}-${index}`}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                title={`${item.name} (${item.ticker})`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${dotClass(item.group)}`} />
                <span className="font-semibold text-slate-900 dark:text-slate-100">{item.label}</span>
                <span className="max-w-44 truncate">{shortName(item.name)}</span>
                <span className="font-semibold tabular-nums text-blue-700 dark:text-blue-300">{formatPrice(item.price, locale)}</span>
              </div>
            ))}
          </div>
        </div>
        {isLoading ? <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin text-slate-400" /> : null}
      </div>
    </div>
  );
}