import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckSquare,
  FileSpreadsheet,
  FileText,
  GitBranch,
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
import { OptimizerSettingsFields, submitOptimizerSettings, useOptimizerSettings } from "../../../features/optimizer-settings";
import { PortfolioSimulationPanel } from "../../../features/portfolio-simulation";
import { API_BASE_URL } from "../../../config";
import type {
  DecisionTreeConfusionMatrixData as ConfusionMatrixData,
  DecisionTreeFeatureImportanceItem as FeatureImportanceItem,
  DecisionTreeMetricItem as MetricItem,
  DecisionTreeAnalysisResultRow as AnalysisResultRow,
  DecisionTreeNumericSummaryItem as NumericSummaryItem,
  DecisionTreePortfolioPosition as PortfolioPosition,
  DecisionTreePreviewNode as TreePreviewNode,
  DecisionTreeRuleItem as RuleItem,
  DecisionTreeSectorAllocationItem as SectorAllocationItem,
} from "../../../features/decision-tree-analysis";
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
  DEFAULT_TREE_SETTINGS,
  TREE_FEATURE_OPTIONS,
  TREE_PALETTE,
  TREE_STATE_KEY,
} from "../model";
import type {
  DecisionTreeSettings,
  SelectionMode,
  TreeAlgorithm,
  TreeCriterion,
  TreeTuningMetric,
  TuningBudget,
} from "../model";
import {
  extractAnalysisRows,
  extractConfusionMatrix,
  extractDecisionRules,
  extractFeatureImportance,
  extractMetrics,
  extractNumericSummary,
  extractPortfolioAssetsCount,
  extractPortfolioMetrics,
  extractPortfolioPositions,
  extractSectorAllocation,
  extractTreePreview,
  formatOptionalNumber,
  formatPercentValue,
} from "../lib";

type TreeDiagramNode = {
  key: string;
  parentKey?: string;
  branch?: string;
  node: TreePreviewNode;
  x: number;
  y: number;
};

function buildTreeDiagramNodes(root: TreePreviewNode): TreeDiagramNode[] {
  const rows: TreeDiagramNode[] = [];

  function walk(node: TreePreviewNode, path: string, depth: number, index: number, parentKey?: string, branch?: string) {
    const slots = 2 ** depth;
    rows.push({
      key: path,
      parentKey,
      branch,
      node,
      x: ((index + 0.5) / slots) * 1000,
      y: 56 + depth * 122,
    });
    if (node.left) walk(node.left, path + "L", depth + 1, index * 2, path, "<=");
    if (node.right) walk(node.right, path + "R", depth + 1, index * 2 + 1, path, ">");
  }

  walk(root, "root", 0, 0);
  return rows;
}

function formatTreeConfidence(value: number | string): string {
  if (typeof value === "string") {
    return value || "-";
  }
  return Number.isFinite(value) ? (value * 100).toFixed(1) + "%" : "-";
}

const PORTFOLIO_METRIC_LABELS = new Set([
  "expected return",
  "expected_return",
  "risk",
  "volatility",
  "sharpe",
  "sharpe ratio",
  "sharpe_ratio",
  "diversification",
  "sortino",
  "value at risk",
]);

function isPortfolioMetric(label: string): boolean {
  return PORTFOLIO_METRIC_LABELS.has(label.toLowerCase());
}

function averageFinite(values: number[]): number {
  const finite = values.filter((value) => Number.isFinite(value));
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : NaN;
}

function isBuyPrediction(value: string): boolean {
  const normalized = value.toLowerCase();
  return normalized.includes("покуп") || normalized.includes("buy") || normalized.includes("недооцен") || normalized === "0" || normalized === "1";
}

export function DecisionTreeAnalysis() {
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
  const [confusionMatrix, setConfusionMatrix] = useState<ConfusionMatrixData | null>(null);
  const [portfolioPositions, setPortfolioPositions] = useState<PortfolioPosition[]>([]);
  const [sectorAllocation, setSectorAllocation] = useState<SectorAllocationItem[]>([]);
  const [numericSummary, setNumericSummary] = useState<NumericSummaryItem[]>([]);
  const [decisionRules, setDecisionRules] = useState<RuleItem[]>([]);
  const [treePreview, setTreePreview] = useState<TreePreviewNode | null>(null);
  const [modelParameters, setModelParameters] = useState<Record<string, unknown>>({});
  const [portfolioAssetsCount, setPortfolioAssetsCount] = useState(0);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("all");
  const [selectedFigis, setSelectedFigis] = useState<string[]>([]);
  const [stockSearch, setStockSearch] = useState("");
  const [treeSettings, setTreeSettings] = useState<DecisionTreeSettings>(DEFAULT_TREE_SETTINGS);
  const portfolioChartRef = useRef<HTMLDivElement | null>(null);
  const decisionChartRef = useRef<HTMLDivElement | null>(null);
  const treeChartRef = useRef<HTMLDivElement | null>(null);
  const visibleMetrics = useMemo(() => metrics.filter((item) => isVisibleAnalysisMetric(item.label)), [metrics]);
  const portfolioMetrics = useMemo(() => visibleMetrics.filter((item) => isPortfolioMetric(item.label)), [visibleMetrics]);
  const overviewMetrics = useMemo(() => visibleMetrics.filter((item) => !isPortfolioMetric(item.label)), [visibleMetrics]);
  const showErrorDialog = (message: string) => {
    setError(message);
    setErrorDialogMessage(message);
  };
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(TREE_STATE_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as {
        error?: string | null;
        metrics?: MetricItem[];
        analysisRows?: AnalysisResultRow[];
        featureImportance?: FeatureImportanceItem[];
        confusionMatrix?: ConfusionMatrixData | null;
        portfolioPositions?: PortfolioPosition[];
        sectorAllocation?: SectorAllocationItem[];
        numericSummary?: NumericSummaryItem[];
        decisionRules?: RuleItem[];
        treePreview?: TreePreviewNode | null;
        modelParameters?: Record<string, unknown>;
        portfolioAssetsCount?: number;
        selectionMode?: SelectionMode;
        selectedFigis?: string[];
        treeSettings?: Partial<DecisionTreeSettings>;
      };
      if (typeof parsed.error === "string" || parsed.error === null) setError(parsed.error);
      if (Array.isArray(parsed.metrics)) setMetrics(parsed.metrics.filter((item) => isVisibleAnalysisMetric(item.label)));
      if (Array.isArray(parsed.analysisRows)) setAnalysisRows(parsed.analysisRows);
      if (Array.isArray(parsed.featureImportance)) setFeatureImportance(parsed.featureImportance);
      if (parsed.confusionMatrix && typeof parsed.confusionMatrix === "object") setConfusionMatrix(parsed.confusionMatrix);
      if (Array.isArray(parsed.portfolioPositions)) setPortfolioPositions(parsed.portfolioPositions);
      if (Array.isArray(parsed.sectorAllocation)) setSectorAllocation(parsed.sectorAllocation);
      if (Array.isArray(parsed.numericSummary)) setNumericSummary(parsed.numericSummary);
      if (Array.isArray(parsed.decisionRules)) setDecisionRules(parsed.decisionRules);
      if (parsed.treePreview && typeof parsed.treePreview === "object") setTreePreview(parsed.treePreview);
      if (parsed.modelParameters && typeof parsed.modelParameters === "object") setModelParameters(parsed.modelParameters);
      if (typeof parsed.portfolioAssetsCount === "number") setPortfolioAssetsCount(parsed.portfolioAssetsCount);
      if (parsed.selectionMode === "all" || parsed.selectionMode === "manual") setSelectionMode(parsed.selectionMode);
      if (Array.isArray(parsed.selectedFigis)) setSelectedFigis(parsed.selectedFigis.filter((figi) => typeof figi === "string"));
      if (parsed.treeSettings && typeof parsed.treeSettings === "object") {
        setTreeSettings({
          ...DEFAULT_TREE_SETTINGS,
          ...parsed.treeSettings,
          maxDepth: numberOr(parsed.treeSettings.maxDepth, DEFAULT_TREE_SETTINGS.maxDepth),
          minSamplesSplit: numberOr(parsed.treeSettings.minSamplesSplit, DEFAULT_TREE_SETTINGS.minSamplesSplit),
          minSamplesLeaf: numberOr(parsed.treeSettings.minSamplesLeaf, DEFAULT_TREE_SETTINGS.minSamplesLeaf),
          testSize: numberOr(parsed.treeSettings.testSize, DEFAULT_TREE_SETTINGS.testSize),
          randomState: numberOr(parsed.treeSettings.randomState, DEFAULT_TREE_SETTINGS.randomState),
          features: Array.isArray(parsed.treeSettings.features)
            ? parsed.treeSettings.features.filter((item) => typeof item === "string")
            : DEFAULT_TREE_SETTINGS.features,
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
      confusionMatrix,
      portfolioPositions,
      sectorAllocation,
      numericSummary,
      decisionRules,
      treePreview,
      modelParameters,
      portfolioAssetsCount,
      selectionMode,
      selectedFigis,
      treeSettings,
    };
    window.localStorage.setItem(TREE_STATE_KEY, JSON.stringify(payload));
  }, [
    error,
    metrics,
    analysisRows,
    featureImportance,
    confusionMatrix,
    portfolioPositions,
    sectorAllocation,
    numericSummary,
    decisionRules,
    treePreview,
    modelParameters,
    portfolioAssetsCount,
    selectionMode,
    selectedFigis,
    treeSettings,
  ]);


  const modelParameterRows = useMemo(
    () =>
      buildParameterRows(
        modelParameters,
        {
          algorithm: t("\u0410\u043b\u0433\u043e\u0440\u0438\u0442\u043c", "Algorithm"),
          criterion: t("\u041a\u0440\u0438\u0442\u0435\u0440\u0438\u0439", "Criterion"),
          max_depth: t("\u041c\u0430\u043a\u0441. \u0433\u043b\u0443\u0431\u0438\u043d\u0430", "Max depth"),
          min_samples_split: t("\u041c\u0438\u043d. \u043e\u0431\u044a\u0435\u043a\u0442\u043e\u0432 \u0434\u043b\u044f split", "Min samples split"),
          min_samples_leaf: t("\u041c\u0438\u043d. \u043e\u0431\u044a\u0435\u043a\u0442\u043e\u0432 \u0432 \u043b\u0438\u0441\u0442\u0435", "Min samples leaf"),
          test_size: t("\u0422\u0435\u0441\u0442\u043e\u0432\u0430\u044f \u0434\u043e\u043b\u044f", "Test size"),
          random_state: t("Random state", "Random state"),
          class_weight: t("\u0411\u0430\u043b\u0430\u043d\u0441 \u043a\u043b\u0430\u0441\u0441\u043e\u0432", "Class weight"),
          features: t("\u041f\u0440\u0438\u0437\u043d\u0430\u043a\u0438", "Features"),
        },
        ["algorithm", "criterion", "max_depth", "min_samples_split", "min_samples_leaf", "test_size", "random_state", "class_weight", "features"],
      ),
    [modelParameters, t],
  );

  const treeDiagramNodes = useMemo(() => (treePreview ? buildTreeDiagramNodes(treePreview) : []), [treePreview]);
  const treeDiagramNodeMap = useMemo(() => new Map(treeDiagramNodes.map((node) => [node.key, node])), [treeDiagramNodes]);
  const decisionScatterRows = useMemo(
    () =>
      analysisRows
        .filter((row) => Number.isFinite(row.confidence) && Number.isFinite(row.expectedReturn))
        .slice(0, 50),
    [analysisRows],
  );
  const predictionDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of analysisRows) {
      counts.set(row.prediction, (counts.get(row.prediction) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([prediction, count], index) => ({
        prediction,
        count,
        fill: TREE_PALETTE[index % TREE_PALETTE.length],
      }))
      .sort((left, right) => right.count - left.count);
  }, [analysisRows]);
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

  const analysisSummary = useMemo(
    () => ({
      sampleSize: selectedRequestData.length,
      resultCount: analysisRows.length,
      buyCount: analysisRows.filter((row) => isBuyPrediction(row.prediction)).length,
      averageConfidence: averageFinite(analysisRows.map((row) => row.confidence)),
      averageExpectedReturn: averageFinite(analysisRows.map((row) => row.expectedReturn)),
      averageRisk: averageFinite(analysisRows.map((row) => row.risk)),
      topTicker: analysisRows[0]?.ticker ?? "-",
      topPrediction: analysisRows[0]?.prediction ?? "-",
    }),
    [analysisRows, selectedRequestData.length],
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

  const selectedFeatureLabels = useMemo(
    () =>
      TREE_FEATURE_OPTIONS
        .filter((option) => treeSettings.features.includes(option.key))
        .map((option) => (isEn ? option.labelEn : option.labelRu)),
    [isEn, treeSettings.features],
  );

  const treeHelp = useMemo(() => {
    if (treeSettings.algorithm === "random_forest") {
      return {
        title: t("Random Forest", "Random Forest"),
        text: t(
          "Обучает ансамбль деревьев и усредняет их решения. Обычно устойчивее одиночного дерева на шумных фундаментальных данных.",
          "Trains an ensemble of trees and averages their decisions. Usually more stable than a single tree on noisy fundamentals.",
        ),
        note: t(
          "Глубина и минимальные размеры листьев ограничивают сложность каждого дерева.",
          "Depth and minimum leaf sizes limit each tree's complexity.",
        ),
      };
    }
    if (treeSettings.algorithm === "gradient_boosting") {
      return {
        title: t("Градиентный бустинг", "Gradient boosting"),
        text: t(
          "Строит последовательность деревьев, где каждое следующее исправляет ошибки предыдущих. Может точнее ловить нелинейные зависимости.",
          "Builds trees sequentially, where each new tree corrects previous errors. It can capture nonlinear relationships more accurately.",
        ),
        note: t(
          "Слишком большая глубина повышает риск переобучения.",
          "Too much depth increases overfitting risk.",
        ),
      };
    }
    return {
      title: t("Дерево решений", "Decision tree"),
      text: t(
        "Разбивает акции по порогам фундаментальных признаков и формирует понятные правила отбора.",
        "Splits stocks by fundamental feature thresholds and produces interpretable selection rules.",
      ),
      note: t(
        "Глубина отвечает за детализацию правил: меньше глубина — проще и устойчивее модель.",
        "Depth controls rule detail: lower depth makes the model simpler and more stable.",
      ),
    };
  }, [treeSettings.algorithm, t]);

  const hasValidTreeInput =
    hasData &&
    selectedRequestData.length >= 2 &&
    treeSettings.features.length >= 2 &&
    treeSettings.minSamplesSplit >= 2 &&
    treeSettings.minSamplesLeaf >= 1;
  const canRunAnalysis = hasValidTreeInput && !isRunning;

  const updateTreeSettings = (patch: Partial<DecisionTreeSettings>) => {
    setTreeSettings((prev) => ({ ...prev, ...patch }));
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

  const resetTreeSettings = () => {
    setTreeSettings(DEFAULT_TREE_SETTINGS);
  };

  const toggleTreeFeature = (key: string) => {
    setTreeSettings((prev) => {
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

    if (!hasValidTreeInput) {
      showErrorDialog(
        t(
          "Выберите минимум две акции и минимум два параметра для дерева решений.",
          "Select at least two stocks and at least two decision tree features.",
        ),
      );
      return;
    }

    setIsRunning(true);

    try {
      await submitOptimizerSettings(optimizerSettings);
      const selectedTickers = selectedRequestData.map((row) => row.ticker);
      const selectedFigisForRequest = selectedRequestData.map((row) => row.figi);
      const response = await fetch(`${API_BASE_URL}/tree-solver-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: selectedRequestData,
          parameters: {
            algorithm: treeSettings.algorithm,
            criterion: treeSettings.criterion,
            max_depth: treeSettings.maxDepth,
            min_samples_split: treeSettings.minSamplesSplit,
            min_samples_leaf: treeSettings.minSamplesLeaf,
            test_size: treeSettings.testSize / 100,
            random_state: treeSettings.randomState,
            class_weight: treeSettings.classBalance ? "balanced" : null,
            balance_classes: treeSettings.classBalance,
            auto_tune: treeSettings.autoTune,
            tuning_metric: treeSettings.tuningMetric,
            tuning_budget: treeSettings.tuningBudget,
            tuning_scope: "decision_tree_analysis",
            features: treeSettings.features,
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

      const parsedMetrics = [...extractMetrics(parsed), ...extractPortfolioMetrics(parsed)];
      const parsedAnalysisRows = extractAnalysisRows(parsed);
      const parsedImportance = extractFeatureImportance(parsed);
      const parsedMatrix = extractConfusionMatrix(parsed);
      const parsedPositions = extractPortfolioPositions(parsed);
      const parsedAllocation = extractSectorAllocation(parsed);
      const parsedNumericSummary = extractNumericSummary(parsed);
      const parsedRules = extractDecisionRules(parsed);
      const parsedTreePreview = extractTreePreview(parsed);
      const parsedModelParameters = extractModelParameters(parsed);
      const parsedAssetsCount = extractPortfolioAssetsCount(parsed);

      setMetrics(parsedMetrics);
      setAnalysisRows(parsedAnalysisRows);
      setFeatureImportance(parsedImportance);
      setConfusionMatrix(parsedMatrix);
      setPortfolioPositions(parsedPositions);
      setSectorAllocation(parsedAllocation);
      setNumericSummary(parsedNumericSummary);
      setDecisionRules(parsedRules);
      setTreePreview(parsedTreePreview);
      setModelParameters(parsedModelParameters);
      setPortfolioAssetsCount(parsedAssetsCount);
    } catch (e) {
      const message = e instanceof Error ? e.message : t("Не удалось выполнить анализ дерева решений", "Failed to run decision tree analysis");
      showErrorDialog(message);
      setMetrics([]);
      setAnalysisRows([]);
      setFeatureImportance([]);
      setConfusionMatrix(null);
      setPortfolioPositions([]);
      setSectorAllocation([]);
      setNumericSummary([]);
      setDecisionRules([]);
      setTreePreview(null);
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
      title: t("Оптимальный портфель из дерева решений", "Optimal Portfolio from Decision Tree"),
      filename: "tree-optimal-portfolio.xlsx",
      rows: portfolioPositions,
      columns: getPortfolioHoldingColumns<PortfolioPosition>({
        name: t("Акция", "Stock"),
        weight: t("Вес, %", "Weight, %"),
      }),
      metrics: portfolioMetrics.map((item) => ({
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
      await downloadSvgAsPng(svg as SVGSVGElement, "tree-optimal-portfolio.png");
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
        title: t("Оптимальный портфель из дерева решений", "Optimal Portfolio from Decision Tree"),
        filename: "tree-optimal-portfolio.pdf",
        rows: portfolioPositions,
        columns: getPortfolioHoldingColumns<PortfolioPosition>({
          name: t("Акция", "Stock"),
          weight: t("Вес, %", "Weight, %"),
        }),
        metrics: portfolioMetrics.map((item) => ({
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
    { label: t("Компаний с прогнозом", "Companies with prediction"), value: analysisSummary.resultCount },
    { label: t("Сигналов покупки", "Buy signals"), value: analysisSummary.buyCount },
    { label: t("Средняя уверенность", "Average confidence"), value: formatPercentValue(analysisSummary.averageConfidence) },
    { label: t("Средняя ожидаемая доходность", "Average expected return"), value: formatPercentValue(analysisSummary.averageExpectedReturn) },
    { label: t("Средний риск", "Average risk"), value: formatPercentValue(analysisSummary.averageRisk) },
    { label: t("Лучший прогноз", "Top prediction"), value: analysisSummary.topTicker + " - " + analysisSummary.topPrediction },
    {
      label: t("Главный признак", "Top feature"),
      value: featureImportance[0]
        ? featureImportance[0].feature + " (" + formatPercentValue(featureImportance[0].importance) + ")"
        : "-",
    },
    ...overviewMetrics.map((item) => ({
      label: localizeMetricLabel(item.label, isEn),
      value: formatMetricDisplay(item.label, item.value),
    })),
    ...portfolioMetrics.map((item) => ({
      label: localizeMetricLabel(item.label, isEn),
      value: formatMetricDisplay(item.label, item.value),
    })),
    ...modelParameterRows.map((row) => ({ label: row.label, value: row.value })),
    ...decisionRules.slice(0, 5).map((row, index) => ({
      label: t("Правило", "Rule") + " #" + (index + 1),
      value: row.conditions + " => " + row.prediction + ", " + formatTreeConfidence(row.confidence),
    })),
  ];

  const buildAnalysisResultColumns = () => [
    { header: "Ticker", render: (row: AnalysisResultRow) => row.ticker },
    { header: t("Компания", "Company"), render: (row: AnalysisResultRow) => row.name },
    { header: t("Сектор", "Sector"), render: (row: AnalysisResultRow) => row.sector },
    { header: t("Прогноз", "Prediction"), render: (row: AnalysisResultRow) => row.prediction },
    { header: t("Уверенность, %", "Confidence, %"), render: (row: AnalysisResultRow) => formatPercentValue(row.confidence) },
    { header: t("Ожидаемая доходность, %", "Expected return, %"), render: (row: AnalysisResultRow) => formatPercentValue(row.expectedReturn) },
    { header: t("Риск, %", "Risk, %"), render: (row: AnalysisResultRow) => formatPercentValue(row.risk) },
    { header: "P/E", render: (row: AnalysisResultRow) => formatOptionalNumber(row.pe, 2) },
    { header: "P/BV", render: (row: AnalysisResultRow) => formatOptionalNumber(row.pb, 2) },
    { header: "ROE, %", render: (row: AnalysisResultRow) => formatPercentValue(row.roe) },
    { header: "g, %", render: (row: AnalysisResultRow) => formatPercentValue(row.growth) },
    { header: t("Рыночная капитализация", "Market cap"), render: (row: AnalysisResultRow) => formatOptionalNumber(row.marketCap, 0) },
    { header: t("Оценка", "Score"), render: (row: AnalysisResultRow) => formatOptionalNumber(row.score, 2) },
  ];

  const exportAnalysisToXlsx = async () => {
    if (!analysisRows.length) {
      return;
    }
    await downloadAnalysisResultsAsXlsx({
      title: t("Результаты анализа дерева решений", "Decision Tree Analysis Results"),
      filename: "tree-analysis-results.xlsx",
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
        title: t("Результаты анализа дерева решений", "Decision Tree Analysis Results"),
        filename: "tree-analysis-results.pdf",
        rows: analysisRows,
        columns: buildAnalysisResultColumns(),
        metrics: buildAnalysisExportMetrics(),
        chartSvg: decisionChartRef.current?.querySelector("svg"),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : t("Не удалось сохранить PDF", "Failed to save PDF");
      showErrorDialog(message);
    }
  };

  const saveDecisionChartPng = async () => {
    const svg = decisionChartRef.current?.querySelector("svg");
    if (!svg) {
      return;
    }
    try {
      await downloadSvgAsPng(svg as SVGSVGElement, "tree-confidence-return.png");
    } catch (e) {
      const message = e instanceof Error ? e.message : t("Не удалось сохранить PNG", "Failed to save PNG");
      showErrorDialog(message);
    }
  };

  const saveTreeChartPng = async () => {
    const svg = treeChartRef.current?.querySelector("svg");
    if (!svg) {
      return;
    }
    try {
      await downloadSvgAsPng(svg as SVGSVGElement, "tree-compact-preview.png");
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
          icon={GitBranch}
          title={t("Анализ дерева решений", "Decision Tree Analysis")}
          description={t(
            "Выберите акции, признаки и параметры дерева решений перед запуском серверного анализа.",
            "Select stocks, features, and decision tree parameters before running server-side analysis.",
          )}
          accent="emerald"
        />
      )}
      sidebar={(
        <AnalysisSidebarCard
          icon={Settings}
          title={t("Настройки", "Settings")}
          description={
            t("Модель, признаки и портфель.", "Model, features, and portfolio.")
          }
          accent="emerald"
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
                  <InfoTooltip label={t("Справка по дереву решений", "Decision tree help")} side="right">
                    <div className="space-y-2">
                      <p>
                        <span className="font-semibold">{treeHelp.title}: </span>
                        {treeHelp.text}
                      </p>
                      <p>{treeHelp.note}</p>
                      <div className="grid gap-1.5">
                        <div>
                          <span className="font-semibold">{t("Критерий", "Criterion")}:</span>{" "}
                          {t("выбирает, какой признак лучше разделяет акции на классы.", "chooses which feature best splits stocks into classes.")}
                        </div>
                        <div>
                          <span className="font-semibold">Min split / leaf:</span>{" "}
                          {t("ограничивают мелкие разбиения и помогают против переобучения.", "limit tiny splits and help against overfitting.")}
                        </div>
                        <div>
                          <span className="font-semibold">g:</span>{" "}
                          {t("темпы роста; в текущем кэше передаются через доступный ROE-показатель.", "growth rate; in the current cache it is sent through the available ROE metric.")}
                        </div>
                        <div>
                          <span className="font-semibold">Test, %:</span>{" "}
                          {t("доля данных для проверки качества модели.", "share of data reserved for model validation.")}
                        </div>
                        <div>
                          <span className="font-semibold">{t("Автоподбор", "Auto-tune")}:</span>{" "}
                          {t("сервер выбирает алгоритм и ограничения дерева по выбранному критерию качества.", "the server selects algorithm and tree constraints by the selected quality metric.")}
                        </div>
                      </div>
                    </div>
                  </InfoTooltip>
                </div>
                <button
                  type="button"
                  onClick={resetTreeSettings}
                  className="ui-secondary-button px-2 py-1 text-xs"
                  title={t("Сбросить параметры", "Reset parameters")}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {t("Сброс", "Reset")}
                </button>
              </div>

              {!treeSettings.autoTune && (
                <>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  {t("Алгоритм", "Algorithm")}
                </span>
                <Select
                  value={treeSettings.algorithm}
                  onValueChange={(value) => updateTreeSettings({ algorithm: value as TreeAlgorithm })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="decision_tree">{t("Дерево решений", "Decision tree")}</SelectItem>
                    <SelectItem value="random_forest">Random Forest</SelectItem>
                    <SelectItem value="gradient_boosting">{t("Градиентный бустинг", "Gradient boosting")}</SelectItem>
                  </SelectContent>
                </Select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  {t("Критерий разбиения", "Split criterion")}
                </span>
                <Select
                  value={treeSettings.criterion}
                  onValueChange={(value) => updateTreeSettings({ criterion: value as TreeCriterion })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gini">Gini</SelectItem>
                    <SelectItem value="entropy">Entropy</SelectItem>
                    <SelectItem value="log_loss">Log loss</SelectItem>
                  </SelectContent>
                </Select>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    {t("Глубина", "Depth")}
                  </span>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={treeSettings.maxDepth}
                    onChange={(event) =>
                      updateTreeSettings({ maxDepth: Math.max(1, Math.min(Number(event.target.value) || 1, 30)) })
                    }
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Test, %
                  </span>
                  <Input
                    type="number"
                    min={10}
                    max={50}
                    value={treeSettings.testSize}
                    onChange={(event) =>
                      updateTreeSettings({ testSize: Math.max(10, Math.min(Number(event.target.value) || 25, 50)) })
                    }
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Min split
                  </span>
                  <Input
                    type="number"
                    min={2}
                    value={treeSettings.minSamplesSplit}
                    onChange={(event) =>
                      updateTreeSettings({ minSamplesSplit: Math.max(2, Number(event.target.value) || 2) })
                    }
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Min leaf
                  </span>
                  <Input
                    type="number"
                    min={1}
                    value={treeSettings.minSamplesLeaf}
                    onChange={(event) =>
                      updateTreeSettings({ minSamplesLeaf: Math.max(1, Number(event.target.value) || 1) })
                    }
                  />
                </label>
              </div>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Random state
                </span>
                <Input
                  type="number"
                  value={treeSettings.randomState}
                  onChange={(event) =>
                    updateTreeSettings({ randomState: Number(event.target.value) || DEFAULT_TREE_SETTINGS.randomState })
                  }
                />
              </label>

              <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200">
                <Checkbox
                  checked={treeSettings.classBalance}
                  onCheckedChange={(checked) => updateTreeSettings({ classBalance: checked === true })}
                />
                <span>{t("Балансировать классы", "Balance classes")}</span>
              </label>
                </>
              )}

              <label className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200">
                <Checkbox
                  checked={treeSettings.autoTune}
                  onCheckedChange={(checked) => updateTreeSettings({ autoTune: checked === true })}
                />
                <span>{t("Автоподбор", "Auto-tune")}</span>
              </label>

              {treeSettings.autoTune && (
                <div className="grid grid-cols-2 gap-2">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      {t("Критерий", "Metric")}
                    </span>
                    <Select
                      value={treeSettings.tuningMetric}
                      onValueChange={(value) => updateTreeSettings({ tuningMetric: value as TreeTuningMetric })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="f1">F1</SelectItem>
                        <SelectItem value="accuracy">Accuracy</SelectItem>
                        <SelectItem value="roc_auc">ROC AUC</SelectItem>
                        <SelectItem value="balanced_accuracy">Balanced accuracy</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      {t("Режим подбора", "Tuning mode")}
                    </span>
                    <Select
                      value={treeSettings.tuningBudget}
                      onValueChange={(value) => updateTreeSettings({ tuningBudget: value as TuningBudget })}
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
                {TREE_FEATURE_OPTIONS.map((option) => {
                  const checked = treeSettings.features.includes(option.key);
                  const label = isEn ? option.labelEn : option.labelRu;
                  return (
                    <label
                      key={option.key}
                      className="flex min-h-10 items-center gap-2 rounded-md border border-slate-200 px-2 py-2 text-xs text-slate-700 dark:border-slate-700 dark:text-slate-200"
                    >
                      <Checkbox
                        checked={checked}
                        disabled={checked && treeSettings.features.length <= 2}
                        onCheckedChange={() => toggleTreeFeature(option.key)}
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
              autoFitWeights
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
              className="ui-primary-button w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700"
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
              "Можно запустить дерево по всему кэшу или вручную оставить только нужные акции.",
              "Run the tree on the full cache or keep only the stocks you need.",
            )}
            action={(
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectionMode("all")}
                  className={`ui-secondary-button px-3 py-2 text-xs ${
                    selectionMode === "all" ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200" : ""
                  }`}
                >
                  <Square className="h-4 w-4" />
                  {t("Весь кэш", "All cache")}
                </button>
                <button
                  type="button"
                  onClick={setManualSelectionMode}
                  className={`ui-secondary-button px-3 py-2 text-xs ${
                    selectionMode === "manual" ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200" : ""
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
                  <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">{treeSettings.features.length}</div>
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

              {!hasValidTreeInput && hasData && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300">
                  {t(
                    "Для запуска нужны минимум две выбранные акции, два признака и корректные ограничения дерева.",
                    "To run, select at least two stocks, two features, and valid tree constraints.",
                  )}
                </div>
              )}
            </div>
          </SectionCard>

          {isRunning && (
            <>
              <AnalysisRunningIndicator
                title={t("Выполняем анализ дерева решений", "Running decision tree analysis")}
                subtitle={t("Обучаем модель и формируем метрики портфеля", "Training model and generating portfolio metrics")}
                accentClassName="text-emerald-600"
              />
              <AnalysisLoadingPreview
                accentClassName="text-emerald-600"
                metricCount={4}
                metricsTitle={t("Готовим показатели дерева", "Preparing tree metrics")}
                metricsDescription={t("Считаем качество классификации, прогнозы и портфельные метрики.", "Calculating classification quality, predictions, and portfolio metrics.")}
                chartsTitle={t("Строим графики дерева", "Building tree charts")}
                chartsDescription={t("Появятся распределение прогнозов, риск-карта, схема дерева и важность признаков.", "Prediction distribution, risk map, tree schema, and feature importance will appear here.")}
                charts={[
                  {
                    title: t("Распределение прогнозов", "Prediction distribution"),
                    subtitle: t("Собираем классы прогнозов по компаниям.", "Collecting prediction classes by company."),
                    variant: "bars",
                  },
                  {
                    title: t("Уверенность vs доходность", "Confidence vs return"),
                    subtitle: t("Готовим точки риска и ожидаемой доходности.", "Preparing risk and expected return points."),
                    variant: "scatter",
                  },
                  {
                    title: t("Укороченное дерево", "Compact tree"),
                    subtitle: t("Рисуем ключевые развилки модели.", "Drawing the model's key splits."),
                    variant: "tree",
                  },
                  {
                    title: t("Значимость признаков", "Feature significance"),
                    subtitle: t("Оцениваем вклад параметров в решения дерева.", "Estimating parameter contribution to tree decisions."),
                    variant: "bars",
                  },
                ]}
                chartColumnsClassName="xl:grid-cols-2"
                tableTitle={t("Готовим таблицу результатов", "Preparing result table")}
                tableDescription={t("Скоро появятся прогнозы, уверенность и портфельные веса.", "Predictions, confidence, and portfolio weights will appear shortly.")}
                tableRows={8}
                tableColumns={8}
              />
            </>
          )}

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
            <SectionCard title={t("\u041f\u0430\u0440\u0430\u043c\u0435\u0442\u0440\u044b \u0438 \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442\u044b \u043c\u043e\u0434\u0435\u043b\u0438", "Model Parameters and Results")}>
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

          {!!analysisRows.length && (
            <SectionCard
              title={t("Сводка по результату", "Result Summary")}
              action={(
                <div className="flex items-center gap-2">
                  <button onClick={exportAnalysisToXlsx} disabled={!analysisRows.length} className="ui-secondary-button px-3 py-2 text-xs">
                    <FileSpreadsheet className="h-4 w-4" />
                    XLSX
                  </button>
                  <button onClick={exportAnalysisToPdf} disabled={!analysisRows.length} className="ui-secondary-button px-3 py-2 text-xs">
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
                    <div className="text-slate-500 dark:text-slate-400">{t("Компаний с прогнозом", "Companies with prediction")}</div>
                    <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">{analysisSummary.resultCount}</div>
                  </div>
                  <div className="ui-stat-card">
                    <div className="text-slate-500 dark:text-slate-400">{t("Средняя уверенность", "Average confidence")}</div>
                    <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">{formatPercentValue(analysisSummary.averageConfidence)}</div>
                  </div>
                  <div className="ui-stat-card">
                    <div className="text-slate-500 dark:text-slate-400">{t("Лучший прогноз", "Top prediction")}</div>
                    <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">{analysisSummary.topTicker}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{analysisSummary.topPrediction}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                  {!!predictionDistribution.length && (
                    <div>
                      <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{t("Распределение прогнозов", "Prediction distribution")}</div>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={predictionDistribution} margin={{ top: 10, right: 18, left: 16, bottom: 42 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="prediction" stroke="#64748b" interval={0} angle={-18} textAnchor="end" height={62} label={{ value: t("Прогноз", "Prediction"), position: "insideBottom", offset: -18 }} />
                            <YAxis allowDecimals={false} stroke="#64748b" label={{ value: t("Компаний", "Companies"), angle: -90, position: "insideLeft" }} />
                            <Tooltip formatter={(value: number) => Number(value).toFixed(0)} />
                            <Bar dataKey="count" name={t("Компаний", "Companies")} radius={[6, 6, 0, 0]}>
                              {predictionDistribution.map((row) => (
                                <Cell key={row.prediction} fill={row.fill} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {!!decisionScatterRows.length && (
                    <div className="xl:col-span-2">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t("Уверенность vs ожидаемая доходность", "Confidence vs expected return")}</div>
                        <button onClick={saveDecisionChartPng} disabled={!decisionScatterRows.length} className="ui-secondary-button px-3 py-2 text-xs">
                          <ImageDown className="h-4 w-4" />
                          PNG
                        </button>
                      </div>
                      <div ref={decisionChartRef} className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <ScatterChart margin={{ top: 12, right: 24, left: 28, bottom: 42 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis type="number" dataKey="confidence" name={t("Уверенность", "Confidence")} unit="%" stroke="#64748b" label={{ value: t("Уверенность, %", "Confidence, %"), position: "insideBottom", offset: -14 }} />
                            <YAxis type="number" dataKey="expectedReturn" name={t("Ожидаемая доходность", "Expected return")} unit="%" stroke="#64748b" label={{ value: t("Ожидаемая доходность, %", "Expected return, %"), angle: -90, position: "insideLeft" }} />
                            <ZAxis dataKey="risk" range={[70, 230]} />
                            <Tooltip formatter={(value: number, name: string) => [formatPercentValue(value), name]} cursor={{ strokeDasharray: "3 3" }} />
                            <Scatter name={t("Акции", "Stocks")} data={decisionScatterRows} fill="#10b981" stroke="#047857" fillOpacity={0.82} />
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </SectionCard>
          )}

          {!!analysisRows.length && (
            <SectionCard
              title={t("Результаты анализа дерева решений", "Decision Tree Analysis Results")}
              description={t("Таблица классифицированных акций, отсортированная по уверенности модели.", "Classified stocks sorted by model confidence.")}
            >
              <div className="ui-table-shell overflow-x-auto tree-analysis-results-table">
                <table className="ui-data-table min-w-[78rem]">
                  <thead>
                    <tr>
                      <th>Ticker</th>
                      <th>{t("Компания", "Company")}</th>
                      <th>{t("Сектор", "Sector")}</th>
                      <th>{t("Прогноз", "Prediction")}</th>
                      <th>{t("Уверенность", "Confidence")}</th>
                      <th>{t("Ожид. доходность", "Expected return")}</th>
                      <th>{t("Риск", "Risk")}</th>
                      <th>P/E</th>
                      <th>P/BV</th>
                      <th>ROE</th>
                      <th>g</th>
                      <th>{t("Капитализация", "Market cap")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysisRows.slice(0, 50).map((row) => (
                      <tr key={(row.figi || row.ticker) + "-tree-analysis"}>
                        <td className="font-medium text-slate-900 dark:text-slate-100">{row.ticker}</td>
                        <td className="ui-cell-name">{row.name}</td>
                        <td>{row.sector}</td>
                        <td className="font-semibold text-slate-900 dark:text-slate-100">{row.prediction}</td>
                        <td className="ui-cell-number text-emerald-700 dark:text-emerald-300">{formatPercentValue(row.confidence)}</td>
                        <td className="ui-cell-number">{formatPercentValue(row.expectedReturn)}</td>
                        <td className="ui-cell-number">{formatPercentValue(row.risk)}</td>
                        <td className="ui-cell-number">{formatOptionalNumber(row.pe, 2)}</td>
                        <td className="ui-cell-number">{formatOptionalNumber(row.pb, 2)}</td>
                        <td className="ui-cell-number">{formatPercentValue(row.roe)}</td>
                        <td className="ui-cell-number">{formatPercentValue(row.growth)}</td>
                        <td className="ui-cell-number">{formatOptionalNumber(row.marketCap, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {!!treeDiagramNodes.length && (
            <SectionCard
              title={t("\u0421\u043e\u043a\u0440\u0430\u0449\u0435\u043d\u043d\u043e\u0435 \u0434\u0435\u0440\u0435\u0432\u043e \u0440\u0435\u0448\u0435\u043d\u0438\u0439", "Compact Decision Tree")}
              description={t(
                "\u041f\u043e\u043a\u0430\u0437\u0430\u043d\u044b \u0432\u0435\u0440\u0445\u043d\u0438\u0435 \u0443\u0440\u043e\u0432\u043d\u0438 \u0434\u0435\u0440\u0435\u0432\u0430: \u0443\u0441\u043b\u043e\u0432\u0438\u0435 \u0440\u0430\u0437\u0434\u0435\u043b\u0435\u043d\u0438\u044f, \u043f\u0440\u043e\u0433\u043d\u043e\u0437 \u043a\u043b\u0430\u0441\u0441\u0430, \u0443\u0432\u0435\u0440\u0435\u043d\u043d\u043e\u0441\u0442\u044c \u0438 \u0447\u0438\u0441\u043b\u043e \u043e\u0431\u044a\u0435\u043a\u0442\u043e\u0432 \u0432 \u0443\u0437\u043b\u0435.",
                "Shows the top levels: split condition, predicted class, confidence, and samples per node.",
              )}
            >
              <div className="mb-4 flex justify-end">
                <button onClick={saveTreeChartPng} disabled={!treeDiagramNodes.length} className="ui-secondary-button px-3 py-2 text-xs">
                  <ImageDown className="h-4 w-4" />
                  PNG
                </button>
              </div>
              <div ref={treeChartRef} className="overflow-x-auto rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950">
                <svg viewBox="0 0 1000 360" className="min-w-[900px]" role="img" aria-label={t("\u0421\u043e\u043a\u0440\u0430\u0449\u0435\u043d\u043d\u043e\u0435 \u0434\u0435\u0440\u0435\u0432\u043e \u0440\u0435\u0448\u0435\u043d\u0438\u0439", "Compact decision tree")}>
                  {treeDiagramNodes
                    .filter((node) => node.parentKey)
                    .map((node) => {
                      const parent = treeDiagramNodeMap.get(node.parentKey ?? "");
                      if (!parent) return null;
                      const midX = (parent.x + node.x) / 2;
                      const midY = (parent.y + node.y) / 2;
                      return (
                        <g key={node.key + "-edge"}>
                          <line x1={parent.x} y1={parent.y + 36} x2={node.x} y2={node.y - 36} stroke="#94a3b8" strokeWidth="2" />
                          <text x={midX} y={midY - 4} textAnchor="middle" className="fill-slate-500 text-[13px] font-semibold">
                            {node.branch}
                          </text>
                        </g>
                      );
                    })}
                  {treeDiagramNodes.map((item) => (
                    <foreignObject key={item.key} x={item.x - 82} y={item.y - 42} width="164" height="84">
                      <div className="h-full rounded-md border border-emerald-200 bg-emerald-50 p-2 text-center text-[11px] leading-tight text-slate-700 shadow-sm dark:border-emerald-800 dark:bg-emerald-950 dark:text-slate-100">
                        <div className="truncate font-semibold text-emerald-800 dark:text-emerald-200">
                          {item.node.kind === "leaf" ? t("\u041b\u0438\u0441\u0442", "Leaf") : item.node.feature}
                        </div>
                        <div className="mt-1 truncate">
                          {item.node.kind === "leaf" ? t("\u041f\u0440\u043e\u0433\u043d\u043e\u0437", "Prediction") : "<= " + Number(item.node.threshold ?? 0).toFixed(2)}
                        </div>
                        <div className="mt-1 font-semibold text-slate-900 dark:text-slate-50">
                          {String(item.node.prediction ?? "-")}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          {formatTreeConfidence(item.node.confidence)} | n={item.node.samples}
                        </div>
                      </div>
                    </foreignObject>
                  ))}
                </svg>
              </div>

              {!!decisionRules.length && (
                <div className="mt-4 ui-table-shell overflow-x-auto">
                  <table className="ui-data-table">
                    <thead>
                      <tr>
                        <th>{t("\u041f\u0440\u0430\u0432\u0438\u043b\u043e", "Rule")}</th>
                        <th>{t("\u041f\u0440\u043e\u0433\u043d\u043e\u0437", "Prediction")}</th>
                        <th>{t("\u0423\u0432\u0435\u0440\u0435\u043d\u043d\u043e\u0441\u0442\u044c", "Confidence")}</th>
                        <th>{t("\u041e\u0431\u044a\u0435\u043a\u0442\u043e\u0432", "Samples")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {decisionRules.map((rule, index) => (
                        <tr key={String(rule.prediction) + "-" + index}>
                          <td className="max-w-xl text-slate-700 dark:text-slate-200">{rule.conditions}</td>
                          <td className="font-semibold text-slate-900 dark:text-slate-100">{String(rule.prediction)}</td>
                          <td>{formatTreeConfidence(rule.confidence)}</td>
                          <td>{rule.samples}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          )}

          {!!portfolioPositions.length && (
            <SectionCard
              title={t("Оптимальный портфель из дерева решений", "Optimal Portfolio from Decision Tree")}
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
              {(portfolioAssetsCount > 0 || !!portfolioMetrics.length) && (
                <MetricGrid className="mb-5 xl:grid-cols-4">
                  {portfolioAssetsCount > 0 && (
                    <MetricCard label={t("Активов в портфеле", "Assets in portfolio")} value={portfolioAssetsCount} />
                  )}
                  {portfolioMetrics.map((metric) => (
                    <MetricCard
                      key={metric.label}
                      label={(
                        <>
                          <span>{localizeMetricLabel(metric.label, isEn)}</span>
                          {getMetricTooltip(metric.label, isEn) && (
                            <MetricTooltip text={getMetricTooltip(metric.label, isEn) ?? ""} />
                          )}
                        </>
                      )}
                      value={formatMetricDisplay(metric.label, metric.value)}
                    />
                  ))}
                </MetricGrid>
              )}

              <PortfolioHoldingsPanel
                rows={portfolioPositions}
                palette={TREE_PALETTE}
                chartRef={portfolioChartRef}
                companyLabel={t("Акция", "Stock")}
                weightLabel={t("Вес, %", "Weight, %")}
              />
            </SectionCard>
          )}

          {!!portfolioPositions.length && (
            <PortfolioSimulationPanel
              holdings={portfolioPositions}
              shares={cache.shares}
              fundamentalsByFigi={cache.fundamentalsByFigi}
              analysisName={t("Дерево решений", "Decision Tree")}
              filenamePrefix="decision-tree-portfolio"
            />
          )}

          {!!numericSummary.length && (
            <SectionCard title={t("Сводка по числовым признакам", "Numeric Features Summary")}>
              <div className="ui-table-shell overflow-x-auto">
                <table className="ui-data-table">
                  <thead>
                    <tr>
                      <th>{t("Метрика", "Metric")}</th>
                      <th>Mean</th>
                      <th>Median</th>
                      <th>Min</th>
                      <th>Max</th>
                    </tr>
                  </thead>
                  <tbody>
                    {numericSummary.map((row) => (
                      <tr key={row.metric}>
                        <td className="font-medium text-slate-900 dark:text-slate-100">{row.metric}</td>
                        <td>{row.mean.toFixed(4)}</td>
                        <td>{row.median.toFixed(4)}</td>
                        <td>{row.min.toFixed(4)}</td>
                        <td>{row.max.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {!!featureImportance.length && (
            <SectionCard title={t("Важность признаков", "Feature Importance")}>
              <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="ui-stat-card">
                  <div className="text-slate-500 dark:text-slate-400">{t("Главный признак", "Top feature")}</div>
                  <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{featureImportance[0]?.feature ?? "-"}</div>
                </div>
                <div className="ui-stat-card">
                  <div className="text-slate-500 dark:text-slate-400">{t("Значимость", "Importance")}</div>
                  <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{formatPercentValue(featureImportance[0]?.importance)}</div>
                </div>
                <div className="ui-stat-card">
                  <div className="text-slate-500 dark:text-slate-400">{t("Признаков в модели", "Model features")}</div>
                  <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{featureImportance.length}</div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={featureImportance} layout="vertical" margin={{ top: 5, right: 30, left: 90, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" stroke="#64748b" unit="%" />
                  <YAxis type="category" dataKey="feature" stroke="#64748b" width={90} />
                  <Tooltip formatter={(v: number) => `${Number(v).toFixed(2)}%`} />
                  <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                    {featureImportance.map((row, idx) => (
                      <Cell key={row.feature} fill={TREE_PALETTE[idx % TREE_PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
          )}

          {confusionMatrix && (
            <SectionCard title={t("Матрица ошибок", "Confusion Matrix")}>
              <div className="max-w-2xl overflow-x-auto">
                <table className="ui-data-table">
                  <thead>
                    <tr>
                      <th className="bg-slate-50 p-2 text-left dark:bg-slate-800"></th>
                      {confusionMatrix.labels.map((label) => (
                        <th key={`pred-${label}`} className="bg-slate-50 p-2 text-left dark:bg-slate-800">
                          {t("Прогноз", "Predicted")}: {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {confusionMatrix.matrix.map((row, rowIndex) => (
                      <tr key={`row-${rowIndex}`}>
                        <td className="bg-slate-50 p-2 font-medium dark:bg-slate-800">{t("Факт", "Actual")}: {confusionMatrix.labels[rowIndex] ?? `Class ${rowIndex + 1}`}</td>
                        {row.map((value, colIndex) => (
                          <td key={`cell-${rowIndex}-${colIndex}`} className="p-2 text-center font-semibold text-slate-900 dark:text-slate-100">
                            {value}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
