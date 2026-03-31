import { useEffect, useMemo, useRef, useState } from "react";
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
import { AppErrorDialog } from "../../../shared/ui/app-error-dialog";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import { useFundamentals } from "../../../entities/fundamentals";
import { PageHero, SectionCard } from "../../../shared/ui/analysis-shell";
import { formatFundamentalMetricValue } from "../../../shared/lib/format/fundamentals";

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
  const { cache, error, loadClosePricesForFigi } = useFundamentals();
  const { locale } = useAppSettings();
  const isEn = locale === "en";
  const { figi } = useParams();
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [errorDialogMessage, setErrorDialogMessage] = useState<string | null>(null);
  const prevErrorRef = useRef<string | null>(null);

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

  useEffect(() => {
    if (error && error !== prevErrorRef.current) {
      setErrorDialogMessage(error);
    }
    prevErrorRef.current = error;
  }, [error]);

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
        <PageHero
          icon={TrendingUp}
          title={isEn ? "Instrument Details" : "Детали инструмента"}
          description={isEn ? "Instrument not found." : "Инструмент не найден."}
          accent="slate"
        />
        <Link to="/fundamentals" className="ui-secondary-button">
          <ArrowLeft className="h-4 w-4" />
          {isEn ? "Back to fundamentals" : "Назад к фундаментальным данным"}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHero
        icon={TrendingUp}
        title={`${share.ticker} · ${share.name}`}
        description={
          mapExchangeLabel(share.exchange, isEn)
            ? `${mapExchangeLabel(share.exchange, isEn)} · ${share.currency}`
            : undefined
        }
        aside={(
          <div className="space-y-1 text-right">
            <div className="text-xs uppercase tracking-[0.16em] text-white/65">FIGI</div>
            <div className="text-sm font-semibold text-white">{share.figi}</div>
          </div>
        )}
        accent="amber"
      />

      <div className="flex flex-wrap items-center gap-3">
        <Link to="/fundamentals" className="ui-secondary-button">
          <ArrowLeft className="h-4 w-4" />
          {isEn ? "Back" : "Назад"}
        </Link>
        <div className="ui-pill">
          <Calendar className="h-4 w-4" />
          {isEn ? "Last 12 months" : "Последние 12 месяцев"}
        </div>
        <div className="ui-pill">
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          {isLoading ? (isEn ? "Updating prices" : "Обновляем цены") : lastUpdatedLabel}
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isLoading}
          className="ui-secondary-button disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          {isEn ? "Refresh now" : "Обновить сейчас"}
        </button>
      </div>

      <SectionCard
        title={isEn ? "Close Price Trend" : "Динамика цены закрытия"}
        description={
          closePrices.length
            ? `${isEn ? "Data points" : "Точек"}: ${closePrices.length}`
            : isEn
              ? "No data yet"
              : "Данных пока нет"
        }
        action={(
          <div className="text-right">
            <div className="text-xs text-slate-500 dark:text-slate-400">{isEn ? "Last close" : "Последнее закрытие"}</div>
            <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {closePrices.length ? formatPrice(closePrices[closePrices.length - 1].price) : "-"}
            </div>
          </div>
        )}
      >
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
            <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
              {isEn ? "Close prices are loading or unavailable." : "Цены закрытия загружаются или недоступны."}
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title={isEn ? "Fundamental Metrics" : "Фундаментальные метрики"}
        action={(
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {fundamentals?.updatedAt
              ? `${isEn ? "Updated" : "Обновлено"}: ${new Date(fundamentals.updatedAt).toLocaleDateString()}`
              : isEn
                ? "Updated: -"
                : "Обновлено: -"}
          </div>
        )}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 p-4 shadow-sm">
            <div className="text-xs text-slate-500 dark:text-slate-400">{isEn ? "Market Cap, bn" : "Капитализация, млрд"}</div>
            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatFundamentalMetricValue("marketCapBn", fundamentals?.marketCapBn, locale)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/40 dark:to-slate-950 p-4 shadow-sm">
            <div className="text-xs text-slate-500 dark:text-slate-400">P/E</div>
            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatFundamentalMetricValue("peRatio", fundamentals?.peRatio, locale)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-orange-50 to-white dark:from-orange-950/40 dark:to-slate-950 p-4 shadow-sm">
            <div className="text-xs text-slate-500 dark:text-slate-400">P/B</div>
            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatFundamentalMetricValue("pbRatio", fundamentals?.pbRatio, locale)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-rose-50 to-white dark:from-rose-950/40 dark:to-slate-950 p-4 shadow-sm">
            <div className="text-xs text-slate-500 dark:text-slate-400">P/S</div>
            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatFundamentalMetricValue("psRatio", fundamentals?.psRatio, locale)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/40 dark:to-slate-950 p-4 shadow-sm">
            <div className="text-xs text-slate-500 dark:text-slate-400">EV/EBITDA</div>
            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatFundamentalMetricValue("evToEbitda", fundamentals?.evToEbitda, locale)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-sky-50 to-white dark:from-sky-950/40 dark:to-slate-950 p-4 shadow-sm">
            <div className="text-xs text-slate-500 dark:text-slate-400">ROE</div>
            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatFundamentalMetricValue("roe", fundamentals?.roe, locale)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/40 dark:to-slate-950 p-4 shadow-sm">
            <div className="text-xs text-slate-500 dark:text-slate-400">ROA</div>
            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatFundamentalMetricValue("roa", fundamentals?.roa, locale)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-lime-50 to-white dark:from-lime-950/40 dark:to-slate-950 p-4 shadow-sm">
            <div className="text-xs text-slate-500 dark:text-slate-400">{isEn ? "Net Margin" : "Маржа"}</div>
            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatFundamentalMetricValue("netMargin", fundamentals?.netMargin, locale)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-teal-50 to-white dark:from-teal-950/40 dark:to-slate-950 p-4 shadow-sm">
            <div className="text-xs text-slate-500 dark:text-slate-400">{isEn ? "Net Debt/EBITDA" : "Чистый долг/EBITDA"}</div>
            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatFundamentalMetricValue("netDebtToEbitda", fundamentals?.netDebtToEbitda, locale)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 p-4 shadow-sm">
            <div className="text-xs text-slate-500 dark:text-slate-400">{isEn ? "Total Debt" : "Общий долг"}</div>
            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatFundamentalMetricValue("totalDebt", fundamentals?.totalDebt, locale)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/40 dark:to-slate-950 p-4 shadow-sm">
            <div className="text-xs text-slate-500 dark:text-slate-400">{isEn ? "Dividend Yield" : "Див. доходность"}</div>
            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatFundamentalMetricValue("dividendYield", fundamentals?.dividendYield, locale)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/40 dark:to-slate-950 p-4 shadow-sm">
            <div className="text-xs text-slate-500 dark:text-slate-400">Beta</div>
            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatFundamentalMetricValue("beta", fundamentals?.beta, locale)}</div>
          </div>
        </div>
      </SectionCard>
      <AppErrorDialog
        message={errorDialogMessage}
        onClose={() => setErrorDialogMessage(null)}
        title={isEn ? "Data Loading Error" : "Ошибка загрузки данных"}
        description={
          isEn
            ? "The application could not load data from the API."
            : "Приложение не смогло загрузить данные из API."
        }
        closeLabel={isEn ? "Close" : "Закрыть"}
      />
    </div>
  );
}
