import { useMemo } from "react";
import { ArrowRight, Database, Filter, RefreshCw } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
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
import type { ScatterSectionProps, ScreeningRow, SummaryMetricConfig } from "../model";
import {
  axisTitle,
  buildMetricRanges,
  buildSectorRows,
  buildSummaryRows,
  chartRows,
  finiteOrZero,
  formatNumber,
  formatSummaryValue,
  maybeLogoUrl,
  scoreRows,
  sectorLabel,
  toPercent,
} from "../lib";

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
        <ScatterChart margin={{ top: 10, right: 28, bottom: 42, left: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            type="number"
            dataKey={xKey}
            name={xLabel}
            unit={xUnit}
            stroke="#64748b"
            tickMargin={8}
            label={{ value: axisTitle(xLabel, xUnit), position: "insideBottom", offset: -26, fill: "#64748b" }}
          />
          <YAxis
            type="number"
            dataKey={yKey}
            name={yLabel}
            unit={yUnit}
            stroke="#64748b"
            tickMargin={8}
            label={{ value: axisTitle(yLabel, yUnit), angle: -90, position: "insideLeft", fill: "#64748b" }}
          />
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
          <BarChart data={sectorRows.slice(0, 14)} layout="vertical" margin={{ top: 4, right: 72, left: 168, bottom: 34 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              type="number"
              stroke="#64748b"
              tickMargin={8}
              label={{ value: t("Количество акций", "Stock count"), position: "insideBottom", offset: -24, fill: "#64748b" }}
            />
            <YAxis
              type="category"
              dataKey="sector"
              width={160}
              stroke="#64748b"
              tickMargin={8}
              label={{ value: t("Сектор", "Sector"), angle: -90, position: "insideLeft", fill: "#64748b" }}
            />
            <Tooltip formatter={(value: number, name: string) => [Number(value).toFixed(name === "averageScore" ? 1 : 0), name === "averageScore" ? (isEn ? "Avg score" : "Средний score") : (isEn ? "Count" : "Количество")]} />
            <Bar dataKey="count" radius={[0, 5, 5, 0]}>
              <LabelList
                dataKey="count"
                position="right"
                formatter={(value: number) => Number(value).toFixed(0)}
                fill="#334155"
                fontSize={12}
              />
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
