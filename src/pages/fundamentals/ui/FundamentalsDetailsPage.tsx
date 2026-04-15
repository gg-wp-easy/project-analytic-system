import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, BarChart3, Calendar, RefreshCw, TrendingUp } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import { useFundamentals, type AssetFundamentalRecord, type ShareRecord } from "../../../entities/fundamentals";
import { createTBankInstrumentsApi, type TBankCandle } from "../../../shared/api/tbank";
import { formatFundamentalMetricValue } from "../../../shared/lib/format/fundamentals";
import { AppErrorDialog } from "../../../shared/ui/app-error-dialog";
import { MetricCard, MetricGrid, PageHero, SectionCard } from "../../../shared/ui/analysis-shell";
import { FundamentalMetricLabel } from "../../../shared/ui/fundamentals/FundamentalMetricLabel";

type ChartRange = "1D" | "1W" | "1M" | "1Y";
type ChartMode = "line" | "candles";
type PriceCandle = TBankCandle;
type CandleBucket = "raw" | "day" | "week";

type RangeConfig = {
  from: (to: Date) => Date;
  interval: string;
  limit: number;
  candleBucket: CandleBucket;
};

const RANGE_CONFIG: Record<ChartRange, RangeConfig> = {
  "1D": {
    from: (to) => {
      const from = new Date(to);
      from.setDate(from.getDate() - 1);
      return from;
    },
    interval: "CANDLE_INTERVAL_HOUR",
    limit: 48,
    candleBucket: "raw",
  },
  "1W": {
    from: (to) => {
      const from = new Date(to);
      from.setDate(from.getDate() - 7);
      return from;
    },
    interval: "CANDLE_INTERVAL_HOUR",
    limit: 240,
    candleBucket: "day",
  },
  "1M": {
    from: (to) => {
      const from = new Date(to);
      from.setMonth(from.getMonth() - 1);
      return from;
    },
    interval: "CANDLE_INTERVAL_DAY",
    limit: 45,
    candleBucket: "week",
  },
  "1Y": {
    from: (to) => {
      const from = new Date(to);
      from.setFullYear(from.getFullYear() - 1);
      return from;
    },
    interval: "CANDLE_INTERVAL_DAY",
    limit: 400,
    candleBucket: "raw",
  },
};

const RANGE_ORDER: ChartRange[] = ["1D", "1W", "1M", "1Y"];

const METRIC_ITEMS: Array<{
  key: keyof AssetFundamentalRecord;
  metric:
    | "marketCapBn"
    | "peRatio"
    | "pbRatio"
    | "psRatio"
    | "evToEbitda"
    | "roe"
    | "roa"
    | "netMargin"
    | "netDebtToEbitda"
    | "totalDebt"
    | "dividendYield"
    | "beta";
  labelRu: string;
  labelEn: string;
}> = [
  { key: "marketCapBn", metric: "marketCapBn", labelRu: "Капитализация, млрд", labelEn: "Market Cap, bn" },
  { key: "peRatio", metric: "peRatio", labelRu: "P/E", labelEn: "P/E" },
  { key: "pbRatio", metric: "pbRatio", labelRu: "P/B", labelEn: "P/B" },
  { key: "psRatio", metric: "psRatio", labelRu: "P/S", labelEn: "P/S" },
  { key: "evToEbitda", metric: "evToEbitda", labelRu: "EV/EBITDA", labelEn: "EV/EBITDA" },
  { key: "roe", metric: "roe", labelRu: "ROE", labelEn: "ROE" },
  { key: "roa", metric: "roa", labelRu: "ROA", labelEn: "ROA" },
  { key: "netMargin", metric: "netMargin", labelRu: "Чистая маржа", labelEn: "Net Margin" },
  {
    key: "netDebtToEbitda",
    metric: "netDebtToEbitda",
    labelRu: "Чистый долг / EBITDA",
    labelEn: "Net Debt / EBITDA",
  },
  { key: "totalDebt", metric: "totalDebt", labelRu: "Общий долг, млрд", labelEn: "Total Debt, bn" },
  { key: "dividendYield", metric: "dividendYield", labelRu: "Див. доходность", labelEn: "Dividend Yield" },
  { key: "beta", metric: "beta", labelRu: "Бета", labelEn: "Beta" },
];

function getLocaleCode(locale: "ru" | "en"): string {
  return locale === "en" ? "en-US" : "ru-RU";
}

function formatPriceValue(value: number | null | undefined, currency: string, locale: "ru" | "en"): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }

  const localeCode = getLocaleCode(locale);
  try {
    return new Intl.NumberFormat(localeCode, {
      style: "currency",
      currency: currency || "RUB",
      minimumFractionDigits: value >= 1000 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return new Intl.NumberFormat(localeCode, {
      minimumFractionDigits: value >= 1000 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
}

function formatSignedPriceValue(value: number, currency: string, locale: "ru" | "en"): string {
  if (!Number.isFinite(value)) {
    return "-";
  }
  const abs = formatPriceValue(Math.abs(value), currency, locale);
  if (value > 0) {
    return `+${abs}`;
  }
  if (value < 0) {
    return `-${abs}`;
  }
  return abs;
}

function formatPercent(value: number | null | undefined, locale: "ru" | "en", withSign = false): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }
  const prefix = withSign && value > 0 ? "+" : "";
  return `${prefix}${new Intl.NumberFormat(getLocaleCode(locale), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}%`;
}

function formatDateLabel(value: string, range: ChartRange, locale: "ru" | "en"): string {
  const date = new Date(value);
  const formatter =
    range === "1D"
      ? new Intl.DateTimeFormat(getLocaleCode(locale), { hour: "2-digit", minute: "2-digit" })
      : new Intl.DateTimeFormat(getLocaleCode(locale), {
          day: "2-digit",
          month: range === "1Y" ? "short" : "2-digit",
        });
  return formatter.format(date);
}

function formatDateTime(value: string, locale: "ru" | "en"): string {
  return new Intl.DateTimeFormat(getLocaleCode(locale), {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getRangeLabel(range: ChartRange, isEn: boolean): string {
  switch (range) {
    case "1D":
      return isEn ? "1 day" : "1 день";
    case "1W":
      return isEn ? "1 week" : "1 неделя";
    case "1M":
      return isEn ? "1 month" : "1 месяц";
    case "1Y":
      return isEn ? "1 year" : "1 год";
    default:
      return range;
  }
}

function mapExchangeLabel(raw: string, isEn: boolean): string {
  if (!raw) {
    return isEn ? "Exchange not specified" : "Биржа не указана";
  }

  const normalized = raw.trim().toUpperCase();
  if (normalized.includes("MOEX") || normalized.includes("TQBR")) {
    return isEn ? "Moscow Exchange" : "Московская биржа";
  }
  return raw.replaceAll("_", " ");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeCandles(rows: PriceCandle[]): PriceCandle[] {
  return [...rows]
    .filter((item) =>
      [item.open, item.high, item.low, item.close].every((value) => Number.isFinite(value)) && Boolean(item.time),
    )
    .sort((left, right) => new Date(left.time).getTime() - new Date(right.time).getTime());
}

function getBucketTimestamp(date: Date, bucket: CandleBucket): number {
  if (bucket === "raw") {
    return date.getTime();
  }

  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);

  if (bucket === "week") {
    const dayIndex = normalized.getDay();
    const offset = (dayIndex + 6) % 7;
    normalized.setDate(normalized.getDate() - offset);
  }

  return normalized.getTime();
}

function aggregateCandles(rows: PriceCandle[], bucket: CandleBucket): PriceCandle[] {
  if (bucket === "raw") {
    return normalizeCandles(rows);
  }

  const normalized = normalizeCandles(rows);
  if (normalized.length === 0) {
    return [];
  }

  const grouped = new Map<number, PriceCandle[]>();
  for (const candle of normalized) {
    const bucketTs = getBucketTimestamp(new Date(candle.time), bucket);
    const existing = grouped.get(bucketTs);
    if (existing) {
      existing.push(candle);
    } else {
      grouped.set(bucketTs, [candle]);
    }
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left - right)
    .map(([bucketTs, items]) => {
      const first = items[0];
      const last = items[items.length - 1];
      return {
        figi: first.figi,
        time: new Date(bucketTs).toISOString(),
        open: first.open,
        close: last.close,
        high: items.reduce((acc, item) => Math.max(acc, item.high), first.high),
        low: items.reduce((acc, item) => Math.min(acc, item.low), first.low),
        volume: items.reduce((acc, item) => acc + (Number.isFinite(item.volume) ? item.volume : 0), 0),
      };
    });
}

function computePriceSummary(history: PriceCandle[]) {
  if (history.length === 0) {
    return null;
  }

  const first = history[0];
  const last = history[history.length - 1];
  const reference = first.close || first.open || 0;
  const absoluteChange = last.close - reference;
  const percentChange = reference ? (absoluteChange / reference) * 100 : 0;
  const high = history.reduce((acc, item) => Math.max(acc, item.high), history[0].high);
  const low = history.reduce((acc, item) => Math.min(acc, item.low), history[0].low);
  const volume = history.reduce((acc, item) => acc + (Number.isFinite(item.volume) ? item.volume : 0), 0);

  return {
    current: last.close,
    absoluteChange,
    percentChange,
    high,
    low,
    volume,
    updatedAt: last.time,
  };
}

function useElementWidth() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }

    const update = () => setWidth(node.clientWidth);
    update();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }

    const observer = new ResizeObserver(() => update());
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

function HistoryTooltip({
  active,
  payload,
  currency,
  locale,
  range,
  isEn,
}: {
  active?: boolean;
  payload?: Array<{ payload: PriceCandle }>;
  currency: string;
  locale: "ru" | "en";
  range: ChartRange;
  isEn: boolean;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const candle = payload[0]?.payload;
  if (!candle) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white/95 px-4 py-3 text-sm shadow-xl dark:border-slate-700 dark:bg-slate-950/95">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
        {range === "1D" || range === "1W" ? formatDateTime(candle.time, locale) : formatDateLabel(candle.time, range, locale)}
      </div>
      <div className="space-y-1 text-slate-700 dark:text-slate-200">
        <div>{isEn ? "Close" : "Закрытие"}: {formatPriceValue(candle.close, currency, locale)}</div>
        <div>{isEn ? "Open" : "Открытие"}: {formatPriceValue(candle.open, currency, locale)}</div>
        <div>{isEn ? "High" : "Максимум"}: {formatPriceValue(candle.high, currency, locale)}</div>
        <div>{isEn ? "Low" : "Минимум"}: {formatPriceValue(candle.low, currency, locale)}</div>
      </div>
    </div>
  );
}

function CandlestickChart({
  data,
  currency,
  locale,
  range,
  isEn,
}: {
  data: PriceCandle[];
  currency: string;
  locale: "ru" | "en";
  range: ChartRange;
  isEn: boolean;
}) {
  const { ref, width } = useElementWidth();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const activeCandle = data[hoveredIndex ?? data.length - 1] ?? null;
  const height = 336;
  const marginTop = 14;
  const marginRight = 18;
  const marginBottom = 32;
  const marginLeft = 56;
  const plotWidth = Math.max(width - marginLeft - marginRight, 1);
  const plotHeight = Math.max(height - marginTop - marginBottom, 1);

  const { minPrice, maxPrice } = useMemo(() => {
    const rawMin = data.reduce((acc, item) => Math.min(acc, item.low), data[0]?.low ?? 0);
    const rawMax = data.reduce((acc, item) => Math.max(acc, item.high), data[0]?.high ?? 0);
    const spread = rawMax - rawMin;
    const padding = spread > 0 ? spread * 0.08 : Math.max(rawMax * 0.015, 1);
    return {
      minPrice: rawMin - padding,
      maxPrice: rawMax + padding,
    };
  }, [data]);

  const yToCoord = useCallback(
    (price: number) => {
      if (maxPrice === minPrice) {
        return marginTop + plotHeight / 2;
      }
      const ratio = (price - minPrice) / (maxPrice - minPrice);
      return marginTop + plotHeight - ratio * plotHeight;
    },
    [marginTop, maxPrice, minPrice, plotHeight],
  );

  const step = data.length > 1 ? plotWidth / data.length : plotWidth;
  const bodyWidth = clamp(step * 0.58, 4, 12);
  const axisValues = Array.from({ length: 5 }, (_, index) => maxPrice - ((maxPrice - minPrice) / 4) * index);
  const labelIndices = [...new Set([0, Math.floor(data.length / 3), Math.floor((data.length * 2) / 3), data.length - 1])]
    .filter((index) => index >= 0 && index < data.length);

  return (
    <div className="space-y-4">
      {activeCandle ? (
        <div className="ui-surface-muted flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              {isEn ? "Selected candle" : "Выбранная свеча"}
            </div>
            <div className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
              {range === "1D" ? formatDateTime(activeCandle.time, locale) : formatDateLabel(activeCandle.time, range, locale)}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            <span className="rounded-full bg-slate-900 px-3 py-1.5 text-white dark:bg-slate-100 dark:text-slate-950">
              {isEn ? "Open" : "Откр."}: {formatPriceValue(activeCandle.open, currency, locale)}
            </span>
            <span className="rounded-full bg-emerald-500/12 px-3 py-1.5 text-emerald-700 dark:bg-emerald-500/16 dark:text-emerald-300">
              {isEn ? "High" : "Макс."}: {formatPriceValue(activeCandle.high, currency, locale)}
            </span>
            <span className="rounded-full bg-rose-500/12 px-3 py-1.5 text-rose-700 dark:bg-rose-500/16 dark:text-rose-300">
              {isEn ? "Low" : "Мин."}: {formatPriceValue(activeCandle.low, currency, locale)}
            </span>
            <span className="rounded-full bg-blue-500/12 px-3 py-1.5 text-blue-700 dark:bg-blue-500/16 dark:text-blue-300">
              {isEn ? "Close" : "Закр."}: {formatPriceValue(activeCandle.close, currency, locale)}
            </span>
          </div>
        </div>
      ) : null}

      <div
        ref={ref}
        className="h-84 w-full overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-gradient-to-b from-slate-50 via-white to-slate-100/80 p-2 dark:border-slate-800 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900/90"
      >
        {width > 0 ? (
          <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
            {axisValues.map((value) => {
              const y = yToCoord(value);
              return (
                <g key={value}>
                  <line
                    x1={marginLeft}
                    x2={width - marginRight}
                    y1={y}
                    y2={y}
                    stroke="rgba(148, 163, 184, 0.18)"
                    strokeDasharray="4 6"
                  />
                  <text
                    x={marginLeft - 10}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="11"
                    fill="rgba(100, 116, 139, 0.9)"
                  >
                    {formatPriceValue(value, currency, locale)}
                  </text>
                </g>
              );
            })}

            {hoveredIndex !== null ? (
              <line
                x1={marginLeft + step * hoveredIndex + step / 2}
                x2={marginLeft + step * hoveredIndex + step / 2}
                y1={marginTop}
                y2={height - marginBottom}
                stroke="rgba(59, 130, 246, 0.28)"
                strokeDasharray="5 5"
              />
            ) : null}

            {data.map((candle, index) => {
              const x = marginLeft + step * index + step / 2;
              const openY = yToCoord(candle.open);
              const closeY = yToCoord(candle.close);
              const highY = yToCoord(candle.high);
              const lowY = yToCoord(candle.low);
              const isUp = candle.close >= candle.open;
              const color = isUp ? "#16a34a" : "#e11d48";
              const bodyTop = Math.min(openY, closeY);
              const bodyHeight = Math.max(Math.abs(closeY - openY), 2);

              return (
                <g
                  key={`${candle.time}-${index}`}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <line x1={x} x2={x} y1={highY} y2={lowY} stroke={color} strokeWidth="1.5" />
                  <rect
                    x={x - bodyWidth / 2}
                    y={bodyTop}
                    width={bodyWidth}
                    height={bodyHeight}
                    rx="2"
                    fill={isUp ? "rgba(22, 163, 74, 0.16)" : "rgba(225, 29, 72, 0.16)"}
                    stroke={color}
                    strokeWidth="1.6"
                  />
                </g>
              );
            })}

            {labelIndices.map((index) => {
              const item = data[index];
              const x = marginLeft + step * index + step / 2;
              return (
                <text
                  key={`${item.time}-label`}
                  x={x}
                  y={height - 10}
                  textAnchor="middle"
                  fontSize="11"
                  fill="rgba(100, 116, 139, 0.9)"
                >
                  {formatDateLabel(item.time, range, locale)}
                </text>
              );
            })}
          </svg>
        ) : null}
      </div>
    </div>
  );
}

function buildHeroAside(
  content: {
    currentPrice: string;
    change: string;
    changePercent: string;
    updatedAt: string;
    rangeLabel: string;
    isPositive: boolean;
  } | null,
  isEn: boolean,
): ReactNode {
  if (!content) {
    return (
      <div className="min-w-[220px] space-y-2">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">
          {isEn ? "Price snapshot" : "Снимок цены"}
        </div>
        <div className="text-2xl font-semibold text-white">{isEn ? "Loading..." : "Загрузка..."}</div>
        <div className="text-sm text-white/72">
          {isEn ? "Fetching fresh market candles from T-Bank API" : "Загружаем свежие свечи из T-Bank API"}
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-[220px] space-y-3">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">
        {isEn ? "Price snapshot" : "Снимок цены"}
      </div>
      <div className="text-3xl font-semibold tracking-tight text-white">{content.currentPrice}</div>
      <div
        className={`inline-flex rounded-full px-3 py-1.5 text-sm font-semibold ${
          content.isPositive ? "bg-emerald-400/18 text-emerald-50" : "bg-rose-400/18 text-rose-50"
        }`}
      >
        {content.change} • {content.changePercent}
      </div>
      <div className="space-y-1 text-sm text-white/75">
        <div>{content.rangeLabel}</div>
        <div>{content.updatedAt}</div>
      </div>
    </div>
  );
}

export function FundamentalsDetailsPage() {
  const { figi = "" } = useParams();
  const { cache, isLoading, error, loadFundamentals } = useFundamentals();
  const { locale } = useAppSettings();
  const isEn = locale === "en";
  const api = useMemo(() => createTBankInstrumentsApi(), []);

  const [selectedRange, setSelectedRange] = useState<ChartRange>("1M");
  const [chartMode, setChartMode] = useState<ChartMode>("line");
  const [historyByRange, setHistoryByRange] = useState<Partial<Record<ChartRange, PriceCandle[]>>>({});
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [errorDialogMessage, setErrorDialogMessage] = useState<string | null>(null);

  const pendingRequestsRef = useRef(0);
  const prevErrorRef = useRef<string | null>(null);

  const share = useMemo<ShareRecord | undefined>(() => cache.shares.find((item) => item.figi === figi), [cache.shares, figi]);
  const fundamentals = share ? cache.fundamentalsByFigi[share.figi] : undefined;
  const selectedHistory = historyByRange[selectedRange] ?? [];
  const candleHistory = useMemo(
    () => aggregateCandles(selectedHistory, RANGE_CONFIG[selectedRange].candleBucket),
    [selectedHistory, selectedRange],
  );
  const displayedHistory = chartMode === "candles" ? candleHistory : selectedHistory;
  const selectedSummary = useMemo(() => computePriceSummary(selectedHistory), [selectedHistory]);

  const fallbackClosePrice = useMemo(() => {
    const lastPoint = cache.closePricesByFigi[figi]?.[cache.closePricesByFigi[figi]?.length - 1];
    return lastPoint?.price ?? null;
  }, [cache.closePricesByFigi, figi]);

  useEffect(() => {
    setHistoryByRange({});
    setSelectedRange("1M");
    setChartMode("line");
  }, [figi]);

  useEffect(() => {
    if (error && error !== prevErrorRef.current) {
      setErrorDialogMessage(error);
    }
    prevErrorRef.current = error;
  }, [error]);

  const loadHistory = useCallback(
    async (range: ChartRange, force = false) => {
      if (!share?.figi) {
        return;
      }
      if (!force && historyByRange[range]?.length) {
        return;
      }

      pendingRequestsRef.current += 1;
      setIsHistoryLoading(true);

      try {
        const to = new Date();
        const config = RANGE_CONFIG[range];
        let candles = await api.fetchCandles({
          figi: share.figi,
          from: config.from(to).toISOString(),
          to: to.toISOString(),
          interval: config.interval,
          limit: config.limit,
        });

        if (range === "1D" && candles.length < 2) {
          const fallbackFrom = new Date(to);
          fallbackFrom.setDate(fallbackFrom.getDate() - 3);
          candles = await api.fetchCandles({
            figi: share.figi,
            from: fallbackFrom.toISOString(),
            to: to.toISOString(),
            interval: "CANDLE_INTERVAL_HOUR",
            limit: 96,
          });
        }

        const normalized = normalizeCandles(candles);
        setHistoryByRange((prev) => ({
          ...prev,
          [range]: normalized,
        }));
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : isEn
              ? "Failed to load chart history"
              : "Не удалось загрузить историю графика";
        setErrorDialogMessage(message);
      } finally {
        pendingRequestsRef.current = Math.max(0, pendingRequestsRef.current - 1);
        setIsHistoryLoading(pendingRequestsRef.current > 0);
      }
    },
    [api, historyByRange, isEn, share?.figi],
  );

  useEffect(() => {
    if (!share?.figi) {
      return;
    }
    void loadHistory(selectedRange, false);
  }, [loadHistory, selectedRange, share?.figi]);

  const heroAside = useMemo(() => {
    const current = selectedSummary?.current ?? fallbackClosePrice;
    if (current === null) {
      return buildHeroAside(null, isEn);
    }

    return buildHeroAside(
      {
        currentPrice: formatPriceValue(current, share?.currency ?? "RUB", locale),
        change: formatSignedPriceValue(selectedSummary?.absoluteChange ?? 0, share?.currency ?? "RUB", locale),
        changePercent: formatPercent(selectedSummary?.percentChange ?? 0, locale, true),
        updatedAt: selectedSummary?.updatedAt
          ? `${isEn ? "Updated" : "Обновлено"}: ${formatDateTime(selectedSummary.updatedAt, locale)}`
          : isEn
            ? "Updated price is not available yet"
            : "Обновлённая цена пока недоступна",
        rangeLabel: `${isEn ? "Range" : "Период"}: ${getRangeLabel(selectedRange, isEn)}`,
        isPositive: (selectedSummary?.absoluteChange ?? 0) >= 0,
      },
      isEn,
    );
  }, [fallbackClosePrice, isEn, locale, selectedRange, selectedSummary, share?.currency]);

  const gradientId = useMemo(() => `fundamentals-price-gradient-${figi.replace(/[^a-zA-Z0-9]/g, "") || "chart"}`, [figi]);

  const chartDomain = useMemo<[number, number]>(() => {
    if (!selectedHistory.length) {
      return [0, 100];
    }
    const min = selectedHistory.reduce((acc, item) => Math.min(acc, item.low), selectedHistory[0].low);
    const max = selectedHistory.reduce((acc, item) => Math.max(acc, item.high), selectedHistory[0].high);
    const spread = max - min;
    const padding = spread > 0 ? spread * 0.12 : Math.max(max * 0.015, 1);
    return [min - padding, max + padding];
  }, [selectedHistory]);

  const chartHeadline = useMemo(() => {
    if (!selectedSummary) {
      return {
        title: isEn ? "Price history" : "История цены",
        description: isEn
          ? "Select a period to load a fresh price slice from the market data API."
          : "Выберите период, чтобы загрузить свежий срез цен из API рыночных данных.",
      };
    }

    return {
      title: isEn ? "Price history" : "История цены",
      description: `${getRangeLabel(selectedRange, isEn)} • ${selectedHistory.length} ${
        isEn ? "points loaded" : "точек загружено"
      }`,
    };
  }, [isEn, selectedHistory.length, selectedRange, selectedSummary]);

  if (!share) {
    return (
      <div className="space-y-6">
        <PageHero
          icon={TrendingUp}
          title={isEn ? "Share not found" : "Акция не найдена"}
          description={
            isEn
              ? "Open this page after loading the fundamentals cache, so we can match the FIGI with a stock card."
              : "Откройте страницу после загрузки кэша фундаментальных данных, чтобы сопоставить FIGI с карточкой акции."
          }
          badge={isEn ? "Fundamentals" : "Фундаментальные данные"}
          accent="slate"
          footer={
            <>
              <Link to="/fundamentals" className="ui-secondary-button">
                <ArrowLeft className="h-4 w-4" />
                {isEn ? "Back to list" : "Назад к списку"}
              </Link>
              <button
                type="button"
                onClick={() => void loadFundamentals()}
                disabled={isLoading}
                className="ui-primary-button bg-slate-900 hover:bg-slate-950"
              >
                {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {isEn ? "Load fundamentals" : "Загрузить фундаментал"}
              </button>
            </>
          }
        />
        <SectionCard>
          <div className="ui-surface-muted text-sm leading-7 text-slate-600 dark:text-slate-300">
            {isEn
              ? "No matching company was found in the local cache yet. Load or refresh fundamentals on the main page, then open the stock card again."
              : "В локальном кэше пока нет подходящей компании. Загрузите или обновите фундаментальные данные на основной странице, затем снова откройте карточку акции."}
          </div>
        </SectionCard>
        <AppErrorDialog
          message={errorDialogMessage}
          onClose={() => setErrorDialogMessage(null)}
          title={isEn ? "Data loading error" : "Ошибка загрузки данных"}
          description={isEn ? "The application could not complete the request." : "Приложение не смогло завершить запрос."}
          closeLabel={isEn ? "Close" : "Закрыть"}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHero
        icon={TrendingUp}
        title={
          <div className="space-y-2">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-white/72">{share.ticker}</div>
            <div>{share.name}</div>
          </div>
        }
        description={
          isEn
            ? "Interactive price history with fast period switching and a cleaner view of current market action."
            : "Интерактивная история цены с быстрым переключением периода и более наглядным отображением текущего движения рынка."
        }
        badge={mapExchangeLabel(share.exchange, isEn)}
        accent="blue"
        aside={heroAside}
        footer={
          <>
            <Link
              to="/fundamentals"
              className="ui-secondary-button border-white/20 bg-white/10 text-white hover:bg-white/16 dark:border-white/20 dark:bg-white/10 dark:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              {isEn ? "Back to shares" : "Назад к акциям"}
            </Link>
            <span className="ui-page-hero-badge">{share.currency || "RUB"}</span>
            <span className="ui-page-hero-badge">{isEn ? `Lot ${share.lot}` : `Лот ${share.lot}`}</span>
            <span className="ui-page-hero-badge">FIGI: {share.figi}</span>
          </>
        }
      />

      <SectionCard
        title={chartHeadline.title}
        description={chartHeadline.description}
        action={
          <button
            type="button"
            onClick={() => void loadHistory(selectedRange, true)}
            disabled={isHistoryLoading}
            className="ui-secondary-button"
          >
            {isHistoryLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {isEn ? "Refresh chart" : "Обновить график"}
          </button>
        }
      >
        <div className="space-y-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              {RANGE_ORDER.map((range) => {
                const active = range === selectedRange;
                return (
                  <button
                    key={range}
                    type="button"
                    onClick={() => setSelectedRange(range)}
                    className={
                      active
                        ? "inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm dark:bg-slate-100 dark:text-slate-950"
                        : "inline-flex items-center rounded-full border border-slate-300/90 bg-white/85 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-white dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-900"
                    }
                  >
                    {range}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setChartMode("line")}
                className={
                  chartMode === "line"
                    ? "inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm"
                    : "inline-flex items-center gap-2 rounded-full border border-slate-300/90 bg-white/85 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-white dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200"
                }
              >
                <TrendingUp className="h-4 w-4" />
                {isEn ? "Line" : "Линия"}
              </button>
              <button
                type="button"
                onClick={() => setChartMode("candles")}
                className={
                  chartMode === "candles"
                    ? "inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm"
                    : "inline-flex items-center gap-2 rounded-full border border-slate-300/90 bg-white/85 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-white dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200"
                }
              >
                <BarChart3 className="h-4 w-4" />
                {isEn ? "Candles" : "Свечи"}
              </button>
            </div>
          </div>

          <div className="ui-surface-muted flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
            <span className="inline-flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {isEn ? "Period" : "Период"}: {getRangeLabel(selectedRange, isEn)}
            </span>
            <span>
              {isEn ? "Mode" : "Режим"}:{" "}
              {chartMode === "line" ? (isEn ? "Line chart" : "Линейный график") : (isEn ? "Candlesticks" : "Свечи")}
            </span>
            <span>
              {chartMode === "candles" ? (isEn ? "Candles" : "Свечей") : isEn ? "Points" : "Точек"}: {displayedHistory.length}
            </span>
          </div>

          {isHistoryLoading && selectedHistory.length === 0 ? (
            <div className="flex h-[22rem] items-center justify-center rounded-[1.75rem] border border-slate-200/80 bg-slate-50/70 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              {isEn ? "Loading chart history..." : "Загружаем историю графика..."}
            </div>
          ) : selectedHistory.length > 0 ? (
            chartMode === "line" ? (
              <div className="overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-gradient-to-b from-slate-50 via-white to-slate-100/80 p-3 dark:border-slate-800 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900/90">
                <div className="h-[22rem] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={selectedHistory} margin={{ top: 18, right: 18, left: 4, bottom: 8 }}>
                      <defs>
                        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.38} />
                          <stop offset="95%" stopColor="#60a5fa" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(148, 163, 184, 0.16)" strokeDasharray="4 6" vertical={false} />
                      <XAxis
                        dataKey="time"
                        tickLine={false}
                        axisLine={false}
                        minTickGap={28}
                        tick={{ fill: "rgb(100 116 139)", fontSize: 11 }}
                        tickFormatter={(value) => formatDateLabel(String(value), selectedRange, locale)}
                      />
                      <YAxis
                        domain={chartDomain}
                        tickLine={false}
                        axisLine={false}
                        width={70}
                        tick={{ fill: "rgb(100 116 139)", fontSize: 11 }}
                        tickFormatter={(value) => formatPriceValue(Number(value), share.currency, locale)}
                      />
                      <Tooltip
                        cursor={{ stroke: "rgba(37, 99, 235, 0.22)", strokeDasharray: "4 4" }}
                        content={<HistoryTooltip currency={share.currency} locale={locale} range={selectedRange} isEn={isEn} />}
                      />
                      <Area
                        type="monotone"
                        dataKey="close"
                        stroke="#2563eb"
                        strokeWidth={2.5}
                        fill={`url(#${gradientId})`}
                        dot={false}
                        activeDot={{ r: 4, fill: "#2563eb", strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <CandlestickChart data={candleHistory} currency={share.currency} locale={locale} range={selectedRange} isEn={isEn} />
            )
          ) : (
            <div className="flex h-[22rem] items-center justify-center rounded-[1.75rem] border border-dashed border-slate-300/80 bg-slate-50/70 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
              {isEn ? "No candles were returned for this period." : "Для этого периода API не вернул свечи."}
            </div>
          )}
        </div>
      </SectionCard>

      <MetricGrid className="xl:grid-cols-4">
        <MetricCard
          label={isEn ? "Current price" : "Текущая цена"}
          value={selectedSummary ? formatPriceValue(selectedSummary.current, share.currency, locale) : formatPriceValue(fallbackClosePrice, share.currency, locale)}
          helper={selectedSummary?.updatedAt ? formatDateTime(selectedSummary.updatedAt, locale) : undefined}
        />
        <MetricCard
          label={isEn ? "Change on selected range" : "Изменение за период"}
          value={selectedSummary ? `${formatSignedPriceValue(selectedSummary.absoluteChange, share.currency, locale)}` : "-"}
          helper={selectedSummary ? formatPercent(selectedSummary.percentChange, locale, true) : undefined}
          className={
            selectedSummary && selectedSummary.absoluteChange >= 0
              ? "ring-1 ring-emerald-200/70 dark:ring-emerald-500/20"
              : "ring-1 ring-rose-200/70 dark:ring-rose-500/20"
          }
        />
        <MetricCard
          label={isEn ? "Range high / low" : "Максимум / минимум"}
          value={
            selectedSummary
              ? `${formatPriceValue(selectedSummary.high, share.currency, locale)} / ${formatPriceValue(selectedSummary.low, share.currency, locale)}`
              : "-"
          }
          helper={getRangeLabel(selectedRange, isEn)}
        />
        <MetricCard
          label={isEn ? "Aggregated volume" : "Суммарный объём"}
          value={
            selectedSummary
              ? new Intl.NumberFormat(getLocaleCode(locale), { maximumFractionDigits: 0 }).format(selectedSummary.volume)
              : "-"
          }
          helper={selectedHistory.length ? `${selectedHistory.length} ${isEn ? "candles" : "свечей"}` : undefined}
        />
      </MetricGrid>

      <SectionCard
        title={isEn ? "Fundamental metrics" : "Фундаментальные показатели"}
        description={
          isEn
            ? "Core valuation and profitability indicators from the fundamentals cache. Hover the help icon to see what each metric means."
            : "Ключевые мультипликаторы и показатели прибыльности из кэша фундаментальных данных. Наведите на значок подсказки, чтобы увидеть объяснение метрики."
        }
      >
        <MetricGrid className="xl:grid-cols-3">
          {METRIC_ITEMS.map((item) => (
            <MetricCard
              key={item.key}
              label={
                <FundamentalMetricLabel
                  label={isEn ? item.labelEn : item.labelRu}
                  metric={item.metric}
                  locale={locale}
                />
              }
              value={formatFundamentalMetricValue(item.metric, fundamentals?.[item.key] as number | undefined, locale)}
            />
          ))}
        </MetricGrid>
      </SectionCard>

      <AppErrorDialog
        message={errorDialogMessage}
        onClose={() => setErrorDialogMessage(null)}
        title={isEn ? "Chart loading error" : "Ошибка загрузки графика"}
        description={
          isEn
            ? "The application could not load fresh price history from the market data API."
            : "Приложение не смогло загрузить свежую историю цены из API рыночных данных."
        }
        closeLabel={isEn ? "Close" : "Закрыть"}
      />
    </div>
  );
}
