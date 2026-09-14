import { useEffect, useMemo, useRef, useState } from "react";
import { FileSpreadsheet, FileText, ImageDown, Layers, Play, Settings } from "lucide-react";
import { useFundamentals } from "../../../entities/fundamentals";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import {
  getOptimizationSummary,
  OptimizerSettingsFields,
  submitOptimizerSettings,
  useOptimizerSettings,
} from "../../../features/optimizer-settings";

import { SavePortfolioButton } from "../../../features/saved-portfolios";
import { API_BASE_URL } from "../../../config";
import type {
  HybridMetricItem as MetricItem,
  HybridModelScore as ModelScore,
  HybridPortfolioPosition as PortfolioPosition,
  HybridStrategyPortfolio as StrategyPortfolio,
  HybridTrainingPoint as TrainingPoint,
} from "../../../features/hybrid-analysis";
import {
  formatMetricDisplay,
  getMetricTooltip,
  isVisibleAnalysisMetric,
  localizeMetricLabel,
} from "../../../shared/lib/analysis/metric-display";
import {
  downloadAnalysisResultsAsPdf,
  downloadAnalysisResultsAsXlsx,
  downloadSvgAsPng,
  getPortfolioHoldingColumns,
} from "../../../shared/lib/export/download";
import {
  AnalysisPageFrame,
  AnalysisSidebarCard,
  MetricCard,
  MetricGrid,
  PageHero,
  SectionCard,
} from "../../../shared/ui/analysis-shell";
import { AppErrorDialog } from "../../../shared/ui/app-error-dialog";
import { AnalysisLoadingPreview } from "../../../shared/ui/analysis/AnalysisLoadingPreview";
import { AnalysisRunningIndicator } from "../../../shared/ui/analysis/AnalysisRunningIndicator";
import { MetricTooltip } from "../../../shared/ui/analysis/MetricTooltip";
import { PortfolioHoldingsPanel } from "../../../shared/ui/analysis/PortfolioHoldingsPanel";
import {
  DEFAULT_SERVER_ERROR_EN,
  DEFAULT_SERVER_ERROR_RU,
  HYBRID_PALETTE,
  HYBRID_STATE_KEY,
} from "../model";
import {
  extractErrorText,
  extractMetrics,
  extractModelScores,
  extractPortfolioAssetsCount,
  extractPortfolioPositions,
  extractPortfolioStrategies,
  extractTrainingHistory,
  normalizePortfolioSettings,
  safeParseJsonObject,
} from "../lib";

function formatPortfolioMetricValue(label: string, value: number): string {
  return Number.isFinite(value) ? formatMetricDisplay(label, String(value)) : "-";
}
export function HybridAnalysis() {
  const { hasData, cache } = useFundamentals();
  const { locale, t } = useAppSettings();
  const isEn = locale === "en";
  const { settings: optimizerSettings, setSettings: setOptimizerSettings } = useOptimizerSettings();

  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDialogMessage, setErrorDialogMessage] = useState<string | null>(null);
  const [modelComparison, setModelComparison] = useState<ModelScore[]>([]);
  const [metrics, setMetrics] = useState<MetricItem[]>([]);
  const [portfolioStrategies, setPortfolioStrategies] = useState<StrategyPortfolio[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioPosition[]>([]);
  const [trainingHistory, setTrainingHistory] = useState<TrainingPoint[]>([]);
  const [portfolioAssetsCount, setPortfolioAssetsCount] = useState(0);
  const portfolioChartRef = useRef<HTMLDivElement | null>(null);
  const visibleMetrics = useMemo(() => metrics.filter((item) => isVisibleAnalysisMetric(item.label)), [metrics]);
  const selectedPortfolioStrategy = useMemo(
    () => portfolioStrategies.find((item) => item.key === "selected_portfolio") ?? portfolioStrategies[0] ?? null,
    [portfolioStrategies],
  );
  const optimalPortfolioMetricCards = useMemo(() => {
    if (selectedPortfolioStrategy) {
      const assetsCount = selectedPortfolioStrategy.assetsCount || portfolioAssetsCount || portfolio.length;
      return [
        {
          key: "expected-return",
          label: localizeMetricLabel("Expected Return", isEn),
          value: formatPortfolioMetricValue("Expected Return", selectedPortfolioStrategy.expectedReturn),
          tooltip: getMetricTooltip("Expected Return", isEn),
        },
        {
          key: "risk",
          label: localizeMetricLabel("Risk", isEn),
          value: formatPortfolioMetricValue("Risk", selectedPortfolioStrategy.risk),
          tooltip: getMetricTooltip("Risk", isEn),
        },
        {
          key: "sharpe",
          label: localizeMetricLabel("Sharpe Ratio", isEn),
          value: formatPortfolioMetricValue("Sharpe Ratio", selectedPortfolioStrategy.sharpe),
          tooltip: getMetricTooltip("Sharpe Ratio", isEn),
        },
        {
          key: "diversification",
          label: localizeMetricLabel("Diversification", isEn),
          value: formatPortfolioMetricValue("Diversification", selectedPortfolioStrategy.diversification),
          tooltip: getMetricTooltip("Diversification", isEn),
        },
        {
          key: "assets",
          label: t("Позиций", "Positions"),
          value: String(Math.max(Math.round(assetsCount), 0)),
          tooltip: null,
        },
      ];
    }

    const portfolioMetricLabels = new Set(["expected return", "risk", "volatility", "sharpe", "sharpe ratio", "diversification"]);
    return visibleMetrics
      .filter((item) => portfolioMetricLabels.has(item.label.trim().toLowerCase()))
      .map((item) => ({
        key: item.label,
        label: localizeMetricLabel(item.label, isEn),
        value: formatMetricDisplay(item.label, item.value),
        tooltip: getMetricTooltip(item.label, isEn),
      }));
  }, [isEn, portfolio.length, portfolioAssetsCount, selectedPortfolioStrategy, t, visibleMetrics]);
  const requestData = useMemo(
    () =>
      cache.shares
        .map((share) => {
          const f = cache.fundamentalsByFigi[share.figi];
          if (!f) {
            return null;
          }

          return {
            figi: share.figi,
            ticker: share.ticker,
            name: share.name,
            exchange: share.exchange,
            currency: share.currency,
            lot: share.lot,
            liquidity_flag: share.liquidityFlag,
            api_trade_available_flag: share.apiTradeAvailableFlag,
            buy_available_flag: share.buyAvailableFlag,
            sell_available_flag: share.sellAvailableFlag,
            otc_flag: share.otcFlag,
            market_cap_bn: f.marketCapBn,
            pe_ratio: f.peRatio,
            pb_ratio: f.pbRatio,
            ps_ratio: f.psRatio,
            ev_to_ebitda: f.evToEbitda,
            roa: f.roa,
            net_margin: f.netMargin,
            net_debt_to_ebitda: f.netDebtToEbitda,
            total_debt: f.totalDebt,
            roe: f.roe,
            dividend_yield: f.dividendYield,
            beta: f.beta,
            g: f.roe,
            growth_rate: f.roe,
            growthRate: f.roe,
          };
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row)),
    [cache.fundamentalsByFigi, cache.shares],
  );

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(HYBRID_STATE_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as {
        modelComparison?: ModelScore[];
        metrics?: MetricItem[];
        portfolioStrategies?: StrategyPortfolio[];
        portfolio?: PortfolioPosition[];
        trainingHistory?: TrainingPoint[];
        portfolioAssetsCount?: number;
        error?: string | null;
      };
      if (Array.isArray(parsed.modelComparison)) setModelComparison(parsed.modelComparison);
      if (Array.isArray(parsed.metrics)) setMetrics(parsed.metrics.filter((item) => isVisibleAnalysisMetric(item.label)));
      if (Array.isArray(parsed.portfolioStrategies)) setPortfolioStrategies(parsed.portfolioStrategies);
      if (Array.isArray(parsed.portfolio)) setPortfolio(parsed.portfolio);
      if (Array.isArray(parsed.trainingHistory)) setTrainingHistory(parsed.trainingHistory);
      if (typeof parsed.portfolioAssetsCount === "number") setPortfolioAssetsCount(parsed.portfolioAssetsCount);
      if (typeof parsed.error === "string" || parsed.error === null) setError(parsed.error);
    } catch {
      // Ignore broken persisted state
    }
  }, []);

  useEffect(() => {
    const payload = {
      modelComparison,
      metrics,
      portfolioStrategies,
      portfolio,
      trainingHistory,
      portfolioAssetsCount,
      error,
    };
    window.localStorage.setItem(HYBRID_STATE_KEY, JSON.stringify(payload));
  }, [modelComparison, metrics, portfolioStrategies, portfolio, trainingHistory, portfolioAssetsCount, error]);

  const resetAnalysisResults = () => {
    setModelComparison([]);
    setMetrics([]);
    setPortfolioStrategies([]);
    setPortfolio([]);
    setTrainingHistory([]);
    setPortfolioAssetsCount(0);
  };

  const showErrorDialog = (message: string) => {
    setError(message);
    setErrorDialogMessage(message);
  };

  const formatAnalysisError = (text: string): string => {
    const payload = safeParseJsonObject(text);
    const serverMessage = extractErrorText(payload);
    if (serverMessage) {
      return serverMessage;
    }
    return isEn ? DEFAULT_SERVER_ERROR_EN : DEFAULT_SERVER_ERROR_RU;
  };

  const parseHybridResponse = async (response: Response): Promise<Record<string, unknown>> => {
    const text = await response.text();
    if (!response.ok) {
      throw new Error(formatAnalysisError(text));
    }
    return safeParseJsonObject(text) ?? {};
  };

  const runHybridAnalysis = async () => {
    setError(null);
    setErrorDialogMessage(null);
    setIsRunning(true);

    const numericWeights = { cluster: 50, tree: 25, neural: 25 };

    try {
      if (!optimizerSettings.autoPortfolioOptimization) {
        await submitOptimizerSettings(optimizerSettings);
      }
      const portfolioSettings = normalizePortfolioSettings(optimizerSettings);
      const requestedAssetsCount = optimizerSettings.autoPortfolioOptimization
        ? 20
        : Number(portfolioSettings.portfolio_assets_count ?? 20);
      const response = await fetch(`${API_BASE_URL}/hybrid-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: requestData,
          weights: numericWeights,
          auto_model_tuning: optimizerSettings.autoModelTuning,
          auto_portfolio_optimization: optimizerSettings.autoPortfolioOptimization,
          portfolio_assets_count: requestedAssetsCount,
          use_cache: true,
          portfolio_settings: portfolioSettings,
          optimizer_settings: portfolioSettings,
        }),
      });
      const parsed = await parseHybridResponse(response);

      const parsedScores = extractModelScores(parsed, numericWeights);
      const parsedMetrics = extractMetrics(parsed);
      const parsedStrategies = extractPortfolioStrategies(parsed);
      const parsedPortfolio = extractPortfolioPositions(parsed);
      const parsedHistory = extractTrainingHistory(parsed);
      const parsedAssetsCount = extractPortfolioAssetsCount(parsed);

      setModelComparison(parsedScores);
      setMetrics(parsedMetrics);
      setPortfolioStrategies(parsedStrategies);
      setPortfolio(parsedPortfolio);
      setTrainingHistory(parsedHistory);
      setPortfolioAssetsCount(parsedAssetsCount);
    } catch (e) {
      const fallback = t("Не удалось выполнить гибридный анализ", "Failed to run hybrid analysis");
      const message = e instanceof Error ? e.message : fallback;
      resetAnalysisResults();
      showErrorDialog(message);
    } finally {
      setIsRunning(false);
    }
  };

  const exportPortfolioToXlsx = async () => {
    if (!portfolio.length) {
      return;
    }
    await downloadAnalysisResultsAsXlsx({
      title: t("Оптимальный портфель гибрида", "Hybrid Optimal Portfolio"),
      filename: "hybrid-optimal-portfolio.xlsx",
      rows: portfolio,
      columns: getPortfolioHoldingColumns<PortfolioPosition>({
        name: t("Акция", "Stock"),
        weight: t("Вес, %", "Weight, %"),
      }),
      metrics: optimalPortfolioMetricCards.map((item) => ({
        label: item.label,
        value: item.value,
      })),
    });
  };

  const savePortfolioChartPng = async () => {
    const svg = portfolioChartRef.current?.querySelector("svg");
    if (!svg) {
      return;
    }
    try {
      await downloadSvgAsPng(svg as SVGSVGElement, "hybrid-optimal-portfolio.png");
    } catch (e) {
      const message = e instanceof Error ? e.message : t("Не удалось сохранить PNG", "Failed to save PNG");
      showErrorDialog(message);
    }
  };

  const exportPortfolioToPdf = async () => {
    if (!portfolio.length) {
      return;
    }
    try {
      await downloadAnalysisResultsAsPdf({
        title: t("Оптимальный портфель гибрида", "Hybrid Optimal Portfolio"),
        filename: "hybrid-optimal-portfolio.pdf",
        rows: portfolio,
        columns: getPortfolioHoldingColumns<PortfolioPosition>({
          name: t("Акция", "Stock"),
          weight: t("Вес, %", "Weight, %"),
        }),
        metrics: optimalPortfolioMetricCards.map((item) => ({
          label: item.label,
          value: item.value,
        })),
        chartSvg: portfolioChartRef.current?.querySelector("svg"),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : t("Не удалось сохранить PDF", "Failed to save PDF");
      showErrorDialog(message);
    }
  };

  return (
    <>
      <AnalysisPageFrame
        hero={(
          <PageHero
            icon={Layers}
            title={t("Гибридный анализ", "Hybrid Analysis")}
            description={t(
              "Комбинированный сигнал на базе кластеризации, дерева решений и нейросети.",
              "Combined signal based on clustering, decision tree, and neural network.",
            )}
            accent="cyan"
          />
        )}
        sidebar={(
          <AnalysisSidebarCard
            icon={Settings}
            title={t("Параметры портфеля", "Portfolio Parameters")}
            description={t(
              "Модели и признаки подбираются автоматически; здесь настраивается только итоговый портфель.",
              "Models and features are selected automatically; only the final portfolio is configured here.",
            )}
            accent="cyan"
          >
            <div className="space-y-4">
              <div className="ui-surface-muted">
                <p className="text-sm text-slate-700 dark:text-slate-300">{t("Источник: загруженные фундаментальные данные", "Source: loaded fundamentals")}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("Записей", "Records")}: {requestData.length}</p>
              </div>
              <OptimizerSettingsFields
                settings={optimizerSettings}
                onChange={setOptimizerSettings}
                autoFitWeights
              />
              <button
                type="button"
                onClick={runHybridAnalysis}
                disabled={!hasData || !requestData.length || isRunning}
                className="ui-primary-button w-full bg-gradient-to-r from-cyan-700 to-blue-700 hover:from-cyan-800 hover:to-blue-800"
              >
                <Play className="h-4 w-4" />
                {isRunning ? t("Выполняется...", "Running...") : t("Запустить гибрид", "Run Hybrid")}
              </button>
              {!hasData && (
                <p className="text-xs text-amber-700 dark:text-amber-300">{t("Для запуска сначала загрузите фундаментальные данные.", "Load fundamentals first.")}</p>
              )}
            </div>
          </AnalysisSidebarCard>
        )}
      >
          {isRunning && (
            <>
              <AnalysisRunningIndicator
                title={t("Выполняем гибридный анализ", "Running hybrid analysis")}
                subtitle={t("Собираем сигналы моделей и оптимизируем портфель", "Combining model signals and optimizing portfolio")}
                accentClassName="text-cyan-700"
              />
              <AnalysisLoadingPreview
                accentClassName="text-cyan-700"
                metricCount={4}
                metricsTitle={t("Готовим метрики портфеля", "Preparing portfolio metrics")}
                metricsDescription={t("Считаем ожидаемую доходность, риск, коэффициент Шарпа и диверсификацию.", "Calculating expected return, risk, Sharpe ratio, and diversification.")}
                chartsTitle={t("Готовим оптимальный портфель", "Preparing optimal portfolio")}
                chartsDescription={t("Появятся портфельные метрики и итоговое распределение бумаг.", "Portfolio metrics and final allocation will appear here.")}
                charts={[
                  {
                    title: t("Распределение портфеля", "Portfolio allocation"),
                    subtitle: t("Готовим веса акций выбранного оптимального портфеля.", "Preparing stock weights for the selected optimal portfolio."),
                    variant: "bars",
                  },
                ]}
                tableTitle={t("Готовим состав оптимального портфеля", "Preparing optimal portfolio holdings")}
                tableDescription={t("Скоро появятся выбранные бумаги, веса и портфельные показатели.", "Selected stocks, weights, and portfolio metrics will appear shortly.")}
                tableRows={8}
                tableColumns={4}
              />
            </>
          )}

          {!isRunning && (
            <>
          {(!!portfolio.length || portfolioAssetsCount > 0) && (
            <SectionCard
              title={t("Оптимальный портфель гибрида", "Hybrid Optimal Portfolio")}
              description={(
                <div className="space-y-1">
                  <div>{getOptimizationSummary(optimizerSettings, isEn)}</div>
                  {portfolioAssetsCount > 0 && (
                    <div>
                      {t("Количество активов в портфеле", "Assets in portfolio")}:{" "}
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{portfolioAssetsCount}</span>
                    </div>
                  )}
                </div>
              )}
              action={(
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={exportPortfolioToXlsx}
                    disabled={!portfolio.length}
                    className="ui-secondary-button px-3 py-2 text-xs"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    XLSX
                  </button>
                  <button
                    onClick={exportPortfolioToPdf}
                    disabled={!portfolio.length}
                    className="ui-secondary-button px-3 py-2 text-xs"
                  >
                    <FileText className="h-4 w-4" />
                    PDF
                  </button>
                  <button
                    onClick={savePortfolioChartPng}
                    disabled={!portfolio.length}
                    className="ui-secondary-button px-3 py-2 text-xs"
                  >
                    <ImageDown className="h-4 w-4" />
                    PNG
                  </button>
                  <SavePortfolioButton
                    holdings={portfolio}
                    metrics={optimalPortfolioMetricCards.map((metric) => ({
                      label: metric.label,
                      value: metric.value,
                      rawValue: metric.value,
                    }))}
                    sourceKey="hybrid"
                    sourceLabel={t("Гибридный анализ", "Hybrid Analysis")}
                    assetClass="stock"
                    defaultName={t("Портфель гибридного анализа", "Hybrid Analysis Portfolio")}
                    shares={cache.shares}
                    fundamentalsByFigi={cache.fundamentalsByFigi}
                    disabled={!portfolio.length}
                  />
                </div>
              )}
            >
              <div className="space-y-5">
                {!!optimalPortfolioMetricCards.length && (
                  <MetricGrid>
                    {optimalPortfolioMetricCards.map((metric) => (
                      <MetricCard
                        key={metric.key}
                        label={(
                          <>
                            <span>{metric.label}</span>
                            {metric.tooltip ? <MetricTooltip text={metric.tooltip} /> : null}
                          </>
                        )}
                        value={metric.value}
                      />
                    ))}
                  </MetricGrid>
                )}

                {!!portfolio.length && (
                  <PortfolioHoldingsPanel
                    rows={portfolio}
                    palette={HYBRID_PALETTE}
                    chartRef={portfolioChartRef}
                    companyLabel={t("Акция", "Stock")}
                    weightLabel={t("Вес, %", "Weight, %")}
                  />
                )}
              </div>
            </SectionCard>
          )}
            </>
          )}
      </AnalysisPageFrame>

      <AppErrorDialog
        message={errorDialogMessage}
        onClose={() => setErrorDialogMessage(null)}
        title={t("Ошибка анализа", "Analysis Error")}
        description={t(
          "Не удалось обработать запрос. Проверьте данные и попробуйте ещё раз.",
          "The request could not be completed. Check the input data and try again.",
        )}
        closeLabel={t("Закрыть", "Close")}
      />
    </>
  );
}
