import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckSquare,
  FileSpreadsheet,
  FileText,
  ImageDown,
  ListFilter,
  Network,
  Play,
  RotateCcw,
  Search,
  Settings,
  Square,
  X,
} from "lucide-react";
import {
  ScatterChart,
  Scatter,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
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

import { SavePortfolioButton } from "../../../features/saved-portfolios";
import { API_BASE_URL } from "../../../config";
import type {
  ClusterAnalysisSummary as AnalysisSummary,
  ClusterFeatureImportanceItem as FeatureImportanceItem,
  ClusterGroup,
  ClusterMetricItem as MetricItem,
  ClusterPoint,
  ClusterPortfolioRow as PortfolioRow,
  ClusterStrategyPortfolio as StrategyPortfolio,
} from "../../../features/cluster-analysis";
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
  CLUSTER_FEATURE_OPTIONS,
  CLUSTER_PALETTE,
  CLUSTER_STATE_KEY,
  DEFAULT_CLUSTER_SETTINGS,
} from "../model";
import type {
  ClusterAlgorithm,
  ClusterAnalysisSettings,
  ClusterTuningMetric,
  DistanceMetric,
  ScalingMethod,
  SelectionMode,
  TuningBudget,
} from "../model";
import {
  extractBestPortfolioAssetsCount,
  extractFeatureImportance,
  extractGroups,
  extractMetrics,
  extractPoints,
  extractPortfolio,
  extractPortfolioStrategies,
  extractSummary,
  getClusterColor,
} from "../lib";

function formatOptionalNumber(value: number | undefined, digits = 4): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "";
}

const PORTFOLIO_METRIC_LABELS = new Set(["expected return", "risk", "sharpe", "sharpe ratio", "diversification"]);

function isPortfolioMetric(label: string): boolean {
  return PORTFOLIO_METRIC_LABELS.has(label.trim().toLowerCase());
}

export function ClusterAnalysis() {
  const { cache, hasData } = useFundamentals();
  const { locale, t } = useAppSettings();
  const isEn = locale === "en";
  const { settings: optimizerSettings, setSettings: setOptimizerSettings } = useOptimizerSettings();
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDialogMessage, setErrorDialogMessage] = useState<string | null>(null);
  const [clusterData, setClusterData] = useState<ClusterPoint[]>([]);
  const [clusterGroups, setClusterGroups] = useState<ClusterGroup[]>([]);
  const [metrics, setMetrics] = useState<MetricItem[]>([]);
  const [featureImportance, setFeatureImportance] = useState<FeatureImportanceItem[]>([]);
  const [modelParameters, setModelParameters] = useState<Record<string, unknown>>({});
  const [optimalPortfolio, setOptimalPortfolio] = useState<PortfolioRow[]>([]);
  const [portfolioStrategies, setPortfolioStrategies] = useState<StrategyPortfolio[]>([]);
  const [summaryInfo, setSummaryInfo] = useState<AnalysisSummary | null>(null);
  const [bestPortfolioAssetsCount, setBestPortfolioAssetsCount] = useState(0);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("all");
  const [selectedFigis, setSelectedFigis] = useState<string[]>([]);
  const [stockSearch, setStockSearch] = useState("");
  const [clusterSettings, setClusterSettings] = useState<ClusterAnalysisSettings>(DEFAULT_CLUSTER_SETTINGS);
  const portfolioChartRef = useRef<HTMLDivElement | null>(null);
  const visibleMetrics = useMemo(() => metrics.filter((item) => isVisibleAnalysisMetric(item.label)), [metrics]);
  const portfolioMetrics = useMemo(() => visibleMetrics.filter((item) => isPortfolioMetric(item.label)), [visibleMetrics]);
  const overviewMetrics = useMemo(() => visibleMetrics.filter((item) => !isPortfolioMetric(item.label)), [visibleMetrics]);
  const clusterSeries = useMemo(
    () =>
      Array.from(new Set(clusterData.map((point) => point.cluster)))
        .sort((left, right) => left - right)
        .map((cluster) => {
          const points = clusterData.filter((point) => point.cluster === cluster);
          return {
            cluster,
            name: `${t("Кластер", "Cluster")} ${cluster + 1}`,
            color: points[0]?.color ?? getClusterColor(cluster),
            points,
          };
        }),
    [clusterData, t],
  );
  const showErrorDialog = (message: string) => {
    setError(message);
    setErrorDialogMessage(message);
  };

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CLUSTER_STATE_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as {
        error?: string | null;
        clusterData?: ClusterPoint[];
        clusterGroups?: ClusterGroup[];
        metrics?: MetricItem[];
        featureImportance?: FeatureImportanceItem[];
        modelParameters?: Record<string, unknown>;
        optimalPortfolio?: PortfolioRow[];
        portfolioStrategies?: StrategyPortfolio[];
        summaryInfo?: AnalysisSummary | null;
        bestPortfolioAssetsCount?: number;
        selectionMode?: SelectionMode;
        selectedFigis?: string[];
        clusterSettings?: Partial<ClusterAnalysisSettings>;
      };

      if (typeof parsed.error === "string" || parsed.error === null) setError(parsed.error);
      if (Array.isArray(parsed.clusterData)) setClusterData(parsed.clusterData);
      if (Array.isArray(parsed.clusterGroups)) setClusterGroups(parsed.clusterGroups);
      if (Array.isArray(parsed.metrics)) setMetrics(parsed.metrics.filter((item) => isVisibleAnalysisMetric(item.label)));
      if (Array.isArray(parsed.featureImportance)) setFeatureImportance(parsed.featureImportance);
      if (parsed.modelParameters && typeof parsed.modelParameters === "object") setModelParameters(parsed.modelParameters);
      if (Array.isArray(parsed.optimalPortfolio)) setOptimalPortfolio(parsed.optimalPortfolio);
      if (Array.isArray(parsed.portfolioStrategies)) setPortfolioStrategies(parsed.portfolioStrategies);
      if (parsed.summaryInfo && typeof parsed.summaryInfo === "object") {
        const savedSummary = parsed.summaryInfo as AnalysisSummary;
        setSummaryInfo({
          ...savedSummary,
          companiesCount: savedSummary.companiesCount || (Array.isArray(parsed.clusterData) ? parsed.clusterData.length : 0),
        });
      }
      if (typeof parsed.bestPortfolioAssetsCount === "number") setBestPortfolioAssetsCount(parsed.bestPortfolioAssetsCount);
      if (parsed.selectionMode === "all" || parsed.selectionMode === "manual") setSelectionMode(parsed.selectionMode);
      if (Array.isArray(parsed.selectedFigis)) setSelectedFigis(parsed.selectedFigis.filter((figi) => typeof figi === "string"));
      if (parsed.clusterSettings && typeof parsed.clusterSettings === "object") {
        setClusterSettings({
          ...DEFAULT_CLUSTER_SETTINGS,
          ...parsed.clusterSettings,
          clustersCount: numberOr(parsed.clusterSettings.clustersCount, DEFAULT_CLUSTER_SETTINGS.clustersCount),
          randomState: numberOr(parsed.clusterSettings.randomState, DEFAULT_CLUSTER_SETTINGS.randomState),
          features: Array.isArray(parsed.clusterSettings.features)
            ? parsed.clusterSettings.features.filter((item) => typeof item === "string")
            : DEFAULT_CLUSTER_SETTINGS.features,
        });
      }
    } catch {
      // ignore broken persisted state
    }
  }, []);

  useEffect(() => {
    const payload = {
      error,
      clusterData,
      clusterGroups,
      metrics,
      featureImportance,
      modelParameters,
      optimalPortfolio,
      portfolioStrategies,
      summaryInfo,
      bestPortfolioAssetsCount,
      selectionMode,
      selectedFigis,
      clusterSettings,
    };
    window.localStorage.setItem(CLUSTER_STATE_KEY, JSON.stringify(payload));
  }, [
    error,
    clusterData,
    clusterGroups,
    metrics,
    featureImportance,
    modelParameters,
    optimalPortfolio,
    portfolioStrategies,
    summaryInfo,
    bestPortfolioAssetsCount,
    selectionMode,
    selectedFigis,
    clusterSettings,
  ]);


  const modelParameterRows = useMemo(
    () =>
      buildParameterRows(
        modelParameters,
        {
          requested_algorithm: t("Запрошенный алгоритм", "Requested algorithm"),
          used_algorithm: t("Итоговый алгоритм", "Selected algorithm"),
          clusters_count: t("Кластеров получено", "Clusters found"),
          requested_clusters_count: t("Кластеров запрошено", "Requested clusters"),
          auto_tune: t("Автоподбор", "Auto tune"),
          scaling_method: t("Масштабирование", "Scaling"),
          distance_metric: t("Метрика расстояния", "Distance metric"),
          features: t("Признаки модели", "Model features"),
          requested_features: t("Запрошенные признаки", "Requested features"),
          model_features: t("Признаки модели", "Model features"),
          random_state: t("Начальное значение", "Random seed"),
          dividend_priority: t("Приоритет стабильных дивидендов", "Stable dividend priority"),
          portfolio_assets_count: "Assets in portfolio",
          requested_portfolio_assets_count: "Requested assets",
          effective_min_weight_pct: "Effective min weight, %",
          effective_max_weight_pct: "Effective max weight, %",
          auto_fit_weights: "Auto-fit weights",
        },
        [
          "used_algorithm",
          "requested_algorithm",
          "clusters_count",
          "requested_clusters_count",
          "auto_tune",
          "scaling_method",
          "distance_metric",
          "features",
          "requested_features",
          "model_features",
          "random_state",
          "dividend_priority",
          "portfolio_assets_count",
          "requested_portfolio_assets_count",
          "effective_min_weight_pct",
          "effective_max_weight_pct",
          "auto_fit_weights",
        ],
      ),
    [modelParameters, t],
  );
  const displayPortfolio = useMemo(() => {
    if (optimalPortfolio.length) {
      return optimalPortfolio;
    }
    const fallback = portfolioStrategies.find((s) => s.rows.length > 0);
    return fallback?.rows ?? [];
  }, [optimalPortfolio, portfolioStrategies]);

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
            pfcfRatio: f.pfcfRatio,
            ev_to_ebitda: f.evToEbitda,
            roa: f.roa,
            net_margin: f.netMargin,
            net_debt_to_ebitda: f.netDebtToEbitda,
            total_debt: f.totalDebt,
            roe: f.roe,
            g: f.roe,
            growth_rate: f.roe,
            growthRate: f.roe,
            dividend_yield: f.dividendYield,
            five_year_avg_dividend_yield: f.fiveYearAverageDividendYield,
            five_year_dividend_growth_rate: f.fiveYearDividendGrowthRate,
            payout_ratio: f.dividendPayoutRatio,
            dividend_years_count: f.dividendYearsCount,
            consecutive_dividend_years: f.consecutiveDividendYears,
            dividend_consistency: f.dividendConsistency,
            last_dividend_year: f.lastDividendYear,
            beta: f.beta,
            peRatio: f.peRatio,
            pbRatio: f.pbRatio,
            marketCapBn: f.marketCapBn,
            dividendYield: f.dividendYield,
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

  const selectedFeatureLabels = useMemo(
    () =>
      CLUSTER_FEATURE_OPTIONS
        .filter((option) => clusterSettings.features.includes(option.key))
        .map((option) => (isEn ? option.labelEn : option.labelRu)),
    [clusterSettings.features, isEn],
  );

  const algorithmHelp = useMemo(() => {
    if (clusterSettings.algorithm === "agglomerative") {
      return {
        title: t("Иерархическая кластеризация", "Agglomerative clustering"),
        text: t(
          "Строит группы по близости компаний и постепенно объединяет похожие акции. Подходит для поиска структуры без случайного старта.",
          "Builds groups by company proximity and gradually merges similar stocks. Useful for reading structure without random initialization.",
        ),
        note: t(
          "Число кластеров задает, на сколько групп разрезать итоговую структуру.",
          "Clusters count defines how many groups the final hierarchy is split into.",
        ),
      };
    }
    if (clusterSettings.algorithm === "dbscan") {
      return {
        title: "DBSCAN",
        text: t(
          "Ищет плотные группы и может отделять нестандартные компании как выбросы. Хорош для неоднородной выборки.",
          "Finds dense groups and can separate unusual companies as outliers. Useful for uneven stock universes.",
        ),
        note: t(
          "DBSCAN определяет число групп автоматически, поэтому заданное значение может не использоваться.",
          "DBSCAN determines the number of groups automatically, so the chosen value may not be used.",
        ),
      };
    }
    return {
      title: "K-Means",
      text: t(
        "Делит акции на заданное число групп вокруг центров кластеров. Быстрый базовый алгоритм для сравнения похожих компаний.",
        "Splits stocks into a chosen number of groups around cluster centers. A fast baseline for comparing similar companies.",
      ),
      note: t(
        "Число кластеров напрямую задает количество групп в результате.",
        "Clusters count directly defines the number of resulting groups.",
      ),
    };
  }, [clusterSettings.algorithm, t]);

  const maxClustersCount = Math.max(2, Math.min(12, selectedRequestData.length || 12));
  const hasValidClusterInput =
    hasData &&
    selectedRequestData.length >= (optimizerSettings.autoModelTuning ? 2 : Math.max(2, Math.min(clusterSettings.clustersCount, 12))) &&
    (optimizerSettings.autoModelTuning || clusterSettings.features.length >= 2);
  const canRunClusterAnalysis = hasValidClusterInput && !isRunning;

  const updateClusterSettings = (patch: Partial<ClusterAnalysisSettings>) => {
    setClusterSettings((prev) => ({ ...prev, ...patch }));
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

  const resetClusterSettings = () => {
    setClusterSettings(DEFAULT_CLUSTER_SETTINGS);
  };

  const toggleClusterFeature = (key: string) => {
    setClusterSettings((prev) => {
      const isSelected = prev.features.includes(key);
      return {
        ...prev,
        features: isSelected ? prev.features.filter((item) => item !== key) : [...prev.features, key],
      };
    });
  };

  const exportPortfolioToXlsx = async () => {
    if (!displayPortfolio.length) {
      return;
    }
    await downloadAnalysisResultsAsXlsx({
      title: t("Оптимальный портфель из кластерного анализа", "Optimal Portfolio from Cluster Analysis"),
      filename: "optimal-portfolio.xlsx",
      rows: displayPortfolio,
      columns: getPortfolioHoldingColumns<PortfolioRow>({
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
      await downloadSvgAsPng(svg, "optimal-portfolio-chart.png");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to export PNG";
      showErrorDialog(message);
    }
  };

  const exportPortfolioToPdf = async () => {
    if (!displayPortfolio.length) {
      return;
    }
    try {
      await downloadAnalysisResultsAsPdf({
        title: t("Оптимальный портфель из кластерного анализа", "Optimal Portfolio from Cluster Analysis"),
        filename: "optimal-portfolio.pdf",
        rows: displayPortfolio,
        columns: getPortfolioHoldingColumns<PortfolioRow>({
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
    ...visibleMetrics.map((item) => ({
      label: localizeMetricLabel(item.label, isEn),
      value: formatMetricDisplay(item.label, item.value),
    })),
    ...modelParameterRows.map((row) => ({ label: row.label, value: row.value })),
    ...clusterGroups.map((cluster) => ({
      label: cluster.name,
      value: [
        "count=" + cluster.count,
        "P/E=" + cluster.avgPE.toFixed(2),
        "g=" + cluster.avgG.toFixed(2),
        cluster.recommendation ? "recommendation=" + cluster.recommendation : "",
      ].filter(Boolean).join("; "),
    })),
  ];

  const buildClusterAnalysisColumns = () => [
    { header: "Ticker", render: (row: ClusterPoint) => row.ticker },
    { header: "Company", render: (row: ClusterPoint) => row.name ?? "" },
    { header: "Cluster", render: (row: ClusterPoint) => row.cluster + 1 },
    { header: "P/E", render: (row: ClusterPoint) => formatOptionalNumber(row.pe, 2) },
    { header: "g, %", render: (row: ClusterPoint) => formatOptionalNumber(row.g, 2) },
    { header: "Expected return", render: (row: ClusterPoint) => formatOptionalNumber(row.expectedReturn, 4) },
    { header: "Risk", render: (row: ClusterPoint) => formatOptionalNumber(row.risk, 4) },
    { header: "ROE", render: (row: ClusterPoint) => formatOptionalNumber(row.roe, 2) },
    { header: "Market cap", render: (row: ClusterPoint) => formatOptionalNumber(row.marketCap, 0) },
    { header: "Value score", render: (row: ClusterPoint) => formatOptionalNumber(row.valueScore, 2) },
    { header: "Quality score", render: (row: ClusterPoint) => formatOptionalNumber(row.qualityScore, 2) },
    { header: "Growth score", render: (row: ClusterPoint) => formatOptionalNumber(row.growthScore, 2) },
    { header: "Income score", render: (row: ClusterPoint) => formatOptionalNumber(row.incomeScore, 2) },
    { header: "Dividend yield, %", render: (row: ClusterPoint) => formatOptionalNumber(row.dividendYield, 2) },
    { header: "Dividend years", render: (row: ClusterPoint) => formatOptionalNumber(row.dividendYearsCount, 0) },
    { header: "Consecutive years", render: (row: ClusterPoint) => formatOptionalNumber(row.consecutiveDividendYears, 0) },
    { header: "Dividend score, %", render: (row: ClusterPoint) => formatOptionalNumber(row.dividendScore, 2) },
    { header: "Composite score", render: (row: ClusterPoint) => formatOptionalNumber(row.compositeScore, 2) },
  ];

  const exportAnalysisToXlsx = async () => {
    if (!clusterData.length) {
      return;
    }
    await downloadAnalysisResultsAsXlsx({
      title: "Cluster Analysis Results",
      filename: "cluster-analysis-results.xlsx",
      rows: clusterData,
      columns: buildClusterAnalysisColumns(),
      metrics: buildAnalysisExportMetrics(),
    });
  };

  const exportAnalysisToPdf = async () => {
    if (!clusterData.length) {
      return;
    }
    try {
      await downloadAnalysisResultsAsPdf({
        title: "Cluster Analysis Results",
        filename: "cluster-analysis-results.pdf",
        rows: clusterData,
        columns: buildClusterAnalysisColumns(),
        metrics: buildAnalysisExportMetrics(),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to save PDF";
      showErrorDialog(message);
    }
  };

  const runClusterAnalysis = async () => {
    setError(null);
    setErrorDialogMessage(null);

    if (!hasValidClusterInput) {
      showErrorDialog(
        t(
          "Выберите минимум две акции и минимум два параметра кластеризации.",
          "Select at least two stocks and at least two clustering parameters.",
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
      const sanitizedClustersCount = Math.max(2, Math.min(clusterSettings.clustersCount, selectedRequestData.length));
      const selectedTickers = selectedRequestData.map((row) => row.ticker);
      const selectedFigisForRequest = selectedRequestData.map((row) => row.figi);
      const requestedAssetsCount = optimizerSettings.autoPortfolioOptimization
        ? 20
        : Number(optimizerPayload.portfolio_assets_count ?? 20);
      const body = JSON.stringify({
        data: selectedRequestData,
        auto_model_tuning: optimizerSettings.autoModelTuning,
        auto_portfolio_optimization: optimizerSettings.autoPortfolioOptimization,
        portfolio_assets_count: requestedAssetsCount,
        use_cache: true,
        parameters: {
          algorithm: clusterSettings.algorithm,
          n_clusters: sanitizedClustersCount,
          clusters_count: sanitizedClustersCount,
          distance_metric: clusterSettings.distanceMetric,
          scaling_method: clusterSettings.scalingMethod,
          standardize: clusterSettings.scalingMethod !== "none",
          random_state: clusterSettings.randomState,
          include_outliers: clusterSettings.includeOutliers,
          auto_tune: optimizerSettings.autoModelTuning ? true : clusterSettings.autoTune,
          tuning_metric: clusterSettings.tuningMetric,
          tuning_budget: clusterSettings.tuningBudget,
          tuning_scope: "cluster_analysis",
          dividend_priority: true,
          features: clusterSettings.features,
        },
        selected_figis: selectedFigisForRequest,
        selected_tickers: selectedTickers,
        selection: {
          mode: selectionMode,
          total_records: requestData.length,
          selected_records: selectedRequestData.length,
        },
      });
      const response = await fetch(`${API_BASE_URL}/cluster-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      const text = await response.text();
      if (!response.ok) {
        throw new Error(t("Не удалось выполнить кластерный анализ. Проверьте данные и повторите попытку.", "Cluster analysis could not be completed. Check the data and try again."));
      }
      const parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};

      const points = extractPoints(parsed);
      const groups = extractGroups(parsed, points);
      const parsedMetrics = extractMetrics(parsed, points, groups);
      const parsedImportance = extractFeatureImportance(parsed);
      const parsedModelParameters = extractModelParameters(parsed);
      const portfolio = extractPortfolio(parsed);
      const strategies = extractPortfolioStrategies(parsed);
      const summary = extractSummary(parsed);
      const bestAssetsCount = extractBestPortfolioAssetsCount(parsed);

      setClusterData(points);
      setClusterGroups(groups);
      setMetrics(parsedMetrics);
      setFeatureImportance(parsedImportance);
      setModelParameters(parsedModelParameters);
      setOptimalPortfolio(portfolio);
      setPortfolioStrategies(strategies);
      setSummaryInfo(summary);
      setBestPortfolioAssetsCount(bestAssetsCount);

    } catch (e) {
      const message = e instanceof Error ? e.message : t("Не удалось выполнить кластеризацию", "Failed to run clustering");
      showErrorDialog(message);
      setClusterData([]);
      setClusterGroups([]);
      setMetrics([]);
      setFeatureImportance([]);
      setModelParameters({});
      setOptimalPortfolio([]);
      setPortfolioStrategies([]);
      setSummaryInfo(null);
      setBestPortfolioAssetsCount(0);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <>
      <AnalysisPageFrame
      hero={(
        <PageHero
          icon={Network}
          title={t("Кластерный анализ", "Cluster Analysis")}
          description={t(
            "Выберите акции и признаки, чтобы распределить компании по похожим группам.",
            "Select stocks and features to group similar companies.",
          )}
          accent="violet"
        />
      )}
      sidebar={(
        <AnalysisSidebarCard
          icon={Settings}
          title={t("Настройки", "Settings")}
          description={t(
            "Модель, признаки и портфель.",
            "Model, features, and portfolio.",
          )}
          accent="violet"
        >
          <div className="space-y-4">
            <div className="ui-surface-muted">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {t("Источник: загруженные фундаментальные данные", "Source: loaded fundamentals")}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t("Выбрано", "Selected")}: {selectedRequestData.length} / {requestData.length}
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <span>{t("Модель", "Model")}</span>
                  <InfoTooltip label={t("Справка по кластеризации", "Clustering help")} side="right">
                    <div className="space-y-2">
                      <p>
                        <span className="font-semibold">{algorithmHelp.title}: </span>
                        {algorithmHelp.text}
                      </p>
                      <p>{algorithmHelp.note}</p>
                      <div className="grid gap-1.5">
                        <div>
                          <span className="font-semibold">{t("Расстояние", "Distance")}:</span>{" "}
                          {t("определяет, какие акции считаются похожими.", "defines which stocks are considered similar.")}
                        </div>
                        <div>
                          <span className="font-semibold">{t("Масштабирование", "Scaling")}:</span>{" "}
                          {t("выравнивает размерности метрик перед расчетом.", "aligns metric scales before calculation.")}
                        </div>
                        <div>
                          <span className="font-semibold">g:</span>{" "}
                          {t("темпы роста; используются вместе с доступным показателем ROE.", "growth rate used with the available ROE metric.")}
                        </div>
                        <div>
                          <span className="font-semibold">{t("Начальное значение", "Random seed")}:</span>{" "}
                          {t("фиксирует повторяемость результата для алгоритмов со случайным стартом.", "keeps results reproducible for algorithms with random starts.")}
                        </div>
                        <div>
                          <span className="font-semibold">{t("Автоподбор", "Auto-tune")}:</span>{" "}
                          {t("модель подбирает алгоритм, число групп и метрики по выбранному критерию.", "the model tunes the algorithm, group count, and metrics for the selected criterion.")}
                        </div>
                      </div>
                    </div>
                  </InfoTooltip>
                </div>
                <button
                  type="button"
                  onClick={resetClusterSettings}
                  className="ui-secondary-button px-2 py-1 text-xs"
                  title={t("Сбросить параметры", "Reset parameters")}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {t("Сброс", "Reset")}
                </button>
              </div>

              {optimizerSettings.autoModelTuning && (
                <div className="rounded-md border border-violet-200 bg-violet-50/70 p-3 text-xs leading-5 text-violet-900 dark:border-violet-900 dark:bg-violet-950/20 dark:text-violet-200">
                  {t(
                    "Автоподбор параметров модели включен: система сама выберет признаки, количество кластеров и режим кластеризации.",
                    "Model auto-tuning is enabled: the system will choose features, cluster count, and clustering mode automatically.",
                  )}
                </div>
              )}

              {!optimizerSettings.autoModelTuning && !clusterSettings.autoTune && (
                <>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  {t("Алгоритм", "Algorithm")}
                </span>
                <Select
                  value={clusterSettings.algorithm}
                  onValueChange={(value) => updateClusterSettings({ algorithm: value as ClusterAlgorithm })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kmeans">K-Means</SelectItem>
                    <SelectItem value="agglomerative">{t("Иерархический", "Agglomerative")}</SelectItem>
                    <SelectItem value="dbscan">DBSCAN</SelectItem>
                  </SelectContent>
                </Select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  {t("Количество кластеров", "Clusters count")}
                </span>
                <Input
                  type="number"
                  min={2}
                  max={maxClustersCount}
                  value={clusterSettings.clustersCount}
                  onChange={(event) =>
                    updateClusterSettings({
                      clustersCount: Math.max(2, Math.min(Number(event.target.value) || 2, 12)),
                    })
                  }
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  {t("Расстояние", "Distance")}
                </span>
                <Select
                  value={clusterSettings.distanceMetric}
                  onValueChange={(value) => updateClusterSettings({ distanceMetric: value as DistanceMetric })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="euclidean">Euclidean</SelectItem>
                    <SelectItem value="manhattan">Manhattan</SelectItem>
                    <SelectItem value="cosine">Cosine</SelectItem>
                  </SelectContent>
                </Select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  {t("Масштабирование", "Scaling")}
                </span>
                <Select
                  value={clusterSettings.scalingMethod}
                  onValueChange={(value) => updateClusterSettings({ scalingMethod: value as ScalingMethod })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="minmax">MinMax</SelectItem>
                    <SelectItem value="robust">Robust</SelectItem>
                    <SelectItem value="none">{t("Без масштабирования", "No scaling")}</SelectItem>
                  </SelectContent>
                </Select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  {t("Начальное значение", "Random seed")}
                </span>
                <Input
                  type="number"
                  value={clusterSettings.randomState}
                  onChange={(event) =>
                    updateClusterSettings({ randomState: Number(event.target.value) || DEFAULT_CLUSTER_SETTINGS.randomState })
                  }
                />
              </label>

              <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200">
                <Checkbox
                  checked={clusterSettings.includeOutliers}
                  onCheckedChange={(checked) => updateClusterSettings({ includeOutliers: checked === true })}
                />
                <span>{t("Учитывать выбросы", "Include outliers")}</span>
              </label>
                </>
              )}

              {!optimizerSettings.autoModelTuning && (
                <>
                  <label className="flex items-center gap-2 rounded-md border border-violet-200 bg-violet-50/70 px-3 py-2 text-sm text-violet-900 dark:border-violet-900 dark:bg-violet-950/20 dark:text-violet-200">
                    <Checkbox
                      checked={clusterSettings.autoTune}
                      onCheckedChange={(checked) => updateClusterSettings({ autoTune: checked === true })}
                    />
                    <span>{t("Автоподбор", "Auto-tune")}</span>
                  </label>

                  {clusterSettings.autoTune && (
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block space-y-1.5">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          {t("Критерий", "Metric")}
                        </span>
                        <Select
                          value={clusterSettings.tuningMetric}
                          onValueChange={(value) => updateClusterSettings({ tuningMetric: value as ClusterTuningMetric })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="silhouette">{t("Качество разделения кластеров", "Cluster separation quality")}</SelectItem>
                            <SelectItem value="davies_bouldin">Davies-Bouldin</SelectItem>
                            <SelectItem value="calinski_harabasz">Calinski-Harabasz</SelectItem>
                          </SelectContent>
                        </Select>
                      </label>
                      <label className="block space-y-1.5">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          {t("Режим подбора", "Tuning mode")}
                        </span>
                        <Select
                          value={clusterSettings.tuningBudget}
                          onValueChange={(value) => updateClusterSettings({ tuningBudget: value as TuningBudget })}
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
                {CLUSTER_FEATURE_OPTIONS.map((option) => {
                  const checked = clusterSettings.features.includes(option.key);
                  const label = isEn ? option.labelEn : option.labelRu;
                  return (
                    <label
                      key={option.key}
                      className="flex min-h-10 items-center gap-2 rounded-md border border-slate-200 px-2 py-2 text-xs text-slate-700 dark:border-slate-700 dark:text-slate-200"
                    >
                      <Checkbox
                        checked={checked}
                        disabled={checked && clusterSettings.features.length <= 2}
                        onCheckedChange={() => toggleClusterFeature(option.key)}
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
              onClick={runClusterAnalysis}
              disabled={!canRunClusterAnalysis}
              className="ui-primary-button w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700"
            >
              <Play className="h-5 w-5" />
              {isRunning ? t("Выполняется...", "Running...") : t("Запустить анализ", "Run Analysis")}
            </button>
          </div>
        </AnalysisSidebarCard>
      )}
    >
          <SectionCard
            title={t("Состав выборки", "Stock Universe")}
            description={t(
              "Можно запустить анализ по всем данным или оставить только нужные акции.",
              "Run analysis on all loaded data or keep only the stocks you need.",
            )}
            action={(
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectionMode("all")}
                  className={`ui-secondary-button px-3 py-2 text-xs ${
                    selectionMode === "all" ? "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-950/30 dark:text-violet-200" : ""
                  }`}
                >
                  <Square className="h-4 w-4" />
                  {t("Все данные", "All data")}
                </button>
                <button
                  type="button"
                  onClick={setManualSelectionMode}
                  className={`ui-secondary-button px-3 py-2 text-xs ${
                    selectionMode === "manual" ? "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-950/30 dark:text-violet-200" : ""
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
                  <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">{clusterSettings.features.length}</div>
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

              {!hasValidClusterInput && hasData && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300">
                  {t(
                    "Для запуска нужны минимум две выбранные акции, два признака и количество кластеров не больше числа выбранных акций.",
                    "To run, select at least two stocks, two features, and no more clusters than selected stocks.",
                  )}
                </div>
              )}
            </div>
          </SectionCard>

          {isRunning && (
            <>
              <AnalysisRunningIndicator
                title={t("Выполняем кластеризацию", "Running clustering")}
                subtitle={t("Подбираем структуру кластеров и оптимальный портфель", "Estimating clusters and optimal portfolio")}
                accentClassName="text-purple-600"
              />
              <AnalysisLoadingPreview
                accentClassName="text-purple-600"
                metricCount={4}
                metricsTitle={t("Готовим сводку", "Preparing summary")}
                metricsDescription={t("Считаем метрики качества кластеров и портфеля.", "Calculating cluster quality and portfolio metrics.")}
                chartsTitle={t("Строим визуализации", "Building visualizations")}
                chartsDescription={t("Появятся значимость признаков и карта кластеров P/E vs g.", "Feature significance and the P/E vs g cluster map will appear here.")}
                charts={[
                  {
                    title: t("Значимость признаков", "Feature significance"),
                    subtitle: t("Оцениваем вклад признаков в разделение компаний.", "Estimating feature contribution to company separation."),
                    variant: "bars",
                  },
                  {
                    title: t("Карта кластеров P/E vs g", "Cluster map P/E vs g"),
                    subtitle: t("Готовим точки компаний и подписи осей.", "Preparing company points and axis labels."),
                    variant: "scatter",
                  },
                ]}
                tableTitle={t("Готовим таблицу компаний", "Preparing company table")}
                tableDescription={t("Скоро здесь появятся кластеры, признаки и портфельные веса.", "Clusters, features, and portfolio weights will appear here shortly.")}
                tableRows={8}
                tableColumns={7}
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
            <SectionCard title={t("\u041f\u0430\u0440\u0430\u043c\u0435\u0442\u0440\u044b \u043c\u043e\u0434\u0435\u043b\u0438", "Model Parameters")}>
              <div className="ui-table-shell overflow-x-auto">
                <table className="ui-data-table">
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
              title={t("Значимость признаков кластеризации", "Clustering Feature Significance")}
              description={t(
                "Чем выше доля, тем сильнее признак разделял центры кластеров в итоговой модели.",
                "Higher values mean the feature separated cluster centers more strongly in the final model.",
              )}
            >
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.6fr)]">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={featureImportance} layout="vertical" margin={{ top: 5, right: 30, left: 90, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" stroke="#64748b" unit="%" />
                    <YAxis type="category" dataKey="feature" stroke="#64748b" width={90} />
                    <Tooltip formatter={(v: number) => `${Number(v).toFixed(2)}%`} />
                    <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                      {featureImportance.map((row, idx) => (
                        <Cell key={row.feature} fill={CLUSTER_PALETTE[idx % CLUSTER_PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="space-y-3">
                  {featureImportance.slice(0, 4).map((row, index) => (
                    <div key={row.feature} className="ui-stat-card">
                      <div className="text-xs text-slate-500 dark:text-slate-400">#{index + 1}</div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{row.feature}</div>
                      <div className="text-sm text-slate-600 dark:text-slate-300">{row.importance.toFixed(2)}%</div>
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>
          )}
          {summaryInfo && (
            <SectionCard
              title={t("\u0421\u0432\u043e\u0434\u043a\u0430 \u043f\u043e \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442\u0443", "Result Summary")}
              action={(
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={exportAnalysisToXlsx}
                    disabled={!clusterData.length}
                    className="ui-secondary-button px-3 py-2 text-xs"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    XLSX
                  </button>
                  <button
                    onClick={exportAnalysisToPdf}
                    disabled={!clusterData.length}
                    className="ui-secondary-button px-3 py-2 text-xs"
                  >
                    <FileText className="h-4 w-4" />
                    PDF
                  </button>
                </div>
              )}
            >
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                  <div className="ui-stat-card">
                    <div className="text-slate-500 dark:text-slate-400">{t("Компаний", "Companies")}</div>
                    <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">{summaryInfo.companiesCount}</div>
                  </div>
                  <div className="ui-stat-card">
                    <div className="text-slate-500 dark:text-slate-400">{t("Кластеров", "Clusters")}</div>
                    <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">{summaryInfo.clustersCount}</div>
                  </div>
                </div>

                {!!summaryInfo.clusterDistribution.length && (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={summaryInfo.clusterDistribution} margin={{ top: 10, right: 20, left: 18, bottom: 32 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="cluster"
                          stroke="#64748b"
                          label={{ value: t("\u041a\u043b\u0430\u0441\u0442\u0435\u0440", "Cluster"), position: "insideBottom", offset: -10 }}
                        />
                        <YAxis
                          stroke="#64748b"
                          label={{ value: t("\u041a\u043e\u043c\u043f\u0430\u043d\u0438\u0439", "Companies"), angle: -90, position: "insideLeft" }}
                        />
                        <Tooltip />
                        <Bar dataKey="count">
                          {summaryInfo.clusterDistribution.map((entry) => (
                            <Cell key={entry.cluster} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {!!clusterGroups.length && (
            <SectionCard
              title={t("Кластеры и профили", "Clusters and Profiles")}
              description={t(
                "Краткий профиль по каждому найденному кластеру.",
                "Quick profile for each detected cluster.",
              )}
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {clusterGroups.map((cluster) => (
                  <div key={cluster.name} className="ui-metric-card">
                    <div className="mb-3 flex items-center gap-3">
                      <div className="h-4 w-4 rounded-full" style={{ backgroundColor: cluster.color }} />
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100">{cluster.name}</h3>
                        <p className="text-xs text-slate-600 dark:text-slate-300">{cluster.description}</p>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-600 dark:text-slate-400">{t("Компаний:", "Companies:")}</span>
                        <span className="font-medium text-slate-900 dark:text-slate-100">{cluster.count}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-600 dark:text-slate-400">{t("Средний P/E:", "Average P/E:")}</span>
                        <span className="font-medium text-blue-600 dark:text-blue-400">{cluster.avgPE.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-600 dark:text-slate-400">{t("\u0421\u0440\u0435\u0434\u043d\u0438\u0439 g:", "Average g:")}</span>
                        <span className="font-medium text-green-600 dark:text-green-400">{cluster.avgG.toFixed(2)}%</span>
                      </div>
                      {typeof cluster.avgROE === "number" && Number.isFinite(cluster.avgROE) && (
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-600 dark:text-slate-400">ROE:</span>
                          <span className="font-medium text-slate-900 dark:text-slate-100">{cluster.avgROE.toFixed(2)}%</span>
                        </div>
                      )}
                      {typeof cluster.avgDividendYield === "number" && Number.isFinite(cluster.avgDividendYield) && (
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-600 dark:text-slate-400">Div yield:</span>
                          <span className="font-medium text-slate-900 dark:text-slate-100">{cluster.avgDividendYield.toFixed(2)}%</span>
                        </div>
                      )}
                      {typeof cluster.avgRisk === "number" && Number.isFinite(cluster.avgRisk) && (
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-600 dark:text-slate-400">Risk:</span>
                          <span className="font-medium text-slate-900 dark:text-slate-100">{cluster.avgRisk.toFixed(2)}</span>
                        </div>
                      )}
                      {cluster.recommendation && (
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-600 dark:text-slate-400">Recommendation:</span>
                          <span className="font-medium text-slate-900 dark:text-slate-100">{cluster.recommendation}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          <SectionCard
            title={t("Визуализация кластеров (P/E vs g)", "Cluster Visualization (P/E vs g)")}
            description={t(
              "Сравнение компаний по мультипликатору и темпу роста внутри найденных кластеров.",
              "Compare companies by valuation and growth across the detected clusters.",
            )}
          >
            {!!clusterSeries.length && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {clusterSeries.map((series) => (
                  <div key={series.cluster} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: series.color }} />
                    <span>{series.name}</span>
                  </div>
                ))}
              </div>
            )}
            <ResponsiveContainer width="100%" height={460}>
              <ScatterChart margin={{ top: 20, right: 36, left: 28, bottom: 42 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  type="number"
                  dataKey="pe"
                  name="P/E"
                  stroke="#64748b"
                  label={{ value: "P/E", position: "insideBottom", offset: -14 }}
                />
                <YAxis
                  type="number"
                  dataKey="g"
                  name="g/ROE"
                  unit="%"
                  stroke="#64748b"
                  label={{ value: t("g / ROE, %", "g / ROE, %"), angle: -90, position: "insideLeft" }}
                />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={({ payload }) => {
                    if (!payload || !payload.length) {
                      return null;
                    }
                    const data = payload[0].payload as ClusterPoint;
                    return (
                      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                        <p className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">{data.ticker}</p>
                        <p className="text-sm text-slate-600 dark:text-slate-300">P/E: {data.pe.toFixed(2)}</p>
                        <p className="text-sm text-slate-600 dark:text-slate-300">g: {data.g.toFixed(2)}%</p>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          {t("Дивидендная оценка", "Dividend score")}: {formatOptionalNumber(data.dividendScore, 2)}%
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          {t("Лет выплат", "Years paid")}: {formatOptionalNumber(data.dividendYearsCount, 0)}
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-300">{data.label}</p>
                      </div>
                    );
                  }}
                />
                {clusterSeries.map((series) => (
                  <Scatter
                    key={series.cluster}
                    name={series.name}
                    data={series.points}
                    fill={series.color}
                    stroke={series.color}
                    fillOpacity={0.86}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </SectionCard>
            </>
          )}

          {(!!displayPortfolio.length || bestPortfolioAssetsCount > 0) && (
            <SectionCard
              title={t("Оптимальный портфель из кластерного анализа", "Optimal Portfolio from Cluster Analysis")}
              description={(
                <div className="space-y-1">
                  <div>{getOptimizationSummary(optimizerSettings, isEn)}</div>
                  {bestPortfolioAssetsCount > 0 && (
                    <div>
                      {t("Количество активов в портфеле:", "Assets in portfolio:")}{" "}
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{bestPortfolioAssetsCount}</span>
                    </div>
                  )}
                </div>
              )}
              action={(
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={exportPortfolioToXlsx}
                    disabled={!displayPortfolio.length}
                    className="ui-secondary-button px-3 py-2 text-xs"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    XLSX
                  </button>
                  <button
                    onClick={exportPortfolioToPdf}
                    disabled={!displayPortfolio.length}
                    className="ui-secondary-button px-3 py-2 text-xs"
                  >
                    <FileText className="h-4 w-4" />
                    PDF
                  </button>
                  <button
                    onClick={savePortfolioChartPng}
                    disabled={!displayPortfolio.length}
                    className="ui-secondary-button px-3 py-2 text-xs"
                  >
                    <ImageDown className="h-4 w-4" />
                    PNG
                  </button>
                  <SavePortfolioButton
                    holdings={displayPortfolio}
                    metrics={portfolioMetrics.map((metric) => ({
                      label: localizeMetricLabel(metric.label, isEn),
                      value: formatMetricDisplay(metric.label, metric.value),
                      rawValue: metric.value,
                    }))}
                    sourceKey="cluster"
                    sourceLabel={t("Кластерный анализ", "Cluster Analysis")}
                    assetClass="stock"
                    defaultName={t("Портфель кластерного анализа", "Cluster Analysis Portfolio")}
                    shares={cache.shares}
                    fundamentalsByFigi={cache.fundamentalsByFigi}
                    disabled={!displayPortfolio.length}
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
              {!!displayPortfolio.length && (
                <PortfolioHoldingsPanel
                  rows={displayPortfolio}
                  palette={CLUSTER_PALETTE}
                  chartRef={portfolioChartRef}
                  companyLabel={t("Акция", "Stock")}
                  weightLabel={t("Вес, %", "Weight, %")}
                />
              )}
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
