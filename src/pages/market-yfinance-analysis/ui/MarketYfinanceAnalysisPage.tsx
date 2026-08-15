import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  Download,
  Gem,
  Globe2,
  Play,
  RefreshCw,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { API_BASE_URL } from "../../../config";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import { SavePortfolioButton } from "../../../features/saved-portfolios";
import {
  downloadAnalysisResultsAsXlsx,
  downloadSvgAsPng,
} from "../../../shared/lib/export/download";
import {
  AnalysisLoadingPreview,
  AnalysisRunningIndicator,
  PortfolioHoldingsPanel,
} from "../../../shared/ui/analysis";
import {
  AnalysisPageFrame,
  AnalysisSidebarCard,
  MetricCard,
  MetricGrid,
  PageHero,
  SectionCard,
} from "../../../shared/ui/analysis-shell";
import { readMarketAnalysisCache, saveMarketAnalysisCache } from "../lib";
import {
  DEFAULT_MARKET_ANALYSIS_PERIOD,
  MARKET_ANALYSIS_PERIOD_OPTIONS,
  type MarketAnalysisResponse,
  type MarketMetricMap,
  type MarketMode,
  type MarketPosition,
  type SourceAsset,
} from "../model";

const MARKET_PALETTE = [
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#0d9488",
  "#ea580c",
  "#be123c",
];

const MODE_CONFIG = {
  indexes: {
    endpoint: "/analysis-indexes-yfinance",
    titleRu: "Анализ индексов",
    titleEn: "Index Analysis",
    badgeRu: "yfinance • месячная доходность",
    badgeEn: "yfinance • monthly returns",
    descriptionRu:
      "Рынки США, Кореи, Японии, Материкового Китая, Гонконга, Саудовской Аравии, Бразилии и Южной Африки. Портфель оптимизируется по максимальному коэффициенту Шарпа.",
    descriptionEn:
      "US, Korea, Japan, Mainland China, Hong Kong, Saudi Arabia, Brazil, and South Africa markets. The portfolio is optimized for the maximum Sharpe ratio.",
    icon: Globe2,
    accent: "blue" as const,
    filePrefix: "indexes-market",
    assetLabelRu: "Рынок",
    assetLabelEn: "Market",
  },
  commodities: {
    endpoint: "/analysis-commodities-yfinance",
    titleRu: "Анализ товаров",
    titleEn: "Commodity Analysis",
    badgeRu: "yfinance • месячная доходность",
    badgeEn: "yfinance • monthly returns",
    descriptionRu:
      "Золото, серебро, медь, Brent, Henry Hub, пшеница, сахар, платина и палладий. Портфель оптимизируется по максимальному коэффициенту Шарпа.",
    descriptionEn:
      "Gold, silver, copper, Brent, Henry Hub gas, wheat, sugar, platinum, and palladium. The portfolio is optimized for the maximum Sharpe ratio.",
    icon: Gem,
    accent: "amber" as const,
    filePrefix: "commodities-market",
    assetLabelRu: "Товар",
    assetLabelEn: "Commodity",
  },
};

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function formatNumber(value: unknown, digits = 2): string {
  const parsed = toNumber(value);
  return Number.isFinite(parsed) ? parsed.toFixed(digits) : "-";
}

function formatPercent(value: unknown, digits = 2): string {
  const parsed = toNumber(value);
  if (!Number.isFinite(parsed)) {
    return "-";
  }
  const percent = Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
  return `${percent.toFixed(digits)}%`;
}

function formatWeight(value: unknown): number {
  const parsed = toNumber(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
}

function pickAssetName(asset: string, sourceAssets: SourceAsset[]): string {
  return sourceAssets.find((item) => item.key === asset)?.name ?? asset;
}

function normalizePositions(response: MarketAnalysisResponse): MarketPosition[] {
  const sourceAssets = response.source?.assets ?? [];
  return (response.portfolios?.max_sharpe?.positions ?? [])
    .map((row) => {
      const asset = String(row.asset ?? "");
      const sourceAsset = sourceAssets.find((item) => item.key === asset);
      return {
        asset,
        ticker: sourceAsset?.ticker ?? asset,
        name: sourceAsset?.name ?? asset,
        weight: formatWeight(row.weight),
      };
    })
    .filter((row) => row.asset && row.weight > 0)
    .sort((a, b) => b.weight - a.weight);
}

function normalizeFrontier(response: MarketAnalysisResponse) {
  return (response.efficient_frontier ?? [])
    .map((row) => ({
      return: toNumber(row.return) * 100,
      volatility: toNumber(row.volatility) * 100,
    }))
    .filter((row) => Number.isFinite(row.return) && Number.isFinite(row.volatility));
}

function getAssetKey(row: Record<string, unknown>): string {
  return String(row.asset ?? row.index ?? row.Asset ?? row.Metal ?? "");
}

function getAnnualReturn(row: Record<string, unknown>): number {
  const direct = toNumber(row["Annual Return"]);
  if (Number.isFinite(direct)) {
    return direct * 100;
  }
  return toNumber(row["Annual Return (%)"]);
}

function getAnnualVolatility(row: Record<string, unknown>): number {
  const direct = toNumber(row["Annual Volatility"]);
  if (Number.isFinite(direct)) {
    return direct * 100;
  }
  return toNumber(row["Annual Volatility (%)"]);
}

function normalizeStatistics(response: MarketAnalysisResponse) {
  const sourceAssets = response.source?.assets ?? [];
  return (response.statistics ?? [])
    .map((row) => {
      const asset = getAssetKey(row);
      return {
        asset,
        name: pickAssetName(asset, sourceAssets),
        return: getAnnualReturn(row),
        volatility: getAnnualVolatility(row),
        sharpe: toNumber(row["Sharpe Ratio"]),
      };
    })
    .filter((row) => row.asset);
}

function normalizeCorrelations(response: MarketAnalysisResponse) {
  const sourceAssets = response.source?.assets ?? [];
  return (response.top_correlations ?? [])
    .map((row) => {
      const left = String(row.asset1 ?? "");
      const right = String(row.asset2 ?? "");
      return {
        left,
        right,
        leftName: pickAssetName(left, sourceAssets),
        rightName: pickAssetName(right, sourceAssets),
        correlation: toNumber(row.correlation),
      };
    })
    .filter((row) => row.left && row.right && Number.isFinite(row.correlation));
}

function metricRows(metrics: MarketMetricMap | undefined, isCommodities: boolean) {
  if (!metrics) {
    return [];
  }
  const rows = [
    { label: "Expected Return", value: formatPercent(metrics["Expected Return"]) },
    { label: "Volatility", value: formatPercent(metrics.Volatility) },
    { label: "Sharpe Ratio", value: formatNumber(metrics["Sharpe Ratio"], 3) },
    { label: "VaR 95%", value: formatPercent(metrics["VaR 95%"]) },
    { label: "CVaR 95%", value: formatPercent(metrics["CVaR 95%"]) },
    { label: "HHI", value: formatNumber(metrics.HHI, 3) },
    { label: "Assets", value: formatNumber(metrics["Number of Assets"], 0) },
  ];
  if (isCommodities) {
    rows.push(
      { label: "Precious", value: formatPercent(metrics["Precious Metals Weight"]) },
      { label: "Industrial", value: formatPercent(metrics["Industrial Metals Weight"]) },
      { label: "Energy", value: formatPercent(metrics["Energy Weight"]) },
    );
  }
  return rows;
}

function MarketYfinanceAnalysisPage({ mode }: { mode: MarketMode }) {
  const { locale, t } = useAppSettings();
  const config = MODE_CONFIG[mode];
  const initialCache = useMemo(
    () => readMarketAnalysisCache(mode, DEFAULT_MARKET_ANALYSIS_PERIOD),
    [mode],
  );
  const [period, setPeriod] = useState(DEFAULT_MARKET_ANALYSIS_PERIOD);
  const [result, setResult] = useState<MarketAnalysisResponse | null>(initialCache?.result ?? null);
  const [cachedAt, setCachedAt] = useState<string | null>(initialCache?.savedAt ?? null);
  const [isCachedResult, setIsCachedResult] = useState(Boolean(initialCache));
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const portfolioChartRef = useRef<HTMLDivElement | null>(null);
  const frontierChartRef = useRef<HTMLDivElement | null>(null);

  const positions = useMemo(() => (result ? normalizePositions(result) : []), [result]);
  const frontier = useMemo(() => (result ? normalizeFrontier(result) : []), [result]);
  const statistics = useMemo(() => (result ? normalizeStatistics(result) : []), [result]);
  const correlations = useMemo(() => (result ? normalizeCorrelations(result) : []), [result]);
  const metrics = useMemo(
    () => metricRows(result?.portfolios?.max_sharpe?.metrics, mode === "commodities"),
    [mode, result],
  );
  const maxSharpePoint = useMemo(() => {
    const rawMetrics = result?.portfolios?.max_sharpe?.metrics;
    if (!rawMetrics) {
      return [];
    }
    return [
      {
        return: toNumber(rawMetrics["Expected Return"]) * 100,
        volatility: toNumber(rawMetrics.Volatility) * 100,
      },
    ].filter((row) => Number.isFinite(row.return) && Number.isFinite(row.volatility));
  }, [result]);

  useEffect(() => {
    const cached = readMarketAnalysisCache(mode, period);
    setResult(cached?.result ?? null);
    setCachedAt(cached?.savedAt ?? null);
    setIsCachedResult(Boolean(cached));
    setError(null);
  }, [mode, period]);

  const runAnalysis = async () => {
    setIsRunning(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}${config.endpoint}?period=${encodeURIComponent(period)}`);
      const text = await response.text();
      const parsed = text ? (JSON.parse(text) as MarketAnalysisResponse | { detail?: unknown }) : {};
      if (!response.ok) {
        const detail = (parsed as { detail?: unknown }).detail;
        throw new Error(typeof detail === "string" ? detail : t("Не удалось выполнить анализ.", "Analysis failed."));
      }
      const nextResult = parsed as MarketAnalysisResponse;
      const cacheEntry = saveMarketAnalysisCache(mode, period, nextResult);
      setResult(nextResult);
      setCachedAt(cacheEntry?.savedAt ?? null);
      setIsCachedResult(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Не удалось выполнить анализ.", "Analysis failed."));
    } finally {
      setIsRunning(false);
    }
  };

  const exportXlsx = async () => {
    if (!positions.length) {
      return;
    }
    await downloadAnalysisResultsAsXlsx({
      title: t({ ru: config.titleRu, en: config.titleEn }),
      filename: `${config.filePrefix}-max-sharpe.xlsx`,
      rows: positions,
      columns: [
        { header: "Ticker", render: (row: MarketPosition) => row.ticker },
        { header: t({ ru: config.assetLabelRu, en: config.assetLabelEn }), render: (row: MarketPosition) => row.name },
        { header: t("Вес, %", "Weight, %"), render: (row: MarketPosition) => row.weight.toFixed(2) },
      ],
      metrics,
    });
  };

  const saveFrontierPng = async () => {
    const svg = frontierChartRef.current?.querySelector("svg");
    if (svg) {
      await downloadSvgAsPng(svg as SVGSVGElement, `${config.filePrefix}-efficient-frontier.png`);
    }
  };

  const savePortfolioPng = async () => {
    const svg = portfolioChartRef.current?.querySelector("svg");
    if (svg) {
      await downloadSvgAsPng(svg as SVGSVGElement, `${config.filePrefix}-max-sharpe-weights.png`);
    }
  };

  const source = result?.source;
  const Icon = config.icon;

  return (
    <AnalysisPageFrame
      hero={(
        <PageHero
          icon={Icon}
          title={t({ ru: config.titleRu, en: config.titleEn })}
          description={t({ ru: config.descriptionRu, en: config.descriptionEn })}
          badge={t({ ru: config.badgeRu, en: config.badgeEn })}
          accent={config.accent}
          aside={source ? (
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-white/60">yfinance</div>
              <div className="font-semibold">{source.start_date} - {source.end_date}</div>
              <div className="text-xs text-slate-600 dark:text-white/75">
                {source.loaded_assets_count} {t("активов", "assets")} / {source.observations} {t("месяцев", "months")}
              </div>
              {cachedAt ? (
                <div className="pt-1 text-xs text-slate-500 dark:text-white/70">
                  {isCachedResult ? t("Из кэша", "From cache") : t("Сохранено", "Saved")}: {new Date(cachedAt).toLocaleString(locale === "en" ? "en-US" : "ru-RU")}
                </div>
              ) : null}
            </div>
          ) : undefined}
        />
      )}
      sidebar={(
        <div className="space-y-4">
          <AnalysisSidebarCard
            icon={RefreshCw}
            title={t("Источник и период", "Source and Period")}
            description={t(
              "Данные загружаются с yfinance месячными ценами закрытия.",
              "Data is loaded from yfinance as monthly close prices.",
            )}
            accent={config.accent}
          >
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                  {t("Период", "Period")}
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {MARKET_ANALYSIS_PERIOD_OPTIONS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      disabled={isRunning}
                      onClick={() => setPeriod(item)}
                      className={`rounded-md border px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
                        period === item
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-slate-700 hover:bg-muted dark:text-slate-200"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
              <button type="button" className="ui-primary-button w-full" disabled={isRunning} onClick={() => void runAnalysis()}>
                {isRunning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {isRunning
                  ? t("Считаем...", "Running...")
                  : result
                    ? t("Обновить анализ", "Refresh analysis")
                    : t("Запустить анализ", "Run analysis")}
              </button>
            </div>
          </AnalysisSidebarCard>

          {source?.assets?.length ? (
            <AnalysisSidebarCard icon={BarChart3} title={t("Инструменты", "Instruments")} accent="slate">
              <div className="space-y-2">
                {source.assets.map((asset) => (
                  <div key={asset.key} className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2 text-xs">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-900 dark:text-slate-100">{asset.name}</div>
                      <div className="text-slate-500 dark:text-slate-400">{asset.ticker}</div>
                    </div>
                    <span className={asset.loaded ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"}>
                      {asset.loaded ? t("OK", "OK") : t("нет", "no")}
                    </span>
                  </div>
                ))}
              </div>
            </AnalysisSidebarCard>
          ) : null}
        </div>
      )}
    >
      <div className="space-y-6">
        {error ? (
          <SectionCard>
            <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          </SectionCard>
        ) : null}

        {isRunning ? (
          <>
            <AnalysisRunningIndicator
              title={t({ ru: config.titleRu, en: config.titleEn })}
              subtitle={t("Загружаем yfinance и оптимизируем портфель по max Sharpe", "Loading yfinance data and optimizing the max-Sharpe portfolio")}
              accentClassName={mode === "indexes" ? "text-blue-600" : "text-amber-600"}
            />
            <AnalysisLoadingPreview
              accentClassName={mode === "indexes" ? "text-blue-600" : "text-amber-600"}
              metricCount={8}
              metricsTitle={t("Метрики портфеля", "Portfolio metrics")}
              metricsDescription={t("Рассчитываем доходность, риск и коэффициенты.", "Calculating return, risk, and ratios.")}
              chartsTitle={t("Портфель и эффективная граница", "Portfolio and efficient frontier")}
              chartsDescription={t("Строим веса активов и пространство доступных портфелей.", "Building asset weights and the available portfolio set.")}
              charts={[
                { title: t("Распределение весов", "Weight allocation"), variant: "bars" },
                { title: t("Эффективная граница", "Efficient frontier"), variant: "scatter" },
              ]}
              tableTitle={t("Метрики активов", "Asset metrics")}
              tableDescription={t("Готовим итоговую таблицу по инструментам.", "Preparing the final instrument table.")}
              tableRows={8}
              tableColumns={5}
            />
          </>
        ) : null}

        {!isRunning && result ? (
          <>
            {!!metrics.length && (
              <MetricGrid>
                {metrics.slice(0, 8).map((metric) => (
                  <MetricCard key={metric.label} label={metric.label} value={metric.value} />
                ))}
              </MetricGrid>
            )}

            {!!positions.length && (
              <SectionCard
                title={t("Портфель с максимальным Шарпом", "Maximum Sharpe Portfolio")}
                description={t(
                  "Веса рассчитаны по месячным доходностям, годовая доходность и риск приведены к частоте 12 периодов в год.",
                  "Weights are calculated from monthly returns; annual return and risk use 12 periods per year.",
                )}
                action={(
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="ui-secondary-button px-3 py-2 text-xs" onClick={() => void exportXlsx()}>
                      <Download className="h-4 w-4" />
                      XLSX
                    </button>
                    <button type="button" className="ui-secondary-button px-3 py-2 text-xs" onClick={() => void savePortfolioPng()}>
                      <Download className="h-4 w-4" />
                      PNG
                    </button>
                    <SavePortfolioButton
                      holdings={positions}
                      metrics={metrics.map((metric) => ({
                        label: metric.label,
                        value: metric.value,
                        rawValue: metric.value,
                      }))}
                      sourceKey={mode}
                      sourceLabel={t({ ru: config.titleRu, en: config.titleEn })}
                      assetClass={mode === "indexes" ? "index" : "commodity"}
                      defaultName={t(
                        mode === "indexes" ? "Портфель индексов" : "Портфель товаров",
                        mode === "indexes" ? "Index Portfolio" : "Commodity Portfolio",
                      )}
                      disabled={!positions.length}
                    />
                  </div>
                )}
              >
                <PortfolioHoldingsPanel
                  rows={positions}
                  palette={MARKET_PALETTE}
                  chartRef={portfolioChartRef}
                  companyLabel={t({ ru: config.assetLabelRu, en: config.assetLabelEn })}
                  weightLabel={t("Вес, %", "Weight, %")}
                />
              </SectionCard>
            )}

            {!!frontier.length && (
              <SectionCard
                title={t("Эффективная граница", "Efficient Frontier")}
                action={(
                  <button type="button" className="ui-secondary-button px-3 py-2 text-xs" onClick={() => void saveFrontierPng()}>
                    <Download className="h-4 w-4" />
                    PNG
                  </button>
                )}
              >
                <div className="h-[22rem]" ref={frontierChartRef}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 16, right: 24, bottom: 24, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="volatility" name={t("Риск", "Risk")} unit="%" tick={{ fontSize: 12 }} />
                      <YAxis dataKey="return" name={t("Доходность", "Return")} unit="%" tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value: number, name: string) => [`${Number(value).toFixed(2)}%`, name]}
                        labelFormatter={() => t("Портфель", "Portfolio")}
                      />
                      <Scatter data={frontier} fill="#94a3b8" line={{ stroke: "#64748b", strokeWidth: 2 }} />
                      <Scatter data={maxSharpePoint} fill="#16a34a">
                        {maxSharpePoint.map((_, index) => <Cell key={index} fill="#16a34a" />)}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>
            )}

            {!!statistics.length && (
              <SectionCard title={t("Годовые метрики активов", "Annual Asset Metrics")}>
                <div className="grid gap-6 xl:grid-cols-2">
                  <div className="h-[20rem]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={statistics} margin={{ top: 12, right: 16, bottom: 64, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="asset" interval={0} angle={-35} textAnchor="end" tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={(value) => `${value}%`} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(value: number) => `${Number(value).toFixed(2)}%`} />
                        <Bar dataKey="return" name={t("Доходность", "Return")} fill="#2563eb" radius={[5, 5, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="h-[20rem]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={statistics} margin={{ top: 12, right: 16, bottom: 64, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="asset" interval={0} angle={-35} textAnchor="end" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="sharpe" name="Sharpe" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </SectionCard>
            )}

            {!!correlations.length && (
              <SectionCard title={t("Самые сильные корреляции", "Strongest Correlations")}>
                <div className="ui-table-shell overflow-x-auto">
                  <table className="ui-data-table min-w-[42rem]">
                    <thead>
                      <tr>
                        <th>{t("Актив 1", "Asset 1")}</th>
                        <th>{t("Актив 2", "Asset 2")}</th>
                        <th>{t("Корреляция", "Correlation")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {correlations.map((row) => (
                        <tr key={`${row.left}-${row.right}`}>
                          <td className="font-medium text-slate-900 dark:text-slate-100">{row.leftName}</td>
                          <td>{row.rightName}</td>
                          <td className="ui-cell-number">{row.correlation.toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            )}
          </>
        ) : !isRunning ? (
          <SectionCard
            title={t("Готово к запуску", "Ready to Run")}
            description={t(
              "Выберите период и запустите анализ. Данные будут загружены с yfinance автоматически.",
              "Choose a period and run the analysis. Data will be loaded from yfinance automatically.",
            )}
          >
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { label: t("Источник", "Source"), value: "yfinance" },
                { label: t("Доходность", "Returns"), value: t("месячная", "monthly") },
                { label: t("Оптимизация", "Optimization"), value: "max Sharpe" },
              ].map((item) => (
                <div key={item.label} className="ui-stat-card">
                  <div className="text-xs text-slate-500 dark:text-slate-400">{item.label}</div>
                  <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">{item.value}</div>
                </div>
              ))}
            </div>
          </SectionCard>
        ) : null}
      </div>
    </AnalysisPageFrame>
  );
}

export function IndexesAnalysisPage() {
  return <MarketYfinanceAnalysisPage mode="indexes" />;
}

export function CommoditiesAnalysisPage() {
  return <MarketYfinanceAnalysisPage mode="commodities" />;
}
