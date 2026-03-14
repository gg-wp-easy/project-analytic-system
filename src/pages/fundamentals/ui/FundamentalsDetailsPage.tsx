import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Calendar, RefreshCw, TrendingUp } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import { useFundamentals } from "../../../entities/fundamentals";

function mapExchangeLabel(raw: string, isEn: boolean): string {
  const code = raw?.toLowerCase?.() ?? "";
  if (code === "moex" || code.startsWith("moex_")) {
    return isEn ? "Moscow Exchange" : "Московская биржа";
  }
  if (code === "spb" || code === "spbex" || code === "spbx") {
    return isEn ? "Saint Petersburg Exchange" : "Санкт-Петербургская биржа";
  }
  return "";
}

function formatPrice(value: number): string {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return value.toFixed(2);
}

export function FundamentalsDetailsPage() {
  const { cache, loadClosePricesForFigi } = useFundamentals();
  const { locale } = useAppSettings();
  const isEn = locale === "en";
  const { figi } = useParams();
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const share = useMemo(
    () => cache.shares.find((item) => item.figi === figi) ?? null,
    [cache.shares, figi],
  );

  const fundamentals = share ? cache.fundamentalsByFigi[share.figi] ?? null : null;

  const closePrices = useMemo(() => {
    if (!share) {
      return [];
    }
    const rows = cache.closePricesByFigi[share.figi] ?? [];
    return [...rows].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }, [cache.closePricesByFigi, share]);

  useEffect(() => {
    if (!share?.figi) {
      return;
    }
    let active = true;
    setIsLoading(true);
    loadClosePricesForFigi(share.figi)
      .catch(() => null)
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [loadClosePricesForFigi, share?.figi]);

  useEffect(() => {
    if (!share?.figi) {
      setLastUpdated(null);
      return;
    }
    const meta = cache.closePricesMetaByFigi?.[share.figi];
    setLastUpdated(meta?.lastUpdated ?? null);
  }, [cache.closePricesMetaByFigi, share?.figi]);

  const handleRefresh = async () => {
    if (!share?.figi) {
      return;
    }
    setIsLoading(true);
    try {
      await loadClosePricesForFigi(share.figi, true);
    } finally {
      setIsLoading(false);
    }
  };

  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdated) {
      return isEn ? "Not updated yet" : "Еще не обновлялось";
    }
    const diffMs = Date.now() - new Date(lastUpdated).getTime();
    if (!Number.isFinite(diffMs) || diffMs < 0) {
      return isEn ? "Just now" : "Только что";
    }
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) {
      return isEn ? "Just now" : "Только что";
    }
    if (minutes < 60) {
      return isEn ? `Updated ${minutes} min ago` : `Обновлено ${minutes} мин назад`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return isEn ? `Updated ${hours} h ago` : `Обновлено ${hours} ч назад`;
    }
    const days = Math.floor(hours / 24);
    return isEn ? `Updated ${days} d ago` : `Обновлено ${days} д назад`;
  }, [isEn, lastUpdated]);

  if (!share) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-slate-800 to-slate-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-8 h-8" />
            <h1 className="text-3xl font-bold">{isEn ? "Instrument Details" : "Детали инструмента"}</h1>
          </div>
          <p className="text-slate-200">{isEn ? "Instrument not found." : "Инструмент не найден."}</p>
        </div>
        <Link
          to="/fundamentals"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          {isEn ? "Back to fundamentals" : "Назад к фундаментальным данным"}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-amber-600 via-orange-500 to-rose-500 dark:from-amber-700 dark:via-orange-600 dark:to-rose-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              {share.ticker} · {share.name}
            </h1>
            {mapExchangeLabel(share.exchange, isEn) && (
              <p className="text-orange-100 mt-1">
                {mapExchangeLabel(share.exchange, isEn)} · {share.currency}
              </p>
            )}
          </div>
          <div className="text-right">
            <div className="text-sm text-orange-100">{isEn ? "FIGI" : "FIGI"}</div>
            <div className="text-sm font-semibold">{share.figi}</div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/fundamentals"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="w-4 h-4" />
          {isEn ? "Back" : "Назад"}
        </Link>
        <div className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <Calendar className="w-4 h-4" />
          {isEn ? "Last 12 months" : "Последние 12 месяцев"}
        </div>
        <div className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          {isLoading ? (isEn ? "Updating prices" : "Обновляем цены") : lastUpdatedLabel}
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          {isEn ? "Refresh now" : "Обновить сейчас"}
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {isEn ? "Close Price Trend" : "Динамика цен закрытия"}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {closePrices.length
                ? `${isEn ? "Data points" : "Точек"}: ${closePrices.length}`
                : isEn
                  ? "No data yet"
                  : "Данных пока нет"}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500 dark:text-slate-400">{isEn ? "Last close" : "Последнее закрытие"}</div>
            <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {closePrices.length ? formatPrice(closePrices[closePrices.length - 1].price) : "-"}
            </div>
          </div>
        </div>

        <div className="h-80 px-2 pb-4">
          {closePrices.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={closePrices} margin={{ top: 10, right: 24, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#fb923c" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#fb923c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="time"
                  stroke="#64748b"
                  tickFormatter={(value) => new Date(value as string).toLocaleDateString()}
                />
                <YAxis stroke="#64748b" domain={["auto", "auto"]} />
                <Tooltip
                  formatter={(value: number) => formatPrice(value)}
                  labelFormatter={(label) => new Date(label as string).toLocaleString()}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="#f97316"
                  strokeWidth={2}
                  fill="url(#priceFill)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-slate-500 dark:text-slate-400">
              {isEn ? "Close prices are loading or unavailable." : "Цены закрытия загружаются или недоступны."}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {isEn ? "Fundamental Metrics" : "Фундаментальные метрики"}
          </h2>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {fundamentals?.updatedAt
              ? `${isEn ? "Updated" : "Обновлено"}: ${new Date(fundamentals.updatedAt).toLocaleDateString()}`
              : isEn
                ? "Updated: -"
                : "Обновлено: -"}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 p-4 shadow-sm">
            <div className="text-xs text-slate-500 dark:text-slate-400">{isEn ? "Market Cap, bn" : "Капитализация, млрд"}</div>
            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{fundamentals?.marketCapBn ?? "-"}</div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/40 dark:to-slate-950 p-4 shadow-sm">
            <div className="text-xs text-slate-500 dark:text-slate-400">P/E</div>
            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{fundamentals?.peRatio ?? "-"}</div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-orange-50 to-white dark:from-orange-950/40 dark:to-slate-950 p-4 shadow-sm">
            <div className="text-xs text-slate-500 dark:text-slate-400">P/B</div>
            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{fundamentals?.pbRatio ?? "-"}</div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-rose-50 to-white dark:from-rose-950/40 dark:to-slate-950 p-4 shadow-sm">
            <div className="text-xs text-slate-500 dark:text-slate-400">P/S</div>
            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{fundamentals?.psRatio ?? "-"}</div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/40 dark:to-slate-950 p-4 shadow-sm">
            <div className="text-xs text-slate-500 dark:text-slate-400">EV/EBITDA</div>
            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{fundamentals?.evToEbitda ?? "-"}</div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-sky-50 to-white dark:from-sky-950/40 dark:to-slate-950 p-4 shadow-sm">
            <div className="text-xs text-slate-500 dark:text-slate-400">ROE</div>
            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{fundamentals?.roe ?? "-"}</div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/40 dark:to-slate-950 p-4 shadow-sm">
            <div className="text-xs text-slate-500 dark:text-slate-400">ROA</div>
            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{fundamentals?.roa ?? "-"}</div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-lime-50 to-white dark:from-lime-950/40 dark:to-slate-950 p-4 shadow-sm">
            <div className="text-xs text-slate-500 dark:text-slate-400">{isEn ? "Net Margin" : "Маржа"}</div>
            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{fundamentals?.netMargin ?? "-"}%</div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-teal-50 to-white dark:from-teal-950/40 dark:to-slate-950 p-4 shadow-sm">
            <div className="text-xs text-slate-500 dark:text-slate-400">{isEn ? "Net Debt/EBITDA" : "Чистый долг/EBITDA"}</div>
            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{fundamentals?.netDebtToEbitda ?? "-"}</div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 p-4 shadow-sm">
            <div className="text-xs text-slate-500 dark:text-slate-400">{isEn ? "Total Debt" : "Общий долг"}</div>
            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{fundamentals?.totalDebt ?? "-"}</div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/40 dark:to-slate-950 p-4 shadow-sm">
            <div className="text-xs text-slate-500 dark:text-slate-400">{isEn ? "Dividend Yield" : "Див. доходность"}</div>
            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{fundamentals?.dividendYield ?? "-"}%</div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/40 dark:to-slate-950 p-4 shadow-sm">
            <div className="text-xs text-slate-500 dark:text-slate-400">Beta</div>
            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{fundamentals?.beta ?? "-"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
