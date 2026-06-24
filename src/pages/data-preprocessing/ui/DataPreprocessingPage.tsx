import { useMemo } from "react";
import { ArrowRight, Database, Filter, RefreshCw } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "react-router-dom";
import { useFundamentals } from "../../../entities/fundamentals";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import { numberOr } from "../../../shared/lib/number/numberOr";
import {
  AnalysisPageFrame,
  AnalysisSidebarCard,
  MetricCard,
  MetricGrid,
  PageHero,
  SectionCard,
} from "../../../shared/ui/analysis-shell";
import { StockAvatar } from "../../../shared/ui/stock-avatar";
import { FundamentalsTabs } from "../../fundamentals/ui/FundamentalsTabs";

type ScreeningRow = {
  figi: string;
  ticker: string;
  name: string;
  sector: string;
  exchange: string;
  currency: string;
  logoUrl?: string | null;
  marketCapBn: number;
  pe: number;
  g: number;
  pbv: number;
  roe: number;
  debtEbitda: number;
  evEbitda: number;
  dividendYield: number;
  beta: number;
  score: number;
};

type SectorRow = {
  sector: string;
  count: number;
  averageScore: number;
  color: string;
};

type ScatterKey = "pe" | "g" | "pbv" | "roe" | "debtEbitda" | "evEbitda";
type MetricKey = ScatterKey | "dividendYield" | "marketCapBn" | "beta" | "score";

type MetricRange = {
  min: number;
  max: number;
};

type SummaryMetricConfig = {
  key: MetricKey;
  label: string;
  digits?: number;
  unit?: string;
};

type SummaryMetricRow = SummaryMetricConfig & {
  average: number;
  median: number;
  min: number;
  max: number;
  count: number;
  filteredOut: number;
};

type ScatterSectionProps = {
  title: string;
  description: string;
  rows: ScreeningRow[];
  sectors: SectorRow[];
  xKey: ScatterKey;
  yKey: ScatterKey;
  xLabel: string;
  yLabel: string;
  xUnit?: string;
  yUnit?: string;
};

const palette = ["#2563eb", "#059669", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2", "#db2777", "#65a30d", "#475569"];

const metricRules: Record<MetricKey, { min?: number; max?: number; lowerQuantile?: number; upperQuantile?: number }> = {
  pe: { min: 0.01, max: 120, lowerQuantile: 0.02, upperQuantile: 0.98 },
  g: { min: -80, max: 80, lowerQuantile: 0.02, upperQuantile: 0.98 },
  pbv: { min: 0.01, max: 25, lowerQuantile: 0.02, upperQuantile: 0.98 },
  roe: { min: -80, max: 80, lowerQuantile: 0.02, upperQuantile: 0.98 },
  debtEbitda: { min: -10, max: 15, lowerQuantile: 0.02, upperQuantile: 0.98 },
  evEbitda: { min: 0.01, max: 60, lowerQuantile: 0.02, upperQuantile: 0.98 },
  dividendYield: { min: 0, max: 25, lowerQuantile: 0, upperQuantile: 0.95 },
  marketCapBn: { min: 0.01, lowerQuantile: 0.01, upperQuantile: 1 },
  beta: { min: -5, max: 5, lowerQuantile: 0.02, upperQuantile: 0.98 },
  score: { min: 0, max: 100, lowerQuantile: 0, upperQuantile: 1 },
};

function finiteOrZero(value: unknown): number {
  const numeric = numberOr(value, 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toPercent(value: number): number {
  return Math.abs(value) <= 1 ? value * 100 : value;
}

function formatNumber(value: number, digits = 2): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "-";
}

function sectorLabel(value: unknown, fallback: string): string {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw || fallback;
}

function maybeLogoUrl(source: Record<string, unknown>): string | null {
  const candidates = [source.logoUrl, source.logo_url, source.image, source.iconUrl, source.icon_url, source.brandLogoUrl];
  const found = candidates.find((value) => typeof value === "string" && value.trim());
  return typeof found === "string" ? found : null;
}

function isScorableValue(key: MetricKey, value: number): boolean {
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

function quantile(values: number[], q: number): number {
  if (values.length === 0) {
    return 0;
  }
  const position = (values.length - 1) * q;
  const base = Math.floor(position);
  const rest = position - base;
  const next = values[base + 1];
  return next === undefined ? values[base] : values[base] + rest * (next - values[base]);
}

function metricRange(rows: ScreeningRow[], key: MetricKey): MetricRange | null {
  const rule = metricRules[key];
  const values = rows
    .map((row) => Number(row[key]))
    .filter((value) => isScorableValue(key, value))
    .sort((left, right) => left - right);

  if (values.length === 0) {
    return null;
  }

  const lower = rule.lowerQuantile === undefined ? values[0] : quantile(values, rule.lowerQuantile);
  const upper = rule.upperQuantile === undefined ? values[values.length - 1] : quantile(values, rule.upperQuantile);
  const min = Math.max(rule.min ?? Number.NEGATIVE_INFINITY, lower);
  const max = Math.min(rule.max ?? Number.POSITIVE_INFINITY, upper);

  if (min > max) {
    return { min: values[0], max: values[values.length - 1] };
  }
  return { min, max };
}

function buildMetricRanges(rows: ScreeningRow[]): Record<MetricKey, MetricRange | null> {
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

function buildSummaryRows(
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

function formatSummaryValue(value: number, row: SummaryMetricRow): string {
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

function scoreRows(rows: ScreeningRow[]): ScreeningRow[] {
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

function buildSectorRows(rows: ScreeningRow[], unknownSector: string): SectorRow[] {
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
      color: palette[index % palette.length],
    }))
    .sort((left, right) => right.count - left.count);
}

function positiveAxisOnly(key: MetricKey): boolean {
  return key === "pe" || key === "pbv" || key === "evEbitda" || key === "marketCapBn";
}

function chartRows(
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

function ScatterTooltip({ payload }: { payload?: Array<{ payload: ScreeningRow }> }) {
  if (!payload?.length) {
    return null;
  }
  const row = payload[0].payload;
  return (
    <div className="min-w-56 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-2 flex items-center gap-2">
        <StockAvatar ticker={row.ticker} name={row.name} logoUrl={row.logoUrl} size="sm" />
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{row.ticker}</div>
          <div className="max-w-44 truncate text-xs text-slate-500 dark:text-slate-400">{row.name}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
        <span>P/E</span><span className="text-right font-medium">{formatNumber(row.pe)}</span>
        <span>g</span><span className="text-right font-medium">{formatNumber(row.g)}%</span>
        <span>P/BV</span><span className="text-right font-medium">{formatNumber(row.pbv)}</span>
        <span>ROE</span><span className="text-right font-medium">{formatNumber(row.roe)}%</span>
        <span>Debt/EBITDA</span><span className="text-right font-medium">{formatNumber(row.debtEbitda)}</span>
        <span>EV/EBITDA</span><span className="text-right font-medium">{formatNumber(row.evEbitda)}</span>
      </div>
    </div>
  );
}

function ScatterSection({ title, description, rows, sectors, xKey, yKey, xLabel, yLabel, xUnit = "", yUnit = "" }: ScatterSectionProps) {
  const chartRanges = useMemo(() => buildMetricRanges(rows), [rows]);
  const visibleRows = useMemo(() => chartRows(rows, xKey, yKey, chartRanges), [chartRanges, rows, xKey, yKey]);
  const sectorColor = new Map(sectors.map((sector) => [sector.sector, sector.color]));
  const grouped = sectors
    .map((sector) => ({
      ...sector,
      rows: visibleRows.filter((row) => row.sector === sector.sector),
    }))
    .filter((sector) => sector.rows.length > 0);

  return (
    <SectionCard title={title} description={description}>
      <div className="mb-4 flex flex-wrap gap-2">
        {grouped.slice(0, 10).map((sector) => (
          <span key={sector.sector} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: sector.color }} />
            {sector.sector}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={380}>
        <ScatterChart margin={{ top: 10, right: 24, bottom: 16, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis type="number" dataKey={xKey} name={xLabel} unit={xUnit} stroke="#64748b" />
          <YAxis type="number" dataKey={yKey} name={yLabel} unit={yUnit} stroke="#64748b" />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<ScatterTooltip />} />
          {grouped.map((sector) => (
            <Scatter
              key={sector.sector}
              name={sector.sector}
              data={sector.rows}
              fill={sectorColor.get(sector.sector) ?? "#2563eb"}
              stroke={sectorColor.get(sector.sector) ?? "#2563eb"}
              fillOpacity={0.82}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </SectionCard>
  );
}

export function DataPreprocessingPage() {
  const { cache, hasData, isLoading, loadFundamentals } = useFundamentals();
  const { locale, t } = useAppSettings();
  const isEn = locale === "en";
  const unknownSector = t("Не указан", "Unknown");

  const rows = useMemo(() => {
    const prepared = cache.shares
      .map((share) => {
        const fundamentals = cache.fundamentalsByFigi[share.figi];
        if (!fundamentals) {
          return null;
        }
        const shareRecord = share as typeof share & Record<string, unknown>;
        const sector = sectorLabel(shareRecord.sector, unknownSector);
        const roe = toPercent(fundamentals.roe);
        const dividendYield = toPercent(fundamentals.dividendYield);
        return {
          figi: share.figi,
          ticker: share.ticker,
          name: share.name,
          sector,
          exchange: share.exchange,
          currency: share.currency,
          logoUrl: maybeLogoUrl(shareRecord),
          marketCapBn: finiteOrZero(fundamentals.marketCapBn),
          pe: finiteOrZero(fundamentals.peRatio),
          g: roe,
          pbv: finiteOrZero(fundamentals.pbRatio),
          roe,
          debtEbitda: finiteOrZero(fundamentals.netDebtToEbitda),
          evEbitda: finiteOrZero(fundamentals.evToEbitda),
          dividendYield,
          beta: finiteOrZero(fundamentals.beta),
          score: 0,
        } satisfies ScreeningRow;
      })
      .filter((row): row is ScreeningRow => Boolean(row));
    return scoreRows(prepared);
  }, [cache.fundamentalsByFigi, cache.shares, unknownSector]);

  const sectorRows = useMemo(() => buildSectorRows(rows, unknownSector), [rows, unknownSector]);
  const selectedRows = useMemo(() => rows.filter((row) => row.score >= 60).slice(0, 30), [rows]);
  const topRows = useMemo(() => rows.slice(0, 25), [rows]);
  const medianScore = rows.length ? [...rows].sort((a, b) => a.score - b.score)[Math.floor(rows.length / 2)]?.score ?? 0 : 0;
  const summaryMetricConfigs = useMemo<SummaryMetricConfig[]>(() => [
    { key: "pe", label: "P/E" },
    { key: "pbv", label: "P/BV" },
    { key: "evEbitda", label: "EV/EBITDA" },
    { key: "debtEbitda", label: "Debt/EBITDA" },
    { key: "roe", label: "ROE", unit: "%" },
    { key: "g", label: "g", unit: "%" },
    { key: "dividendYield", label: t("Дивидендная доходность", "Dividend yield"), unit: "%" },
    { key: "marketCapBn", label: t("Капитализация", "Market cap"), digits: 1, unit: isEn ? " bn" : " млрд" },
    { key: "beta", label: "Beta" },
    { key: "score", label: "Score", digits: 1 },
  ], [isEn, t]);
  const metricRanges = useMemo(() => buildMetricRanges(rows), [rows]);
  const summaryRows = useMemo(() => buildSummaryRows(rows, summaryMetricConfigs, metricRanges), [metricRanges, rows, summaryMetricConfigs]);
  return (
    <div className="space-y-6">
      <FundamentalsTabs />
      <AnalysisPageFrame
      hero={(
        <PageHero
          icon={Filter}
          title={t("Первичная обработка данных", "Data Preprocessing")}
          description={t(
            "Быстрый срез акций до запуска моделей: мультипликаторы, прибыльность, долг, EV/EBITDA и секторная структура.",
            "A quick stock universe view before models: valuation, profitability, debt, EV/EBITDA, and sector structure.",
          )}
          accent="blue"
        />
      )}
      sidebar={(
        <AnalysisSidebarCard
          icon={Database}
          title={t("Источник данных", "Data Source")}
          description={t("Используется кэш фундаментальных данных T-Bank.", "Uses the T-Bank fundamentals cache.")}
          accent="blue"
        >
          <div className="space-y-4">
            <div className="ui-surface-muted space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span>{t("Акций", "Shares")}</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{cache.shares.length}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span>{t("Фундаменталок", "Fundamentals")}</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{Object.keys(cache.fundamentalsByFigi).length}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span>{t("Секторов", "Sectors")}</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{sectorRows.length}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadFundamentals()}
              disabled={isLoading}
              className="ui-primary-button w-full bg-gradient-to-r from-blue-700 to-cyan-700 hover:from-blue-800 hover:to-cyan-800"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              {isLoading ? t("Загрузка...", "Loading...") : t("Обновить кэш", "Refresh Cache")}
            </button>
            {!hasData && (
              <p className="text-xs leading-5 text-amber-700 dark:text-amber-300">
                {t("Сначала загрузите фундаментальные данные.", "Load fundamentals first.")}
              </p>
            )}
          </div>
        </AnalysisSidebarCard>
      )}
    >
      <MetricGrid>
        <MetricCard label={t("Акций в срезе", "Stocks in universe")} value={rows.length} />
        <MetricCard label={t("Первичный отбор", "Initial selection")} value={selectedRows.length} helper={t("Score >= 60", "Score >= 60")} />
        <MetricCard label={t("Секторов", "Sectors")} value={sectorRows.length} />
        <MetricCard label={t("Медианный score", "Median score")} value={formatNumber(medianScore, 1)} />
      </MetricGrid>

      <SectionCard
        title={t("Средние и медианные значения", "Average and Median Values")}
        description={t(
          "Сводка считается по очищенным значениям: экстремальные выбросы не попадают в среднее, медиану и диапазон.",
          "The summary uses cleaned values: extreme outliers are excluded from averages, medians, and ranges.",
        )}
      >
        <div className="ui-table-shell overflow-x-auto">
          <table className="ui-data-table">
            <thead>
              <tr>
                <th>{t("Показатель", "Metric")}</th>
                <th>{t("Среднее", "Average")}</th>
                <th>{t("Медиана", "Median")}</th>
                <th>Min</th>
                <th>Max</th>
                <th>N</th>
                <th>{t("Отсечено", "Filtered")}</th>
              </tr>
            </thead>
            <tbody>
              {summaryRows.map((row) => (
                <tr key={row.key}>
                  <td className="font-medium text-slate-900 dark:text-slate-100">{row.label}</td>
                  <td className="ui-cell-number">{formatSummaryValue(row.average, row)}</td>
                  <td className="ui-cell-number font-semibold text-blue-700 dark:text-blue-300">{formatSummaryValue(row.median, row)}</td>
                  <td className="ui-cell-number">{formatSummaryValue(row.min, row)}</td>
                  <td className="ui-cell-number">{formatSummaryValue(row.max, row)}</td>
                  <td className="ui-cell-number">{row.count}</td>
                  <td className="ui-cell-number">{row.filteredOut}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
      <SectionCard
        title={t("Первичный отбор акций", "Initial Stock Selection")}
        description={t(
          "Топ акций по первичному composite-score на базе мультипликаторов и прибыльности.",
          "Top stocks by initial composite score based on valuation and profitability.",
        )}
        action={<Link to="/fundamentals" className="ui-secondary-button px-3 py-2 text-xs"><ArrowRight className="h-4 w-4" />{t("Фундаментальные данные", "Fundamentals")}</Link>}
      >
        <div className="ui-table-shell overflow-x-auto">
          <table className="ui-data-table">
            <thead>
              <tr>
                <th>{t("Акция", "Stock")}</th>
                <th>{t("Сектор", "Sector")}</th>
                <th>Score</th>
                <th>P/E</th>
                <th>P/BV</th>
                <th>ROE</th>
                <th>EV/EBITDA</th>
                <th>Debt/EBITDA</th>
              </tr>
            </thead>
            <tbody>
              {topRows.map((row) => (
                <tr key={row.figi}>
                  <td>
                    <div className="flex min-w-56 items-center gap-3">
                      <StockAvatar ticker={row.ticker} name={row.name} logoUrl={row.logoUrl} />
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{row.ticker}</div>
                        <div className="max-w-52 truncate text-xs text-slate-500 dark:text-slate-400">{row.name}</div>
                      </div>
                    </div>
                  </td>
                  <td>{row.sector}</td>
                  <td className="ui-cell-number font-semibold text-blue-700 dark:text-blue-300">{formatNumber(row.score, 1)}</td>
                  <td className="ui-cell-number">{formatNumber(row.pe)}</td>
                  <td className="ui-cell-number">{formatNumber(row.pbv)}</td>
                  <td className="ui-cell-number">{formatNumber(row.roe)}%</td>
                  <td className="ui-cell-number">{formatNumber(row.evEbitda)}</td>
                  <td className="ui-cell-number">{formatNumber(row.debtEbitda)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <ScatterSection
        title="P/E и g"
        description={t("Оценка стоимости относительно темпа роста; g сейчас строится из доступной ROE-прокси.", "Valuation relative to growth; g currently uses the available ROE proxy.")}
        rows={rows}
        sectors={sectorRows}
        xKey="pe"
        yKey="g"
        xLabel="P/E"
        yLabel="g"
        yUnit="%"
      />

      <ScatterSection
        title="P/BV и ROE"
        description={t("Баланс между балансовой оценкой и доходностью капитала.", "Balance between book valuation and return on equity.")}
        rows={rows}
        sectors={sectorRows}
        xKey="pbv"
        yKey="roe"
        xLabel="P/BV"
        yLabel="ROE"
        yUnit="%"
      />

      <ScatterSection
        title="Debt/EBITDA и EV/EBITDA"
        description={t("Сопоставление долговой нагрузки и enterprise value к EBITDA.", "Debt load compared with enterprise value to EBITDA.")}
        rows={rows}
        sectors={sectorRows}
        xKey="debtEbitda"
        yKey="evEbitda"
        xLabel="Debt/EBITDA"
        yLabel="EV/EBITDA"
      />

      <SectionCard
        title={t("Распределение по секторам", "Sector Distribution")}
        description={t("Количество акций и средний score в каждом секторе.", "Stock count and average score by sector.")}
      >
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={sectorRows.slice(0, 14)} layout="vertical" margin={{ top: 4, right: 36, left: 140, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" stroke="#64748b" />
            <YAxis type="category" dataKey="sector" width={140} stroke="#64748b" />
            <Tooltip formatter={(value: number, name: string) => [Number(value).toFixed(name === "averageScore" ? 1 : 0), name === "averageScore" ? (isEn ? "Avg score" : "Средний score") : (isEn ? "Count" : "Количество")]} />
            <Bar dataKey="count" radius={[0, 5, 5, 0]}>
              {sectorRows.slice(0, 14).map((row) => (
                <Cell key={row.sector} fill={row.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>
      </AnalysisPageFrame>
    </div>
  );
}
