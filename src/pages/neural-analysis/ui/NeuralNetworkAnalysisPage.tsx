import { useEffect, useMemo, useRef, useState } from "react";
import {
  Brain,
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
import { OptimizerSettingsFields, submitOptimizerSettings, useOptimizerSettings } from "../../../features/optimizer-settings";
import { PortfolioSimulationPanel } from "../../../features/portfolio-simulation";
import { API_BASE_URL } from "../../../config";
import type {
  NeuralFeatureImportanceItem as FeatureImportanceItem,
  NeuralMetricItem as MetricItem,
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
  NeuralTuningMetric,
  SelectionMode,
  TuningBudget,
} from "../model";
import {
  extractFeatureImportance,
  extractMetrics,
  extractModelStats,
  extractPortfolioAssetsCount,
  extractPortfolioPositions,
  extractPortfolioStrategies,
  extractTrainingHistory,
} from "../lib";

export function NeuralNetworkAnalysis() {
  const { cache, hasData } = useFundamentals();
  const { locale, t } = useAppSettings();
  const isEn = locale === "en";
  const { settings: optimizerSettings, setSettings: setOptimizerSettings } = useOptimizerSettings();
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDialogMessage, setErrorDialogMessage] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<MetricItem[]>([]);
  const [featureImportance, setFeatureImportance] = useState<FeatureImportanceItem[]>([]);
  const [portfolioStrategies, setPortfolioStrategies] = useState<PortfolioStrategy[]>([]);
  const [portfolioPositions, setPortfolioPositions] = useState<PortfolioPosition[]>([]);
  const [trainingHistory, setTrainingHistory] = useState<TrainingPoint[]>([]);
  const [modelStats, setModelStats] = useState<ModelStatItem[]>([]);
  const [modelParameters, setModelParameters] = useState<Record<string, unknown>>({});
  const [portfolioAssetsCount, setPortfolioAssetsCount] = useState(0);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("all");
  const [selectedFigis, setSelectedFigis] = useState<string[]>([]);
  const [stockSearch, setStockSearch] = useState("");
  const [neuralSettings, setNeuralSettings] = useState<NeuralAnalysisSettings>(DEFAULT_NEURAL_SETTINGS);
  const portfolioChartRef = useRef<HTMLDivElement | null>(null);
  const visibleMetrics = useMemo(() => metrics.filter((item) => isVisibleAnalysisMetric(item.label)), [metrics]);
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


  const modelParameterRows = useMemo(
    () =>
      buildParameterRows(
        modelParameters,
        {
          model_type: t("\u0422\u0438\u043f \u043c\u043e\u0434\u0435\u043b\u0438", "Model type"),
          best_model: t("\u041b\u0443\u0447\u0448\u0430\u044f \u043c\u043e\u0434\u0435\u043b\u044c", "Best model"),
          epochs: t("\u042d\u043f\u043e\u0445", "Epochs"),
          validation_split: t("\u0412\u0430\u043b\u0438\u0434\u0430\u0446\u0438\u043e\u043d\u043d\u0430\u044f \u0434\u043e\u043b\u044f", "Validation split"),
          random_state: t("Random state", "Random state"),
          selection_metric: t("\u041c\u0435\u0442\u0440\u0438\u043a\u0430 \u043f\u043e\u0434\u0431\u043e\u0440\u0430", "Selection metric"),
          auto_tune: t("\u0410\u0432\u0442\u043e\u043f\u043e\u0434\u0431\u043e\u0440", "Auto tune"),
          features: t("\u041f\u0440\u0438\u0437\u043d\u0430\u043a\u0438", "Features"),
          variants_count: t("\u041a\u043e\u043d\u0444\u0438\u0433\u0443\u0440\u0430\u0446\u0438\u0439", "Variants"),
        },
        ["model_type", "best_model", "epochs", "validation_split", "random_state", "selection_metric", "auto_tune", "features", "variants_count"],
      ),
    [modelParameters, t],
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

  const neuralHelp = useMemo(() => {
    if (neuralSettings.modelType === "deep_mlp") {
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
    if (neuralSettings.modelType === "auto") {
      return {
        title: t("Автоподбор", "Auto selection"),
        text: t(
          "Сервер может выбрать подходящую нейросетевую конфигурацию из доступных вариантов.",
          "The server may choose a suitable neural configuration from available options.",
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
  }, [neuralSettings.modelType, t]);

  const hasValidNeuralInput =
    hasData &&
    selectedRequestData.length >= 2 &&
    neuralSettings.features.length >= 2 &&
    hiddenLayerSizes.length >= 1 &&
    neuralSettings.epochs >= 1 &&
    neuralSettings.batchSize >= 1 &&
    neuralSettings.learningRate > 0;
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
          "Выберите минимум две акции, два признака и корректные параметры нейросети.",
          "Select at least two stocks, two features, and valid neural network parameters.",
        ),
      );
      return;
    }

    setIsRunning(true);

    try {
      await submitOptimizerSettings(optimizerSettings);
      const selectedTickers = selectedRequestData.map((row) => row.ticker);
      const selectedFigisForRequest = selectedRequestData.map((row) => row.figi);
      const response = await fetch(`${API_BASE_URL}/ai-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: selectedRequestData,
          parameters: {
            model_type: neuralSettings.modelType,
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
            auto_tune: neuralSettings.autoTune,
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
      const parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}${text ? `: ${text}` : ""}`);
      }

      const parsedMetrics = extractMetrics(parsed);
      const parsedImportance = extractFeatureImportance(parsed);
      const parsedStrategies = extractPortfolioStrategies(parsed);
      const parsedPositions = extractPortfolioPositions(parsed);
      const parsedHistory = extractTrainingHistory(parsed);
      const parsedModelStats = extractModelStats(parsed);
      const parsedModelParameters = extractModelParameters(parsed);
      const parsedAssetsCount = extractPortfolioAssetsCount(parsed);

      setMetrics(parsedMetrics);
      setFeatureImportance(parsedImportance);
      setPortfolioStrategies(parsedStrategies);
      setPortfolioPositions(parsedPositions);
      setTrainingHistory(parsedHistory);
      setModelStats(parsedModelStats);
      setModelParameters(parsedModelParameters);
      setPortfolioAssetsCount(parsedAssetsCount);
    } catch (e) {
      const message = e instanceof Error
        ? e.message
        : t("Не удалось выполнить нейросетевой анализ", "Failed to run neural network analysis");
      showErrorDialog(message);
      setMetrics([]);
      setFeatureImportance([]);
      setPortfolioStrategies([]);
      setPortfolioPositions([]);
      setTrainingHistory([]);
      setModelStats([]);
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

  return (
    <>
      <AnalysisPageFrame
      hero={(
        <PageHero
          icon={Brain}
          title={t("Анализ нейросети", "Neural Network Analysis")}
          description={t(
            "Выберите акции, признаки и гиперпараметры нейросети перед запуском серверного обучения.",
            "Select stocks, features, and neural hyperparameters before server-side training.",
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
              <p className="text-sm text-slate-700 dark:text-slate-300">{t("Источник: кэш фундаментальных данных", "Source: fundamentals cache")}</p>
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
                          <span className="font-semibold">Learning rate:</span>{" "}
                          {t("скорость обновления весов; слишком высокая может сделать обучение нестабильным.", "weight update speed; too high can make training unstable.")}
                        </div>
                        <div>
                          <span className="font-semibold">Dropout:</span>{" "}
                          {t("случайно отключает часть нейронов и снижает риск переобучения.", "randomly disables part of neurons and reduces overfitting risk.")}
                        </div>
                        <div>
                          <span className="font-semibold">g:</span>{" "}
                          {t("темпы роста; в текущем кэше передаются через доступный ROE-показатель.", "growth rate; in the current cache it is sent through the available ROE metric.")}
                        </div>
                        <div>
                          <span className="font-semibold">Validation, %:</span>{" "}
                          {t("доля данных для контроля качества во время обучения.", "share of data used to monitor quality during training.")}
                        </div>
                        <div>
                          <span className="font-semibold">{t("Автоподбор", "Auto-tune")}:</span>{" "}
                          {t("сервер подбирает архитектуру и параметры обучения по выбранному критерию.", "the server tunes architecture and training parameters by the selected metric.")}
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

              {!neuralSettings.autoTune && (
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
                  placeholder="64,32"
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
                    Batch
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
                    Learning rate
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
                    Validation, %
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
                    Random state
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

              <label className="flex items-center gap-2 rounded-md border border-orange-200 bg-orange-50/70 px-3 py-2 text-sm text-orange-900 dark:border-orange-900 dark:bg-orange-950/20 dark:text-orange-200">
                <Checkbox
                  checked={neuralSettings.autoTune}
                  onCheckedChange={(checked) => updateNeuralSettings({ autoTune: checked === true })}
                />
                <span>{t("Автоподбор", "Auto-tune")}</span>
              </label>

              {neuralSettings.autoTune && (
                <div className="grid grid-cols-2 gap-2">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      {t("Критерий", "Metric")}
                    </span>
                    <Select
                      value={neuralSettings.tuningMetric}
                      onValueChange={(value) => updateNeuralSettings({ tuningMetric: value as NeuralTuningMetric })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="val_loss">Val loss</SelectItem>
                        <SelectItem value="sharpe_ratio">Sharpe</SelectItem>
                        <SelectItem value="expected_return">Expected return</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
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
                </div>
              )}
            </div>

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

            <OptimizerSettingsFields
              settings={optimizerSettings}
              onChange={setOptimizerSettings}
            />

            {!hasData && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/20">
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  {t("Кэш пуст. Сначала загрузите фундаментальные данные.", "Cache is empty. Load fundamentals first.")}
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
              "Можно обучить нейросеть по всему кэшу или вручную оставить только нужные акции.",
              "Train the neural model on the full cache or keep only the stocks you need.",
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
                  {t("Весь кэш", "All cache")}
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
            <AnalysisRunningIndicator
              title={t("Выполняем нейросетевой анализ", "Running neural network analysis")}
              subtitle={t("Обучаем сеть и рассчитываем стратегии портфеля", "Training network and calculating portfolio strategies")}
              accentClassName="text-orange-600"
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

          {!!modelStats.length && (
            <SectionCard title={t("\u0421\u0440\u0430\u0432\u043d\u0435\u043d\u0438\u0435 \u043c\u043e\u0434\u0435\u043b\u0435\u0439", "Model Comparison")}>
              <div className="ui-table-shell overflow-x-auto">
                <table className="ui-data-table">
                  <thead>
                    <tr>
                      <th>{t("\u041c\u043e\u0434\u0435\u043b\u044c", "Model")}</th>
                      <th>{t("\u0421\u043b\u043e\u0438", "Layers")}</th>
                      <th>Activation</th>
                      <th>Solver</th>
                      <th>{t("\u041b\u0443\u0447\u0448\u0430\u044f \u044d\u043f\u043e\u0445\u0430", "Best epoch")}</th>
                      <th>Best val MSE</th>
                      <th>Final val MSE</th>
                      <th>Val R2</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modelStats.map((row) => (
                      <tr key={row.modelName}>
                        <td className="font-medium text-slate-900 dark:text-slate-100">{row.modelName}</td>
                        <td>{row.hiddenLayers}</td>
                        <td>{row.activation}</td>
                        <td>{row.solver}</td>
                        <td>{Number.isFinite(row.bestEpoch) ? row.bestEpoch : "-"}</td>
                        <td>{Number.isFinite(row.bestValMse) ? row.bestValMse.toFixed(5) : "-"}</td>
                        <td>{Number.isFinite(row.finalValMse) ? row.finalValMse.toFixed(5) : "-"}</td>
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
                  <XAxis dataKey="epoch" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip formatter={(v: number) => Number(v).toFixed(4)} />
                  <Legend />
                  <Line type="monotone" dataKey="trainLoss" name={t("Train Loss", "Train Loss")} stroke="#f97316" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="valLoss" name={t("Val Loss", "Val Loss")} stroke="#ef4444" strokeWidth={2} dot={false} />
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

          {(!!portfolioPositions.length || portfolioAssetsCount > 0) && (
            <SectionCard
              title={t("Оптимальный портфель из нейросетевого анализа", "Optimal Portfolio from Neural Analysis")}
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
                </div>
              )}
            >
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

          {!!featureImportance.length && (
            <SectionCard title={t("Важность признаков", "Feature Importance")}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={featureImportance} layout="vertical" margin={{ top: 5, right: 30, left: 90, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" stroke="#64748b" unit="%" />
                  <YAxis type="category" dataKey="feature" stroke="#64748b" width={90} />
                  <Tooltip formatter={(v: number) => `${Number(v).toFixed(2)}%`} />
                  <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                    {featureImportance.map((row, idx) => (
                      <Cell key={row.feature} fill={NEURAL_PALETTE[idx % NEURAL_PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
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
