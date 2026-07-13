import type { CapmAdequacyLevel } from "../../../features/fundamentals-capm";
import {
  FUNDAMENTALS_CANDLE_DOWN_COLOR,
  FUNDAMENTALS_CANDLE_DOWN_MUTED_COLOR,
  FUNDAMENTALS_CHART_UP_COLOR,
  FUNDAMENTALS_CHART_UP_MUTED_COLOR,
} from "../model";
import type {
  CandleBucket,
  CandleTone,
  CapmAdequacyCopy,
  ChartPriceDomain,
  ChartRange,
  ModelTimeSeriesPoint,
  PriceCandle,
  PriceSummary,
  RegressionScatterDomain,
  RegressionScatterPoint,
  ScatterTrend,
} from "../model";

export function getLocaleCode(locale: "ru" | "en"): string {
  return locale === "en" ? "en-US" : "ru-RU";
}

export function formatPriceValue(value: number | null | undefined, currency: string, locale: "ru" | "en"): string {
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

export function formatSignedPriceValue(value: number, currency: string, locale: "ru" | "en"): string {
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

export function formatPercent(value: number | null | undefined, locale: "ru" | "en", withSign = false): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }
  const prefix = withSign && value > 0 ? "+" : "";
  return `${prefix}${new Intl.NumberFormat(getLocaleCode(locale), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}%`;
}

export function formatDateLabel(value: string, range: ChartRange, locale: "ru" | "en"): string {
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

export function formatDateTime(value: string, locale: "ru" | "en"): string {
  return new Intl.DateTimeFormat(getLocaleCode(locale), {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatCalendarDate(value: string, locale: "ru" | "en"): string {
  return new Intl.DateTimeFormat(getLocaleCode(locale), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function formatShortDate(value: string, locale: "ru" | "en"): string {
  return new Intl.DateTimeFormat(getLocaleCode(locale), {
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

export function formatFactorFundLabel(source: { ticker: string; query: string }): string {
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

export function getRangeLabel(range: ChartRange, isEn: boolean): string {
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

export function formatPercentPoints(value: number | null | undefined, locale: "ru" | "en"): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }
  return formatPercent(value * 100, locale);
}

export function formatCompactNumber(value: number | null | undefined, locale: "ru" | "en", digits = 2): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }
  return new Intl.NumberFormat(getLocaleCode(locale), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function getCapmAdequacyCopy(level: CapmAdequacyLevel, isEn: boolean): CapmAdequacyCopy {
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

export function mapExchangeLabel(raw: string, isEn: boolean): string {
  if (!raw) {
    return isEn ? "Exchange not specified" : "Биржа не указана";
  }

  const normalized = raw.trim().toUpperCase();
  if (normalized.includes("MOEX") || normalized.includes("TQBR")) {
    return isEn ? "Moscow Exchange" : "Московская биржа";
  }
  return raw.replaceAll("_", " ");
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function normalizeCandles(rows: PriceCandle[]): PriceCandle[] {
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

export function aggregateCandles(rows: PriceCandle[], bucket: CandleBucket): PriceCandle[] {
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
      const first = items[0]!;
      const last = items[items.length - 1]!;
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

export function computePriceSummary(history: PriceCandle[]): PriceSummary | null {
  if (history.length === 0) {
    return null;
  }

  const first = history[0]!;
  const last = history[history.length - 1]!;
  const reference = first.close || first.open || 0;
  const absoluteChange = last.close - reference;
  const percentChange = reference ? (absoluteChange / reference) * 100 : 0;
  const high = history.reduce((acc, item) => Math.max(acc, item.high), history[0]!.high);
  const low = history.reduce((acc, item) => Math.min(acc, item.low), history[0]!.low);
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

export function getChartPriceDomain(data: PriceCandle[], mode: "close" | "ohlc"): ChartPriceDomain {
  const rawMin = data.reduce((acc, item) => Math.min(acc, mode === "close" ? item.close : item.low), data[0]?.close ?? 0);
  const rawMax = data.reduce((acc, item) => Math.max(acc, mode === "close" ? item.close : item.high), data[0]?.close ?? 0);
  const spread = rawMax - rawMin;
  const padding = spread > 0 ? spread * 0.08 : Math.max(rawMax * 0.015, 1);
  return {
    minPrice: rawMin - padding,
    maxPrice: rawMax + padding,
  };
}

export function getCandleTone(candle: PriceCandle): CandleTone {
  const isUp = candle.close >= candle.open;
  return {
    color: isUp ? FUNDAMENTALS_CHART_UP_COLOR : FUNDAMENTALS_CANDLE_DOWN_COLOR,
    mutedColor: isUp ? FUNDAMENTALS_CHART_UP_MUTED_COLOR : FUNDAMENTALS_CANDLE_DOWN_MUTED_COLOR,
    isUp,
  };
}

export function getModelSeriesDomain(points: ModelTimeSeriesPoint[]) {
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

export function getRegressionScatterDomain(
  points: RegressionScatterPoint[],
  trend: Pick<ScatterTrend, "startY" | "endY"> | null,
): RegressionScatterDomain {
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

export function buildScatterTrend(points: RegressionScatterPoint[]): ScatterTrend | null {
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
  const startX = points.reduce((acc, point) => Math.min(acc, point.x), points[0]!.x);
  const endX = points.reduce((acc, point) => Math.max(acc, point.x), points[0]!.x);

  return {
    slope,
    intercept,
    startX,
    endX,
    startY: intercept + slope * startX,
    endY: intercept + slope * endX,
  };
}
