import { useEffect, useMemo, useRef, useState } from "react";
import { Download, ImageDown, Layers, Play, Settings, Trophy } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { EmbeddedMarkowitz } from "./EmbeddedMarkowitz";
import { useFundamentals } from "../context/FundamentalsContext";
import { useAppSettings } from "../context/AppSettingsContext";
import { OptimizerSettingsFields } from "./OptimizerSettingsFields";
import { submitOptimizerSettings, useOptimizerSettings } from "./optimizerSettings";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { AnalysisRunningIndicator } from "./AnalysisRunningIndicator";
import { MetricTooltip } from "./MetricTooltip";
import { formatMetricDisplay, getMetricTooltip, localizeMetricLabel } from "./metricDisplay";
import type {
  HybridMetricItem as MetricItem,
  HybridModelScore as ModelScore,
  HybridPortfolioPosition as PortfolioPosition,
  HybridStrategyPortfolio as StrategyPortfolio,
  HybridTrainingPoint as TrainingPoint,
} from "../../features/hybrid-analysis/model/types";
import { numberOr } from "../../shared/lib/number/numberOr";
import { formatVarPercent } from "../../shared/lib/format/finance";
import { downloadRowsAsExcel, downloadSvgAsPng } from "../../shared/lib/export/download";

const ENABLE_TEMP_LOGS = true;
const palette = ["#0891b2", "#2563eb", "#f97316", "#16a34a", "#e11d48", "#a855f7", "#0ea5e9", "#f59e0b"];
const HYBRID_STATE_KEY = "hybrid-analysis-state-v1";
const DEFAULT_SERVER_ERROR_RU = "Сервер вернул ошибку. Попробуйте повторить позже.";
const DEFAULT_SERVER_ERROR_EN = "Server returned an error. Please try again later.";

function downloadPortfolioAsExcel(rows: PortfolioPosition[], filename: string): void {
  downloadRowsAsExcel(
    rows,
    [
      { header: "Ticker", render: (row) => row.ticker },
      { header: "Name", render: (row) => row.name || "" },
      { header: "Weight, %", render: (row) => row.weight.toFixed(4) },
      { header: "Expected Return", render: (row) => (Number.isFinite(row.expectedReturn) ? row.expectedReturn.toFixed(6) : "") },
      { header: "Risk", render: (row) => (Number.isFinite(row.risk) ? row.risk.toFixed(6) : "") },
      { header: "Sharpe", render: (row) => (Number.isFinite(row.sharpe) ? row.sharpe.toFixed(6) : "") },
      { header: "Sortino", render: (row) => (Number.isFinite(row.sortino) ? row.sortino?.toFixed(6) : "") },
      { header: "VaR", render: (row) => (Number.isFinite(row.value_at_risk) ? row.value_at_risk?.toFixed(6) : "") },
    ],
    filename,
  );
}

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
    { key: "sortino_ratio", label: "Sortino Ratio" },
    { key: "sortino", label: "Sortino" },
    { key: "value_at_risk", label: "VaR" },
    { key: "var", label: "VaR" },
    { key: "diversification_score", label: "Diversification" },
  ];

  for (const item of portfolioMapping) {
    if (item.key in maxSharpeMetrics) {
      if (item.label === "VaR" || item.label === "Sortino" || item.label === "Sortino Ratio") {
        const raw = numberOr(maxSharpeMetrics[item.key], NaN);
        rows.push({
          label: item.label,
          value:
            item.label === "VaR"
              ? formatVarPercent(raw)
              : Number.isFinite(raw)
                ? raw.toFixed(4)
                : "-",
        });
        continue;
      }
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
  const { locale } = useAppSettings();
  const isEn = locale === "en";
  const tx = (ru: string, en: string) => (isEn ? en : ru);
  const { settings: optimizerSettings, setSettings: setOptimizerSettings } = useOptimizerSettings();

  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverErrorModal, setServerErrorModal] = useState<string | null>(null);
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
      if (Array.isArray(parsed.metrics)) setMetrics(parsed.metrics);
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

  const openServerErrorModal = (message: string) => {
    setError(message);
    setServerErrorModal(message);
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
    setIsRunning(true);

    const numericWeights = {
      cluster: numberOr(weights.clusterWeight, 0),
      tree: numberOr(weights.treeWeight, 0),
      neural: numberOr(weights.neuralWeight, 0),
    };

    try {
      await submitOptimizerSettings(optimizerSettings);
      const response = await fetch("/api/hybrid-analysis", {
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
      const fallback = tx("Не удалось выполнить гибридный анализ", "Failed to run hybrid analysis");
      const message = e instanceof Error ? e.message : fallback;
      resetAnalysisResults();
      openServerErrorModal(message);
    } finally {
      setIsRunning(false);
    }
  };

  const exportPortfolioToExcel = () => {
    if (!portfolio.length) {
      return;
    }
    downloadPortfolioAsExcel(portfolio, "hybrid-optimal-portfolio.xls");
  };

  const savePortfolioChartPng = async () => {
    const svg = portfolioChartRef.current?.querySelector("svg");
    if (!svg) {
      return;
    }
    try {
      await downloadSvgAsPng(svg as SVGSVGElement, "hybrid-optimal-portfolio.png");
    } catch (e) {
      const message = e instanceof Error ? e.message : tx("Не удалось сохранить PNG", "Failed to save PNG");
      setError(message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-cyan-700 to-blue-700 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <Layers className="w-8 h-8" />
          <h1 className="text-3xl font-bold">{tx("Гибридный анализ", "Hybrid Analysis")}</h1>
        </div>
        <p className="text-cyan-100">
          {tx(
            "Комбинированный сигнал на базе кластеризации, дерева решений и нейросети.",
            "Combined signal based on clustering, decision tree, and neural network.",
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-cyan-700" />
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">{tx("Параметры ансамбля", "Ensemble Parameters")}</h2>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800/40">
              <p className="text-sm text-slate-700 dark:text-slate-300">{tx("Источник: кэш фундаментальных данных", "Source: fundamentals cache")}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{tx("Записей", "Records")}: {requestData.length}</p>
            </div>
            <OptimizerSettingsFields
              isEn={isEn}
              settings={optimizerSettings}
              onChange={setOptimizerSettings}
            />
            {error && (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg p-3">
                <p className="text-sm text-red-700 dark:text-red-300 break-words">{error}</p>
              </div>
            )}
            <button
              type="button"
              onClick={runHybridAnalysis}
              disabled={!hasData || !requestData.length || isRunning}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-700 to-blue-700 px-4 py-2 text-white font-medium disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              {isRunning ? tx("Выполняется...", "Running...") : tx("Запустить гибрид", "Run Hybrid")}
            </button>
            {!hasData && (
              <p className="text-xs text-amber-700 dark:text-amber-300">{tx("Для запуска сначала загрузите фундаментальные данные.", "Load fundamentals first.")}</p>
            )}
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
          {isRunning && (
            <AnalysisRunningIndicator
              title={tx("Выполняем гибридный анализ", "Running hybrid analysis")}
              subtitle={tx("Собираем сигналы моделей и оптимизируем портфель", "Combining model signals and optimizing portfolio")}
              accentClassName="text-cyan-700"
            />
          )}

          {!!metrics.length && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {metrics.map((m) => (
                <div key={m.label} className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800">
                  <div className="text-sm text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                    <span>{localizeMetricLabel(m.label, isEn)}</span>
                    {getMetricTooltip(m.label, isEn) && (
                      <MetricTooltip text={getMetricTooltip(m.label, isEn) ?? ""} />
                    )}
                  </div>
                  <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatMetricDisplay(m.label, m.value)}</div>
                </div>
              ))}
            </div>
          )}

          {!!modelComparison.length && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">{tx("Сравнение моделей", "Model Comparison")}</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={modelComparison}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="model" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip formatter={(v: number) => Number(v).toFixed(4)} />
                    <Bar dataKey="score" fill="#0891b2" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {!!trainingHistory.length && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">{tx("История обучения", "Training History")}</h3>
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
            </div>
          )}

          {!!portfolioStrategies.length && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">{tx("Стратегии портфеля", "Portfolio Strategies")}</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
                  <thead>
                    <tr className="text-left border-b border-slate-200 dark:border-slate-800">
                      <th className="py-2 pr-3">{tx("Стратегия", "Strategy")}</th>
                      <th className="py-2 pr-3">Expected return</th>
                      <th className="py-2 pr-3">Volatility</th>
                      <th className="py-2 pr-3">Sharpe</th>
                      <th className="py-2 pr-3">Diversification</th>
                      <th className="py-2 pr-3">{tx("Позиций", "Positions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolioStrategies.map((s) => (
                      <tr key={s.key} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-2 pr-3 font-medium text-slate-900 dark:text-slate-100">{s.name}</td>
                        <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{Number.isFinite(s.expectedReturn) ? s.expectedReturn.toFixed(4) : "-"}</td>
                        <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{Number.isFinite(s.risk) ? s.risk.toFixed(4) : "-"}</td>
                        <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{Number.isFinite(s.sharpe) ? s.sharpe.toFixed(4) : "-"}</td>
                        <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{Number.isFinite(s.diversification) ? s.diversification.toFixed(4) : "-"}</td>
                        <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{s.assetsCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(!!portfolio.length || portfolioAssetsCount > 0) && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">{tx("Оптимальный портфель гибрида", "Hybrid Optimal Portfolio")}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={savePortfolioChartPng}
                    disabled={!portfolio.length}
                    className="inline-flex items-center gap-1 px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-50"
                  >
                    <ImageDown className="w-4 h-4" />
                    PNG
                  </button>
                  <button
                    onClick={exportPortfolioToExcel}
                    disabled={!portfolio.length}
                    className="inline-flex items-center gap-1 px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    Excel
                  </button>
                </div>
              </div>
              {portfolioAssetsCount > 0 && (
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                  {tx("Количество активов в портфеле", "Assets in portfolio")}: <span className="font-semibold text-slate-900 dark:text-slate-100">{portfolioAssetsCount}</span>
                </p>
              )}

              {!!portfolio.length && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="h-72" ref={portfolioChartRef}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={portfolio}
                          dataKey="weight"
                          nameKey="ticker"
                          cx="50%"
                          cy="50%"
                          outerRadius={105}
                          labelLine={false}
                          label={({ ticker, weight }) => (Number(weight) >= 6 ? `${ticker}: ${Number(weight).toFixed(1)}%` : "")}
                        >
                          {portfolio.map((row, idx) => (
                            <Cell key={row.ticker} fill={palette[idx % palette.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => `${Number(v).toFixed(2)}%`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[860px] text-sm [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
                      <thead>
                        <tr className="text-left border-b border-slate-200 dark:border-slate-800">
                          <th className="py-2 pr-3">Ticker</th>
                          <th className="py-2 pr-3">{tx("Компания", "Company")}</th>
                          <th className="py-2 pr-3">{tx("Вес, %", "Weight, %")}</th>
                          <th className="py-2 pr-3">Return</th>
                          <th className="py-2 pr-3">Risk</th>
                          <th className="py-2 pr-3">Sharpe</th>
                          <th className="py-2 pr-3">Sortino</th>
                          <th className="py-2 pr-3">VaR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {portfolio.map((row) => (
                          <tr key={`${row.ticker}-${row.name}`} className="border-b border-slate-100 dark:border-slate-800">
                            <td className="py-2 pr-3 font-medium text-slate-900 dark:text-slate-100">{row.ticker}</td>
                            <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{row.name}</td>
                            <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{row.weight.toFixed(2)}</td>
                            <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{Number.isFinite(row.expectedReturn) ? row.expectedReturn.toFixed(4) : "-"}</td>
                            <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{Number.isFinite(row.risk) ? row.risk.toFixed(4) : "-"}</td>
                            <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{Number.isFinite(row.sharpe) ? row.sharpe.toFixed(4) : "-"}</td>
                            <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{Number.isFinite(row.sortino) ? row.sortino?.toFixed(4) : "-"}</td>
                            <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{formatVarPercent(numberOr(row.value_at_risk, NaN))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Dialog open={Boolean(serverErrorModal)} onOpenChange={(open) => !open && setServerErrorModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tx("Ошибка сервера", "Server Error")}</DialogTitle>
            <DialogDescription className="break-words">
              {serverErrorModal}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setServerErrorModal(null)}
              className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              {tx("Закрыть", "Close")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}




