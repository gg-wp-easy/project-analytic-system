import { numberOr } from "../../../shared/lib/number/numberOr";
import { DATA_PREPROCESSING_PALETTE, METRIC_RULES } from "../model";
import type { MetricKey, MetricRange, ScatterKey, ScreeningRow, SectorRow, SummaryMetricConfig, SummaryMetricRow } from "../model";

export function finiteOrZero(value: unknown): number {
  const numeric = numberOr(value, 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function toPercent(value: number): number {
  return Math.abs(value) <= 1 ? value * 100 : value;
}

export function formatNumber(value: number, digits = 2): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "-";
}

export function formatSectorRu(rawSector: string): string {
  const sector = rawSector.trim();
  const normalized = sector.toLowerCase().replace(/[_-]+/g, " ");
  const exact: Record<string, string> = {
    energy: "Энергетика",
    financial: "Финансы",
    financials: "Финансы",
    industrials: "Промышленность",
    materials: "Материалы",
    "consumer discretionary": "Потребительский сектор",
    "consumer staples": "Товары первой необходимости",
    "information technology": "Информационные технологии",
    technology: "Информационные технологии",
    it: "Информационные технологии",
    "communication services": "Связь и коммуникации",
    telecom: "Связь и коммуникации",
    utilities: "Коммунальные услуги",
    "real estate": "Недвижимость",
    healthcare: "Здравоохранение",
    "health care": "Здравоохранение",
    "health care services": "Здравоохранение",
    government: "Государственный сектор",
    other: "Другое",
  };
  const exactMatch = exact[normalized];
  if (exactMatch) {
    return exactMatch;
  }

  const partial: Array<[string, string]> = [
    ["oil", "Нефть и газ"],
    ["gas", "Нефть и газ"],
    ["bank", "Финансы"],
    ["finance", "Финансы"],
    ["metal", "Металлы и добыча"],
    ["mining", "Металлы и добыча"],
    ["transport", "Транспорт"],
    ["retail", "Ритейл"],
    ["consumer", "Потребительский сектор"],
    ["tele", "Связь и коммуникации"],
    ["media", "Связь и коммуникации"],
    ["software", "Информационные технологии"],
    ["internet", "Информационные технологии"],
    ["tech", "Информационные технологии"],
    ["pharma", "Здравоохранение"],
    ["health", "Здравоохранение"],
    ["real estate", "Недвижимость"],
    ["utility", "Коммунальные услуги"],
  ];
  const found = partial.find(([needle]) => normalized.includes(needle));
  return found?.[1] ?? sector;
}

export function sectorLabel(value: unknown, fallback: string): string {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw ? formatSectorRu(raw) : fallback;
}

export function axisTitle(label: string, unit = ""): string {
  return unit ? `${label}, ${unit}` : label;
}

export function maybeLogoUrl(source: Record<string, unknown>): string | null {
  const candidates = [source.logoUrl, source.logo_url, source.image, source.iconUrl, source.icon_url, source.brandLogoUrl];
  const found = candidates.find((value) => typeof value === "string" && value.trim());
  return typeof found === "string" ? found : null;
}

export function isScorableValue(key: MetricKey, value: number): boolean {
  if (!Number.isFinite(value)) {
    return false;
  }
  if (key === "pe" || key === "pbv" || key === "evEbitda" || key === "marketCapBn") {
    return value > 0;
  }
  if (key === "dividendYield" || key === "score") {
    return value >= 0;
  }
  return true;
}

export function quantile(values: number[], q: number): number {
  if (values.length === 0) {
    return 0;
  }
  const position = (values.length - 1) * q;
  const base = Math.floor(position);
  const rest = position - base;
  const next = values[base + 1];
  return next === undefined ? values[base]! : values[base]! + rest * (next - values[base]!);
}

function metricRange(rows: ScreeningRow[], key: MetricKey): MetricRange | null {
  const rule = METRIC_RULES[key];
  const values = rows
    .map((row) => Number(row[key]))
    .filter((value) => isScorableValue(key, value))
    .sort((left, right) => left - right);

  if (values.length === 0) {
    return null;
  }

  const lower = rule.lowerQuantile === undefined ? values[0]! : quantile(values, rule.lowerQuantile);
  const upper = rule.upperQuantile === undefined ? values[values.length - 1]! : quantile(values, rule.upperQuantile);
  const min = Math.max(rule.min ?? Number.NEGATIVE_INFINITY, lower);
  const max = Math.min(rule.max ?? Number.POSITIVE_INFINITY, upper);

  if (min > max) {
    return { min: values[0]!, max: values[values.length - 1]! };
  }
  return { min, max };
}

export function buildMetricRanges(rows: ScreeningRow[]): Record<MetricKey, MetricRange | null> {
  return {
    pe: metricRange(rows, "pe"),
    g: metricRange(rows, "g"),
    pbv: metricRange(rows, "pbv"),
    roe: metricRange(rows, "roe"),
    debtEbitda: metricRange(rows, "debtEbitda"),
    evEbitda: metricRange(rows, "evEbitda"),
    dividendYield: metricRange(rows, "dividendYield"),
    marketCapBn: metricRange(rows, "marketCapBn"),
    beta: metricRange(rows, "beta"),
    score: metricRange(rows, "score"),
  };
}

function isWithinRange(value: number, range: MetricRange | null): boolean {
  return !range || (value >= range.min && value <= range.max);
}

function metricValues(rows: ScreeningRow[], key: MetricKey, range: MetricRange | null): number[] {
  return rows
    .map((row) => Number(row[key]))
    .filter((value) => isScorableValue(key, value) && isWithinRange(value, range))
    .sort((left, right) => left - right);
}

function average(values: number[]): number {
  if (values.length === 0) {
    return Number.NaN;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) {
    return Number.NaN;
  }
  return quantile(values, 0.5);
}

export function buildSummaryRows(
  rows: ScreeningRow[],
  configs: SummaryMetricConfig[],
  ranges: Record<MetricKey, MetricRange | null>,
): SummaryMetricRow[] {
  return configs.map((config) => {
    const rawCount = rows
      .map((row) => Number(row[config.key]))
      .filter((value) => isScorableValue(config.key, value)).length;
    const values = metricValues(rows, config.key, ranges[config.key]);
    return {
      ...config,
      average: average(values),
      median: median(values),
      min: values[0] ?? Number.NaN,
      max: values[values.length - 1] ?? Number.NaN,
      count: values.length,
      filteredOut: Math.max(0, rawCount - values.length),
    };
  });
}

export function formatSummaryValue(value: number, row: SummaryMetricRow): string {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return `${formatNumber(value, row.digits ?? 2)}${row.unit ?? ""}`;
}

function rankScores(
  rows: ScreeningRow[],
  key: MetricKey,
  higherIsBetter: boolean,
  ranges: Record<MetricKey, MetricRange | null>,
): Map<string, number> {
  const range = ranges[key];
  const values = rows
    .map((row) => ({ figi: row.figi, value: Number(row[key]) }))
    .filter((row) => isScorableValue(key, row.value) && isWithinRange(row.value, range))
    .sort((left, right) => (higherIsBetter ? left.value - right.value : right.value - left.value));

  const result = new Map<string, number>();
  if (values.length <= 1) {
    values.forEach((row) => result.set(row.figi, 0.5));
    return result;
  }

  values.forEach((row, index) => {
    result.set(row.figi, index / (values.length - 1));
  });
  return result;
}

export function scoreRows(rows: ScreeningRow[]): ScreeningRow[] {
  const ranges = buildMetricRanges(rows);
  const rankMaps = {
    pe: rankScores(rows, "pe", false, ranges),
    pbv: rankScores(rows, "pbv", false, ranges),
    roe: rankScores(rows, "roe", true, ranges),
    g: rankScores(rows, "g", true, ranges),
    debtEbitda: rankScores(rows, "debtEbitda", false, ranges),
    evEbitda: rankScores(rows, "evEbitda", false, ranges),
    dividendYield: rankScores(rows, "dividendYield", true, ranges),
    marketCapBn: rankScores(rows, "marketCapBn", true, ranges),
  };

  return rows
    .map((row) => {
      const score =
        (rankMaps.pe.get(row.figi) ?? 0.5) * 0.18 +
        (rankMaps.pbv.get(row.figi) ?? 0.5) * 0.14 +
        (rankMaps.roe.get(row.figi) ?? 0.5) * 0.18 +
        (rankMaps.g.get(row.figi) ?? 0.5) * 0.12 +
        (rankMaps.debtEbitda.get(row.figi) ?? 0.5) * 0.12 +
        (rankMaps.evEbitda.get(row.figi) ?? 0.5) * 0.12 +
        (rankMaps.dividendYield.get(row.figi) ?? 0.5) * 0.08 +
        (rankMaps.marketCapBn.get(row.figi) ?? 0.5) * 0.06;
      return { ...row, score: Math.max(0, Math.min(100, score * 100)) };
    })
    .sort((left, right) => right.score - left.score);
}

export function buildSectorRows(rows: ScreeningRow[], unknownSector: string): SectorRow[] {
  const groups = new Map<string, ScreeningRow[]>();
  rows.forEach((row) => {
    const key = row.sector || unknownSector;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  });

  return Array.from(groups.entries())
    .map(([sector, items], index) => ({
      sector,
      count: items.length,
      averageScore: items.reduce((sum, row) => sum + row.score, 0) / Math.max(items.length, 1),
      color: DATA_PREPROCESSING_PALETTE[index % DATA_PREPROCESSING_PALETTE.length]!,
    }))
    .sort((left, right) => right.count - left.count);
}

function positiveAxisOnly(key: MetricKey): boolean {
  return key === "pe" || key === "pbv" || key === "evEbitda" || key === "marketCapBn";
}

export function chartRows(
  rows: ScreeningRow[],
  xKey: ScatterKey,
  yKey: ScatterKey,
  ranges: Record<MetricKey, MetricRange | null>,
): ScreeningRow[] {
  return rows.filter((row) => {
    const x = row[xKey];
    const y = row[yKey];
    return (
      Number.isFinite(x) &&
      Number.isFinite(y) &&
      (!positiveAxisOnly(xKey) || x > 0) &&
      (!positiveAxisOnly(yKey) || y > 0) &&
      isWithinRange(x, ranges[xKey]) &&
      isWithinRange(y, ranges[yKey])
    );
  });
}
