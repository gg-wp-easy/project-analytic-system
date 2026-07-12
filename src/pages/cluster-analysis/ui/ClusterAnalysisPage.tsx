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
import { OptimizerSettingsFields, submitOptimizerSettings, useOptimizerSettings } from "../../../features/optimizer-settings";
import { PortfolioSimulationPanel } from "../../../features/portfolio-simulation";
import { API_BASE_URL } from "../../../config";
import type {
  ClusterAnalysisSummary as AnalysisSummary,
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

const palette = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#14b8a6", "#f97316"];
const CLUSTER_STATE_KEY = "cluster-analysis-state-v2";

type SelectionMode = "all" | "manual";
type ClusterAlgorithm = "kmeans" | "agglomerative" | "dbscan";
type DistanceMetric = "euclidean" | "manhattan" | "cosine";
type ScalingMethod = "standard" | "minmax" | "robust" | "none";
type ClusterTuningMetric = "silhouette" | "davies_bouldin" | "calinski_harabasz";
type TuningBudget = "fast" | "balanced" | "quality";

type ClusterAnalysisSettings = {
  algorithm: ClusterAlgorithm;
  clustersCount: number;
  distanceMetric: DistanceMetric;
  scalingMethod: ScalingMethod;
  randomState: number;
  includeOutliers: boolean;
  autoTune: boolean;
  tuningMetric: ClusterTuningMetric;
  tuningBudget: TuningBudget;
  features: string[];
};

const clusterFeatureOptions = [
  { key: "g", labelRu: "g / темпы роста", labelEn: "g / growth rate" },
  { key: "pe_ratio", labelRu: "P/E", labelEn: "P/E" },
  { key: "pb_ratio", labelRu: "P/B", labelEn: "P/B" },
  { key: "ps_ratio", labelRu: "P/S", labelEn: "P/S" },
  { key: "ev_to_ebitda", labelRu: "EV/EBITDA", labelEn: "EV/EBITDA" },
  { key: "roe", labelRu: "ROE", labelEn: "ROE" },
  { key: "roa", labelRu: "ROA", labelEn: "ROA" },
  { key: "net_margin", labelRu: "Маржа", labelEn: "Margin" },
  { key: "dividend_yield", labelRu: "Дивиденды", labelEn: "Dividend yield" },
  { key: "market_cap_bn", labelRu: "Капитализация", labelEn: "Market cap" },
  { key: "beta", labelRu: "Beta", labelEn: "Beta" },
] as const;

const defaultClusterSettings: ClusterAnalysisSettings = {
  algorithm: "kmeans",
  clustersCount: 4,
  distanceMetric: "euclidean",
  scalingMethod: "standard",
  randomState: 42,
  includeOutliers: true,
  autoTune: true,
  tuningMetric: "silhouette",
  tuningBudget: "balanced",
  features: ["g", "pe_ratio", "pb_ratio", "ev_to_ebitda", "roe", "net_margin", "dividend_yield"],
};

function getClusterColor(cluster: number): string {
  const safeCluster = Number.isFinite(cluster) ? Math.abs(Math.trunc(cluster)) : 0;
  return palette[safeCluster % palette.length];
}

function formatMetric(value: unknown): string {
  if (typeof value === "number") {
    if (Math.abs(value) >= 1000) {
      return value.toFixed(0);
    }
    return value.toFixed(4);
  }
  return String(value);
}

function firstObject(source: unknown[]): Record<string, unknown> {
  const found = source.find((item) => item && typeof item === "object");
  return (found as Record<string, unknown>) ?? {};
}

function extractPortfolioRowsFromTopPositions(
  topPositions: unknown,
  metrics?: Record<string, unknown>,
): PortfolioRow[] {
  if (!Array.isArray(topPositions)) {
    return [];
  }

  const rows = topPositions.map((item, index) => {
    const row = item as Record<string, unknown>;
    return {
      figi: String(row.figi ?? row.FIGI ?? row.instrumentFigi ?? ""),
      ticker: String(row.ticker ?? row.Ticker ?? row.symbol ?? `Asset ${index + 1}`),
      name: String(row.name ?? row.Name ?? ""),
      weight: numberOr(row.weight, numberOr(row.Weight, numberOr(row.allocation, numberOr(row.share, 0)))),
      expectedReturn: numberOr(
        row.expected_return,
        numberOr(row.Expected_Return, numberOr(metrics?.expected_return, numberOr(metrics?.return, NaN))),
      ),
      risk: numberOr(row.risk, numberOr(row.Risk, numberOr(metrics?.risk, numberOr(metrics?.volatility, NaN)))),
      sharpe: numberOr(row.sharpe, numberOr(row.sharpe_ratio, numberOr(metrics?.sharpe, numberOr(metrics?.sharpe_ratio, NaN)))),
      sortino: numberOr(row.sortino, numberOr(metrics?.sortino, NaN)),
      value_at_risk: numberOr(row.value_at_risk, numberOr(metrics?.value_at_risk, NaN)),
    } satisfies PortfolioRow;
  });

  return normalizeWeights(rows);
}

function readAssetsCount(source: Record<string, unknown>): number {
  return numberOr(
    source.assets_count,
    numberOr(
      source.assetsCount,
      numberOr(
        source.positions_count,
        numberOr(source.positionsCount, numberOr(source.portfolio_size, numberOr(source.count, 0))),
      ),
    ),
  );
}

function extractPoints(parsed: Record<string, unknown>): ClusterPoint[] {
  const pointsSource = Array.isArray(parsed.points)
    ? parsed.points
    : Array.isArray(parsed.data)
      ? parsed.data
      : Array.isArray(parsed.clusters)
        ? parsed.clusters
        : Array.isArray(parsed.companies)
          ? parsed.companies
        : [];

  return pointsSource
    .map((item, index) => {
      const row = item as Record<string, unknown>;
      const cluster = numberOr(
        row.cluster,
        numberOr(
          row.cluster_id,
          numberOr(row.clusterId, numberOr(row.cluster_label, numberOr(row.group, numberOr(row.Cluster, 0)))),
        ),
      );
      const color = getClusterColor(cluster);
      return {
        ticker: String(row.ticker ?? row.Ticker ?? row.name ?? row.Company ?? `Asset ${index + 1}`),
        figi: String(row.figi ?? row.id ?? index),
        pe: numberOr(row.pe, numberOr(row.pe_ratio, numberOr(row.peRatio, numberOr(row.PE, numberOr(row["P/E"], 0))))),
        g: numberOr(
          row.g,
          numberOr(
            row.roe,
            numberOr(
              row.ROE,
              numberOr(row.growth, numberOr(row.Expected_Return, numberOr(row.dividend_yield, numberOr(row.dividendYield, 0)))),
            ),
          ),
        ),
        cluster,
        color,
        label: String(row.label ?? `Кластер ${cluster + 1}`),
      } satisfies ClusterPoint;
    })
    .filter((p) => Number.isFinite(p.pe) && Number.isFinite(p.g));
}

function extractGroups(parsed: Record<string, unknown>, points: ClusterPoint[]): ClusterGroup[] {
  const profilesSource = Array.isArray(parsed.cluster_profiles) ? parsed.cluster_profiles : [];
  if (profilesSource.length > 0) {
    return profilesSource.map((item, index) => {
      const row = item as Record<string, unknown>;
      const cluster = numberOr(
        row.cluster,
        numberOr(row.cluster_id, numberOr(row.clusterId, numberOr(row.group, index))),
      );

      const count = numberOr(
        row.count,
        numberOr(row.size, numberOr(row.companies_count, points.filter((p) => p.cluster === cluster).length)),
      );

      const avgPE = numberOr(
        row.avg_pe,
        numberOr(row.avgPE, numberOr(row.mean_pe, numberOr(row.pe_mean, 0))),
      );
      const avgG = numberOr(
        row.avg_g,
        numberOr(row.avg_roe, numberOr(row.avgROE, numberOr(row.g_mean, numberOr(row.mean_growth, 0)))),
      );

      return {
        name: String(row.name ?? row.label ?? `Кластер ${cluster + 1}`),
        count,
        avgPE,
        avgG,
        color: getClusterColor(cluster),
        description: String(row.description ?? "Результат серверной кластеризации (k-means)"),
      } satisfies ClusterGroup;
    });
  }

  const groupsMap = new Map<number, ClusterPoint[]>();
  points.forEach((point) => {
    const current = groupsMap.get(point.cluster) ?? [];
    current.push(point);
    groupsMap.set(point.cluster, current);
  });

  return Array.from(groupsMap.entries()).map(([cluster, pointsInCluster]) => {
    const avgPE = pointsInCluster.reduce((acc, p) => acc + p.pe, 0) / pointsInCluster.length;
    const avgG = pointsInCluster.reduce((acc, p) => acc + p.g, 0) / pointsInCluster.length;
    return {
      name: `Кластер ${cluster + 1}`,
      count: pointsInCluster.length,
      avgPE,
      avgG,
      color: getClusterColor(cluster),
      description: "Результат серверной кластеризации (k-means)",
    };
  });
}

function extractMetrics(parsed: Record<string, unknown>, points: ClusterPoint[], groups: ClusterGroup[]): MetricItem[] {
  const summaryObj = (parsed.summary as Record<string, unknown> | undefined) ?? {};
  const bestPortfolioObj = (summaryObj.best_portfolio as Record<string, unknown> | undefined) ?? {};
  const bestMetrics = bestPortfolioObj.metrics as Record<string, unknown> | undefined;

  const metricsObj =
    bestMetrics ??
    (parsed.metrics as Record<string, unknown> | undefined) ??
    (parsed.model_metrics as Record<string, unknown> | undefined) ??
    (parsed.stats as Record<string, unknown> | undefined) ??
    summaryObj ??
    {};

  const collected: MetricItem[] = [];
  const candidates: Array<{ key: string; label: string }> = [
    { key: "silhouette", label: "Качество кластеров" },
    { key: "silhouette_score", label: "Качество кластеров" },
    { key: "davies_bouldin", label: "Davies-Bouldin" },
    { key: "calinski_harabasz", label: "Calinski-Harabasz" },
    { key: "inertia", label: "Inertia" },
    { key: "score", label: "Model score" },
    { key: "expected_return", label: "Expected return" },
    { key: "risk", label: "Risk" },
    { key: "volatility", label: "Volatility" },
    { key: "sharpe", label: "Sharpe" },
    { key: "sharpe_ratio", label: "Sharpe ratio" },
    { key: "diversification_score", label: "Diversification" },
  ];

  for (const item of candidates) {
    if (item.key in metricsObj) {
      collected.push({ label: item.label, value: formatMetric(metricsObj[item.key]) });
    }
  }

  collected.unshift(
    { label: "Кластеров", value: String(groups.length) },
    { label: "Активов", value: String(points.length) },
  );

  return collected;
}

function extractPortfolioStrategies(parsed: Record<string, unknown>): StrategyPortfolio[] {
  const fromPortfolios = parsed.portfolios;
  const strategies: StrategyPortfolio[] = [];

  if (fromPortfolios && typeof fromPortfolios === "object" && !Array.isArray(fromPortfolios)) {
    for (const [name, rawValue] of Object.entries(fromPortfolios as Record<string, unknown>)) {
      if (!rawValue || typeof rawValue !== "object") {
        continue;
      }
      const portfolio = rawValue as Record<string, unknown>;
      const metrics = (portfolio.metrics as Record<string, unknown> | undefined) ?? {};
      const rows = extractPortfolioRowsFromTopPositions(portfolio.top_positions, metrics);
      strategies.push({
        name: String(portfolio.name ?? name),
        expectedReturn: numberOr(metrics.expected_return, 0),
        risk: numberOr(metrics.risk, 0),
        sharpe: numberOr(metrics.sharpe_ratio, numberOr(metrics.sharpe, 0)),
        diversification: numberOr(metrics.diversification_score, 0),
        rows,
        assetsCount: readAssetsCount(portfolio) || rows.length,
      });
    }
  }

  return strategies.sort((a, b) => b.sharpe - a.sharpe);
}

function extractBestPortfolioAssetsCount(parsed: Record<string, unknown>): number {
  const summary = (parsed.summary as Record<string, unknown> | undefined) ?? {};
  const bestPortfolio = (summary.best_portfolio as Record<string, unknown> | undefined) ?? {};
  return readAssetsCount(bestPortfolio);
}

function extractSummary(parsed: Record<string, unknown>): AnalysisSummary | null {
  const summary = (parsed.summary as Record<string, unknown> | undefined) ?? null;
  if (!summary) {
    return null;
  }

  const rawDistribution = (summary.cluster_distribution as Record<string, unknown> | undefined) ?? {};
  const clusterDistribution = Object.entries(rawDistribution).map(([cluster, value], index) => ({
    cluster: `Кластер ${Number(cluster) + 1}`,
    count: numberOr(value, 0),
    color: getClusterColor(numberOr(cluster, index)),
  }));

  return {
    companiesCount: numberOr(summary.companies_count, 0),
    clustersCount: numberOr(summary.clusters_count, clusterDistribution.length),
    portfoliosCount: numberOr(summary.portfolios_count, 0),
    clusterDistribution,
  };
}

function extractPortfolio(parsed: Record<string, unknown>): PortfolioRow[] {
  const summary = (parsed.summary as Record<string, unknown> | undefined) ?? {};
  const bestPortfolio = (summary.best_portfolio as Record<string, unknown> | undefined) ?? {};
  const bestMetrics = (bestPortfolio.metrics as Record<string, unknown> | undefined) ?? {};
  const fromBestPositions = extractPortfolioRowsFromTopPositions(bestPortfolio.positions, bestMetrics);
  const fromBestTopPositions = extractPortfolioRowsFromTopPositions(bestPortfolio.top_positions, bestMetrics);
  const fromBest = fromBestPositions.length ? fromBestPositions : fromBestTopPositions;
  if (fromBest.length) {
    return fromBest;
  }

  const portfolios = Array.isArray(parsed.portfolios) ? parsed.portfolios : [];
  if (portfolios.length) {
    const first = firstObject(portfolios);
    const fromWeights =
      first.weights ??
      first.optimal_weights ??
      first.portfolio ??
      first.best_portfolio;

    if (fromWeights && typeof fromWeights === "object") {
      const rows = Object.entries(fromWeights as Record<string, unknown>).map(([ticker, rawWeight]) => ({
        ticker,
        name: ticker,
        weight: numberOr(rawWeight, 0),
        expectedReturn: numberOr(first.expected_return, numberOr(first.return, NaN)),
        risk: numberOr(first.risk, numberOr(first.volatility, NaN)),
        sharpe: numberOr(first.sharpe, NaN),
        sortino: numberOr(first.sortino, NaN),
        value_at_risk: numberOr(first.value_at_risk, NaN),
      }));
      return normalizeWeights(rows);
    }
  }

  const portfolioCandidate =
    parsed.optimal_portfolio ??
    parsed.portfolio ??
    parsed.best_portfolio ??
    parsed.optimal_weights ??
    parsed.weights;

  if (Array.isArray(portfolioCandidate)) {
    const rows = portfolioCandidate.map((item, index) => {
      const row = item as Record<string, unknown>;
      const ticker = String(row.ticker ?? row.asset ?? row.symbol ?? `Asset ${index + 1}`);
      const weight = numberOr(row.weight, numberOr(row.allocation, numberOr(row.share, 0)));
      return {
        figi: String(row.figi ?? row.FIGI ?? row.instrumentFigi ?? ""),
        ticker,
        name: String(row.name ?? row.company ?? row.Company ?? ticker),
        weight,
        expectedReturn: numberOr(row.expected_return, numberOr(row.return, NaN)),
        risk: numberOr(row.risk, numberOr(row.volatility, NaN)),
        sharpe: numberOr(row.sharpe, NaN),
        sortino: numberOr(row.sortino, NaN),
        value_at_risk: numberOr(row.value_at_risk, NaN),
      };
    });
    return normalizeWeights(rows);
  }

  if (portfolioCandidate && typeof portfolioCandidate === "object") {
    const entries = Object.entries(portfolioCandidate as Record<string, unknown>).filter(
      ([, value]) => typeof value === "number" || typeof value === "string",
    );
    const rows = entries.map(([ticker, rawWeight]) => ({ ticker, name: ticker, weight: numberOr(rawWeight, 0) }));
    return normalizeWeights(rows);
  }

  return [];
}

function normalizeWeights(rows: PortfolioRow[]): PortfolioRow[] {
  if (!rows.length) {
    return [];
  }
  const max = Math.max(...rows.map((r) => r.weight));
  const scaled = max <= 1 ? rows.map((r) => ({ ...r, weight: r.weight * 100 })) : rows;
  return scaled.sort((a, b) => b.weight - a.weight);
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
  const [optimalPortfolio, setOptimalPortfolio] = useState<PortfolioRow[]>([]);
  const [portfolioStrategies, setPortfolioStrategies] = useState<StrategyPortfolio[]>([]);
  const [summaryInfo, setSummaryInfo] = useState<AnalysisSummary | null>(null);
  const [bestPortfolioAssetsCount, setBestPortfolioAssetsCount] = useState(0);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("all");
  const [selectedFigis, setSelectedFigis] = useState<string[]>([]);
  const [stockSearch, setStockSearch] = useState("");
  const [clusterSettings, setClusterSettings] = useState<ClusterAnalysisSettings>(defaultClusterSettings);
  const portfolioChartRef = useRef<HTMLDivElement | null>(null);
  const visibleMetrics = useMemo(() => metrics.filter((item) => isVisibleAnalysisMetric(item.label)), [metrics]);
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
      if (Array.isArray(parsed.optimalPortfolio)) setOptimalPortfolio(parsed.optimalPortfolio);
      if (Array.isArray(parsed.portfolioStrategies)) setPortfolioStrategies(parsed.portfolioStrategies);
      if (parsed.summaryInfo && typeof parsed.summaryInfo === "object") setSummaryInfo(parsed.summaryInfo);
      if (typeof parsed.bestPortfolioAssetsCount === "number") setBestPortfolioAssetsCount(parsed.bestPortfolioAssetsCount);
      if (parsed.selectionMode === "all" || parsed.selectionMode === "manual") setSelectionMode(parsed.selectionMode);
      if (Array.isArray(parsed.selectedFigis)) setSelectedFigis(parsed.selectedFigis.filter((figi) => typeof figi === "string"));
      if (parsed.clusterSettings && typeof parsed.clusterSettings === "object") {
        setClusterSettings({
          ...defaultClusterSettings,
          ...parsed.clusterSettings,
          clustersCount: numberOr(parsed.clusterSettings.clustersCount, defaultClusterSettings.clustersCount),
          randomState: numberOr(parsed.clusterSettings.randomState, defaultClusterSettings.randomState),
          features: Array.isArray(parsed.clusterSettings.features)
            ? parsed.clusterSettings.features.filter((item) => typeof item === "string")
            : defaultClusterSettings.features,
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
    optimalPortfolio,
    portfolioStrategies,
    summaryInfo,
    bestPortfolioAssetsCount,
    selectionMode,
    selectedFigis,
    clusterSettings,
  ]);

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
      clusterFeatureOptions
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
          "Число кластеров может игнорироваться серверной реализацией DBSCAN.",
          "Clusters count may be ignored by the server-side DBSCAN implementation.",
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
    selectedRequestData.length >= Math.max(2, Math.min(clusterSettings.clustersCount, 12)) &&
    clusterSettings.features.length >= 2;
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
    setClusterSettings(defaultClusterSettings);
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
      await submitOptimizerSettings(optimizerSettings);
      const sanitizedClustersCount = Math.max(2, Math.min(clusterSettings.clustersCount, selectedRequestData.length));
      const selectedTickers = selectedRequestData.map((row) => row.ticker);
      const selectedFigisForRequest = selectedRequestData.map((row) => row.figi);
      const body = JSON.stringify({
        data: selectedRequestData,
        parameters: {
          algorithm: clusterSettings.algorithm,
          n_clusters: sanitizedClustersCount,
          clusters_count: sanitizedClustersCount,
          distance_metric: clusterSettings.distanceMetric,
          scaling_method: clusterSettings.scalingMethod,
          standardize: clusterSettings.scalingMethod !== "none",
          random_state: clusterSettings.randomState,
          include_outliers: clusterSettings.includeOutliers,
          auto_tune: clusterSettings.autoTune,
          tuning_metric: clusterSettings.tuningMetric,
          tuning_budget: clusterSettings.tuningBudget,
          tuning_scope: "cluster_analysis",
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
      const parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}${text ? `: ${text}` : ""}`);
      }

      const points = extractPoints(parsed);
      const groups = extractGroups(parsed, points);
      const parsedMetrics = extractMetrics(parsed, points, groups);
      const portfolio = extractPortfolio(parsed);
      const strategies = extractPortfolioStrategies(parsed);
      const summary = extractSummary(parsed);
      const bestAssetsCount = extractBestPortfolioAssetsCount(parsed);

      setClusterData(points);
      setClusterGroups(groups);
      setMetrics(parsedMetrics);
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
            "Выберите акции, настройте признаки и запустите серверную кластеризацию по нужной выборке.",
            "Select stocks, tune features, and run server-side clustering for the chosen universe.",
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
                {t("Источник: кэш фундаментальных данных", "Source: fundamentals cache")}
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
                          {t("темпы роста; в текущем кэше передаются через доступный ROE-показатель.", "growth rate; in the current cache it is sent through the available ROE metric.")}
                        </div>
                        <div>
                          <span className="font-semibold">Random state:</span>{" "}
                          {t("фиксирует повторяемость результата для алгоритмов со случайным стартом.", "keeps results reproducible for algorithms with random starts.")}
                        </div>
                        <div>
                          <span className="font-semibold">{t("Автоподбор", "Auto-tune")}:</span>{" "}
                          {t("сервер подбирает алгоритм, число кластеров и метрики в выбранном режиме.", "the server tunes algorithm, cluster count, and metrics in the selected mode.")}
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

              {!clusterSettings.autoTune && (
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
                  Random state
                </span>
                <Input
                  type="number"
                  value={clusterSettings.randomState}
                  onChange={(event) =>
                    updateClusterSettings({ randomState: Number(event.target.value) || defaultClusterSettings.randomState })
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
                {clusterFeatureOptions.map((option) => {
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
              "Можно запустить анализ по всему кэшу или вручную оставить только нужные акции.",
              "Run analysis on the full cache or keep only the stocks you need.",
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
                  {t("Весь кэш", "All cache")}
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
            <AnalysisRunningIndicator
              title={t("Выполняем кластеризацию", "Running clustering")}
              subtitle={t("Подбираем структуру кластеров и оптимальный портфель", "Estimating clusters and optimal portfolio")}
              accentClassName="text-purple-600"
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

          {summaryInfo && (
            <SectionCard title={t("Сводка по результату", "Result Summary")}>
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
                      <BarChart data={summaryInfo.clusterDistribution}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="cluster" stroke="#64748b" />
                        <YAxis stroke="#64748b" />
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
                        <span className="text-slate-600 dark:text-slate-400">{t("Средний g:", "Average g:")}</span>
                        <span className="font-medium text-green-600 dark:text-green-400">{cluster.avgG.toFixed(2)}%</span>
                      </div>
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
              <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" dataKey="pe" name="P/E" stroke="#64748b" />
                <YAxis type="number" dataKey="g" name="g/ROE" unit="%" stroke="#64748b" />
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

          {(!!displayPortfolio.length || bestPortfolioAssetsCount > 0) && (
            <SectionCard
              title={t("Оптимальный портфель из кластерного анализа", "Optimal Portfolio from Cluster Analysis")}
              description={
                bestPortfolioAssetsCount > 0
                  ? (
                      <>
                        {t("Количество активов в портфеле:", "Assets in portfolio:")}{" "}
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{bestPortfolioAssetsCount}</span>
                      </>
                    )
                  : undefined
              }
              action={(
                <div className="flex items-center gap-2">
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
                </div>
              )}
            >
              {!!displayPortfolio.length && (
                <PortfolioHoldingsPanel
                  rows={displayPortfolio}
                  palette={palette}
                  chartRef={portfolioChartRef}
                  companyLabel={t("Акция", "Stock")}
                  weightLabel={t("Вес, %", "Weight, %")}
                />
              )}
            </SectionCard>
          )}

          {!!displayPortfolio.length && (
            <PortfolioSimulationPanel
              holdings={displayPortfolio}
              shares={cache.shares}
              fundamentalsByFigi={cache.fundamentalsByFigi}
              analysisName={t("Кластерный анализ", "Cluster Analysis")}
              filenamePrefix="cluster-portfolio"
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
