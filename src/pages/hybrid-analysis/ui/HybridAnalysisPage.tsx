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
import { Checkbox } from "../../../app/components/ui/checkbox";
import { OptimizerSettingsFields, submitOptimizerSettings, useOptimizerSettings } from "../../../features/optimizer-settings";
import { PortfolioSimulationPanel } from "../../../features/portfolio-simulation";
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

const palette = ["#0891b2", "#2563eb", "#f97316", "#16a34a", "#e11d48", "#a855f7", "#0ea5e9", "#f59e0b"];
const HYBRID_STATE_KEY = "hybrid-analysis-state-v2";
const CLUSTER_ANALYSIS_STATE_KEY = "cluster-analysis-state-v2";
const TREE_ANALYSIS_STATE_KEY = "decision-tree-analysis-state-v1";
const NEURAL_ANALYSIS_STATE_KEY = "neural-analysis-state-v1";
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
  const selectedPortfolio =
    (portfolios.selected_portfolio as Record<string, unknown> | undefined) ??
    (portfolios.max_sharpe as Record<string, unknown> | undefined) ??
    {};
  const maxSharpeMetrics = (selectedPortfolio.metrics as Record<string, unknown> | undefined) ?? {};

  const rows: MetricItem[] = [];
  const countMapping: Array<{ key: string; label: string }> = [
    { key: "cluster_selected_count", label: "Cluster Selected" },
    { key: "tree_selected_count", label: "Tree Selected" },
    { key: "hybrid_selected_count", label: "Hybrid Selected" },
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
    selected_portfolio: "Selected",
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
  const selectedPortfolio =
    (portfolios.selected_portfolio as Record<string, unknown> | undefined) ??
    (portfolios.max_sharpe as Record<string, unknown> | undefined) ??
    {};
  const maxSharpeMetrics = (selectedPortfolio.metrics as Record<string, unknown> | undefined) ?? {};
  const positions = Array.isArray(selectedPortfolio.positions) ? selectedPortfolio.positions : [];

  const tickerMap = new Map<string, { name: string; expectedReturn: number }>();
  const merged = [
    ...(Array.isArray(parsed.cluster_selected) ? parsed.cluster_selected : []),
    ...(Array.isArray(parsed.tree_selected) ? parsed.tree_selected : []),
    ...(Array.isArray(parsed.hybrid_selected) ? parsed.hybrid_selected : []),
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
      figi: String(row.figi ?? row.FIGI ?? row.instrumentFigi ?? ""),
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
  const maxSharpe =
    (portfolios.selected_portfolio as Record<string, unknown> | undefined) ??
    (portfolios.max_sharpe as Record<string, unknown> | undefined) ??
    {};

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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function parseHiddenLayers(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.map((item) => Math.trunc(numberOr(item, NaN))).filter((item) => Number.isFinite(item) && item > 0);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => Math.trunc(Number(item.trim())))
      .filter((item) => Number.isFinite(item) && item > 0);
  }
  return [];
}

function readAnalysisState(storageKey: string): Record<string, unknown> | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.localStorage.getItem(storageKey);
  return raw ? safeParseJsonObject(raw) : null;
}

function readSavedModelSelection(state: Record<string, unknown> | null): Record<string, unknown> {
  return {
    mode: state?.selectionMode === "manual" ? "manual" : "all",
    selected_figis: asStringArray(state?.selectedFigis),
  };
}

function normalizeClusterSettings(settings: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!settings) return null;
  const clustersCount = numberOr(settings.clustersCount, 4);
  return {
    algorithm: String(settings.algorithm ?? "kmeans"),
    n_clusters: clustersCount,
    clusters_count: clustersCount,
    distance_metric: String(settings.distanceMetric ?? "euclidean"),
    scaling_method: String(settings.scalingMethod ?? "standard"),
    standardize: settings.scalingMethod !== "none",
    random_state: numberOr(settings.randomState, 42),
    include_outliers: settings.includeOutliers !== false,
    auto_tune: settings.autoTune !== false,
    tuning_metric: String(settings.tuningMetric ?? "silhouette"),
    tuning_budget: String(settings.tuningBudget ?? "balanced"),
    tuning_scope: "cluster_analysis",
    features: asStringArray(settings.features),
  };
}

function normalizeTreeSettings(settings: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!settings) return null;
  return {
    algorithm: String(settings.algorithm ?? "decision_tree"),
    criterion: String(settings.criterion ?? "gini"),
    max_depth: numberOr(settings.maxDepth, 5),
    min_samples_split: numberOr(settings.minSamplesSplit, 4),
    min_samples_leaf: numberOr(settings.minSamplesLeaf, 2),
    test_size: numberOr(settings.testSize, 25) / 100,
    random_state: numberOr(settings.randomState, 42),
    class_weight: settings.classBalance === false ? null : "balanced",
    balance_classes: settings.classBalance !== false,
    auto_tune: settings.autoTune !== false,
    tuning_metric: String(settings.tuningMetric ?? "f1"),
    tuning_budget: String(settings.tuningBudget ?? "balanced"),
    tuning_scope: "decision_tree_analysis",
    features: asStringArray(settings.features),
  };
}

function normalizeNeuralSettings(settings: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!settings) return null;
  const hiddenLayers = parseHiddenLayers(settings.hiddenLayers);
  return {
    model_type: String(settings.modelType ?? "mlp"),
    activation: String(settings.activation ?? "relu"),
    optimizer: String(settings.optimizer ?? "adam"),
    hidden_layers: hiddenLayers.length ? hiddenLayers : [64, 32],
    hidden_layers_raw: String(settings.hiddenLayers ?? "64,32"),
    epochs: numberOr(settings.epochs, 120),
    batch_size: numberOr(settings.batchSize, 32),
    learning_rate: numberOr(settings.learningRate, 0.001),
    dropout: numberOr(settings.dropout, 0.2),
    validation_split: numberOr(settings.validationSplit, 20) / 100,
    random_state: numberOr(settings.randomState, 42),
    early_stopping: settings.earlyStopping !== false,
    auto_tune: settings.autoTune !== false,
    tuning_metric: String(settings.tuningMetric ?? "val_loss"),
    tuning_budget: String(settings.tuningBudget ?? "balanced"),
    tuning_scope: "neural_analysis",
    features: asStringArray(settings.features),
  };
}

function readHybridModelSettings(): Record<string, unknown> {
  const clusterState = readAnalysisState(CLUSTER_ANALYSIS_STATE_KEY);
  const treeState = readAnalysisState(TREE_ANALYSIS_STATE_KEY);
  const neuralState = readAnalysisState(NEURAL_ANALYSIS_STATE_KEY);

  const clusterSettings = asRecord(clusterState?.clusterSettings);
  const treeSettings = asRecord(treeState?.treeSettings);
  const neuralSettings = asRecord(neuralState?.neuralSettings);

  return {
    cluster: {
      parameters: normalizeClusterSettings(clusterSettings),
      selection: readSavedModelSelection(clusterState),
      raw_settings: clusterSettings,
    },
    tree: {
      parameters: normalizeTreeSettings(treeSettings),
      selection: readSavedModelSelection(treeState),
      raw_settings: treeSettings,
    },
    neural: {
      parameters: normalizeNeuralSettings(neuralSettings),
      selection: readSavedModelSelection(neuralState),
      raw_settings: neuralSettings,
    },
  };
}

function countSavedAutoTuneModels(modelSettings: Record<string, unknown>): number {
  return Object.values(modelSettings).filter((value) => {
    const model = asRecord(value);
    const parameters = asRecord(model?.parameters);
    return parameters?.auto_tune === true;
  }).length;
}

function normalizePortfolioSettings(settings: {
  minWeight: string;
  maxWeight: string;
  riskFreeRate: string;
  sharpeBlendWeight: string;
  minRiskBlendWeight: string;
  optimizationObjective: "max_sharpe" | "min_risk";
  portfolioAssetsCount: string;
}): Record<string, unknown> {
  const optimizationObjective = settings.optimizationObjective === "min_risk" ? "min_risk" : "max_sharpe";
  const portfolioAssetsCount = Math.max(0, Math.trunc(numberOr(settings.portfolioAssetsCount, 0)));

  return {
    risk_free_rate: numberOr(settings.riskFreeRate, 0),
    min_weight: Math.max(0, numberOr(settings.minWeight, 0)),
    max_weight: Math.max(0, numberOr(settings.maxWeight, 0)),
    sharpe_blend_weight: optimizationObjective === "max_sharpe" ? Math.max(numberOr(settings.sharpeBlendWeight, 0), 100) : 0,
    min_risk_blend_weight: optimizationObjective === "min_risk" ? Math.max(numberOr(settings.minRiskBlendWeight, 0), 100) : 0,
    optimization_objective: optimizationObjective,
    portfolio_assets_count: portfolioAssetsCount,
    requested_assets_count: portfolioAssetsCount,
    enforce_requested_count: portfolioAssetsCount > 0,
  };
}

function buildHybridPipelinePayload(
  modelSettings: Record<string, unknown>,
  portfolioSettings: Record<string, unknown>,
  weights: { cluster: number; tree: number; neural: number },
): Record<string, unknown> {
  const cluster = asRecord(modelSettings.cluster);
  const tree = asRecord(modelSettings.tree);
  const neural = asRecord(modelSettings.neural);

  return {
    mode: "base_models_then_weighted_ensemble",
    portfolio_settings: portfolioSettings,
    base_models: [
      {
        key: "cluster",
        endpoint: "cluster-analysis",
        importance_weight: weights.cluster,
        parameters: asRecord(cluster?.parameters) ?? {},
        selection: asRecord(cluster?.selection) ?? { mode: "all", selected_figis: [] },
        portfolio_settings: portfolioSettings,
      },
      {
        key: "tree",
        endpoint: "tree-solver-analysis",
        importance_weight: weights.tree,
        parameters: asRecord(tree?.parameters) ?? {},
        selection: asRecord(tree?.selection) ?? { mode: "all", selected_figis: [] },
        portfolio_settings: portfolioSettings,
      },
      {
        key: "neural",
        endpoint: "ai-analysis",
        importance_weight: weights.neural,
        parameters: asRecord(neural?.parameters) ?? {},
        selection: asRecord(neural?.selection) ?? { mode: "all", selected_figis: [] },
        portfolio_settings: portfolioSettings,
      },
    ],
    aggregation: {
      method: "weighted_average",
      signal_source: "base_model_selected_assets",
      weights,
      normalize_model_weights: true,
      combine_asset_scores_by: "weighted_average_importance",
    },
    final_portfolio: {
      construction: "rank_weighted_assets_after_base_models",
      portfolio_settings: portfolioSettings,
      assets_count_policy: "up_to_requested_count",
      allow_fewer_assets_than_requested: true,
      clamp_assets_count_to_available_candidates: true,
      min_weight_policy: "best_effort_after_weighted_selection",
      avoid_hard_count_error: true,
    },
  };
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
    clusterWeight: "50",
    treeWeight: "25",
    neuralWeight: "25",
  });
  const [useSavedAnalysisSettings, setUseSavedAnalysisSettings] = useState(true);
  const [modelComparison, setModelComparison] = useState<ModelScore[]>([]);
  const [metrics, setMetrics] = useState<MetricItem[]>([]);
  const [portfolioStrategies, setPortfolioStrategies] = useState<StrategyPortfolio[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioPosition[]>([]);
  const [trainingHistory, setTrainingHistory] = useState<TrainingPoint[]>([]);
  const [portfolioAssetsCount, setPortfolioAssetsCount] = useState(0);
  const portfolioChartRef = useRef<HTMLDivElement | null>(null);
  const visibleMetrics = useMemo(() => metrics.filter((item) => isVisibleAnalysisMetric(item.label)), [metrics]);
  const savedModelSettings = useMemo(() => readHybridModelSettings(), []);
  const savedAutoTuneCount = useMemo(() => countSavedAutoTuneModels(savedModelSettings), [savedModelSettings]);
  const modelWeightChartData = useMemo(
    () =>
      modelComparison.map((row) => ({
        model: row.model,
        score: Number.isFinite(row.score) ? (Math.abs(row.score) <= 1 ? row.score * 100 : row.score) : 0,
      })),
    [modelComparison],
  );

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
        weights?: { clusterWeight?: string; treeWeight?: string; neuralWeight?: string };
        useSavedAnalysisSettings?: boolean;
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
          clusterWeight: String(parsed.weights.clusterWeight ?? "50"),
          treeWeight: String(parsed.weights.treeWeight ?? "25"),
          neuralWeight: String(parsed.weights.neuralWeight ?? "25"),
        });
      }
      if (typeof parsed.useSavedAnalysisSettings === "boolean") {
        setUseSavedAnalysisSettings(parsed.useSavedAnalysisSettings);
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
      useSavedAnalysisSettings,
      modelComparison,
      metrics,
      portfolioStrategies,
      portfolio,
      trainingHistory,
      portfolioAssetsCount,
      error,
    };
    window.localStorage.setItem(HYBRID_STATE_KEY, JSON.stringify(payload));
  }, [weights, useSavedAnalysisSettings, modelComparison, metrics, portfolioStrategies, portfolio, trainingHistory, portfolioAssetsCount, error]);

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
      const modelSettings = useSavedAnalysisSettings ? readHybridModelSettings() : {};
      const portfolioSettings = normalizePortfolioSettings(optimizerSettings);
      const hybridPipeline = buildHybridPipelinePayload(modelSettings, portfolioSettings, numericWeights);
      const response = await fetch(`${API_BASE_URL}/hybrid-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: requestData,
          weights: numericWeights,
          portfolio_settings: portfolioSettings,
          optimizer_settings: portfolioSettings,
          model_settings: modelSettings,
          base_model_requests: hybridPipeline.base_models,
          hybrid_pipeline: hybridPipeline,
          aggregation: hybridPipeline.aggregation,
          final_portfolio: hybridPipeline.final_portfolio,
          auto_tune: {
            enabled: useSavedAnalysisSettings,
            source: "saved_individual_analysis_settings",
            models_count: useSavedAnalysisSettings ? countSavedAutoTuneModels(modelSettings) : 0,
          },
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

  const analysisWeightFields = [
    {
      key: "clusterWeight" as const,
      label: t("Кластерный анализ", "Cluster analysis"),
      defaultValue: 50,
    },
    {
      key: "treeWeight" as const,
      label: t("Дерево решений", "Decision tree"),
      defaultValue: 25,
    },
    {
      key: "neuralWeight" as const,
      label: t("Нейросетевой анализ", "Neural analysis"),
      defaultValue: 25,
    },
  ];
  const analysisWeightTotal = analysisWeightFields.reduce(
    (sum, item) => sum + Math.max(numberOr(weights[item.key], item.defaultValue), 0),
    0,
  );

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
              "Базовые анализы получают одинаковые параметры портфеля, затем активы объединяются по средневзвешенной важности.",
              "Base analyses receive the same portfolio settings, then assets are combined by weighted importance.",
            )}
            accent="cyan"
          >
            <div className="space-y-4">
              <div className="ui-surface-muted">
                <p className="text-sm text-slate-700 dark:text-slate-300">{t("Источник: кэш фундаментальных данных", "Source: fundamentals cache")}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("Записей", "Records")}: {requestData.length}</p>
              </div>
              <div className="ui-surface-muted space-y-3">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {t("Коэффициенты важности анализов", "Analysis Importance Coefficients")}
                </p>
                {analysisWeightFields.map((field) => {
                  const rawValue = Math.max(numberOr(weights[field.key], field.defaultValue), 0);
                  const share = analysisWeightTotal > 0 ? (rawValue / analysisWeightTotal) * 100 : 0;
                  return (
                    <label key={field.key} className="block text-xs text-slate-600 dark:text-slate-400">
                      <span className="flex items-center justify-between gap-3">
                        <span>{field.label}</span>
                        <span className="font-semibold text-cyan-700 dark:text-cyan-300">{share.toFixed(0)}%</span>
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className="ui-input mt-1"
                        value={weights[field.key]}
                        onChange={(e) => setWeights((current) => ({ ...current, [field.key]: e.target.value }))}
                      />
                    </label>
                  );
                })}
              </div>
              <div className="ui-surface-muted space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <Checkbox
                    checked={useSavedAnalysisSettings}
                    onCheckedChange={(checked) => setUseSavedAnalysisSettings(checked === true)}
                  />
                  <span>{t("Использовать автоподборы моделей", "Use model auto-tuning")}</span>
                </label>
                <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {t(
                    "Гибрид передаст серверу сохраненные настройки кластеров, дерева и нейросети.",
                    "Hybrid will send saved cluster, tree, and neural settings to the server.",
                  )}
                </p>
                <p className="text-xs font-semibold text-cyan-700 dark:text-cyan-300">
                  {t("Найдено моделей с автоподбором", "Models with auto-tune found")}: {savedAutoTuneCount} / 3
                </p>
              </div>
              <div className="rounded-md border border-cyan-200 bg-cyan-50/70 p-3 text-xs leading-5 text-slate-700 dark:border-cyan-900 dark:bg-cyan-950/20 dark:text-slate-300">
                {t(
                  "Схема гибрида: кластерный анализ, дерево решений и нейросеть строят свои портфели с текущими настройками ниже. Финальный список активов выбирается по средневзвешенным весам моделей; если кандидатов меньше запрошенного количества, используется доступное число без жесткой ошибки.",
                  "Hybrid flow: clustering, decision tree, and neural network build their portfolios with the settings below. The final assets are selected by model-weighted scores; if candidates are fewer than requested, the available count is used without a hard error.",
                )}
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

          {!!modelWeightChartData.length && (
            <SectionCard
              title={t("Вклад анализов в гибрид", "Analysis Contribution Weights")}
              description={t(
                "Нормализованные коэффициенты, по которым усреднялись сигналы моделей.",
                "Normalized coefficients used to average model signals.",
              )}
            >
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={modelWeightChartData} layout="vertical" margin={{ left: 16, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${Number(value).toFixed(0)}%`} stroke="#64748b" />
                  <YAxis dataKey="model" type="category" width={110} stroke="#64748b" />
                  <Tooltip formatter={(value: number) => `${Number(value).toFixed(1)}%`} />
                  <Bar dataKey="score" radius={[0, 6, 6, 0]}>
                    {modelWeightChartData.map((entry, index) => (
                      <Cell key={entry.model} fill={palette[index % palette.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
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

          {!!portfolio.length && (
            <PortfolioSimulationPanel
              holdings={portfolio}
              shares={cache.shares}
              fundamentalsByFigi={cache.fundamentalsByFigi}
              analysisName={t("Гибридный анализ", "Hybrid Analysis")}
              filenamePrefix="hybrid-portfolio"
            />
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
