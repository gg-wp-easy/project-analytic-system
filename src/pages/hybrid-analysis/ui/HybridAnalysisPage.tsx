import { useEffect, useMemo, useRef, useState } from "react";
import { FileSpreadsheet, FileText, ImageDown, Layers, Play, Settings } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { useFundamentals } from "../../../entities/fundamentals";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import { OptimizerSettingsFields } from "../../../features/optimizer-settings/ui/OptimizerSettingsFields";
import { submitOptimizerSettings, useOptimizerSettings } from "../../../features/optimizer-settings/model/optimizerSettings";
import { API_BASE_URL } from "../../../config/api";
import type {
  HybridMetricItem as MetricItem,
  HybridModelScore as ModelScore,
  HybridPortfolioPosition as PortfolioPosition,
  HybridStrategyPortfolio as StrategyPortfolio,
  HybridTrainingPoint as TrainingPoint,
} from "../../../features/hybrid-analysis/model/types";
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
import { numberOr } from "../../../shared/lib/number/numberOr";
import {
  AnalysisPageFrame,
  AnalysisSidebarCard,
  MetricCard,
  MetricGrid,
  PageHero,
  SectionCard,
} from "../../../shared/ui/analysis-shell";
import { AppErrorDialog } from "../../../shared/ui/app-error-dialog";
import { AnalysisRunningIndicator } from "../../../shared/ui/analysis/AnalysisRunningIndicator";
import { MetricTooltip } from "../../../shared/ui/analysis/MetricTooltip";
import { PortfolioHoldingsPanel } from "../../../shared/ui/analysis/PortfolioHoldingsPanel";

const ENABLE_TEMP_LOGS = true;
const palette = ["#0891b2", "#2563eb", "#f97316", "#16a34a", "#e11d48", "#a855f7", "#0ea5e9", "#f59e0b"];
const HYBRID_STATE_KEY = "hybrid-analysis-state-v1";
const DEFAULT_SERVER_ERROR_RU = "Сервер вернул ошибку. Попробуйте повторить позже.";
const DEFAULT_SERVER_ERROR_EN = "Server returned an error. Please try again later.";

function formatMetric(value: number): string {
  if (!Number.isFinite(value)) {
    return "-";
  }
  if (value >= 0 && value <= 1) {
    return `${(value * 100).toFixed(2)}%`;
  }
  return value.toFixed(4);
}

function extractModelScores(parsed: Record<string, unknown>, fallbackWeights: { cluster: number; tree: number; neural: number }): ModelScore[] {
  const rawArray = Array.isArray(parsed.model_scores) ? parsed.model_scores : Array.isArray(parsed.models) ? parsed.models : [];
  if (rawArray.length) {
    const mapped = rawArray
      .map((item) => {
        const row = item as Record<string, unknown>;
        return {
          model: String(row.model ?? row.name ?? row.model_name ?? "Model"),
          score: numberOr(row.score, numberOr(row.weighted_score, numberOr(row.sharpe, NaN))),
        };
      })
      .filter((row) => Number.isFinite(row.score));
    if (mapped.length) {
      return mapped.sort((a, b) => b.score - a.score);
    }
  }

  const source =
    (parsed.ensemble_weights as Record<string, unknown> | undefined) ??
    (parsed.weights as Record<string, unknown> | undefined) ??
    (parsed.hybrid_weights as Record<string, unknown> | undefined) ??
    null;

  if (source) {
    return Object.entries(source)
      .map(([model, score]) => ({ model, score: numberOr(score, NaN) }))
      .filter((row) => Number.isFinite(row.score))
      .sort((a, b) => b.score - a.score);
  }

  return [
    { model: "Cluster", score: fallbackWeights.cluster },
    { model: "Tree", score: fallbackWeights.tree },
    { model: "Neural", score: fallbackWeights.neural },
  ];
}

function extractMetrics(parsed: Record<string, unknown>): MetricItem[] {
  const stats = (parsed.stats as Record<string, unknown> | undefined) ?? {};
  const summary = (parsed.summary as Record<string, unknown> | undefined) ?? {};
  const portfolios = (parsed.portfolios as Record<string, unknown> | undefined) ?? {};
  const maxSharpe = (portfolios.max_sharpe as Record<string, unknown> | undefined) ?? {};
  const maxSharpeMetrics = (maxSharpe.metrics as Record<string, unknown> | undefined) ?? {};

  const rows: MetricItem[] = [];
  const countMapping: Array<{ key: string; label: string }> = [
    { key: "cluster_selected_count", label: "Cluster Selected" },
    { key: "tree_selected_count", label: "Tree Selected" },
    { key: "undervalued_count", label: "Undervalued" },
    { key: "models_count", label: "Models" },
  ];

  for (const item of countMapping) {
    if (item.key in stats || item.key in summary) {
      rows.push({
        label: item.label,
        value: String(numberOr(stats[item.key], numberOr(summary[item.key], NaN))),
      });
    }
  }

  const portfolioMapping: Array<{ key: string; label: string }> = [
    { key: "expected_return", label: "Expected Return" },
    { key: "volatility", label: "Volatility" },
    { key: "sharpe_ratio", label: "Sharpe Ratio" },
    { key: "diversification_score", label: "Diversification" },
  ];

  for (const item of portfolioMapping) {
    if (item.key in maxSharpeMetrics) {
      rows.push({
        label: item.label,
        value: formatMetric(numberOr(maxSharpeMetrics[item.key], NaN)),
      });
    }
  }

  return rows;
}

function extractPortfolioStrategies(parsed: Record<string, unknown>): StrategyPortfolio[] {
  const portfolios = parsed.portfolios;
  if (!portfolios || typeof portfolios !== "object" || Array.isArray(portfolios)) {
    return [];
  }

  const mapping: Record<string, string> = {
    max_sharpe: "Max Sharpe",
    min_volatility: "Min Volatility",
  };

  return Object.entries(portfolios as Record<string, unknown>)
    .map(([key, value]) => {
      const row = (value as Record<string, unknown>) ?? {};
      const metrics = (row.metrics as Record<string, unknown> | undefined) ?? {};
      return {
        key,
        name: mapping[key] ?? key,
        expectedReturn: numberOr(metrics.expected_return, NaN),
        risk: numberOr(metrics.volatility, numberOr(metrics.risk, NaN)),
        sharpe: numberOr(metrics.sharpe_ratio, NaN),
        diversification: numberOr(metrics.diversification_score, NaN),
        assetsCount: numberOr(row.assets_count, 0),
      } satisfies StrategyPortfolio;
    })
    .sort((a, b) => numberOr(b.sharpe, -Infinity) - numberOr(a.sharpe, -Infinity));
}

function extractPortfolioPositions(parsed: Record<string, unknown>): PortfolioPosition[] {
  const portfolios = (parsed.portfolios as Record<string, unknown> | undefined) ?? {};
  const maxSharpe = (portfolios.max_sharpe as Record<string, unknown> | undefined) ?? {};
  const maxSharpeMetrics = (maxSharpe.metrics as Record<string, unknown> | undefined) ?? {};
  const positions = Array.isArray(maxSharpe.positions) ? maxSharpe.positions : [];

  const tickerMap = new Map<string, { name: string; expectedReturn: number }>();
  const merged = [
    ...(Array.isArray(parsed.cluster_selected) ? parsed.cluster_selected : []),
    ...(Array.isArray(parsed.undervalued_stocks) ? parsed.undervalued_stocks : []),
  ];

  for (const item of merged) {
    const row = item as Record<string, unknown>;
    const ticker = String(row.ticker ?? row.Ticker ?? "");
    if (!ticker) {
      continue;
    }
    tickerMap.set(ticker, {
      name: String(row.name ?? row.Company ?? ticker),
      expectedReturn: numberOr(row.expected_return, numberOr(row.g, numberOr(row.roe, NaN))),
    });
  }

  const rows = positions.map((item, idx) => {
    const row = item as Record<string, unknown>;
    const ticker = String(row.ticker ?? `Asset ${idx + 1}`);
    const mapped = tickerMap.get(ticker);
    return {
      ticker,
      name: mapped?.name ?? ticker,
      weight: numberOr(row.weight, 0),
      expectedReturn: mapped?.expectedReturn ?? numberOr(maxSharpeMetrics.expected_return, NaN),
      risk: numberOr(maxSharpeMetrics.volatility, NaN),
      sharpe: numberOr(maxSharpeMetrics.sharpe_ratio, NaN),
      sortino: numberOr(maxSharpeMetrics.sortino, numberOr(maxSharpeMetrics.sortino_ratio, NaN)),
      value_at_risk: numberOr(maxSharpeMetrics.value_at_risk, numberOr(maxSharpeMetrics.var, NaN)),
    } satisfies PortfolioPosition;
  });

  const maxWeight = rows.length ? Math.max(...rows.map((r) => r.weight)) : 0;
  const normalized = maxWeight <= 1 ? rows.map((r) => ({ ...r, weight: r.weight * 100 })) : rows;
  return normalized.sort((a, b) => b.weight - a.weight);
}

function extractPortfolioAssetsCount(parsed: Record<string, unknown>): number {
  const stats = (parsed.stats as Record<string, unknown> | undefined) ?? {};
  const summary = (parsed.summary as Record<string, unknown> | undefined) ?? {};
  const portfolios = (parsed.portfolios as Record<string, unknown> | undefined) ?? {};
  const maxSharpe = (portfolios.max_sharpe as Record<string, unknown> | undefined) ?? {};

  return numberOr(maxSharpe.assets_count, numberOr(stats.portfolio_assets_count, numberOr(summary.portfolio_assets_count, 0)));
}

function extractTrainingHistory(parsed: Record<string, unknown>): TrainingPoint[] {
  const history = (parsed.training_history as Record<string, unknown> | undefined) ?? {};
  const train = Array.isArray(history.train_loss) ? history.train_loss : [];
  const val = Array.isArray(history.val_loss) ? history.val_loss : [];
  const count = Math.max(train.length, val.length);

  return Array.from({ length: count }, (_, idx) => ({
    epoch: idx + 1,
    trainLoss: numberOr(train[idx], NaN),
    valLoss: numberOr(val[idx], NaN),
  })).filter((row) => Number.isFinite(row.trainLoss) || Number.isFinite(row.valLoss));
}

function safeParseJsonObject(text: string): Record<string, unknown> | null {
  if (!text.trim()) {
    return null;
  }
  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function extractErrorText(payload: Record<string, unknown> | null): string | null {
  if (!payload) {
    return null;
  }
  const direct = payload.error ?? payload.message ?? payload.detail;
  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }
  const nestedDetail = payload.detail;
  if (nestedDetail && typeof nestedDetail === "object" && !Array.isArray(nestedDetail)) {
    const detailMessage = (nestedDetail as Record<string, unknown>).message;
    if (typeof detailMessage === "string" && detailMessage.trim()) {
      return detailMessage.trim();
    }
  }
  return null;
}

export function HybridAnalysis() {
  const { hasData, cache } = useFundamentals();
  const { locale, t } = useAppSettings();
  const isEn = locale === "en";
  const { settings: optimizerSettings, setSettings: setOptimizerSettings } = useOptimizerSettings();

  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDialogMessage, setErrorDialogMessage] = useState<string | null>(null);
  const [weights, setWeights] = useState({
    clusterWeight: "30",
    treeWeight: "30",
    neuralWeight: "40",
  });
  const [modelComparison, setModelComparison] = useState<ModelScore[]>([]);
  const [metrics, setMetrics] = useState<MetricItem[]>([]);
  const [portfolioStrategies, setPortfolioStrategies] = useState<StrategyPortfolio[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioPosition[]>([]);
  const [trainingHistory, setTrainingHistory] = useState<TrainingPoint[]>([]);
  const [portfolioAssetsCount, setPortfolioAssetsCount] = useState(0);
  const portfolioChartRef = useRef<HTMLDivElement | null>(null);
  const visibleMetrics = useMemo(() => metrics.filter((item) => isVisibleAnalysisMetric(item.label)), [metrics]);

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
        weights?: { clusterWeight?: string; treeWeight?: string; neuralWeight?: string };
        modelComparison?: ModelScore[];
        metrics?: MetricItem[];
        portfolioStrategies?: StrategyPortfolio[];
        portfolio?: PortfolioPosition[];
        trainingHistory?: TrainingPoint[];
        portfolioAssetsCount?: number;
        error?: string | null;
      };
      if (parsed.weights) {
        setWeights({
          clusterWeight: String(parsed.weights.clusterWeight ?? "30"),
          treeWeight: String(parsed.weights.treeWeight ?? "30"),
          neuralWeight: String(parsed.weights.neuralWeight ?? "40"),
        });
      }
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
      weights,
      modelComparison,
      metrics,
      portfolioStrategies,
      portfolio,
      trainingHistory,
      portfolioAssetsCount,
      error,
    };
    window.localStorage.setItem(HYBRID_STATE_KEY, JSON.stringify(payload));
  }, [weights, modelComparison, metrics, portfolioStrategies, portfolio, trainingHistory, portfolioAssetsCount, error]);

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

  const formatHttpError = (response: Response, text: string): string => {
    const payload = safeParseJsonObject(text);
    const serverMessage = extractErrorText(payload);
    if (serverMessage) {
      return `HTTP ${response.status}: ${serverMessage}`;
    }
    const fallback = isEn ? DEFAULT_SERVER_ERROR_EN : DEFAULT_SERVER_ERROR_RU;
    const statusText = response.statusText?.trim();
    if (statusText) {
      return `HTTP ${response.status} ${statusText}`;
    }
    return `HTTP ${response.status}: ${fallback}`;
  };

  const parseHybridResponse = async (response: Response): Promise<Record<string, unknown>> => {
    const text = await response.text();
    if (!response.ok) {
      throw new Error(formatHttpError(response, text));
    }
    return safeParseJsonObject(text) ?? {};
  };

  const runHybridAnalysis = async () => {
    setError(null);
    setErrorDialogMessage(null);
    setIsRunning(true);

    const numericWeights = {
      cluster: numberOr(weights.clusterWeight, 0),
      tree: numberOr(weights.treeWeight, 0),
      neural: numberOr(weights.neuralWeight, 0),
    };

    try {
      await submitOptimizerSettings(optimizerSettings);
      const response = await fetch(`${API_BASE_URL}/hybrid-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: requestData,
          weights: numericWeights,
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

      if (ENABLE_TEMP_LOGS) {
        console.info("[Hybrid][Request][Success]", {
          ts: new Date().toISOString(),
          status: response.status,
          scores: parsedScores.length,
          metrics: parsedMetrics.length,
          strategies: parsedStrategies.length,
          portfolio: parsedPortfolio.length,
          history: parsedHistory.length,
          responseKeys: Object.keys(parsed),
        });
      }
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
      metrics: visibleMetrics.map((item) => ({
        label: localizeMetricLabel(item.label, isEn),
        value: formatMetricDisplay(item.label, item.value),
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
        metrics: visibleMetrics.map((item) => ({
          label: localizeMetricLabel(item.label, isEn),
          value: formatMetricDisplay(item.label, item.value),
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
            title={t("Параметры ансамбля", "Ensemble Parameters")}
            description={t(
              "Общий shell для весов ансамбля и настроек оптимизатора.",
              "Shared shell for ensemble weights and optimizer settings.",
            )}
            accent="cyan"
          >
            <div className="space-y-4">
              <div className="ui-surface-muted">
                <p className="text-sm text-slate-700 dark:text-slate-300">{t("Источник: кэш фундаментальных данных", "Source: fundamentals cache")}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("Записей", "Records")}: {requestData.length}</p>
              </div>
              <OptimizerSettingsFields
                settings={optimizerSettings}
                onChange={setOptimizerSettings}
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
            <AnalysisRunningIndicator
              title={t("Выполняем гибридный анализ", "Running hybrid analysis")}
              subtitle={t("Собираем сигналы моделей и оптимизируем портфель", "Combining model signals and optimizing portfolio")}
              accentClassName="text-cyan-700"
            />
          )}

          {!!visibleMetrics.length && (
            <MetricGrid>
              {visibleMetrics.map((m) => (
                <MetricCard
                  key={m.label}
                  label={(
                    <>
                      <span>{localizeMetricLabel(m.label, isEn)}</span>
                      {getMetricTooltip(m.label, isEn) && (
                        <MetricTooltip text={getMetricTooltip(m.label, isEn) ?? ""} />
                      )}
                    </>
                  )}
                  value={formatMetricDisplay(m.label, m.value)}
                />
              ))}
            </MetricGrid>
          )}

          {!!trainingHistory.length && (
            <SectionCard title={t("История обучения", "Training History")}>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={trainingHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="epoch" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip formatter={(v: number) => Number(v).toFixed(4)} />
                  <Legend />
                  <Line type="monotone" dataKey="trainLoss" name="Train Loss" stroke="#0ea5e9" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="valLoss" name="Val Loss" stroke="#f97316" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </SectionCard>
          )}

          {!!portfolioStrategies.length && (
            <SectionCard title={t("Стратегии портфеля", "Portfolio Strategies")}>
              <div className="ui-table-shell overflow-x-auto">
                <table className="ui-data-table">
                  <thead>
                    <tr>
                      <th>{t("Стратегия", "Strategy")}</th>
                      <th>Expected return</th>
                      <th>Volatility</th>
                      <th>Sharpe</th>
                      <th>Diversification</th>
                      <th>{t("Позиций", "Positions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolioStrategies.map((s) => (
                      <tr key={s.key}>
                        <td className="font-medium text-slate-900 dark:text-slate-100">{s.name}</td>
                        <td>{Number.isFinite(s.expectedReturn) ? s.expectedReturn.toFixed(4) : "-"}</td>
                        <td>{Number.isFinite(s.risk) ? s.risk.toFixed(4) : "-"}</td>
                        <td>{Number.isFinite(s.sharpe) ? s.sharpe.toFixed(4) : "-"}</td>
                        <td>{Number.isFinite(s.diversification) ? s.diversification.toFixed(4) : "-"}</td>
                        <td>{s.assetsCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {(!!portfolio.length || portfolioAssetsCount > 0) && (
            <SectionCard
              title={t("Оптимальный портфель гибрида", "Hybrid Optimal Portfolio")}
              description={
                portfolioAssetsCount > 0
                  ? (
                      <>
                        {t("Количество активов в портфеле", "Assets in portfolio")}:{" "}
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{portfolioAssetsCount}</span>
                      </>
                    )
                  : undefined
              }
              action={(
                <div className="flex items-center gap-2">
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
                </div>
              )}
            >
              {!!portfolio.length && (
                <PortfolioHoldingsPanel
                  rows={portfolio}
                  palette={palette}
                  chartRef={portfolioChartRef}
                  companyLabel={t("Акция", "Stock")}
                  weightLabel={t("Вес, %", "Weight, %")}
                />
              )}
            </SectionCard>
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




