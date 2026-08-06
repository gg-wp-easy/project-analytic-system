import { useEffect, useMemo, useRef, useState } from "react";
import {
  Brain,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  FileSpreadsheet,
  FileText,
  ImageDown,
  ListFilter,
  Play,
  RotateCcw,
  Search,
  Settings,
  Square,
  X,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  Legend,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";
import { useFundamentals } from "../../../entities/fundamentals";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import { Checkbox } from "../../../app/components/ui/checkbox";
import { Input } from "../../../app/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../app/components/ui/select";
import {
  buildOptimizerSettingsPayload,
  getOptimizationSummary,
  OptimizerSettingsFields,
  submitOptimizerSettings,
  useOptimizerSettings,
} from "../../../features/optimizer-settings";
import { PortfolioSimulationPanel } from "../../../features/portfolio-simulation";

import { SavePortfolioButton } from "../../../features/saved-portfolios";
import { API_BASE_URL } from "../../../config";
import type {
  NeuralFeatureImportanceItem as FeatureImportanceItem,
  NeuralMetricItem as MetricItem,
  NeuralAnalysisResultRow as AnalysisResultRow,
  NeuralModelStatItem as ModelStatItem,
  NeuralPortfolioPosition as PortfolioPosition,
  NeuralPortfolioStrategy as PortfolioStrategy,
  NeuralTrainingPoint as TrainingPoint,
} from "../../../features/neural-analysis";
import {
  formatMetricDisplay,
  getMetricTooltip,
  isVisibleAnalysisMetric,
  localizeMetricLabel,
} from "../../../shared/lib/analysis/metric-display";
import {
  buildParameterRows,
  extractModelParameters,
} from "../../../shared/lib/analysis/model-details";
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
import { AnalysisLoadingPreview } from "../../../shared/ui/analysis/AnalysisLoadingPreview";
import { AnalysisRunningIndicator } from "../../../shared/ui/analysis/AnalysisRunningIndicator";
import { InfoTooltip } from "../../../shared/ui/analysis/InfoTooltip";
import { MetricTooltip } from "../../../shared/ui/analysis/MetricTooltip";
import { PortfolioHoldingsPanel } from "../../../shared/ui/analysis/PortfolioHoldingsPanel";
import {
  DEFAULT_NEURAL_SETTINGS,
  NEURAL_FEATURE_OPTIONS,
  NEURAL_PALETTE,
  NEURAL_STATE_KEY,
} from "../model";
import type {
  NeuralActivation,
  NeuralAnalysisSettings,
  NeuralModelType,
  NeuralOptimizer,
  SelectionMode,
  TuningBudget,
} from "../model";
import {
  extractAnalysisRows,
  extractFeatureImportance,
  extractMetrics,
  extractModelStats,
  extractPortfolioAssetsCount,
  extractPortfolioPositions,
  extractPortfolioStrategies,
  extractTrainingHistory,
  formatOptionalNumber,
  formatPercentValue,
} from "../lib";

const PORTFOLIO_METRIC_LABELS = new Set(["expected return", "risk", "volatility", "sharpe", "sharpe ratio", "diversification"]);
const ARCHITECTURE_DIAGRAM_WIDTH = 1080;
const ARCHITECTURE_DIAGRAM_HEIGHT = 420;
const MODEL_STATS_PAGE_SIZE = 8;
const ANALYSIS_ROWS_PAGE_SIZE = 12;
const ARCHITECTURE_INPUT_COLOR = "#0f766e";
const ARCHITECTURE_INPUT_DARK_COLOR = "#5eead4";
const ARCHITECTURE_HIDDEN_COLORS = ["#2563eb", "#7c3aed", "#0891b2", "#4f46e5", "#db2777"];
const ARCHITECTURE_HIDDEN_DARK_COLORS = ["#93c5fd", "#c4b5fd", "#67e8f9", "#a5b4fc", "#f9a8d4"];
const ARCHITECTURE_OUTPUT_COLOR = "#16a34a";
const ARCHITECTURE_OUTPUT_DARK_COLOR = "#86efac";

function isPortfolioMetric(label: string): boolean {
  return PORTFOLIO_METRIC_LABELS.has(label.trim().toLowerCase());
}

function parseLayerSizesFromValue(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.map((item) => Math.trunc(Number(item))).filter((item) => Number.isFinite(item) && item > 0);
  }
  const matches = String(value ?? "").match(/\d+/g) ?? [];
  return matches.map((item) => Math.trunc(Number(item))).filter((item) => Number.isFinite(item) && item > 0);
}

function averageFinite(values: number[]): number {
  const finite = values.filter((value) => Number.isFinite(value));
  if (!finite.length) {
    return NaN;
  }
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function getArchitectureNodeY(index: number, count: number): number {
  if (count <= 1) {
    return ARCHITECTURE_DIAGRAM_HEIGHT / 2;
  }
  const top = 118;
  const bottom = ARCHITECTURE_DIAGRAM_HEIGHT - 132;
  return top + (index * (bottom - top)) / (count - 1);
}

function getArchitectureLayerX(index: number, count: number): number {
  return 92 + (index * (ARCHITECTURE_DIAGRAM_WIDTH - 184)) / Math.max(count - 1, 1);
}

function getArchitectureBandWidth(count: number): number {
  const step = (ARCHITECTURE_DIAGRAM_WIDTH - 184) / Math.max(count - 1, 1);
  return Math.max(58, Math.min(96, step - 36));
}

function truncateSvgLabel(value: string, maxLength: number): string {
  return value.length > maxLength ? value.slice(0, maxLength - 3) + "..." : value;
}

function formatModelValue(value: unknown, fallback = "-"): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

export function NeuralNetworkAnalysis() {
  const { cache, hasData } = useFundamentals();
  const { locale, t } = useAppSettings();
  const isEn = locale === "en";
  const { settings: optimizerSettings, setSettings: setOptimizerSettings } = useOptimizerSettings();
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDialogMessage, setErrorDialogMessage] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<MetricItem[]>([]);
  const [analysisRows, setAnalysisRows] = useState<AnalysisResultRow[]>([]);
  const [featureImportance, setFeatureImportance] = useState<FeatureImportanceItem[]>([]);
  const [portfolioStrategies, setPortfolioStrategies] = useState<PortfolioStrategy[]>([]);
  const [portfolioPositions, setPortfolioPositions] = useState<PortfolioPosition[]>([]);
  const [trainingHistory, setTrainingHistory] = useState<TrainingPoint[]>([]);
  const [modelStats, setModelStats] = useState<ModelStatItem[]>([]);
  const [modelStatsPage, setModelStatsPage] = useState(1);
  const [analysisRowsPage, setAnalysisRowsPage] = useState(1);
  const [modelParameters, setModelParameters] = useState<Record<string, unknown>>({});
  const [portfolioAssetsCount, setPortfolioAssetsCount] = useState(0);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("all");
  const [selectedFigis, setSelectedFigis] = useState<string[]>([]);
  const [stockSearch, setStockSearch] = useState("");
  const [neuralSettings, setNeuralSettings] = useState<NeuralAnalysisSettings>(DEFAULT_NEURAL_SETTINGS);
  const portfolioChartRef = useRef<HTMLDivElement | null>(null);
  const predictionChartRef = useRef<HTMLDivElement | null>(null);
  const architectureChartRef = useRef<HTMLDivElement | null>(null);
  const visibleMetrics = useMemo(() => metrics.filter((item) => isVisibleAnalysisMetric(item.label)), [metrics]);
  const portfolioMetrics = useMemo(() => visibleMetrics.filter((item) => isPortfolioMetric(item.label)), [visibleMetrics]);
  const overviewMetrics = useMemo(() => visibleMetrics.filter((item) => !isPortfolioMetric(item.label)), [visibleMetrics]);
  const showErrorDialog = (message: string) => {
    setError(message);
    setErrorDialogMessage(message);
  };
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(NEURAL_STATE_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as {
        error?: string | null;
        metrics?: MetricItem[];
        analysisRows?: AnalysisResultRow[];
        featureImportance?: FeatureImportanceItem[];
        portfolioStrategies?: PortfolioStrategy[];
        portfolioPositions?: PortfolioPosition[];
        trainingHistory?: TrainingPoint[];
        modelStats?: ModelStatItem[];
        modelParameters?: Record<string, unknown>;
        portfolioAssetsCount?: number;
        selectionMode?: SelectionMode;
        selectedFigis?: string[];
        neuralSettings?: Partial<NeuralAnalysisSettings>;
      };
      if (typeof parsed.error === "string" || parsed.error === null) setError(parsed.error);
      if (Array.isArray(parsed.metrics)) setMetrics(parsed.metrics.filter((item) => isVisibleAnalysisMetric(item.label)));
      if (Array.isArray(parsed.analysisRows)) setAnalysisRows(parsed.analysisRows);
      if (Array.isArray(parsed.featureImportance)) setFeatureImportance(parsed.featureImportance);
      if (Array.isArray(parsed.portfolioStrategies)) setPortfolioStrategies(parsed.portfolioStrategies);
      if (Array.isArray(parsed.portfolioPositions)) setPortfolioPositions(parsed.portfolioPositions);
      if (Array.isArray(parsed.trainingHistory)) setTrainingHistory(parsed.trainingHistory);
      if (Array.isArray(parsed.modelStats)) setModelStats(parsed.modelStats);
      if (parsed.modelParameters && typeof parsed.modelParameters === "object") setModelParameters(parsed.modelParameters);
      if (typeof parsed.portfolioAssetsCount === "number") setPortfolioAssetsCount(parsed.portfolioAssetsCount);
      if (parsed.selectionMode === "all" || parsed.selectionMode === "manual") setSelectionMode(parsed.selectionMode);
      if (Array.isArray(parsed.selectedFigis)) setSelectedFigis(parsed.selectedFigis.filter((figi) => typeof figi === "string"));
      if (parsed.neuralSettings && typeof parsed.neuralSettings === "object") {
        setNeuralSettings({
          ...DEFAULT_NEURAL_SETTINGS,
          ...parsed.neuralSettings,
          epochs: numberOr(parsed.neuralSettings.epochs, DEFAULT_NEURAL_SETTINGS.epochs),
          batchSize: numberOr(parsed.neuralSettings.batchSize, DEFAULT_NEURAL_SETTINGS.batchSize),
          learningRate: numberOr(parsed.neuralSettings.learningRate, DEFAULT_NEURAL_SETTINGS.learningRate),
          dropout: numberOr(parsed.neuralSettings.dropout, DEFAULT_NEURAL_SETTINGS.dropout),
          validationSplit: numberOr(parsed.neuralSettings.validationSplit, DEFAULT_NEURAL_SETTINGS.validationSplit),
          randomState: numberOr(parsed.neuralSettings.randomState, DEFAULT_NEURAL_SETTINGS.randomState),
          features: Array.isArray(parsed.neuralSettings.features)
            ? parsed.neuralSettings.features.filter((item) => typeof item === "string")
            : DEFAULT_NEURAL_SETTINGS.features,
        });
      }
    } catch {
      // ignore broken persisted state
    }
  }, []);

  useEffect(() => {
    const payload = {
      error,
      metrics,
      analysisRows,
      featureImportance,
      portfolioStrategies,
      portfolioPositions,
      trainingHistory,
      modelStats,
      modelParameters,
      portfolioAssetsCount,
      selectionMode,
      selectedFigis,
      neuralSettings,
    };
    window.localStorage.setItem(NEURAL_STATE_KEY, JSON.stringify(payload));
  }, [
    error,
    metrics,
    analysisRows,
    featureImportance,
    portfolioStrategies,
    portfolioPositions,
    trainingHistory,
    modelStats,
    modelParameters,
    portfolioAssetsCount,
    selectionMode,
    selectedFigis,
    neuralSettings,
  ]);


  const modelParameterRows = useMemo(() => {
      const visibleKeys = [
        "model_type",
        "best_model",
        "epochs",
        "validation_split",
        "tuning_budget",
        "selected_features",
        "feature_combinations_count",
        "dividend_priority",
        "reuse_cached_models",
        "model_cache_status",
        "variants_count",
      ];
      return buildParameterRows(
        modelParameters,
        {
          model_type: t("\u0422\u0438\u043f \u043c\u043e\u0434\u0435\u043b\u0438", "Model type"),
          best_model: t("\u041b\u0443\u0447\u0448\u0430\u044f \u043c\u043e\u0434\u0435\u043b\u044c", "Best model"),
          epochs: t("\u042d\u043f\u043e\u0445", "Epochs"),
          validation_split: t("\u0412\u0430\u043b\u0438\u0434\u0430\u0446\u0438\u043e\u043d\u043d\u0430\u044f \u0434\u043e\u043b\u044f", "Validation split"),
          random_state: t("Начальное значение", "Random seed"),
          selection_metric: t("\u041c\u0435\u0442\u0440\u0438\u043a\u0430 \u043f\u043e\u0434\u0431\u043e\u0440\u0430", "Selection metric"),
          selection_rule: t("\u041f\u0440\u0430\u0432\u0438\u043b\u043e \u0432\u044b\u0431\u043e\u0440\u0430", "Selection rule"),
          auto_tune: t("\u0410\u0432\u0442\u043e\u043f\u043e\u0434\u0431\u043e\u0440", "Auto tune"),
          tuning_budget: t("\u0411\u044e\u0434\u0436\u0435\u0442 \u043f\u043e\u0434\u0431\u043e\u0440\u0430", "Tuning budget"),
          features: t("\u041f\u0440\u0438\u0437\u043d\u0430\u043a\u0438", "Features"),
          selected_features: t("Выбранные признаки", "Selected features"),
          feature_combinations_count: t("Комбинаций признаков", "Feature combinations"),
          dividend_priority: t("Дивидендный приоритет", "Dividend priority"),
          reuse_cached_models: t("Кэш моделей", "Model cache"),
          model_cache_status: t("Результат кэша", "Cache result"),
          variants_count: t("\u041a\u043e\u043d\u0444\u0438\u0433\u0443\u0440\u0430\u0446\u0438\u0439", "Variants"),
          grid_hidden_layers: t("\u0421\u0435\u0442\u043a\u0430 \u0441\u043b\u043e\u0451\u0432", "Layer grid"),
        },
        visibleKeys,
      ).filter((row) => visibleKeys.includes(row.key));
    }, [modelParameters, t]);

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
            pfcf: f.pfcfRatio,
            ev_to_ebitda: f.evToEbitda,
            roa: f.roa,
            net_margin: f.netMargin,
            net_debt_to_ebitda: f.netDebtToEbitda,
            total_debt: f.totalDebt,
            roe: f.roe,
            dividend_yield: f.dividendYield,
            five_year_avg_dividend_yield: f.fiveYearAverageDividendYield,
            five_year_dividend_growth_rate: f.fiveYearDividendGrowthRate,
            payout_ratio: f.dividendPayoutRatio,
            dividend_years_count: f.dividendYearsCount,
            consecutive_dividend_years: f.consecutiveDividendYears,
            dividend_consistency: f.dividendConsistency,
            last_dividend_year: f.lastDividendYear,
            beta: f.beta,
            g: f.roe,
            growth_rate: f.roe,
            growthRate: f.roe,
          };
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row)),
    [cache.fundamentalsByFigi, cache.shares],
  );

  const sortedRequestData = useMemo(
    () => [...requestData].sort((left, right) => left.ticker.localeCompare(right.ticker)),
    [requestData],
  );

  const selectedFigisSet = useMemo(() => new Set(selectedFigis), [selectedFigis]);
  const selectedRequestData = useMemo(
    () => (selectionMode === "all" ? requestData : requestData.filter((row) => selectedFigisSet.has(row.figi))),
    [requestData, selectedFigisSet, selectionMode],
  );

  const filteredStockRows = useMemo(() => {
    const normalizedSearch = stockSearch.trim().toLowerCase();
    if (!normalizedSearch) {
      return sortedRequestData;
    }
    return sortedRequestData.filter((row) => {
      const haystack = `${row.ticker} ${row.name} ${row.exchange} ${row.currency}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [sortedRequestData, stockSearch]);

  const hiddenLayerSizes = useMemo(
    () =>
      neuralSettings.hiddenLayers
        .split(",")
        .map((item) => Math.trunc(Number(item.trim())))
        .filter((value) => Number.isFinite(value) && value > 0),
    [neuralSettings.hiddenLayers],
  );

  const selectedFeatureLabels = useMemo(
    () =>
      NEURAL_FEATURE_OPTIONS
        .filter((option) => neuralSettings.features.includes(option.key))
        .map((option) => (isEn ? option.labelEn : option.labelRu)),
    [isEn, neuralSettings.features],
  );

  const topSignalRows = useMemo(() => analysisRows.slice(0, 10), [analysisRows]);

  const predictionChartRows = useMemo(
    () => analysisRows.filter((row) => Number.isFinite(row.pe) && Number.isFinite(row.predictedPE)).slice(0, 40),
    [analysisRows],
  );

  const analysisRowsPageCount = useMemo(
    () => Math.max(1, Math.ceil(analysisRows.length / ANALYSIS_ROWS_PAGE_SIZE)),
    [analysisRows.length],
  );
  const activeAnalysisRowsPage = Math.min(Math.max(analysisRowsPage, 1), analysisRowsPageCount);

  useEffect(() => {
    setAnalysisRowsPage((current) => Math.min(Math.max(current, 1), analysisRowsPageCount));
  }, [analysisRowsPageCount]);

  const paginatedAnalysisRows = useMemo(() => {
    const start = (activeAnalysisRowsPage - 1) * ANALYSIS_ROWS_PAGE_SIZE;
    return analysisRows.slice(start, start + ANALYSIS_ROWS_PAGE_SIZE);
  }, [activeAnalysisRowsPage, analysisRows]);

  const analysisRowsRangeLabel = useMemo(() => {
    if (!analysisRows.length) {
      return "0 / 0";
    }
    const start = (activeAnalysisRowsPage - 1) * ANALYSIS_ROWS_PAGE_SIZE + 1;
    const end = Math.min(analysisRows.length, activeAnalysisRowsPage * ANALYSIS_ROWS_PAGE_SIZE);
    return start + "-" + end + " / " + analysisRows.length;
  }, [activeAnalysisRowsPage, analysisRows.length]);
  const bestModelStat = modelStats[0] ?? null;
  const resolvedFeatureNames = useMemo(() => {
    if (bestModelStat?.features.length) {
      return bestModelStat.features;
    }
    const selected = modelParameters.selected_features;
    if (Array.isArray(selected) && selected.length) {
      return selected.map(String);
    }
    return neuralSettings.features;
  }, [bestModelStat?.features, modelParameters.selected_features, neuralSettings.features]);
  const resolvedFeatureLabels = useMemo(
    () =>
      resolvedFeatureNames.map((feature) => {
        const option = NEURAL_FEATURE_OPTIONS.find((item) => item.key === feature);
        return option ? (isEn ? option.labelEn : option.labelRu) : feature;
      }),
    [isEn, resolvedFeatureNames],
  );

  const modelStatsPageCount = useMemo(
    () => Math.max(1, Math.ceil(modelStats.length / MODEL_STATS_PAGE_SIZE)),
    [modelStats.length],
  );
  const activeModelStatsPage = Math.min(Math.max(modelStatsPage, 1), modelStatsPageCount);

  useEffect(() => {
    setModelStatsPage((current) => Math.min(Math.max(current, 1), modelStatsPageCount));
  }, [modelStatsPageCount]);

  const paginatedModelStats = useMemo(() => {
    const start = (activeModelStatsPage - 1) * MODEL_STATS_PAGE_SIZE;
    return modelStats.slice(start, start + MODEL_STATS_PAGE_SIZE);
  }, [activeModelStatsPage, modelStats]);

  const modelStatsRangeLabel = useMemo(() => {
    if (!modelStats.length) {
      return "0 / 0";
    }
    const start = (activeModelStatsPage - 1) * MODEL_STATS_PAGE_SIZE + 1;
    const end = Math.min(modelStats.length, activeModelStatsPage * MODEL_STATS_PAGE_SIZE);
    return start + "-" + end + " / " + modelStats.length;
  }, [activeModelStatsPage, modelStats.length]);

  const resolvedHiddenLayerSizes = useMemo(() => {
    const fromBestModel = parseLayerSizesFromValue(bestModelStat?.hiddenLayers);
    if (fromBestModel.length) {
      return fromBestModel;
    }
    const fromParameters = parseLayerSizesFromValue(modelParameters.hidden_layer_sizes ?? modelParameters.hidden_layers);
    return fromParameters.length ? fromParameters : hiddenLayerSizes;
  }, [bestModelStat?.hiddenLayers, hiddenLayerSizes, modelParameters]);

  const resolvedActivation = useMemo(
    () => formatModelValue(bestModelStat?.activation ?? modelParameters.activation ?? neuralSettings.activation),
    [bestModelStat?.activation, modelParameters.activation, neuralSettings.activation],
  );

  const resolvedOptimizer = useMemo(
    () => formatModelValue(bestModelStat?.solver ?? modelParameters.solver ?? neuralSettings.optimizer),
    [bestModelStat?.solver, modelParameters.solver, neuralSettings.optimizer],
  );

  const architectureSignature = useMemo(
    () => [resolvedFeatureNames.length, ...resolvedHiddenLayerSizes, 1].join(" -> "),
    [resolvedFeatureNames.length, resolvedHiddenLayerSizes],
  );

  const architectureFeaturePreview = useMemo(() => {
    const visible = resolvedFeatureLabels.slice(0, 5);
    const suffix = resolvedFeatureLabels.length > visible.length ? " +" + (resolvedFeatureLabels.length - visible.length) : "";
    return truncateSvgLabel(visible.join(", ") + suffix, 86);
  }, [resolvedFeatureLabels]);

  const architectureLayers = useMemo(
    () => [
      {
        key: "input",
        title: t("Вход", "Input"),
        subtitle: t("Признаки", "Features"),
        count: Math.max(resolvedFeatureNames.length, 1),
        color: ARCHITECTURE_INPUT_COLOR,
        darkColor: ARCHITECTURE_INPUT_DARK_COLOR,
      },
      ...resolvedHiddenLayerSizes.map((size, index) => ({
        key: "hidden-" + index,
        title: t("Слой", "Layer") + " " + (index + 1),
        subtitle: t("Нейроны", "Neurons"),
        count: size,
        color: ARCHITECTURE_HIDDEN_COLORS[index % ARCHITECTURE_HIDDEN_COLORS.length],
        darkColor: ARCHITECTURE_HIDDEN_DARK_COLORS[index % ARCHITECTURE_HIDDEN_DARK_COLORS.length],
      })),
      {
        key: "output",
        title: t("Выход", "Output"),
        subtitle: "P/E",
        count: 1,
        color: ARCHITECTURE_OUTPUT_COLOR,
        darkColor: ARCHITECTURE_OUTPUT_DARK_COLOR,
      },
    ],
    [resolvedFeatureNames.length, resolvedHiddenLayerSizes, t],
  );

  const analysisSummary = useMemo(
    () => ({
      sampleSize: selectedRequestData.length,
      resultCount: analysisRows.length,
      averageGap: averageFinite(analysisRows.map((row) => row.undervaluationGap)),
      averageExpectedReturn: averageFinite(analysisRows.map((row) => row.expectedReturn)),
      averageSignal: averageFinite(analysisRows.map((row) => row.portfolioSignal)),
      topTicker: analysisRows[0]?.ticker ?? "-",
      bestModel: bestModelStat?.modelName ?? String(modelParameters.best_model ?? "-"),
    }),
    [analysisRows, bestModelStat?.modelName, modelParameters.best_model, selectedRequestData.length],
  );

  const neuralHelp = useMemo(() => {
    if (!neuralSettings.autoTune && neuralSettings.modelType === "deep_mlp") {
      return {
        title: t("Глубокий MLP", "Deep MLP"),
        text: t(
          "Использует несколько скрытых слоев для поиска нелинейных связей между фундаментальными метриками и целевым сигналом.",
          "Uses multiple hidden layers to find nonlinear relationships between fundamental metrics and the target signal.",
        ),
        note: t(
          "Больше слоев и эпох могут повысить качество, но увеличивают риск переобучения.",
          "More layers and epochs may improve quality, but increase overfitting risk.",
        ),
      };
    }
    if (neuralSettings.autoTune || neuralSettings.modelType === "auto") {
      return {
        title: t("Автоподбор", "Auto selection"),
        text: t(
          "Модель может автоматически выбрать подходящую конфигурацию из доступных вариантов.",
          "The model can automatically choose a suitable configuration from the available options.",
        ),
        note: t(
          "Переданные ограничения остаются ориентирами для обучения.",
          "The submitted limits remain training guidelines.",
        ),
      };
    }
    return {
      title: "MLP",
      text: t(
        "Полносвязная нейросеть для табличных фундаментальных данных. Хорошая базовая модель для оценки нелинейных комбинаций признаков.",
        "A fully connected network for tabular fundamentals. A good baseline for evaluating nonlinear feature combinations.",
      ),
      note: t(
        "Слои задаются через запятую, например 64,32.",
        "Layers are entered comma-separated, for example 64,32.",
      ),
    };
  }, [neuralSettings.autoTune, neuralSettings.modelType, t]);

  const hasValidNeuralInput =
    hasData &&
    selectedRequestData.length >= 10 &&
    (optimizerSettings.autoModelTuning ||
      (neuralSettings.features.length >= 2 &&
        hiddenLayerSizes.length >= 1 &&
        neuralSettings.epochs >= 1 &&
        neuralSettings.batchSize >= 1 &&
        neuralSettings.learningRate > 0));
  const canRunAnalysis = hasValidNeuralInput && !isRunning;

  const updateNeuralSettings = (patch: Partial<NeuralAnalysisSettings>) => {
    setNeuralSettings((prev) => ({ ...prev, ...patch }));
  };

  const setManualSelectionMode = () => {
    setSelectionMode("manual");
    setSelectedFigis((prev) => (prev.length ? prev : requestData.map((row) => row.figi)));
  };

  const toggleStockSelection = (figi: string) => {
    setSelectionMode("manual");
    setSelectedFigis((prev) => (prev.includes(figi) ? prev.filter((item) => item !== figi) : [...prev, figi]));
  };

  const selectAllStocks = () => {
    setSelectionMode("manual");
    setSelectedFigis(requestData.map((row) => row.figi));
  };

  const clearStockSelection = () => {
    setSelectionMode("manual");
    setSelectedFigis([]);
  };

  const resetNeuralSettings = () => {
    setNeuralSettings(DEFAULT_NEURAL_SETTINGS);
  };

  const toggleNeuralFeature = (key: string) => {
    setNeuralSettings((prev) => {
      const isSelected = prev.features.includes(key);
      return {
        ...prev,
        features: isSelected ? prev.features.filter((item) => item !== key) : [...prev.features, key],
      };
    });
  };

  const runAnalysis = async () => {
    setError(null);
    setErrorDialogMessage(null);

    if (!hasValidNeuralInput) {
      showErrorDialog(
        t(
          "Выберите минимум 10 акций, два признака и корректные параметры нейросети.",
          "Select at least 10 stocks, two features, and valid neural network parameters.",
        ),
      );
      return;
    }

    setIsRunning(true);

    try {
      const optimizerPayload = buildOptimizerSettingsPayload(optimizerSettings);
      if (!optimizerSettings.autoPortfolioOptimization) {
        await submitOptimizerSettings(optimizerSettings);
      }
      const selectedTickers = selectedRequestData.map((row) => row.ticker);
      const selectedFigisForRequest = selectedRequestData.map((row) => row.figi);
      const requestedAssetsCount = optimizerSettings.autoPortfolioOptimization
        ? 20
        : Number(optimizerPayload.portfolio_assets_count ?? 20);
      const response = await fetch(`${API_BASE_URL}/ai-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: selectedRequestData,
          auto_model_tuning: optimizerSettings.autoModelTuning,
          auto_portfolio_optimization: optimizerSettings.autoPortfolioOptimization,
          portfolio_assets_count: requestedAssetsCount,
          use_cache: true,
          parameters: {
            model_type: neuralSettings.autoTune ? "auto" : neuralSettings.modelType,
            activation: neuralSettings.activation,
            optimizer: neuralSettings.optimizer,
            hidden_layers: hiddenLayerSizes,
            hidden_layers_raw: neuralSettings.hiddenLayers,
            epochs: neuralSettings.epochs,
            batch_size: neuralSettings.batchSize,
            learning_rate: neuralSettings.learningRate,
            dropout: neuralSettings.dropout,
            validation_split: neuralSettings.validationSplit / 100,
            random_state: neuralSettings.randomState,
            early_stopping: neuralSettings.earlyStopping,
            auto_tune: optimizerSettings.autoModelTuning ? true : neuralSettings.autoTune,
            search_feature_combinations: neuralSettings.searchFeatureCombinations,
            dividend_priority: neuralSettings.dividendPriority,
            reuse_cached_models: neuralSettings.reuseCachedModels,
            tuning_metric: neuralSettings.tuningMetric,
            tuning_budget: neuralSettings.tuningBudget,
            tuning_scope: "neural_analysis",
            features: neuralSettings.features,
          },
          selected_figis: selectedFigisForRequest,
          selected_tickers: selectedTickers,
          selection: {
            mode: selectionMode,
            total_records: requestData.length,
            selected_records: selectedRequestData.length,
          },
        }),
      });

      const text = await response.text();
      if (!response.ok) {
        throw new Error(t("Не удалось обучить нейросеть. Проверьте данные и повторите попытку.", "The neural model could not be trained. Check the data and try again."));
      }
      const parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};

      const parsedMetrics = extractMetrics(parsed);
      const parsedAnalysisRows = extractAnalysisRows(parsed);
      const parsedImportance = extractFeatureImportance(parsed);
      const parsedStrategies = extractPortfolioStrategies(parsed);
      const parsedPositions = extractPortfolioPositions(parsed);
      const parsedHistory = extractTrainingHistory(parsed);
      const parsedModelStats = extractModelStats(parsed);
      const parsedModelParameters = extractModelParameters(parsed);
      const parsedAssetsCount = extractPortfolioAssetsCount(parsed);

      setMetrics(parsedMetrics);
      setAnalysisRows(parsedAnalysisRows);
      setAnalysisRowsPage(1);
      setFeatureImportance(parsedImportance);
      setPortfolioStrategies(parsedStrategies);
      setPortfolioPositions(parsedPositions);
      setTrainingHistory(parsedHistory);
      setModelStats(parsedModelStats);
      setModelStatsPage(1);
      setModelParameters(parsedModelParameters);
      setPortfolioAssetsCount(parsedAssetsCount);
    } catch (e) {
      const message = e instanceof Error
        ? e.message
        : t("Не удалось выполнить нейросетевой анализ", "Failed to run neural network analysis");
      showErrorDialog(message);
      setMetrics([]);
      setAnalysisRows([]);
      setAnalysisRowsPage(1);
      setFeatureImportance([]);
      setPortfolioStrategies([]);
      setPortfolioPositions([]);
      setTrainingHistory([]);
      setModelStats([]);
      setModelStatsPage(1);
      setModelParameters({});
      setPortfolioAssetsCount(0);
    } finally {
      setIsRunning(false);
    }
  };

  const exportPortfolioToXlsx = async () => {
    if (!portfolioPositions.length) {
      return;
    }
    await downloadAnalysisResultsAsXlsx({
      title: t("Оптимальный портфель из нейросетевого анализа", "Optimal Portfolio from Neural Analysis"),
      filename: "ai-optimal-portfolio.xlsx",
      rows: portfolioPositions,
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
      await downloadSvgAsPng(svg as SVGSVGElement, "ai-optimal-portfolio.png");
    } catch (e) {
      const message = e instanceof Error ? e.message : t("Не удалось сохранить PNG", "Failed to save PNG");
      showErrorDialog(message);
    }
  };

  const exportPortfolioToPdf = async () => {
    if (!portfolioPositions.length) {
      return;
    }
    try {
      await downloadAnalysisResultsAsPdf({
        title: t("Оптимальный портфель из нейросетевого анализа", "Optimal Portfolio from Neural Analysis"),
        filename: "ai-optimal-portfolio.pdf",
        rows: portfolioPositions,
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

  const buildAnalysisExportMetrics = () => [
    { label: t("Акций в анализе", "Stocks in analysis"), value: analysisSummary.sampleSize },
    { label: t("Недооценённых", "Undervalued"), value: analysisSummary.resultCount },
    { label: t("Средний разрыв P/E", "Average P/E gap"), value: formatPercentValue(analysisSummary.averageGap) },
    { label: t("Средняя ожидаемая доходность", "Average expected return"), value: formatPercentValue(analysisSummary.averageExpectedReturn) },
    { label: t("Средний сигнал", "Average signal"), value: formatPercentValue(analysisSummary.averageSignal) },
    { label: t("Лучший сигнал", "Top signal"), value: analysisSummary.topTicker },
    { label: t("Лучшая модель", "Best model"), value: analysisSummary.bestModel },
    ...overviewMetrics.map((item) => ({
      label: localizeMetricLabel(item.label, isEn),
      value: formatMetricDisplay(item.label, item.value),
    })),
    ...portfolioMetrics.map((item) => ({
      label: localizeMetricLabel(item.label, isEn),
      value: formatMetricDisplay(item.label, item.value),
    })),
    ...modelParameterRows.map((row) => ({ label: row.label, value: row.value })),
    ...modelStats.slice(0, 5).map((row, index) => ({
      label: t("Модель", "Model") + " #" + (index + 1),
      value: [
        row.modelName,
        "features=" + row.features.join(","),
        row.hiddenLayers,
        "selection_score=" + formatOptionalNumber(row.selectionScore, 5),
        "overfit_ratio=" + formatOptionalNumber(row.overfitRatio, 2),
        "val_r2=" + formatOptionalNumber(row.valR2Final, 4),
      ].join("; "),
    })),
  ];

  const buildAnalysisResultColumns = () => [
    { header: "Ticker", render: (row: AnalysisResultRow) => row.ticker },
    { header: t("Компания", "Company"), render: (row: AnalysisResultRow) => row.name },
    { header: "P/E fact", render: (row: AnalysisResultRow) => formatOptionalNumber(row.pe, 2) },
    { header: "P/E forecast", render: (row: AnalysisResultRow) => formatOptionalNumber(row.predictedPE, 2) },
    { header: "Residual", render: (row: AnalysisResultRow) => formatOptionalNumber(row.residual, 2) },
    { header: "Gap, %", render: (row: AnalysisResultRow) => formatPercentValue(row.undervaluationGap) },
    { header: "Expected return, %", render: (row: AnalysisResultRow) => formatPercentValue(row.expectedReturn) },
    { header: "Signal, %", render: (row: AnalysisResultRow) => formatPercentValue(row.portfolioSignal) },
    { header: "Value score, %", render: (row: AnalysisResultRow) => formatPercentValue(row.valueScore) },
    { header: "Quality score, %", render: (row: AnalysisResultRow) => formatPercentValue(row.qualityScore) },
    { header: "Growth score, %", render: (row: AnalysisResultRow) => formatPercentValue(row.growthScore) },
    { header: "Risk score, %", render: (row: AnalysisResultRow) => formatPercentValue(row.riskScore) },
    { header: "ROE, %", render: (row: AnalysisResultRow) => formatPercentValue(row.roe) },
    { header: "Dividend yield, %", render: (row: AnalysisResultRow) => formatPercentValue(row.dividendYield) },
    { header: "5Y dividend yield, %", render: (row: AnalysisResultRow) => formatPercentValue(row.fiveYearAverageDividendYield) },
    { header: "Dividend years", render: (row: AnalysisResultRow) => row.dividendYearsCount },
    { header: "Consecutive dividend years", render: (row: AnalysisResultRow) => row.consecutiveDividendYears },
    { header: "Dividend score, %", render: (row: AnalysisResultRow) => formatPercentValue(row.dividendScore) },
    { header: "Beta", render: (row: AnalysisResultRow) => formatOptionalNumber(row.beta, 2) },
    { header: "Market cap", render: (row: AnalysisResultRow) => formatOptionalNumber(row.marketCap, 0) },
  ];

  const exportAnalysisToXlsx = async () => {
    if (!analysisRows.length) {
      return;
    }
    await downloadAnalysisResultsAsXlsx({
      title: t("Результаты нейросетевого анализа", "Neural Network Analysis Results"),
      filename: "ai-analysis-results.xlsx",
      rows: analysisRows,
      columns: buildAnalysisResultColumns(),
      metrics: buildAnalysisExportMetrics(),
    });
  };

  const exportAnalysisToPdf = async () => {
    if (!analysisRows.length) {
      return;
    }
    try {
      await downloadAnalysisResultsAsPdf({
        title: t("Результаты нейросетевого анализа", "Neural Network Analysis Results"),
        filename: "ai-analysis-results.pdf",
        rows: analysisRows,
        columns: buildAnalysisResultColumns(),
        metrics: buildAnalysisExportMetrics(),
        chartSvg: predictionChartRef.current?.querySelector("svg"),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : t("Не удалось сохранить PDF", "Failed to save PDF");
      showErrorDialog(message);
    }
  };

  const savePredictionChartPng = async () => {
    const svg = predictionChartRef.current?.querySelector("svg");
    if (!svg) {
      return;
    }
    try {
      await downloadSvgAsPng(svg as SVGSVGElement, "ai-pe-prediction.png");
    } catch (e) {
      const message = e instanceof Error ? e.message : t("Не удалось сохранить PNG", "Failed to save PNG");
      showErrorDialog(message);
    }
  };

  const saveArchitectureChartPng = async () => {
    const svg = architectureChartRef.current?.querySelector("svg");
    if (!svg) {
      return;
    }
    try {
      await downloadSvgAsPng(svg as SVGSVGElement, "ai-network-schema.png");
    } catch (e) {
      const message = e instanceof Error ? e.message : t("Не удалось сохранить PNG", "Failed to save PNG");
      showErrorDialog(message);
    }
  };

  return (
    <>
      <AnalysisPageFrame
      hero={(
        <PageHero
          icon={Brain}
          title={t("Анализ нейросети", "Neural Network Analysis")}
          description={t(
            "Выберите акции, признаки и параметры, чтобы обучить и оценить нейросеть.",
            "Select stocks, features, and settings to train and evaluate the neural model.",
          )}
          accent="orange"
        />
      )}
      sidebar={(
        <AnalysisSidebarCard
          icon={Settings}
          title={t("Настройки", "Settings")}
          description={
            t("Модель, признаки и портфель.", "Model, features, and portfolio.")
          }
          accent="orange"
        >
          <div className="space-y-4">
            <div className="ui-surface-muted">
              <p className="text-sm text-slate-700 dark:text-slate-300">{t("Источник: загруженные фундаментальные данные", "Source: loaded fundamentals")}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t("Выбрано", "Selected")}: {selectedRequestData.length} / {requestData.length}
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <span>{t("Модель", "Model")}</span>
                  <InfoTooltip label={t("Справка по нейросети", "Neural model help")} side="right">
                    <div className="space-y-2">
                      <p>
                        <span className="font-semibold">{neuralHelp.title}: </span>
                        {neuralHelp.text}
                      </p>
                      <p>{neuralHelp.note}</p>
                      <div className="grid gap-1.5">
                        <div>
                          <span className="font-semibold">{t("Скорость обучения", "Learning rate")}:</span>{" "}
                          {t("скорость обновления весов; слишком высокая может сделать обучение нестабильным.", "weight update speed; too high can make training unstable.")}
                        </div>
                        <div>
                          <span className="font-semibold">Dropout:</span>{" "}
                          {t("случайно отключает часть нейронов и снижает риск переобучения.", "randomly disables part of neurons and reduces overfitting risk.")}
                        </div>
                        <div>
                          <span className="font-semibold">g:</span>{" "}
                          {t("темпы роста; используются вместе с доступным показателем ROE.", "growth rate used with the available ROE metric.")}
                        </div>
                        <div>
                          <span className="font-semibold">{t("Проверочная выборка, %", "Validation set, %")}:</span>{" "}
                          {t("доля данных для контроля качества во время обучения.", "share of data used to monitor quality during training.")}
                        </div>
                        <div>
                          <span className="font-semibold">{t("Автоподбор", "Auto-tune")}:</span>{" "}
                          {t("модель подбирает архитектуру и параметры обучения по выбранному критерию.", "the model tunes its architecture and training settings by the selected metric.")}
                        </div>
                      </div>
                    </div>
                  </InfoTooltip>
                </div>
                <button
                  type="button"
                  onClick={resetNeuralSettings}
                  className="ui-secondary-button px-2 py-1 text-xs"
                  title={t("Сбросить параметры", "Reset parameters")}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {t("Сброс", "Reset")}
                </button>
              </div>

              {optimizerSettings.autoModelTuning && (
                <div className="rounded-md border border-orange-200 bg-orange-50/70 p-3 text-xs leading-5 text-orange-900 dark:border-orange-900 dark:bg-orange-950/20 dark:text-orange-200">
                  {t(
                    "Автоподбор параметров модели включен: система сама выберет признаки, архитектуру и режим обучения нейросети.",
                    "Model auto-tuning is enabled: the system will choose features, architecture, and neural training mode automatically.",
                  )}
                </div>
              )}

              {!optimizerSettings.autoModelTuning && !neuralSettings.autoTune && (
                <>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  {t("Тип модели", "Model type")}
                </span>
                <Select
                  value={neuralSettings.modelType}
                  onValueChange={(value) => updateNeuralSettings({ modelType: value as NeuralModelType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mlp">MLP</SelectItem>
                    <SelectItem value="deep_mlp">{t("Глубокий MLP", "Deep MLP")}</SelectItem>
                    <SelectItem value="auto">{t("Автоподбор", "Auto selection")}</SelectItem>
                  </SelectContent>
                </Select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  {t("Скрытые слои", "Hidden layers")}
                </span>
                <Input
                  value={neuralSettings.hiddenLayers}
                  onChange={(event) => updateNeuralSettings({ hiddenLayers: event.target.value })}
                  placeholder="128,64,32"
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Activation
                  </span>
                  <Select
                    value={neuralSettings.activation}
                    onValueChange={(value) => updateNeuralSettings({ activation: value as NeuralActivation })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="relu">ReLU</SelectItem>
                      <SelectItem value="tanh">Tanh</SelectItem>
                      <SelectItem value="gelu">GELU</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Optimizer
                  </span>
                  <Select
                    value={neuralSettings.optimizer}
                    onValueChange={(value) => updateNeuralSettings({ optimizer: value as NeuralOptimizer })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="adam">Adam</SelectItem>
                      <SelectItem value="sgd">SGD</SelectItem>
                      <SelectItem value="rmsprop">RMSprop</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Epochs
                  </span>
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    value={neuralSettings.epochs}
                    onChange={(event) =>
                      updateNeuralSettings({ epochs: Math.max(1, Math.min(Number(event.target.value) || 1, 1000)) })
                    }
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    {t("Размер пакета", "Batch size")}
                  </span>
                  <Input
                    type="number"
                    min={1}
                    max={512}
                    value={neuralSettings.batchSize}
                    onChange={(event) =>
                      updateNeuralSettings({ batchSize: Math.max(1, Math.min(Number(event.target.value) || 1, 512)) })
                    }
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    {t("Скорость обучения", "Learning rate")}
                  </span>
                  <Input
                    type="number"
                    min={0.00001}
                    step={0.0001}
                    value={neuralSettings.learningRate}
                    onChange={(event) =>
                      updateNeuralSettings({ learningRate: Math.max(0.00001, Number(event.target.value) || 0.001) })
                    }
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Dropout
                  </span>
                  <Input
                    type="number"
                    min={0}
                    max={0.8}
                    step={0.05}
                    value={neuralSettings.dropout}
                    onChange={(event) =>
                      updateNeuralSettings({ dropout: Math.max(0, Math.min(Number(event.target.value) || 0, 0.8)) })
                    }
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    {t("Проверочная выборка, %", "Validation set, %")}
                  </span>
                  <Input
                    type="number"
                    min={10}
                    max={50}
                    value={neuralSettings.validationSplit}
                    onChange={(event) =>
                      updateNeuralSettings({ validationSplit: Math.max(10, Math.min(Number(event.target.value) || 20, 50)) })
                    }
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    {t("Начальное значение", "Random seed")}
                  </span>
                  <Input
                    type="number"
                    value={neuralSettings.randomState}
                    onChange={(event) =>
                      updateNeuralSettings({ randomState: Number(event.target.value) || DEFAULT_NEURAL_SETTINGS.randomState })
                    }
                  />
                </label>
              </div>

              <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200">
                <Checkbox
                  checked={neuralSettings.earlyStopping}
                  onCheckedChange={(checked) => updateNeuralSettings({ earlyStopping: checked === true })}
                />
                <span>Early stopping</span>
              </label>
                </>
              )}

              {!optimizerSettings.autoModelTuning && (
                <>
                  <label className="flex items-center gap-2 rounded-md border border-orange-200 bg-orange-50/70 px-3 py-2 text-sm text-orange-900 dark:border-orange-900 dark:bg-orange-950/20 dark:text-orange-200">
                    <Checkbox
                      checked={neuralSettings.autoTune}
                      onCheckedChange={(checked) => updateNeuralSettings({ autoTune: checked === true })}
                    />
                    <span>{t("Автоподбор", "Auto-tune")}</span>
                  </label>

                  {neuralSettings.autoTune && (
                    <div className="space-y-2">
                      <label className="block space-y-1.5">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          {t("Режим подбора", "Tuning mode")}
                        </span>
                        <Select
                          value={neuralSettings.tuningBudget}
                          onValueChange={(value) => updateNeuralSettings({ tuningBudget: value as TuningBudget })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fast">{t("Быстро", "Fast")}</SelectItem>
                            <SelectItem value="balanced">{t("Баланс", "Balanced")}</SelectItem>
                            <SelectItem value="quality">{t("Качество", "Quality")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </label>
                      <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200">
                        <Checkbox
                          checked={neuralSettings.searchFeatureCombinations}
                          onCheckedChange={(checked) => updateNeuralSettings({ searchFeatureCombinations: checked === true })}
                        />
                        <span>{t("Подбирать комбинации признаков", "Tune feature combinations")}</span>
                      </label>
                    </div>
                  )}
                </>
              )}

              {!optimizerSettings.autoModelTuning && (
                <>
                  <label className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200">
                    <Checkbox
                      checked={neuralSettings.dividendPriority}
                      onCheckedChange={(checked) => updateNeuralSettings({ dividendPriority: checked === true })}
                    />
                    <span>{t("Приоритет стабильных дивидендов", "Prioritize stable dividends")}</span>
                  </label>

                  <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200">
                    <Checkbox
                      checked={neuralSettings.reuseCachedModels}
                      onCheckedChange={(checked) => updateNeuralSettings({ reuseCachedModels: checked === true })}
                    />
                    <span>{t("Использовать готовые модели", "Reuse trained models")}</span>
                  </label>
                </>
              )}
            </div>

            {!optimizerSettings.autoModelTuning && (
            <div className="space-y-3">
              <div>
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {t("Параметры", "Features")}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {t("Минимум два параметра", "At least two parameters")}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {NEURAL_FEATURE_OPTIONS.map((option) => {
                  const checked = neuralSettings.features.includes(option.key);
                  const label = isEn ? option.labelEn : option.labelRu;
                  return (
                    <label
                      key={option.key}
                      className="flex min-h-10 items-center gap-2 rounded-md border border-slate-200 px-2 py-2 text-xs text-slate-700 dark:border-slate-700 dark:text-slate-200"
                    >
                      <Checkbox
                        checked={checked}
                        disabled={checked && neuralSettings.features.length <= 2}
                        onCheckedChange={() => toggleNeuralFeature(option.key)}
                      />
                      <span>{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            )}

            <OptimizerSettingsFields
              settings={optimizerSettings}
              onChange={setOptimizerSettings}
              autoFitWeights
            />

            {!hasData && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/20">
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  {t("Данных пока нет. Сначала загрузите фундаментальные показатели.", "No data yet. Load fundamentals first.")}
                </p>
              </div>
            )}

            <button
              onClick={runAnalysis}
              disabled={!canRunAnalysis}
              className="ui-primary-button w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700"
            >
              <Play className="h-5 w-5" />
              {isRunning ? (t("Выполняется...", "Running...")) : (t("Запустить анализ", "Run Analysis"))}
            </button>
          </div>
        </AnalysisSidebarCard>
      )}
    >
          <SectionCard
            title={t("Состав выборки", "Stock Universe")}
            description={t(
              "Можно обучить нейросеть по всем данным или оставить только нужные акции.",
              "Train the neural model on all loaded data or keep only the stocks you need.",
            )}
            action={(
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectionMode("all")}
                  className={`ui-secondary-button px-3 py-2 text-xs ${
                    selectionMode === "all" ? "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-700 dark:bg-orange-950/30 dark:text-orange-200" : ""
                  }`}
                >
                  <Square className="h-4 w-4" />
                  {t("Все данные", "All data")}
                </button>
                <button
                  type="button"
                  onClick={setManualSelectionMode}
                  className={`ui-secondary-button px-3 py-2 text-xs ${
                    selectionMode === "manual" ? "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-700 dark:bg-orange-950/30 dark:text-orange-200" : ""
                  }`}
                >
                  <ListFilter className="h-4 w-4" />
                  {t("Ручной отбор", "Manual")}
                </button>
              </div>
            )}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
                <div className="ui-stat-card">
                  <div className="text-slate-500 dark:text-slate-400">{t("Доступно", "Available")}</div>
                  <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">{requestData.length}</div>
                </div>
                <div className="ui-stat-card">
                  <div className="text-slate-500 dark:text-slate-400">{t("В анализе", "In analysis")}</div>
                  <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">{selectedRequestData.length}</div>
                </div>
                <div className="ui-stat-card">
                  <div className="text-slate-500 dark:text-slate-400">{t("Признаков", "Features")}</div>
                  <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">{neuralSettings.features.length}</div>
                </div>
              </div>

              <div className="ui-surface-muted">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {selectionMode === "all"
                        ? t("Используются все акции с фундаментальными данными", "All stocks with fundamentals are used")
                        : t("Используется ручной список акций", "Manual stock list is used")}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {t("Параметры:", "Parameters:")} {selectedFeatureLabels.join(", ")}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllStocks}
                      disabled={!requestData.length}
                      className="ui-secondary-button px-3 py-2 text-xs"
                    >
                      <CheckSquare className="h-4 w-4" />
                      {t("Выбрать все", "Select all")}
                    </button>
                    <button
                      type="button"
                      onClick={clearStockSelection}
                      disabled={!requestData.length}
                      className="ui-secondary-button px-3 py-2 text-xs"
                    >
                      <X className="h-4 w-4" />
                      {t("Очистить", "Clear")}
                    </button>
                  </div>
                </div>
              </div>

              {selectionMode === "manual" && (
                <div className="space-y-3">
                  <label className="relative block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={stockSearch}
                      onChange={(event) => setStockSearch(event.target.value)}
                      placeholder={t("Поиск по тикеру, названию или бирже", "Search by ticker, name, or exchange")}
                      className="pl-9"
                    />
                  </label>

                  <div className="max-h-[420px] overflow-y-auto rounded-md border border-slate-200 dark:border-slate-700">
                    {filteredStockRows.length ? (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredStockRows.map((row) => {
                          const checked = selectedFigisSet.has(row.figi);
                          return (
                            <label
                              key={row.figi}
                              className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => toggleStockSelection(row.figi)}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-semibold text-slate-900 dark:text-slate-100">{row.ticker}</span>
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                    {row.exchange || row.currency}
                                  </span>
                                </div>
                                <div className="truncate text-xs text-slate-500 dark:text-slate-400">{row.name}</div>
                              </div>
                              <div className="hidden text-right text-xs text-slate-500 dark:text-slate-400 sm:block">
                                <div>P/E {Number(row.pe_ratio).toFixed(2)}</div>
                                <div>ROE {Number(row.roe).toFixed(2)}%</div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                        {t("Ничего не найдено", "No stocks found")}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!hasValidNeuralInput && hasData && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300">
                  {t(
                    "Для запуска нужны минимум две выбранные акции, два признака, один скрытый слой и корректные параметры обучения.",
                    "To run, select at least two stocks, two features, one hidden layer, and valid training parameters.",
                  )}
                </div>
              )}
            </div>
          </SectionCard>

          {isRunning && (
            <>
              <AnalysisRunningIndicator
                title={t("Выполняем нейросетевой анализ", "Running neural network analysis")}
                subtitle={t("Обучаем сеть и рассчитываем стратегии портфеля", "Training network and calculating portfolio strategies")}
                accentClassName="text-orange-600"
              />
              <AnalysisLoadingPreview
                accentClassName="text-orange-600"
                metricCount={4}
                metricsTitle={t("Готовим метрики нейросети", "Preparing neural metrics")}
                metricsDescription={t("Считаем ошибку, качество валидации и портфельные показатели.", "Calculating error, validation quality, and portfolio metrics.")}
                chartsTitle={t("Строим нейросетевые визуализации", "Building neural visualizations")}
                chartsDescription={t("Появятся архитектура модели, значимость признаков, история обучения и сигналы по компаниям.", "Model architecture, feature significance, training history, and company signals will appear here.")}
                charts={[
                  {
                    title: t("Схема нейросети", "Neural network schema"),
                    subtitle: t("Готовим входы, скрытые слои и выход прогноза.", "Preparing inputs, hidden layers, and prediction output."),
                    variant: "network",
                  },
                  {
                    title: t("Значимость параметров", "Parameter significance"),
                    subtitle: t("Оцениваем вклад входных признаков.", "Estimating input feature contribution."),
                    variant: "bars",
                  },
                  {
                    title: t("История обучения", "Training history"),
                    subtitle: t("Ждем значения train/validation loss по эпохам.", "Waiting for train/validation loss by epoch."),
                    variant: "line",
                  },
                  {
                    title: t("Сигналы P/E vs прогноз", "P/E vs prediction signals"),
                    subtitle: t("Готовим точки компаний для итоговой карты.", "Preparing company points for the final map."),
                    variant: "scatter",
                  },
                ]}
                chartColumnsClassName="xl:grid-cols-2"
                tableTitle={t("Готовим сравнение и таблицу компаний", "Preparing comparison and company table")}
                tableDescription={t("Скоро появятся конфигурации моделей, прогнозы и веса портфеля.", "Model configurations, predictions, and portfolio weights will appear shortly.")}
                tableRows={8}
                tableColumns={8}
              />
            </>
          )}

          {!isRunning && (
            <>
          {!optimizerSettings.hideAnalysisDetails && (
            <>
          {!!overviewMetrics.length && (
            <MetricGrid>
              {overviewMetrics.map((m) => (
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


          {!!modelParameterRows.length && (
            <SectionCard title={t("\u041f\u0430\u0440\u0430\u043c\u0435\u0442\u0440\u044b \u043d\u0435\u0439\u0440\u043e\u0441\u0435\u0442\u0438", "Neural Network Parameters")}>
              <div className="ui-table-shell overflow-x-auto">
                <table className="ui-data-table">
                  <thead>
                    <tr>
                      <th>{t("\u041f\u0430\u0440\u0430\u043c\u0435\u0442\u0440", "Parameter")}</th>
                      <th>{t("\u0417\u043d\u0430\u0447\u0435\u043d\u0438\u0435", "Value")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modelParameterRows.map((row) => (
                      <tr key={row.key}>
                        <td className="font-medium text-slate-900 dark:text-slate-100">{row.label}</td>
                        <td>{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {!!featureImportance.length && (
            <SectionCard
              title={t("Значимость параметров нейросети", "Neural Feature Significance")}
              description={t(
                "Оценка построена по абсолютным весам первого слоя лучшей обученной модели.",
                "The estimate is based on absolute first-layer weights of the best trained model.",
              )}
            >
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.6fr)]">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={featureImportance} layout="vertical" margin={{ top: 5, right: 30, left: 90, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" stroke="#64748b" unit="%" />
                    <YAxis type="category" dataKey="feature" stroke="#64748b" width={90} />
                    <Tooltip formatter={(v: number) => formatPercentValue(Number(v))} />
                    <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                      {featureImportance.map((row, idx) => (
                        <Cell key={row.feature} fill={NEURAL_PALETTE[idx % NEURAL_PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="space-y-3">
                  {featureImportance.slice(0, 4).map((row, index) => (
                    <div key={row.feature} className="ui-stat-card">
                      <div className="text-xs text-slate-500 dark:text-slate-400">#{index + 1}</div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{row.feature}</div>
                      <div className="text-sm text-slate-600 dark:text-slate-300">{formatPercentValue(row.importance)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>
          )}

          {(!!modelParameterRows.length || !!modelStats.length) && (
            <SectionCard
              title={t("Мини-схема нейросети", "Neural Network Mini Schema")}
              description={t(
                "Упрощенная архитектура лучшей обученной конфигурации.",
                "Simplified architecture of the best trained configuration.",
              )}
              action={(
                <button
                  onClick={saveArchitectureChartPng}
                  className="ui-secondary-button px-3 py-2 text-xs"
                >
                  <ImageDown className="h-4 w-4" />
                  PNG
                </button>
              )}
            >
              <div className="space-y-4">
                <div ref={architectureChartRef} className="overflow-hidden rounded-md border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-950/40">
                  <svg
                    viewBox={"0 0 " + ARCHITECTURE_DIAGRAM_WIDTH + " " + ARCHITECTURE_DIAGRAM_HEIGHT}
                    className="h-auto w-full max-w-full"
                    role="img"
                    aria-label={t("Схема обученной нейросети", "Trained neural network schema")}
                  >
                    <defs>
                      <filter id="nn-node-shadow" x="-40%" y="-40%" width="180%" height="180%">
                        <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#0f172a" floodOpacity="0.16" />
                      </filter>
                    </defs>
                    <rect
                      width={ARCHITECTURE_DIAGRAM_WIDTH}
                      height={ARCHITECTURE_DIAGRAM_HEIGHT}
                      rx="22"
                      className="fill-white stroke-sky-100 dark:fill-slate-950 dark:stroke-slate-700"
                    />
                    <text x="28" y="38" className="fill-slate-950 dark:fill-slate-100" fontSize="20" fontWeight="800">
                      {t("Модель", "Model")}: {architectureSignature}
                    </text>
                    <text x="28" y="66" className="fill-slate-600 dark:fill-slate-300" fontSize="13" fontWeight="600">
                      {t("Входы", "Inputs")}: {architectureFeaturePreview || "-"}
                    </text>
                    <text x={ARCHITECTURE_DIAGRAM_WIDTH - 28} y="38" textAnchor="end" className="fill-slate-600 dark:fill-slate-300" fontSize="13" fontWeight="700">
                      {resolvedActivation} / {resolvedOptimizer}
                    </text>
                    {architectureLayers.slice(0, -1).map((layer, index) => {
                      const nextLayer = architectureLayers[index + 1];
                      const x1 = getArchitectureLayerX(index, architectureLayers.length);
                      const x2 = getArchitectureLayerX(index + 1, architectureLayers.length);
                      const leftCount = Math.min(layer.count, 7);
                      const rightCount = Math.min(nextLayer.count, 7);
                      return (
                        <g key={"connection-" + index}>
                          {Array.from({ length: leftCount }).map((_, leftIndex) =>
                            Array.from({ length: rightCount }).map((__, rightIndex) => (
                              <line
                                key={"connection-" + index + "-" + leftIndex + "-" + rightIndex}
                                x1={x1 + 14}
                                y1={getArchitectureNodeY(leftIndex, leftCount)}
                                x2={x2 - 14}
                                y2={getArchitectureNodeY(rightIndex, rightCount)}
                                stroke="currentColor"
                                className={index % 2 === 0 ? "text-sky-400 dark:text-cyan-300" : "text-violet-400 dark:text-fuchsia-300"}
                                strokeOpacity="0.18"
                                strokeWidth="1.2"
                              />
                            )),
                          )}
                        </g>
                      );
                    })}
                    {architectureLayers.map((layer, layerIndex) => {
                      const x = getArchitectureLayerX(layerIndex, architectureLayers.length);
                      const architectureBandWidth = getArchitectureBandWidth(architectureLayers.length);
                      const visibleNodeCount = Math.min(layer.count, 7);
                      return (
                        <g key={layer.key}>
                          <rect
                            x={x - architectureBandWidth / 2}
                            y="92"
                            width={architectureBandWidth}
                            height="246"
                            rx="18"
                            fill={layer.color}
                            className="dark:hidden"
                            fillOpacity="0.075"
                            stroke={layer.color}
                            strokeOpacity="0.28"
                          />
                          <rect
                            x={x - architectureBandWidth / 2}
                            y="92"
                            width={architectureBandWidth}
                            height="246"
                            rx="18"
                            fill={layer.darkColor}
                            className="hidden dark:block"
                            fillOpacity="0.11"
                            stroke={layer.darkColor}
                            strokeOpacity="0.34"
                          />
                          <text x={x} y="104" textAnchor="middle" className="fill-slate-700 dark:fill-slate-100" fontSize="15" fontWeight="800">
                            {layer.title}
                          </text>
                          <text x={x} y="358" textAnchor="middle" className="fill-slate-600 dark:fill-slate-300" fontSize="12" fontWeight="700">
                            {layer.count} {layer.subtitle}
                          </text>
                          {Array.from({ length: visibleNodeCount }).map((_, nodeIndex) => {
                            const nodeY = getArchitectureNodeY(nodeIndex, visibleNodeCount);
                            const inputLabel = layer.key === "input"
                              ? truncateSvgLabel(resolvedFeatureLabels[nodeIndex] ?? "x" + (nodeIndex + 1), 10)
                              : "";
                            return (
                              <g key={layer.key + "-node-" + nodeIndex}>
                                {layer.key === "input" && (
                                  <text
                                    x={x - 24}
                                    y={nodeY + 4}
                                    textAnchor="end"
                                    className="fill-slate-500 dark:fill-slate-300"
                                    fontSize="10"
                                    fontWeight="700"
                                  >
                                    {inputLabel}
                                  </text>
                                )}
                                <circle
                                  cx={x}
                                  cy={nodeY}
                                  r="12"
                                  fill={layer.color}
                                  className="dark:hidden"
                                  fillOpacity="0.96"
                                  stroke="#ffffff"
                                  strokeWidth="3"
                                  filter="url(#nn-node-shadow)"
                                />
                                <circle
                                  cx={x}
                                  cy={nodeY}
                                  r="12"
                                  fill={layer.darkColor}
                                  className="hidden dark:block"
                                  fillOpacity="0.98"
                                  stroke="#020617"
                                  strokeWidth="3"
                                  filter="url(#nn-node-shadow)"
                                />
                                {layer.key === "output" && (
                                  <text
                                    x={x + 24}
                                    y={nodeY + 4}
                                    textAnchor="start"
                                    className="fill-slate-500 dark:fill-slate-300"
                                    fontSize="10"
                                    fontWeight="800"
                                  >
                                    P/E
                                  </text>
                                )}
                              </g>
                            );
                          })}
                          {layer.count > visibleNodeCount && (
                            <text x={x} y="332" textAnchor="middle" className="fill-slate-500 dark:fill-slate-300" fontSize="18" fontWeight="800">
                              ...
                            </text>
                          )}
                        </g>
                      );
                    })}
                    <text x="28" y={ARCHITECTURE_DIAGRAM_HEIGHT - 24} className="fill-slate-500 dark:fill-slate-300" fontSize="12" fontWeight="600">
                      {t("Лучшая конфигурация", "Best configuration")}: {analysisSummary.bestModel}
                    </text>
                  </svg>
                </div>
                <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                    {[
                      {
                        label: t("Входов", "Inputs"),
                        value: neuralSettings.features.length,
                        hint: t(
                          "Количество выбранных фундаментальных признаков, которые подаются в сеть для каждой компании.",
                          "Number of selected fundamental features passed into the network for each company.",
                        ),
                      },
                      {
                        label: t("Скрытых слоев", "Hidden layers"),
                        value: resolvedHiddenLayerSizes.length,
                        hint: t(
                          "Промежуточные слои между входами и прогнозом. Автоподбор выбирает конфигурацию с меньшей ошибкой валидации.",
                          "Intermediate layers between inputs and prediction. Auto-tuning selects the configuration with lower validation error.",
                        ),
                      },
                      {
                        label: t("Нейронов", "Neurons"),
                        value: resolvedHiddenLayerSizes.reduce((sum, value) => sum + value, 0),
                        hint: t(
                          "Суммарное число нейронов во всех скрытых слоях лучшей конфигурации.",
                          "Total number of neurons across all hidden layers in the best configuration.",
                        ),
                      },
                      {
                        label: "Activation",
                        value: resolvedActivation,
                        hint: t(
                          "Функция активации задает нелинейность нейронов и помогает модели находить сложные зависимости между признаками.",
                          "Activation function adds non-linearity and helps the model capture complex relationships between features.",
                        ),
                      },
                      {
                        label: "Optimizer",
                        value: resolvedOptimizer,
                        hint: t(
                          "Алгоритм, который обновляет веса сети во время обучения и снижает ошибку прогноза.",
                          "Algorithm that updates network weights during training and reduces prediction error.",
                        ),
                      },
                      {
                        label: "Best val MSE",
                        value: formatOptionalNumber(bestModelStat?.bestValMse, 5),
                        hint: t(
                          "Минимальная среднеквадратичная ошибка на валидации: чем меньше, тем точнее модель на отложенных данных.",
                          "Minimum validation mean squared error: lower values mean better accuracy on held-out data.",
                        ),
                      },
                    ].map((item) => (
                      <div key={item.label} className="min-w-0">
                        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                          <span className="truncate">{item.label}</span>
                          <InfoTooltip label={item.label} side="top">{item.hint}</InfoTooltip>
                        </div>
                        <div className="mt-1 truncate text-2xl font-semibold text-slate-900 dark:text-slate-100">{item.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-700">
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                      <span>{t("Входные признаки", "Input features")}</span>
                      <InfoTooltip label={t("Входные признаки", "Input features")} side="top">
                        {t(
                          "Эти признаки нормализуются и становятся входным вектором сети; их веса используются для оценки значимости параметров.",
                          "These features are normalized into the network input vector; their weights are used to estimate feature significance.",
                        )}
                      </InfoTooltip>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {resolvedFeatureLabels.map((label) => (
                        <span key={label} className="rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-800 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>
          )}

          {!!modelStats.length && (
            <SectionCard
              title={t("\u0421\u0440\u0430\u0432\u043d\u0435\u043d\u0438\u0435 \u043c\u043e\u0434\u0435\u043b\u0435\u0439", "Model Comparison")}
              action={
                modelStats.length > MODEL_STATS_PAGE_SIZE ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setModelStatsPage((current) => Math.max(1, current - 1))}
                      disabled={activeModelStatsPage <= 1}
                      aria-label={t("\u041f\u0440\u0435\u0434\u044b\u0434\u0443\u0449\u0430\u044f \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0430", "Previous page")}
                      className="ui-secondary-button px-2 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="min-w-[6.5rem] text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {modelStatsRangeLabel}
                    </span>
                    <button
                      type="button"
                      onClick={() => setModelStatsPage((current) => Math.min(modelStatsPageCount, current + 1))}
                      disabled={activeModelStatsPage >= modelStatsPageCount}
                      aria-label={t("\u0421\u043b\u0435\u0434\u0443\u044e\u0449\u0430\u044f \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0430", "Next page")}
                      className="ui-secondary-button px-2 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                ) : undefined
              }
            >
              <div className="ui-table-shell overflow-x-auto">
                <table className="ui-data-table min-w-[68rem]">
                  <thead>
                    <tr>
                      <th>{t("\u041c\u043e\u0434\u0435\u043b\u044c", "Model")}</th>
                      <th>{t("Признаки", "Features")}</th>
                      <th>{t("\u0421\u043b\u043e\u0438", "Layers")}</th>
                      <th>{t("\u041b\u0443\u0447\u0448\u0430\u044f \u044d\u043f\u043e\u0445\u0430", "Best epoch")}</th>
                      <th>
                        <span className="inline-flex items-center gap-1">
                          Best val MSE
                          <InfoTooltip label="Best val MSE" side="top">
                            {t("Лучшая ошибка на валидационной выборке. Основной ориентир при выборе конфигурации: меньше лучше.", "Best validation error. Main signal for choosing a configuration: lower is better.")}
                          </InfoTooltip>
                        </span>
                      </th>
                      <th>{t("Итоговая оценка", "Selection score")}</th>
                      <th>{t("Переобучение", "Overfit")}</th>
                      <th>
                        <span className="inline-flex items-center gap-1">
                          Val R2
                          <InfoTooltip label="Val R2" side="top">
                            {t("Доля объясненной вариации на валидации. Ближе к 1 лучше, отрицательные значения говорят о слабом прогнозе.", "Share of variance explained on validation. Closer to 1 is better; negative values indicate weak prediction.")}
                          </InfoTooltip>
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedModelStats.map((row) => (
                      <tr key={row.modelName}>
                        <td className="font-medium text-slate-900 dark:text-slate-100">{row.modelName}</td>
                        <td className="max-w-64 whitespace-normal">{row.features.join(", ") || "-"}</td>
                        <td>{row.hiddenLayers}</td>
                        <td>{Number.isFinite(row.bestEpoch) ? row.bestEpoch : "-"}</td>
                        <td>{Number.isFinite(row.bestValMse) ? row.bestValMse.toFixed(5) : "-"}</td>
                        <td>{Number.isFinite(row.selectionScore) ? row.selectionScore.toFixed(5) : "-"}</td>
                        <td className={row.isOverfit ? "text-rose-600 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300"}>
                          {Number.isFinite(row.overfitRatio) ? row.overfitRatio.toFixed(2) + "x" : "-"}
                        </td>
                        <td>{Number.isFinite(row.valR2Final) ? row.valR2Final.toFixed(4) : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {!!trainingHistory.length && (
            <SectionCard title={t("История обучения", "Training History")}>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={trainingHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="epoch"
                    stroke="#64748b"
                    label={{ value: t("Эпоха", "Epoch"), position: "insideBottom", offset: -6 }}
                  />
                  <YAxis
                    stroke="#64748b"
                    label={{ value: t("MSE / loss", "MSE / loss"), angle: -90, position: "insideLeft" }}
                  />
                  <Tooltip formatter={(v: number) => Number(v).toFixed(4)} />
                  <Legend />
                  <Line type="monotone" dataKey="trainLoss" name={t("Train Loss", "Train Loss")} stroke="#f97316" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="valLoss" name={t("Val Loss", "Val Loss")} stroke="#ef4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </SectionCard>
          )}

          {!!analysisRows.length && (
            <SectionCard
              title={t("Сводка по результату", "Result Summary")}
              action={(
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={exportAnalysisToXlsx}
                    disabled={!analysisRows.length}
                    className="ui-secondary-button px-3 py-2 text-xs"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    XLSX
                  </button>
                  <button
                    onClick={exportAnalysisToPdf}
                    disabled={!analysisRows.length}
                    className="ui-secondary-button px-3 py-2 text-xs"
                  >
                    <FileText className="h-4 w-4" />
                    PDF
                  </button>
                </div>
              )}
            >
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
                  <div className="ui-stat-card">
                    <div className="text-slate-500 dark:text-slate-400">{t("Акций в анализе", "Stocks in analysis")}</div>
                    <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">{analysisSummary.sampleSize}</div>
                  </div>
                  <div className="ui-stat-card">
                    <div className="text-slate-500 dark:text-slate-400">{t("Недооцененных", "Undervalued")}</div>
                    <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">{analysisSummary.resultCount}</div>
                  </div>
                  <div className="ui-stat-card">
                    <div className="text-slate-500 dark:text-slate-400">{t("Средний разрыв P/E", "Average P/E gap")}</div>
                    <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">{formatPercentValue(analysisSummary.averageGap)}</div>
                  </div>
                  <div className="ui-stat-card">
                    <div className="text-slate-500 dark:text-slate-400">{t("Лучший сигнал", "Top signal")}</div>
                    <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">{analysisSummary.topTicker}</div>
                  </div>
                </div>

                {!!topSignalRows.length && (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topSignalRows} margin={{ top: 10, right: 20, left: 18, bottom: 36 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="ticker"
                          stroke="#64748b"
                          label={{ value: t("Акция", "Stock"), position: "insideBottom", offset: -12 }}
                        />
                        <YAxis
                          stroke="#64748b"
                          unit="%"
                          label={{ value: t("Сигнал, %", "Signal, %"), angle: -90, position: "insideLeft" }}
                        />
                        <Tooltip formatter={(value: number) => formatPercentValue(value)} />
                        <Bar dataKey="portfolioSignal" name={t("Сигнал", "Signal")} radius={[6, 6, 0, 0]}>
                          {topSignalRows.map((row, idx) => (
                            <Cell key={row.ticker} fill={NEURAL_PALETTE[idx % NEURAL_PALETTE.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {!!predictionChartRows.length && (
            <SectionCard
              title={t("P/E факт vs прогноз", "Actual P/E vs Predicted P/E")}
              description={t(
                "Сравнение фактического мультипликатора с оценкой нейросети для найденных кандидатов.",
                "Compares the actual valuation multiple with the neural estimate for detected candidates.",
              )}
              action={(
                <button
                  onClick={savePredictionChartPng}
                  disabled={!predictionChartRows.length}
                  className="ui-secondary-button px-3 py-2 text-xs"
                >
                  <ImageDown className="h-4 w-4" />
                  PNG
                </button>
              )}
            >
              <div ref={predictionChartRef} className="h-[420px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 36, left: 28, bottom: 42 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      type="number"
                      dataKey="pe"
                      name="P/E fact"
                      stroke="#64748b"
                      label={{ value: t("P/E факт", "Actual P/E"), position: "insideBottom", offset: -14 }}
                    />
                    <YAxis
                      type="number"
                      dataKey="predictedPE"
                      name="P/E forecast"
                      stroke="#64748b"
                      label={{ value: t("P/E прогноз", "Predicted P/E"), angle: -90, position: "insideLeft" }}
                    />
                    <ZAxis dataKey="portfolioSignal" range={[70, 230]} />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      content={({ payload }) => {
                        if (!payload || !payload.length) {
                          return null;
                        }
                        const row = payload[0].payload as AnalysisResultRow;
                        return (
                          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                            <p className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">{row.ticker}</p>
                            <p className="text-sm text-slate-600 dark:text-slate-300">P/E факт: {formatOptionalNumber(row.pe, 2)}</p>
                            <p className="text-sm text-slate-600 dark:text-slate-300">P/E прогноз: {formatOptionalNumber(row.predictedPE, 2)}</p>
                            <p className="text-sm text-slate-600 dark:text-slate-300">Gap: {formatPercentValue(row.undervaluationGap)}</p>
                            <p className="text-sm text-slate-600 dark:text-slate-300">Signal: {formatPercentValue(row.portfolioSignal)}</p>
                          </div>
                        );
                      }}
                    />
                    <Scatter
                      name={t("Акции", "Stocks")}
                      data={predictionChartRows}
                      fill="#f97316"
                      stroke="#ea580c"
                      fillOpacity={0.82}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          )}

          {!!analysisRows.length && (
            <SectionCard
              title={t("Результаты нейросетевого анализа", "Neural Network Analysis Results")}
              description={t(
                "Таблица кандидатов, отсортированная по итоговому сигналу модели.",
                "Candidate table sorted by the final model signal.",
              )}
              action={
                analysisRows.length > ANALYSIS_ROWS_PAGE_SIZE ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAnalysisRowsPage((current) => Math.max(1, current - 1))}
                      disabled={activeAnalysisRowsPage <= 1}
                      aria-label={t("Предыдущая страница", "Previous page")}
                      className="ui-secondary-button px-2 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="min-w-[6.5rem] text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {analysisRowsRangeLabel}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAnalysisRowsPage((current) => Math.min(analysisRowsPageCount, current + 1))}
                      disabled={activeAnalysisRowsPage >= analysisRowsPageCount}
                      aria-label={t("Следующая страница", "Next page")}
                      className="ui-secondary-button px-2 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                ) : undefined
              }
            >
              <div className="ui-table-shell overflow-x-auto">
                <table className="ui-data-table min-w-[72rem]">
                  <thead>
                    <tr>
                      <th>Ticker</th>
                      <th>{t("Компания", "Company")}</th>
                      <th>P/E</th>
                      <th>{t("Прогноз P/E", "Predicted P/E")}</th>
                      <th>Gap</th>
                      <th>{t("Ожид. доходность", "Expected return")}</th>
                      <th>{t("Сигнал", "Signal")}</th>
                      <th>{t("Дивиденды", "Dividend yield")}</th>
                      <th>{t("Лет выплат", "Years paid")}</th>
                      <th>{t("Подряд", "Consecutive")}</th>
                      <th>{t("Див. оценка", "Dividend score")}</th>
                      <th>Beta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedAnalysisRows.map((row) => (
                      <tr key={(row.figi || row.ticker) + "-analysis"}>
                        <td className="font-medium text-slate-900 dark:text-slate-100">{row.ticker}</td>
                        <td className="ui-cell-name">{row.name}</td>
                        <td className="ui-cell-number">{formatOptionalNumber(row.pe, 2)}</td>
                        <td className="ui-cell-number">{formatOptionalNumber(row.predictedPE, 2)}</td>
                        <td className="ui-cell-number">{formatPercentValue(row.undervaluationGap)}</td>
                        <td className="ui-cell-number">{formatPercentValue(row.expectedReturn)}</td>
                        <td className="ui-cell-number font-semibold text-orange-700 dark:text-orange-300">{formatPercentValue(row.portfolioSignal)}</td>
                        <td className="ui-cell-number">{formatPercentValue(row.dividendYield)}</td>
                        <td className="ui-cell-number">{row.dividendYearsCount}</td>
                        <td className="ui-cell-number">{row.consecutiveDividendYears}</td>
                        <td className="ui-cell-number">{formatPercentValue(row.dividendScore)}</td>
                        <td className="ui-cell-number">{formatOptionalNumber(row.beta, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
            </>
          )}

          {(!!portfolioPositions.length || portfolioAssetsCount > 0) && (
            <SectionCard
              title={t("Оптимальный портфель из нейросетевого анализа", "Optimal Portfolio from Neural Analysis")}
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
                    disabled={!portfolioPositions.length}
                    className="ui-secondary-button px-3 py-2 text-xs"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    XLSX
                  </button>
                  <button
                    onClick={exportPortfolioToPdf}
                    disabled={!portfolioPositions.length}
                    className="ui-secondary-button px-3 py-2 text-xs"
                  >
                    <FileText className="h-4 w-4" />
                    PDF
                  </button>
                  <button
                    onClick={savePortfolioChartPng}
                    disabled={!portfolioPositions.length}
                    className="ui-secondary-button px-3 py-2 text-xs"
                  >
                    <ImageDown className="h-4 w-4" />
                    PNG
                  </button>
                  <SavePortfolioButton
                    holdings={portfolioPositions}
                    metrics={portfolioMetrics.map((metric) => ({
                      label: localizeMetricLabel(metric.label, isEn),
                      value: formatMetricDisplay(metric.label, metric.value),
                      rawValue: metric.value,
                    }))}
                    sourceKey="neural-network"
                    sourceLabel={t("Нейросетевой анализ", "Neural Network Analysis")}
                    assetClass="stock"
                    defaultName={t("Портфель нейросетевого анализа", "Neural Network Portfolio")}
                    shares={cache.shares}
                    fundamentalsByFigi={cache.fundamentalsByFigi}
                    disabled={!portfolioPositions.length}
                  />
                </div>
              )}
            >
              {!!portfolioMetrics.length && (
                <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {portfolioMetrics.map((metric) => (
                    <div key={metric.label} className="ui-stat-card">
                      <div className="text-xs text-slate-500 dark:text-slate-400">{localizeMetricLabel(metric.label, isEn)}</div>
                      <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">{formatMetricDisplay(metric.label, metric.value)}</div>
                    </div>
                  ))}
                </div>
              )}
              {!!portfolioPositions.length && (
                <PortfolioHoldingsPanel
                  rows={portfolioPositions}
                  palette={NEURAL_PALETTE}
                  chartRef={portfolioChartRef}
                  companyLabel={t("Акция", "Stock")}
                  weightLabel={t("Вес, %", "Weight, %")}
                />
              )}
            </SectionCard>
          )}

          {!!portfolioPositions.length && (
            <PortfolioSimulationPanel
              holdings={portfolioPositions}
              shares={cache.shares}
              fundamentalsByFigi={cache.fundamentalsByFigi}
              analysisName={t("Нейросетевой анализ", "Neural Network Analysis")}
              filenamePrefix="neural-portfolio"
            />
          )}
            </>
          )}



      </AnalysisPageFrame>

      <AppErrorDialog
        message={errorDialogMessage}
        onClose={() => setErrorDialogMessage(null)}
        title={t("Ошибка анализа", "Analysis Error")}
        description={
          t("Не удалось обработать запрос. Проверьте данные и попробуйте ещё раз.", "The request could not be completed. Check the input data and try again.")
        }
        closeLabel={t("Закрыть", "Close")}
      />
    </>
  );
}
