import type {
  HybridMetricItem as MetricItem,
  HybridModelScore as ModelScore,
  HybridPortfolioPosition as PortfolioPosition,
  HybridStrategyPortfolio as StrategyPortfolio,
  HybridTrainingPoint as TrainingPoint,
} from "../../../features/hybrid-analysis";
import { numberOr } from "../../../shared/lib/number/numberOr";
import { CLUSTER_ANALYSIS_STATE_KEY, NEURAL_ANALYSIS_STATE_KEY, TREE_ANALYSIS_STATE_KEY } from "../model";
import type { HybridModelWeights, HybridPortfolioSettingsInput } from "../model";

function formatMetric(value: number): string {
  if (!Number.isFinite(value)) {
    return "-";
  }
  if (value >= 0 && value <= 1) {
    return `${(value * 100).toFixed(2)}%`;
  }
  return value.toFixed(4);
}

function isMinRiskObjective(parsed: Record<string, unknown>): boolean {
  const summary = (parsed.summary as Record<string, unknown> | undefined) ?? {};
  const stats = (parsed.stats as Record<string, unknown> | undefined) ?? {};
  const objective = String(summary.optimization_objective ?? stats.optimization_objective ?? "").toLowerCase();
  return ["min_risk", "min_volatility", "minimum_risk", "min_risk_target_return"].includes(objective);
}

export function extractModelScores(parsed: Record<string, unknown>, fallbackWeights: HybridModelWeights): ModelScore[] {
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

export function extractMetrics(parsed: Record<string, unknown>): MetricItem[] {
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

export function extractPortfolioStrategies(parsed: Record<string, unknown>): StrategyPortfolio[] {
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
    .sort((a, b) =>
      isMinRiskObjective(parsed)
        ? numberOr(a.risk, Infinity) - numberOr(b.risk, Infinity)
        : numberOr(b.sharpe, -Infinity) - numberOr(a.sharpe, -Infinity),
    );
}

export function extractPortfolioPositions(parsed: Record<string, unknown>): PortfolioPosition[] {
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

export function extractPortfolioAssetsCount(parsed: Record<string, unknown>): number {
  const stats = (parsed.stats as Record<string, unknown> | undefined) ?? {};
  const summary = (parsed.summary as Record<string, unknown> | undefined) ?? {};
  const portfolios = (parsed.portfolios as Record<string, unknown> | undefined) ?? {};
  const maxSharpe =
    (portfolios.selected_portfolio as Record<string, unknown> | undefined) ??
    (portfolios.max_sharpe as Record<string, unknown> | undefined) ??
    {};

  return numberOr(maxSharpe.assets_count, numberOr(stats.portfolio_assets_count, numberOr(summary.portfolio_assets_count, 0)));
}

export function extractTrainingHistory(parsed: Record<string, unknown>): TrainingPoint[] {
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

export function safeParseJsonObject(text: string): Record<string, unknown> | null {
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

export function extractErrorText(payload: Record<string, unknown> | null): string | null {
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

export function readHybridModelSettings(): Record<string, unknown> {
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

export function countSavedAutoTuneModels(modelSettings: Record<string, unknown>): number {
  return Object.values(modelSettings).filter((value) => {
    const model = asRecord(value);
    const parameters = asRecord(model?.parameters);
    return parameters?.auto_tune === true;
  }).length;
}

export function normalizePortfolioSettings(settings: HybridPortfolioSettingsInput): Record<string, unknown> {
  const optimizationObjective = settings.autoPortfolioOptimization
    ? "max_sharpe"
    : settings.optimizationObjective === "max_return_target_risk"
      ? "max_return_target_risk"
      : settings.optimizationObjective === "max_sharpe"
        ? "max_sharpe"
        : "min_risk_target_return";
  const portfolioAssetsCount = settings.autoPortfolioOptimization
    ? 20
    : Math.max(0, Math.trunc(numberOr(settings.portfolioAssetsCount, 0)));

  return {
    risk_free_rate: numberOr(settings.riskFreeRate, 0),
    min_weight: Math.max(0, numberOr(settings.minWeight, 0)),
    max_weight: Math.max(0, numberOr(settings.maxWeight, 0)),
    sharpe_blend_weight:
      optimizationObjective === "max_sharpe" || optimizationObjective === "max_return_target_risk"
        ? Math.max(numberOr(settings.sharpeBlendWeight, 0), 100)
        : 0,
    min_risk_blend_weight: optimizationObjective === "min_risk_target_return" ? Math.max(numberOr(settings.minRiskBlendWeight, 0), 100) : 0,
    optimization_objective: optimizationObjective,
    target_return: Math.max(0, numberOr(settings.targetReturn, 20)),
    target_risk: Math.max(0.1, numberOr(settings.targetRisk, 20)),
    portfolio_assets_count: portfolioAssetsCount,
    requested_assets_count: portfolioAssetsCount,
    enforce_requested_count: portfolioAssetsCount > 0,
  };
}

export function getHybridAnalysisParameters(modelSettings: Record<string, unknown>): Record<string, unknown> {
  const neural = asRecord(modelSettings.neural);
  return asRecord(neural?.parameters) ?? {};
}

export function buildHybridPipelinePayload(
  modelSettings: Record<string, unknown>,
  portfolioSettings: Record<string, unknown>,
  weights: HybridModelWeights,
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
