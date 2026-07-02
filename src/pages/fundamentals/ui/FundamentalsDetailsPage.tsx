import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BarChart3, RefreshCw, TrendingUp } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import { useFundamentals, type AssetFundamentalRecord, type ShareRecord } from "../../../entities/fundamentals";
import { createTBankInstrumentsApi, type TBankCandle } from "../../../shared/api/tbank";
import {
  loadCapmAnalysis,
  type CapmAdequacyLevel,
  type CapmAnalysisResult,
} from "../../../features/fundamentals-capm/model/capm";
import { formatFundamentalMetricValue } from "../../../shared/lib/format/fundamentals";
import { AppErrorDialog } from "../../../shared/ui/app-error-dialog";
import { MetricCard, MetricGrid, PageHero, SectionCard } from "../../../shared/ui/analysis-shell";
import { ChartSkeleton, MetricSkeletonGrid, PageLoadingState } from "../../../shared/ui/loading-state";
import { FundamentalMetricLabel } from "../../../shared/ui/fundamentals/FundamentalMetricLabel";
import { StockAvatar } from "../../../shared/ui/stock-avatar";

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
    candleBucket: "raw",
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
const CHART_UP_COLOR = "#16a34a";
const CHART_DOWN_COLOR = "#64748b";
const CHART_UP_MUTED_COLOR = "rgba(22, 163, 74, 0.16)";
const CANDLE_DOWN_COLOR = "#e11d48";
const CANDLE_DOWN_MUTED_COLOR = "rgba(225, 29, 72, 0.16)";

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

function formatCalendarDate(value: string, locale: "ru" | "en"): string {
  return new Intl.DateTimeFormat(getLocaleCode(locale), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatShortDate(value: string, locale: "ru" | "en"): string {
  return new Intl.DateTimeFormat(getLocaleCode(locale), {
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function formatFactorFundLabel(source: { ticker: string; query: string }): string {
  const normalizedQuery = source.query.toUpperCase();
  const descriptions: Record<string, string> = {
    RU000A109KS6: "Компании второго эшелона",
    TMOS: "Крупнейшие компании РФ",
    TDIV: "Дивидендные акции",
    TITR: "Акции роста",
  };
  const description = descriptions[normalizedQuery];
  if (description) {
    return source.ticker.toUpperCase() !== normalizedQuery
      ? `${source.query} — ${description} (${source.ticker})`
      : `${source.query} — ${description}`;
  }

  return source.query && normalizedQuery !== source.ticker.toUpperCase()
    ? `${source.ticker} (${source.query})`
    : source.ticker;
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

function formatPercentPoints(value: number | null | undefined, locale: "ru" | "en"): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }
  return formatPercent(value * 100, locale);
}

function formatCompactNumber(value: number | null | undefined, locale: "ru" | "en", digits = 2): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }
  return new Intl.NumberFormat(getLocaleCode(locale), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function getCapmAdequacyCopy(
  level: CapmAdequacyLevel,
  isEn: boolean,
): { label: string; description: string; toneClass: string } {
  switch (level) {
    case "strong":
      return {
        label: isEn ? "Strong fit" : "Хорошая подгонка",
        description: isEn
          ? "The market factor explains a meaningful part of the stock's excess-return dynamics. For a one-factor CAPM on daily data, the model looks fairly adequate."
          : "Рыночный фактор объясняет заметную часть динамики избыточной доходности акции. Для однофакторной CAPM на дневных данных модель выглядит достаточно адекватной.",
        toneClass: "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/16 dark:text-emerald-300",
      };
    case "moderate":
      return {
        label: isEn ? "Moderate fit" : "Средняя подгонка",
        description: isEn
          ? "The model captures part of market sensitivity, but a large share of stock moves still comes from company-specific factors."
          : "Модель улавливает часть рыночной чувствительности, но заметная доля движений акции всё ещё определяется собственными факторами компании.",
        toneClass: "bg-amber-500/12 text-amber-700 dark:bg-amber-500/16 dark:text-amber-300",
      };
    case "insufficient":
      return {
        label: isEn ? "Insufficient data" : "Недостаточно данных",
        description: isEn
          ? "There are too few overlapping observations to judge the CAPM fit reliably."
          : "Пересекающихся наблюдений слишком мало, чтобы надёжно оценивать качество CAPM.",
        toneClass: "bg-slate-500/12 text-slate-700 dark:bg-slate-500/16 dark:text-slate-300",
      };
    case "weak":
    default:
      return {
        label: isEn ? "Weak fit" : "Слабая подгонка",
        description: isEn
          ? "The market factor explains only a small share of the stock's behavior, so CAPM should be treated as a rough directional estimate."
          : "Рыночный фактор объясняет лишь небольшую часть поведения акции, поэтому CAPM здесь лучше воспринимать как грубую ориентировочную оценку.",
        toneClass: "bg-rose-500/12 text-rose-700 dark:bg-rose-500/16 dark:text-rose-300",
      };
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

function getChartPriceDomain(data: PriceCandle[], mode: "close" | "ohlc") {
  const rawMin = data.reduce((acc, item) => Math.min(acc, mode === "close" ? item.close : item.low), data[0]?.close ?? 0);
  const rawMax = data.reduce((acc, item) => Math.max(acc, mode === "close" ? item.close : item.high), data[0]?.close ?? 0);
  const spread = rawMax - rawMin;
  const padding = spread > 0 ? spread * 0.08 : Math.max(rawMax * 0.015, 1);
  return {
    minPrice: rawMin - padding,
    maxPrice: rawMax + padding,
  };
}

function getCandleTone(candle: PriceCandle): { color: string; mutedColor: string; isUp: boolean } {
  const isUp = candle.close >= candle.open;
  return {
    color: isUp ? CHART_UP_COLOR : CANDLE_DOWN_COLOR,
    mutedColor: isUp ? CHART_UP_MUTED_COLOR : CANDLE_DOWN_MUTED_COLOR,
    isUp,
  };
}

type RegressionScatterPoint = {
  date: string;
  x: number;
  y: number;
};

type ModelTimeSeriesPoint = {
  date: string;
  actual: number;
  predicted: number;
};

function getModelSeriesDomain(points: ModelTimeSeriesPoint[]) {
  const values = points.flatMap((point) => [point.actual, point.predicted]);
  const rawMin = values.reduce((acc, value) => Math.min(acc, value), values[0] ?? -0.01);
  const rawMax = values.reduce((acc, value) => Math.max(acc, value), values[0] ?? 0.01);
  const spread = rawMax - rawMin;
  const padding = spread > 0 ? spread * 0.12 : 0.01;

  return {
    min: rawMin - padding,
    max: rawMax + padding,
  };
}

function buildLinePath<T>(
  data: T[],
  xToCoord: (index: number) => number,
  yToCoord: (point: T) => number,
) {
  return data
    .map((point, index) => `${index === 0 ? "M" : "L"} ${xToCoord(index).toFixed(2)} ${yToCoord(point).toFixed(2)}`)
    .join(" ");
}

function ModelTimeSeriesChart({
  points,
  locale,
  isEn,
  title,
  actualLabel,
  predictedLabel,
  predictedColor = "#0ea5e9",
}: {
  points: ModelTimeSeriesPoint[];
  locale: "ru" | "en";
  isEn: boolean;
  title: string;
  actualLabel: string;
  predictedLabel: string;
  predictedColor?: string;
}) {
  const { ref, width } = useElementWidth();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const activeIndex = hoveredIndex ?? points.length - 1;
  const activePoint = points[activeIndex] ?? null;
  const height = 340;
  const marginTop = 54;
  const marginRight = 82;
  const marginBottom = 42;
  const marginLeft = 62;
  const chartWidth = Math.max(width, marginLeft + marginRight + 220);
  const plotWidth = Math.max(chartWidth - marginLeft - marginRight, 1);
  const plotHeight = Math.max(height - marginTop - marginBottom, 1);
  const { min, max } = useMemo(() => getModelSeriesDomain(points), [points]);
  const actualColor = "#64748b";

  const yToCoord = useCallback(
    (value: number) => {
      if (max === min) {
        return marginTop + plotHeight / 2;
      }
      const ratio = (value - min) / (max - min);
      return marginTop + plotHeight - ratio * plotHeight;
    },
    [max, min, plotHeight],
  );

  const xToCoord = useCallback(
    (index: number) => {
      if (points.length <= 1) {
        return marginLeft + plotWidth / 2;
      }
      return marginLeft + (plotWidth / (points.length - 1)) * index;
    },
    [plotWidth, points.length],
  );

  const yAxisValues = Array.from({ length: 5 }, (_, index) => max - ((max - min) / 4) * index);
  const labelIndices = [...new Set([0, Math.floor(points.length / 3), Math.floor((points.length * 2) / 3), points.length - 1])]
    .filter((index) => index >= 0 && index < points.length);
  const actualPath = buildLinePath(points, xToCoord, (point) => yToCoord(point.actual));
  const predictedPath = buildLinePath(points, xToCoord, (point) => yToCoord(point.predicted));
  const activeX = activePoint ? xToCoord(activeIndex) : 0;
  const activeActualY = activePoint ? yToCoord(activePoint.actual) : 0;
  const activePredictedY = activePoint ? yToCoord(activePoint.predicted) : 0;

  return (
    <div
      ref={ref}
      className="relative h-[21.25rem] w-full overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
    >
      <div className="pointer-events-none absolute left-4 top-3 z-10 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
        <span className="font-semibold text-slate-800 dark:text-slate-100">{title}</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-6 rounded-full" style={{ backgroundColor: actualColor }} />
          {actualLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-6 rounded-full" style={{ backgroundColor: predictedColor }} />
          {predictedLabel}
        </span>
      </div>

      {activePoint ? (
        <div className="pointer-events-none absolute bottom-3 left-4 z-10 rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs leading-5 text-slate-600 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/86 dark:text-slate-300">
          <div className="font-semibold text-slate-900 dark:text-slate-100">{formatCalendarDate(activePoint.date, locale)}</div>
          <div>{actualLabel}: {formatPercentPoints(activePoint.actual, locale)}</div>
          <div>{predictedLabel}: {formatPercentPoints(activePoint.predicted, locale)}</div>
        </div>
      ) : null}

      {width > 0 ? (
        <svg width={chartWidth} height={height} viewBox={`0 0 ${chartWidth} ${height}`} className="h-full w-full">
          <rect x="0" y="0" width={chartWidth} height={height} fill="transparent" />
          {yAxisValues.map((value) => {
            const y = yToCoord(value);
            return (
              <g key={value}>
                <line x1={marginLeft} x2={chartWidth - marginRight} y1={y} y2={y} stroke="rgba(148, 163, 184, 0.16)" />
                <text x={marginLeft - 10} y={y + 4} textAnchor="end" fontSize="11" fill="rgb(100, 116, 139)">
                  {formatPercentPoints(value, locale)}
                </text>
              </g>
            );
          })}
          {labelIndices.map((index) => {
            const x = xToCoord(index);
            return (
              <text key={points[index].date} x={x} y={height - 12} textAnchor="middle" fontSize="11" fill="rgb(100, 116, 139)">
                {formatShortDate(points[index].date, locale)}
              </text>
            );
          })}
          <path d={actualPath} fill="none" stroke={actualColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.82" />
          <path d={predictedPath} fill="none" stroke={predictedColor} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          {activePoint ? (
            <g pointerEvents="none">
              <line x1={activeX} x2={activeX} y1={marginTop} y2={height - marginBottom} stroke="rgba(15, 23, 42, 0.18)" strokeDasharray="4 4" />
              <circle cx={activeX} cy={activeActualY} r="4" fill={actualColor} />
              <circle cx={activeX} cy={activePredictedY} r="4" fill={predictedColor} />
            </g>
          ) : null}
          {points.map((point, index) => (
            <rect
              key={`${point.date}-hit`}
              x={xToCoord(index) - Math.max(plotWidth / Math.max(points.length - 1, 1), 10) / 2}
              y={marginTop}
              width={Math.max(plotWidth / Math.max(points.length - 1, 1), 10)}
              height={plotHeight}
              fill="transparent"
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseMove={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          ))}
        </svg>
      ) : null}

      {!points.length ? (
        <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
          {isEn ? "No model points available." : "Нет точек модели для отображения."}
        </div>
      ) : null}
    </div>
  );
}

function getRegressionScatterDomain(points: RegressionScatterPoint[], trend: { startY: number; endY: number } | null) {
  const xValues = points.map((point) => point.x);
  const yValues = points.flatMap((point) => [point.y]);
  if (trend) {
    yValues.push(trend.startY, trend.endY);
  }

  const rawMinX = xValues.reduce((acc, value) => Math.min(acc, value), xValues[0] ?? -0.01);
  const rawMaxX = xValues.reduce((acc, value) => Math.max(acc, value), xValues[0] ?? 0.01);
  const rawMinY = yValues.reduce((acc, value) => Math.min(acc, value), yValues[0] ?? -0.01);
  const rawMaxY = yValues.reduce((acc, value) => Math.max(acc, value), yValues[0] ?? 0.01);
  const spreadX = rawMaxX - rawMinX;
  const spreadY = rawMaxY - rawMinY;

  return {
    minX: rawMinX - (spreadX > 0 ? spreadX * 0.12 : 0.01),
    maxX: rawMaxX + (spreadX > 0 ? spreadX * 0.12 : 0.01),
    minY: rawMinY - (spreadY > 0 ? spreadY * 0.12 : 0.01),
    maxY: rawMaxY + (spreadY > 0 ? spreadY * 0.12 : 0.01),
  };
}

function buildScatterTrend(points: RegressionScatterPoint[]): { slope: number; intercept: number; startX: number; endX: number; startY: number; endY: number } | null {
  if (points.length < 2) {
    return null;
  }

  const avgX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const avgY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  const varianceX = points.reduce((sum, point) => sum + (point.x - avgX) ** 2, 0) / points.length;
  if (!Number.isFinite(varianceX) || varianceX <= 0) {
    return null;
  }

  const covarianceXY = points.reduce((sum, point) => sum + (point.x - avgX) * (point.y - avgY), 0) / points.length;
  const slope = covarianceXY / varianceX;
  const intercept = avgY - slope * avgX;
  const startX = points.reduce((acc, point) => Math.min(acc, point.x), points[0].x);
  const endX = points.reduce((acc, point) => Math.max(acc, point.x), points[0].x);

  return {
    slope,
    intercept,
    startX,
    endX,
    startY: intercept + slope * startX,
    endY: intercept + slope * endX,
  };
}

function RegressionScatterChart({
  points,
  locale,
  isEn,
  title,
  xLabel,
  yLabel,
  lineLabel,
  accent = "#0ea5e9",
}: {
  points: RegressionScatterPoint[];
  locale: "ru" | "en";
  isEn: boolean;
  title: string;
  xLabel: string;
  yLabel: string;
  lineLabel: string;
  accent?: string;
}) {
  const { ref, width } = useElementWidth();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const activeIndex = hoveredIndex ?? points.length - 1;
  const activePoint = points[activeIndex] ?? null;
  const height = 360;
  const marginTop = 58;
  const marginRight = 86;
  const marginBottom = 54;
  const marginLeft = 62;
  const chartWidth = Math.max(width, marginLeft + marginRight + 220);
  const plotWidth = Math.max(chartWidth - marginLeft - marginRight, 1);
  const plotHeight = Math.max(height - marginTop - marginBottom, 1);
  const trend = useMemo(() => buildScatterTrend(points), [points]);
  const { minX, maxX, minY, maxY } = useMemo(() => getRegressionScatterDomain(points, trend), [points, trend]);

  const yToCoord = useCallback(
    (value: number) => {
      if (maxY === minY) {
        return marginTop + plotHeight / 2;
      }
      const ratio = (value - minY) / (maxY - minY);
      return marginTop + plotHeight - ratio * plotHeight;
    },
    [maxY, minY, plotHeight],
  );

  const xToCoord = useCallback(
    (value: number) => {
      if (maxX === minX) {
        return marginLeft + plotWidth / 2;
      }
      const ratio = (value - minX) / (maxX - minX);
      return marginLeft + ratio * plotWidth;
    },
    [maxX, minX, plotWidth],
  );

  const yAxisValues = Array.from({ length: 5 }, (_, index) => maxY - ((maxY - minY) / 4) * index);
  const xAxisValues = Array.from({ length: 5 }, (_, index) => minX + ((maxX - minX) / 4) * index);
  const activeX = activePoint ? xToCoord(activePoint.x) : 0;
  const activeY = activePoint ? yToCoord(activePoint.y) : 0;
  const activeTrendY = activePoint && trend ? trend.intercept + trend.slope * activePoint.x : null;

  return (
    <div
      ref={ref}
      className="relative h-[22.5rem] w-full overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
    >
      <div className="pointer-events-none absolute left-4 top-3 z-10 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
        <span className="font-semibold text-slate-800 dark:text-slate-100">{title}</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accent }} />
          {isEn ? "Observations" : "Наблюдения"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-6 rounded-full" style={{ backgroundColor: accent }} />
          {lineLabel}
        </span>
      </div>
      {activePoint ? (
        <div className="pointer-events-none absolute bottom-3 left-4 z-10 rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs leading-5 text-slate-600 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/86 dark:text-slate-300">
          <div className="font-semibold text-slate-900 dark:text-slate-100">{formatCalendarDate(activePoint.date, locale)}</div>
          <div>{xLabel}: {formatPercentPoints(activePoint.x, locale)}</div>
          <div>{yLabel}: {formatPercentPoints(activePoint.y, locale)}</div>
          {typeof activeTrendY === "number" ? (
            <div>{lineLabel}: {formatPercentPoints(activeTrendY, locale)}</div>
          ) : null}
        </div>
      ) : null}
      {width > 0 ? (
        <svg width={chartWidth} height={height} viewBox={`0 0 ${chartWidth} ${height}`} className="h-full w-full">
          <rect x="0" y="0" width={chartWidth} height={height} fill="transparent" />
          {yAxisValues.map((value) => {
            const y = yToCoord(value);
            return (
              <g key={value}>
                <line x1={marginLeft} x2={chartWidth - marginRight} y1={y} y2={y} stroke="rgba(148, 163, 184, 0.16)" />
                <text x={marginLeft - 10} y={y + 4} textAnchor="end" fontSize="11" fill="rgb(100, 116, 139)">
                  {formatPercentPoints(value, locale)}
                </text>
              </g>
            );
          })}
          {xAxisValues.map((value) => {
            const x = xToCoord(value);
            return (
              <g key={`${value}-x`}>
                <line x1={x} x2={x} y1={marginTop} y2={height - marginBottom} stroke="rgba(148, 163, 184, 0.10)" />
                <text x={x} y={height - 12} textAnchor="middle" fontSize="11" fill="rgb(100, 116, 139)">
                  {formatPercentPoints(value, locale)}
                </text>
              </g>
            );
          })}
          <text x={marginLeft + plotWidth / 2} y={height - 2} textAnchor="middle" fontSize="11" fill="rgb(100, 116, 139)">
            {xLabel}
          </text>
          <text x="14" y={marginTop + plotHeight / 2} textAnchor="middle" fontSize="11" fill="rgb(100, 116, 139)" transform={`rotate(-90 14 ${marginTop + plotHeight / 2})`}>
            {yLabel}
          </text>
          {trend ? (
            <line
              x1={xToCoord(trend.startX)}
              y1={yToCoord(trend.startY)}
              x2={xToCoord(trend.endX)}
              y2={yToCoord(trend.endY)}
              stroke={accent}
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          ) : null}
          {points.map((point, index) => {
            const x = xToCoord(point.x);
            const y = yToCoord(point.y);
            return (
              <circle
                key={`${point.date}-hit`}
                cx={x}
                cy={y}
                r={hoveredIndex === index ? 4.8 : 3.2}
                fill={accent}
                fillOpacity={hoveredIndex === index ? 0.95 : 0.55}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseMove={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            );
          })}
          {activePoint ? (
            <g pointerEvents="none">
              <line x1={activeX} x2={activeX} y1={marginTop} y2={height - marginBottom} stroke="rgba(15, 23, 42, 0.20)" strokeDasharray="4 4" />
              <line x1={marginLeft} x2={chartWidth - marginRight} y1={activeY} y2={activeY} stroke="rgba(15, 23, 42, 0.16)" strokeDasharray="4 4" />
            </g>
          ) : null}
        </svg>
      ) : null}
    </div>
  );
}

function PriceLineChart({
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
  const activeIndex = hoveredIndex ?? data.length - 1;
  const activePoint = data[activeIndex] ?? null;
  const latestPoint = data[data.length - 1] ?? null;
  const height = 352;
  const marginTop = 30;
  const marginRight = 88;
  const marginBottom = 34;
  const marginLeft = 14;
  const chartWidth = Math.max(width, marginLeft + marginRight + 160);
  const plotWidth = Math.max(chartWidth - marginLeft - marginRight, 1);
  const plotHeight = Math.max(height - marginTop - marginBottom, 1);
  const { minPrice, maxPrice } = useMemo(() => getChartPriceDomain(data, "close"), [data]);
  const trendIsUp = data.length < 2 || data[data.length - 1].close >= data[0].close;
  const lineColor = trendIsUp ? CHART_UP_COLOR : CHART_DOWN_COLOR;

  const yToCoord = useCallback(
    (price: number) => {
      if (maxPrice === minPrice) {
        return marginTop + plotHeight / 2;
      }
      const ratio = (price - minPrice) / (maxPrice - minPrice);
      return marginTop + plotHeight - ratio * plotHeight;
    },
    [maxPrice, minPrice, plotHeight],
  );

  const xToCoord = useCallback(
    (index: number) => {
      if (data.length <= 1) {
        return marginLeft + plotWidth / 2;
      }
      return marginLeft + (plotWidth / (data.length - 1)) * index;
    },
    [data.length, plotWidth],
  );

  const axisValues = Array.from({ length: 5 }, (_, index) => maxPrice - ((maxPrice - minPrice) / 4) * index);
  const labelIndices = [...new Set([0, Math.floor(data.length / 3), Math.floor((data.length * 2) / 3), data.length - 1])]
    .filter((index) => index >= 0 && index < data.length);
  const path = data
    .map((point, index) => `${index === 0 ? "M" : "L"} ${xToCoord(index).toFixed(2)} ${yToCoord(point.close).toFixed(2)}`)
    .join(" ");
  const activeX = activePoint ? xToCoord(activeIndex) : 0;
  const activeY = activePoint ? yToCoord(activePoint.close) : 0;
  const latestY = latestPoint ? yToCoord(latestPoint.close) : 0;
  const hitWidth = data.length > 1 ? Math.max(plotWidth / (data.length - 1), 12) : plotWidth;

  return (
    <div
      ref={ref}
      className="relative h-[22rem] w-full overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
    >
      {activePoint ? (
        <div className="pointer-events-none absolute left-4 top-3 z-10 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            {range === "1D" ? formatDateTime(activePoint.time, locale) : formatDateLabel(activePoint.time, range, locale)}
          </span>
          <span>{isEn ? "Price" : "Цена"}</span>
          <span className={trendIsUp ? "font-semibold text-emerald-600" : "font-semibold text-slate-600 dark:text-slate-300"}>
            {formatPriceValue(activePoint.close, currency, locale)}
          </span>
        </div>
      ) : null}
      {width > 0 ? (
        <svg width={chartWidth} height={height} viewBox={`0 0 ${chartWidth} ${height}`} className="h-full w-full">
          <rect x="0" y="0" width={chartWidth} height={height} fill="transparent" />
          {axisValues.map((value) => {
            const y = yToCoord(value);
            return (
              <g key={value}>
                <line x1={marginLeft} x2={chartWidth - marginRight} y1={y} y2={y} stroke="rgba(148, 163, 184, 0.16)" />
                <text x={chartWidth - marginRight + 12} y={y + 4} fontSize="11" fill="rgb(100, 116, 139)">
                  {formatPriceValue(value, currency, locale)}
                </text>
              </g>
            );
          })}
          {labelIndices.map((index) => {
            const item = data[index];
            const x = xToCoord(index);
            return (
              <g key={`${item.time}-grid`}>
                <line x1={x} x2={x} y1={marginTop} y2={height - marginBottom} stroke="rgba(148, 163, 184, 0.10)" />
                <text x={x} y={height - 11} textAnchor="middle" fontSize="11" fill="rgb(100, 116, 139)">
                  {formatDateLabel(item.time, range, locale)}
                </text>
              </g>
            );
          })}
          {latestPoint ? (
            <g>
              <line x1={marginLeft} x2={chartWidth - marginRight} y1={latestY} y2={latestY} stroke={lineColor} strokeDasharray="4 4" strokeOpacity="0.56" />
              <rect x={chartWidth - marginRight + 5} y={latestY - 11} width="76" height="22" rx="6" fill={lineColor} />
              <text x={chartWidth - marginRight + 43} y={latestY + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="white">
                {formatPriceValue(latestPoint.close, currency, locale)}
              </text>
            </g>
          ) : null}
          <path d={path} fill="none" stroke={lineColor} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
          {activePoint ? (
            <g>
              <line x1={activeX} x2={activeX} y1={marginTop} y2={height - marginBottom} stroke="rgba(15, 23, 42, 0.22)" strokeDasharray="4 4" />
              <line x1={marginLeft} x2={chartWidth - marginRight} y1={activeY} y2={activeY} stroke="rgba(15, 23, 42, 0.18)" strokeDasharray="4 4" />
              <circle cx={activeX} cy={activeY} r="4" fill={lineColor} stroke="white" strokeWidth="2" />
            </g>
          ) : null}
          {data.map((point, index) => (
            <rect
              key={`${point.time}-hit`}
              x={xToCoord(index) - hitWidth / 2}
              y={marginTop}
              width={hitWidth}
              height={plotHeight}
              fill="transparent"
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseMove={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          ))}
        </svg>
      ) : null}
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
  const activeIndex = hoveredIndex ?? data.length - 1;
  const activeCandle = data[activeIndex] ?? null;
  const latestCandle = data[data.length - 1] ?? null;
  const height = 352;
  const marginTop = 30;
  const marginRight = 88;
  const marginBottom = 34;
  const marginLeft = 14;
  const chartWidth = Math.max(width, marginLeft + marginRight + 160);
  const plotWidth = Math.max(chartWidth - marginLeft - marginRight, 1);
  const plotHeight = Math.max(height - marginTop - marginBottom, 1);
  const volumeHeight = 42;
  const { minPrice, maxPrice } = useMemo(() => getChartPriceDomain(data, "ohlc"), [data]);
  const maxVolume = Math.max(...data.map((item) => (Number.isFinite(item.volume) ? item.volume : 0)), 0);

  const yToCoord = useCallback(
    (price: number) => {
      if (maxPrice === minPrice) {
        return marginTop + plotHeight / 2;
      }
      const ratio = (price - minPrice) / (maxPrice - minPrice);
      return marginTop + plotHeight - ratio * plotHeight;
    },
    [maxPrice, minPrice, plotHeight],
  );

  const axisValues = Array.from({ length: 5 }, (_, index) => maxPrice - ((maxPrice - minPrice) / 4) * index);
  const labelIndices = [...new Set([0, Math.floor(data.length / 3), Math.floor((data.length * 2) / 3), data.length - 1])]
    .filter((index) => index >= 0 && index < data.length);
  const step = data.length > 0 ? plotWidth / data.length : plotWidth;
  const bodyWidth = clamp(step * 0.62, 2, 10);
  const hitWidth = Math.max(step, 8);
  const latestTone = latestCandle ? getCandleTone(latestCandle) : null;
  const latestY = latestCandle ? yToCoord(latestCandle.close) : 0;
  const activeX = activeCandle ? marginLeft + step * activeIndex + step / 2 : 0;
  const activeY = activeCandle ? yToCoord(activeCandle.close) : 0;

  return (
    <div
      ref={ref}
      className="relative h-[22rem] w-full overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
    >
      {activeCandle ? (
        <div className="pointer-events-none absolute left-4 top-3 z-10 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            {range === "1D" ? formatDateTime(activeCandle.time, locale) : formatDateLabel(activeCandle.time, range, locale)}
          </span>
          <span>{isEn ? "O" : "О"} {formatPriceValue(activeCandle.open, currency, locale)}</span>
          <span>{isEn ? "H" : "М"} {formatPriceValue(activeCandle.high, currency, locale)}</span>
          <span>{isEn ? "L" : "Н"} {formatPriceValue(activeCandle.low, currency, locale)}</span>
          <span className={getCandleTone(activeCandle).isUp ? "font-semibold text-emerald-600" : "font-semibold text-rose-600 dark:text-rose-400"}>
            {isEn ? "C" : "З"} {formatPriceValue(activeCandle.close, currency, locale)}
          </span>
        </div>
      ) : null}
      {width > 0 ? (
        <svg width={chartWidth} height={height} viewBox={`0 0 ${chartWidth} ${height}`} className="h-full w-full">
          <rect x="0" y="0" width={chartWidth} height={height} fill="transparent" />
          {axisValues.map((value) => {
            const y = yToCoord(value);
            return (
              <g key={value}>
                <line x1={marginLeft} x2={chartWidth - marginRight} y1={y} y2={y} stroke="rgba(148, 163, 184, 0.16)" />
                <text x={chartWidth - marginRight + 12} y={y + 4} fontSize="11" fill="rgb(100, 116, 139)">
                  {formatPriceValue(value, currency, locale)}
                </text>
              </g>
            );
          })}
          {labelIndices.map((index) => {
            const item = data[index];
            const x = marginLeft + step * index + step / 2;
            return (
              <g key={`${item.time}-label`}>
                <line x1={x} x2={x} y1={marginTop} y2={height - marginBottom} stroke="rgba(148, 163, 184, 0.10)" />
                <text x={x} y={height - 11} textAnchor="middle" fontSize="11" fill="rgb(100, 116, 139)">
                  {formatDateLabel(item.time, range, locale)}
                </text>
              </g>
            );
          })}
          {latestCandle && latestTone ? (
            <g>
              <line x1={marginLeft} x2={chartWidth - marginRight} y1={latestY} y2={latestY} stroke={latestTone.color} strokeDasharray="4 4" strokeOpacity="0.56" />
              <rect x={chartWidth - marginRight + 5} y={latestY - 11} width="76" height="22" rx="6" fill={latestTone.color} />
              <text x={chartWidth - marginRight + 43} y={latestY + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="white">
                {formatPriceValue(latestCandle.close, currency, locale)}
              </text>
            </g>
          ) : null}
          {data.map((candle, index) => {
            const x = marginLeft + step * index + step / 2;
            const openY = yToCoord(candle.open);
            const closeY = yToCoord(candle.close);
            const highY = yToCoord(candle.high);
            const lowY = yToCoord(candle.low);
            const tone = getCandleTone(candle);
            const bodyTop = Math.min(openY, closeY);
            const bodyHeight = Math.max(Math.abs(closeY - openY), 2);
            const volumeBarHeight = maxVolume > 0 ? clamp((candle.volume / maxVolume) * volumeHeight, 1, volumeHeight) : 0;
            const volumeY = height - marginBottom - volumeBarHeight;

            return (
              <g key={`${candle.time}-${index}`}>
                {volumeBarHeight > 0 ? (
                  <rect
                    x={x - bodyWidth / 2}
                    y={volumeY}
                    width={bodyWidth}
                    height={volumeBarHeight}
                    fill={tone.mutedColor}
                  />
                ) : null}
                <line x1={x} x2={x} y1={highY} y2={lowY} stroke={tone.color} strokeWidth="1.25" />
                <rect
                  x={x - bodyWidth / 2}
                  y={bodyTop}
                  width={bodyWidth}
                  height={bodyHeight}
                  rx="1.5"
                  fill={tone.color}
                />
                <rect
                  x={x - hitWidth / 2}
                  y={marginTop}
                  width={hitWidth}
                  height={plotHeight}
                  fill="transparent"
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseMove={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              </g>
            );
          })}
          {activeCandle ? (
            <g pointerEvents="none">
              <line x1={activeX} x2={activeX} y1={marginTop} y2={height - marginBottom} stroke="rgba(15, 23, 42, 0.22)" strokeDasharray="4 4" />
              <line x1={marginLeft} x2={chartWidth - marginRight} y1={activeY} y2={activeY} stroke="rgba(15, 23, 42, 0.18)" strokeDasharray="4 4" />
            </g>
          ) : null}
        </svg>
      ) : null}
    </div>
  );
}

export function FundamentalsDetailsPage() {
  const { figi = "" } = useParams();
  const { cache, isLoading, error, loadFundamentals } = useFundamentals();
  const { locale, t } = useAppSettings();
  const isEn = locale === "en";
  const api = useMemo(() => createTBankInstrumentsApi(), []);

  const [selectedRange, setSelectedRange] = useState<ChartRange>("1M");
  const [chartMode, setChartMode] = useState<ChartMode>("line");
  const [historyByRange, setHistoryByRange] = useState<Partial<Record<ChartRange, PriceCandle[]>>>({});
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [capmAnalysis, setCapmAnalysis] = useState<CapmAnalysisResult | null>(null);
  const [isCapmLoading, setIsCapmLoading] = useState(false);
  const [capmError, setCapmError] = useState<string | null>(null);
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
  const selectedSummary = useMemo(() => computePriceSummary(selectedHistory), [selectedHistory]);

  const fallbackClosePrice = useMemo(() => {
    const lastPoint = cache.closePricesByFigi[figi]?.[cache.closePricesByFigi[figi]?.length - 1];
    return lastPoint?.price ?? null;
  }, [cache.closePricesByFigi, figi]);

  useEffect(() => {
    setHistoryByRange({});
    setSelectedRange("1M");
    setChartMode("line");
    setCapmAnalysis(null);
    setCapmError(null);
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
            : t("Не удалось загрузить историю графика", "Failed to load chart history");
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

  useEffect(() => {
    if (!share?.figi) {
      return;
    }

    let cancelled = false;
    setIsCapmLoading(true);
    setCapmError(null);

    void loadCapmAnalysis(share.figi)
      .then((result) => {
        if (!cancelled) {
          setCapmAnalysis(result);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setCapmAnalysis(null);
          setCapmError(err instanceof Error ? err.message : t("Не удалось построить CAPM", "Failed to build CAPM"));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsCapmLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isEn, share?.figi]);

  const chartHeadline = useMemo(() => {
    if (!selectedSummary) {
      return {
        title: t("История цены", "Price history"),
        description: t("Выберите период и формат графика.", "Select the period and chart format."),
      };
    }

    return {
      title: t("История цены", "Price history"),
      description: `${t("Период", "Period")}: ${getRangeLabel(selectedRange, isEn)}`,
    };
  }, [isEn, selectedRange, selectedSummary]);

  const capmAdequacy = useMemo(
    () => (capmAnalysis ? getCapmAdequacyCopy(capmAnalysis.adequacyLevel, isEn) : null),
    [capmAnalysis, isEn],
  );

  if (!share) {
    return (
      <div className="space-y-6">
        <PageHero
          icon={TrendingUp}
          title={t("Акция не найдена", "Share not found")}
          description={
            t("Откройте страницу после загрузки кеша фундаментальных данных, чтобы сопоставить FIGI с карточкой акции.", "Open this page after loading the fundamentals cache, so we can match the FIGI with a stock card.")
          }
          badge={t("Фундаментальные данные", "Fundamentals")}
          accent="slate"
          footer={
            <>
              <Link to="/fundamentals" className="ui-secondary-button">
                <ArrowLeft className="h-4 w-4" />
                {t("Назад к списку", "Back to list")}
              </Link>
              <button
                type="button"
                onClick={() => void loadFundamentals()}
                disabled={isLoading}
                className="ui-primary-button bg-slate-900 hover:bg-slate-950"
              >
                {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {t("Загрузить фундаментал", "Load fundamentals")}
              </button>
            </>
          }
        />
        <SectionCard>
          {isLoading ? (
            <PageLoadingState
              title={t("Загружаем фундаментальные данные", "Loading fundamentals")}
              subtitle={t("Обновляем локальный кеш компаний и показателей.", "Refreshing the local company and metrics cache.")}
              accentClassName="text-slate-700"
            />
          ) : (
            <div className="ui-surface-muted text-sm leading-7 text-slate-600 dark:text-slate-300">
              {t("В локальном кеше пока нет подходящей компании. Загрузите или обновите фундаментальные данные на основной странице, затем снова откройте карточку акции.", "No matching company was found in the local cache yet. Load or refresh fundamentals on the main page, then open the stock card again.")}
            </div>
          )}
        </SectionCard>
        <AppErrorDialog
          message={errorDialogMessage}
          onClose={() => setErrorDialogMessage(null)}
          title={t("Ошибка загрузки данных", "Data loading error")}
          description={t("Приложение не смогло завершить запрос.", "The application could not complete the request.")}
          closeLabel={t("Закрыть", "Close")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/80 bg-white/90 px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <StockAvatar ticker={share.ticker} name={share.name} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-semibold text-slate-950 dark:text-slate-50">{share.name}</h1>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                  {share.ticker}
                </span>
              </div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {mapExchangeLabel(share.exchange, isEn)} · {share.currency || "RUB"}
              </div>
            </div>
          </div>
          <Link
            to="/fundamentals"
            className="ui-secondary-button w-fit"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("Назад к акциям", "Back to shares")}
          </Link>
        </div>
      </div>

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
            {t("Обновить график", "Refresh chart")}
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
                {t("Линия", "Line")}
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
                {t("Свечи", "Candles")}
              </button>
            </div>
          </div>
          {isHistoryLoading && selectedHistory.length === 0 ? (
            <ChartSkeleton className="min-h-[22rem]" />
          ) : selectedHistory.length > 0 ? (
            chartMode === "line" ? (
              <PriceLineChart data={selectedHistory} currency={share.currency} locale={locale} range={selectedRange} isEn={isEn} />
            ) : (
              <CandlestickChart data={candleHistory} currency={share.currency} locale={locale} range={selectedRange} isEn={isEn} />
            )
          ) : (
            <div className="flex h-[22rem] items-center justify-center rounded-xl border border-dashed border-slate-300/80 bg-slate-50/70 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
              {t("Для этого периода API не вернул свечи.", "No candles were returned for this period.")}
            </div>
          )}
        </div>
      </SectionCard>

      <MetricGrid className="xl:grid-cols-3">
        <MetricCard
          label={t("Текущая цена", "Current price")}
          value={selectedSummary ? formatPriceValue(selectedSummary.current, share.currency, locale) : formatPriceValue(fallbackClosePrice, share.currency, locale)}
          helper={selectedSummary?.updatedAt ? formatDateTime(selectedSummary.updatedAt, locale) : undefined}
        />
        <MetricCard
          label={t("Изменение за период", "Change on selected range")}
          value={selectedSummary ? `${formatSignedPriceValue(selectedSummary.absoluteChange, share.currency, locale)}` : "-"}
          helper={selectedSummary ? formatPercent(selectedSummary.percentChange, locale, true) : undefined}
          className={
            selectedSummary && selectedSummary.absoluteChange >= 0
              ? "ring-1 ring-emerald-200/70 dark:ring-emerald-500/20"
              : "ring-1 ring-rose-200/70 dark:ring-rose-500/20"
          }
        />
        <MetricCard
          label={t("Максимум / минимум", "Range high / low")}
          value={
            selectedSummary
              ? `${formatPriceValue(selectedSummary.high, share.currency, locale)} / ${formatPriceValue(selectedSummary.low, share.currency, locale)}`
              : "-"
          }
          helper={getRangeLabel(selectedRange, isEn)}
        />
      </MetricGrid>

      <SectionCard
        title={t("Модель CAPM", "CAPM model")}
        description={
          t(
            "CAPM строится по дневным доходностям за последний год относительно индекса Мосбиржи. На графике показаны наблюдения и регрессионная линия.",
            "CAPM is built from daily returns for the last year against the MOEX index. The chart shows observations and the regression line.",
          )
        }
      >
        {isCapmLoading ? (
          <div className="space-y-4">
            <PageLoadingState
              title={t("Строим CAPM", "Building CAPM")}
              subtitle={t("Загружаем рыночные свечи и считаем доходности относительно индекса.", "Loading market candles and calculating returns against the index.")}
              accentClassName="text-blue-600"
            />
            <MetricSkeletonGrid count={4} />
          </div>
        ) : capmError ? (
          <div className="rounded-[1.75rem] border border-rose-200/80 bg-rose-50/75 px-5 py-4 text-sm leading-7 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
            <div className="text-xs font-semibold uppercase tracking-[0.16em]">
              {t("CAPM не построена", "CAPM was not built")}
            </div>
            <div className="mt-2">{capmError}</div>
          </div>
        ) : capmAnalysis && capmAdequacy ? (
          <div className="space-y-5">
            <MetricGrid className="xl:grid-cols-4">
              <MetricCard
                label="R^2"
                value={formatPercentPoints(capmAnalysis.rSquared, locale)}
                helper={
                  t("Доля вариации избыточной доходности, объясняемая рыночным фактором", "Share of excess-return variance explained by the market factor")
                }
              />
              <MetricCard
                label={t("Бета", "Beta")}
                value={formatCompactNumber(capmAnalysis.beta, locale, 2)}
                helper={
                  t("Чувствительность акции к избыточной доходности рынка", "Sensitivity of the stock to market excess returns")
                }
              />
              <MetricCard
                label={t("Безрисковая ставка", "Risk-free rate")}
                value={formatPercentPoints(capmAnalysis.riskFreeAnnualRate, locale)}
                helper={`${capmAnalysis.riskFreeSource.bondTicker} | ${formatCalendarDate(capmAnalysis.riskFreeSource.maturityDate, locale)}`}
              />
              <MetricCard
                label={t("Наблюдений", "Observations")}
                value={formatCompactNumber(capmAnalysis.sampleSize, locale, 0)}
                helper={`${formatCalendarDate(capmAnalysis.periodStart, locale)} - ${formatCalendarDate(capmAnalysis.periodEnd, locale)}`}
              />
            </MetricGrid>

            {capmAnalysis.modelPoints.length ? (
              <div className="grid gap-4 xl:grid-cols-2">
                <ModelTimeSeriesChart
                  points={capmAnalysis.modelPoints.map((point) => ({
                    date: point.date,
                    actual: point.actualExcessReturn,
                    predicted: point.predictedCapmReturn,
                  }))}
                  locale={locale}
                  isEn={isEn}
                  title={t("CAPM: временной ряд", "CAPM: time series")}
                  actualLabel={t("Факт", "Actual")}
                  predictedLabel={t("CAPM", "CAPM")}
                  predictedColor="#0ea5e9"
                />
                <RegressionScatterChart
                  points={capmAnalysis.modelPoints.map((point) => ({
                    date: point.date,
                    x: point.marketExcessReturn,
                    y: point.actualExcessReturn,
                  }))}
                  locale={locale}
                  isEn={isEn}
                  title={t("CAPM: акция против рынка", "CAPM: stock versus market")}
                  xLabel={t("Избыточная доходность рынка", "Market excess return")}
                  yLabel={t("Избыточная доходность акции", "Stock excess return")}
                  lineLabel={t("Линия CAPM", "CAPM line")}
                  accent="#0ea5e9"
                />
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
              <div className="rounded-[1.75rem] border border-slate-200/80 bg-slate-50/70 px-5 py-5 dark:border-slate-800 dark:bg-slate-950/40">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    {t("Оценка адекватности", "Adequacy assessment")}
                  </div>
                  <span className={`inline-flex rounded-full px-3 py-1.5 text-sm font-semibold ${capmAdequacy.toneClass}`}>
                    {capmAdequacy.label}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">{capmAdequacy.description}</p>
                <div className="mt-4 text-xs leading-6 text-slate-500 dark:text-slate-400">
                  {isEn
                    ? `The model uses ${capmAnalysis.sampleSize} overlapping daily observations from ${formatCalendarDate(capmAnalysis.periodStart, locale)} to ${formatCalendarDate(capmAnalysis.periodEnd, locale)}.`
                    : `Модель использует ${formatCompactNumber(capmAnalysis.sampleSize, locale, 0)} пересекающихся дневных наблюдений с ${formatCalendarDate(capmAnalysis.periodStart, locale)} по ${formatCalendarDate(capmAnalysis.periodEnd, locale)}.`}
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-slate-200/80 bg-white/85 px-5 py-5 dark:border-slate-800 dark:bg-slate-950/50">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  {t("Входные данные", "Model inputs")}
                </div>
                <div className="mt-4 space-y-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {t("Рыночный бенчмарк", "Market benchmark")}:
                    </span>{" "}
                    {capmAnalysis.marketTicker} | {capmAnalysis.marketName}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {t("Источник безрисковой ставки", "Risk-free source")}:
                    </span>{" "}
                    {capmAnalysis.riskFreeSource.bondTicker} | {capmAnalysis.riskFreeSource.bondName}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {t("Ожидаемая годовая доходность", "Expected annual return")}:
                    </span>{" "}
                    {formatPercentPoints(capmAnalysis.expectedAnnualReturn, locale)}
                  </div>
                  <div className="text-xs leading-6 text-slate-500 dark:text-slate-400">
                    {capmAnalysis.riskFreeSource.pricingMethod === "ytm_solver"
                      ? t("Ставка по ОФЗ получена из рыночной цены и купонных потоков через расчёт YTM.", "The OFZ rate is derived from the bond price and coupon cash flows using a YTM solver.")
                      : t("Ставка по ОФЗ приближённая: использована купонная оценка, потому что точный расчёт YTM оказался нестабилен.", "The OFZ rate is approximated from coupon cash flows because an exact YTM solve was not stable.")}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-[1.75rem] border border-dashed border-slate-300/80 bg-slate-50/70 px-5 py-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
            {t("Данные CAPM пока недоступны.", "CAPM data is not available yet.")}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title={t("Модель Фамы-Френча", "Fama-French model")}
        description={
          t(
            "Многофакторная модель использует рыночный фактор, SMB = компании второго эшелона минус крупнейшие компании РФ и HML = дивидендные акции минус акции роста. На графиках фактическая избыточная доходность сравнивается с расчётной доходностью модели.",
            "The multifactor model uses the market factor, SMB = RU000A109KS6 - TMOS, and HML = TDIV - TITR. The charts compare actual excess return with model-fitted return.",
          )
        }
      >
        {isCapmLoading ? (
          <div className="space-y-4">
            <PageLoadingState
              title={t("Строим модель Фамы-Френча", "Building Fama-French")}
              subtitle={t("Загружаем фондовые факторы и считаем многофакторную регрессию.", "Loading fund factors and fitting the multifactor regression.")}
              accentClassName="text-teal-600"
            />
            <MetricSkeletonGrid count={4} />
          </div>
        ) : capmAnalysis?.famaFrench ? (
          <div className="space-y-5">
            <MetricGrid className="xl:grid-cols-4">
              <MetricCard label={t("R^2 модели", "FF R^2")} value={formatPercentPoints(capmAnalysis.famaFrench.rSquared, locale)} />
              <MetricCard label={t("Бета рынка", "Market beta")} value={formatCompactNumber(capmAnalysis.famaFrench.marketBeta, locale, 2)} />
              <MetricCard label="β SMB" value={formatCompactNumber(capmAnalysis.famaFrench.smbBeta, locale, 2)} />
              <MetricCard label="β HML" value={formatCompactNumber(capmAnalysis.famaFrench.hmlBeta, locale, 2)} />
            </MetricGrid>

            <div className="grid gap-4 xl:grid-cols-2">
              <ModelTimeSeriesChart
                points={capmAnalysis.modelPoints
                  .filter((point) => typeof point.predictedFamaFrenchReturn === "number")
                  .map((point) => ({
                    date: point.date,
                    actual: point.actualExcessReturn,
                    predicted: point.predictedFamaFrenchReturn as number,
                  }))}
                locale={locale}
                isEn={isEn}
                title={t("Модель Фамы-Френча: временной ряд", "Fama-French: time series")}
                actualLabel={t("Факт", "Actual")}
                predictedLabel={t("Расчёт модели", "Fama-French")}
                predictedColor="#14b8a6"
              />
              <RegressionScatterChart
                points={capmAnalysis.modelPoints
                  .filter((point) => typeof point.predictedFamaFrenchReturn === "number")
                  .map((point) => ({
                    date: point.date,
                    x: point.predictedFamaFrenchReturn as number,
                    y: point.actualExcessReturn,
                  }))}
                locale={locale}
                isEn={isEn}
                title={t("Модель Фамы-Френча: расчёт против факта", "Fama-French: fitted versus actual")}
                xLabel={t("Расчётная доходность модели", "FF fitted return")}
                yLabel={t("Фактическая доходность", "Actual return")}
                lineLabel={t("Линия тренда", "Trend line")}
                accent="#14b8a6"
              />
            </div>

            <MetricGrid className="xl:grid-cols-4">
              <MetricCard
                label={t("Ожидаемая доходность модели", "FF expected return")}
                value={formatPercentPoints(capmAnalysis.famaFrench.expectedAnnualReturn, locale)}
                helper={t("Годовая оценка с альфой, рыночным фактором, SMB и HML", "Annual estimate with alpha, market, SMB, and HML")}
              />
              <MetricCard
                label={t("Альфа модели", "FF alpha")}
                value={formatPercentPoints(capmAnalysis.famaFrench.alphaAnnual, locale)}
                helper={t("Годовая альфа многофакторной модели", "Annual alpha of the multifactor model")}
              />
              <MetricCard
                label={t("Наблюдений", "FF observations")}
                value={formatCompactNumber(capmAnalysis.famaFrench.sampleSize, locale, 0)}
                helper={`${formatCalendarDate(capmAnalysis.famaFrench.periodStart, locale)} - ${formatCalendarDate(capmAnalysis.famaFrench.periodEnd, locale)}`}
              />
            </MetricGrid>

            <div className="rounded-[1.75rem] border border-slate-200/80 bg-slate-50/70 px-5 py-5 text-sm leading-7 text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                {t("Факторные фонды", "Factor funds")}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">SMB:</span>{" "}
                  {formatFactorFundLabel(capmAnalysis.famaFrench.sources.smallCap)} - {formatFactorFundLabel(capmAnalysis.famaFrench.sources.largeCap)}
                </div>
                <div>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">HML:</span>{" "}
                  {formatFactorFundLabel(capmAnalysis.famaFrench.sources.value)} - {formatFactorFundLabel(capmAnalysis.famaFrench.sources.growth)}
                </div>
              </div>
            </div>
          </div>
        ) : capmAnalysis?.famaFrenchError ? (
          <div className="rounded-[1.75rem] border border-amber-200/80 bg-amber-50/75 px-5 py-4 text-sm leading-7 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
            <div className="text-xs font-semibold uppercase tracking-[0.16em]">
              {t("Модель Фамы-Френча не построена", "Fama-French was not built")}
            </div>
            <div className="mt-2">{capmAnalysis.famaFrenchError}</div>
          </div>
        ) : (
          <div className="rounded-[1.75rem] border border-dashed border-slate-300/80 bg-slate-50/70 px-5 py-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
            {t("Данные модели Фамы-Френча пока недоступны.", "Fama-French data is not available yet.")}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title={t("Фундаментальные показатели", "Fundamental metrics")}
        description={
          t("Ключевые мультипликаторы и показатели прибыльности из кэша фундаментальных данных. Наведите на значок подсказки, чтобы увидеть объяснение метрики.", "Core valuation and profitability indicators from the fundamentals cache. Hover the help icon to see what each metric means.")
        }
      >
        <MetricGrid className="xl:grid-cols-3">
          {METRIC_ITEMS.map((item) => (
            <MetricCard
              key={item.key}
              label={
                <FundamentalMetricLabel
                  label={t(item.labelRu, item.labelEn)}
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
        title={t("Ошибка загрузки графика", "Chart loading error")}
        description={
          t("Приложение не смогло загрузить свежую историю цены из API рыночных данных.", "The application could not load fresh price history from the market data API.")
        }
        closeLabel={t("Закрыть", "Close")}
      />
    </div>
  );
}
