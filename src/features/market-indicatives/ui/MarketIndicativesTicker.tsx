import { useEffect, useMemo, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import {
  formatMarketIndicativePrice,
  getMarketIndicativeDotClass,
  isMarketIndicativesCacheFresh,
  loadMarketIndicators,
  loadMarketIndicativesCache,
  saveMarketIndicativesCache,
  shortMarketIndicativeName,
} from "../lib";
import type { MarketIndicator } from "../model";

export function MarketIndicativesTicker() {
  const { t, locale } = useAppSettings();
  const cached = useMemo(() => loadMarketIndicativesCache(), []);
  const [items, setItems] = useState<MarketIndicator[]>(() => (isMarketIndicativesCacheFresh(cached) ? cached?.items ?? [] : []));
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isMarketIndicativesCacheFresh(cached)) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    loadMarketIndicators()
      .then((nextItems) => {
        if (cancelled || nextItems.length === 0) {
          return;
        }
        setItems(nextItems);
        saveMarketIndicativesCache(nextItems);
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
                <span className={`h-1.5 w-1.5 rounded-full ${getMarketIndicativeDotClass(item.group)}`} />
                <span className="font-semibold text-slate-900 dark:text-slate-100">{item.label}</span>
                <span className="max-w-44 truncate">{shortMarketIndicativeName(item.name)}</span>
                <span className="font-semibold tabular-nums text-blue-700 dark:text-blue-300">{formatMarketIndicativePrice(item.price, locale)}</span>
              </div>
            ))}
          </div>
        </div>
        {isLoading ? <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin text-slate-400" /> : null}
      </div>
    </div>
  );
}
