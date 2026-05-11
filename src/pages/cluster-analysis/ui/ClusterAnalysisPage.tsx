import { useEffect, useMemo, useRef, useState } from "react";
import { FileSpreadsheet, FileText, ImageDown, Network, Play, Settings } from "lucide-react";
import {
  ScatterChart,
  Scatter,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { useFundamentals } from "../../../entities/fundamentals";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import { OptimizerSettingsFields } from "../../../features/optimizer-settings/ui/OptimizerSettingsFields";
import { submitOptimizerSettings, useOptimizerSettings } from "../../../features/optimizer-settings/model/optimizerSettings";
import { API_BASE_URL } from "../../../config/api";
import type {
  ClusterAnalysisSummary as AnalysisSummary,
  ClusterGroup,
  ClusterMetricItem as MetricItem,
  ClusterPoint,
  ClusterPortfolioRow as PortfolioRow,
  ClusterStrategyPortfolio as StrategyPortfolio,
} from "../../../features/cluster-analysis/model/types";
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

const palette = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#14b8a6", "#f97316"];
const ENABLE_TEMP_LOGS = true;
const CLUSTER_STATE_KEY = "cluster-analysis-state-v1";

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
      const color = palette[cluster % palette.length];
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
        color: palette[cluster % palette.length],
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
      color: palette[cluster % palette.length],
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
    { key: "silhouette", label: "Silhouette" },
    { key: "silhouette_score", label: "Silhouette score" },
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
    color: palette[index % palette.length],
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
  const [serverRaw, setServerRaw] = useState<Record<string, unknown> | null>(null);
  const [clusterData, setClusterData] = useState<ClusterPoint[]>([]);
  const [clusterGroups, setClusterGroups] = useState<ClusterGroup[]>([]);
  const [metrics, setMetrics] = useState<MetricItem[]>([]);
  const [optimalPortfolio, setOptimalPortfolio] = useState<PortfolioRow[]>([]);
  const [portfolioStrategies, setPortfolioStrategies] = useState<StrategyPortfolio[]>([]);
  const [summaryInfo, setSummaryInfo] = useState<AnalysisSummary | null>(null);
  const [bestPortfolioAssetsCount, setBestPortfolioAssetsCount] = useState(0);
  const portfolioChartRef = useRef<HTMLDivElement | null>(null);
  const visibleMetrics = useMemo(() => metrics.filter((item) => isVisibleAnalysisMetric(item.label)), [metrics]);
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
        serverRaw?: Record<string, unknown> | null;
        clusterData?: ClusterPoint[];
        clusterGroups?: ClusterGroup[];
        metrics?: MetricItem[];
        optimalPortfolio?: PortfolioRow[];
        portfolioStrategies?: StrategyPortfolio[];
        summaryInfo?: AnalysisSummary | null;
        bestPortfolioAssetsCount?: number;
      };

      if (typeof parsed.error === "string" || parsed.error === null) setError(parsed.error);
      if (parsed.serverRaw && typeof parsed.serverRaw === "object") setServerRaw(parsed.serverRaw);
      if (Array.isArray(parsed.clusterData)) setClusterData(parsed.clusterData);
      if (Array.isArray(parsed.clusterGroups)) setClusterGroups(parsed.clusterGroups);
      if (Array.isArray(parsed.metrics)) setMetrics(parsed.metrics.filter((item) => isVisibleAnalysisMetric(item.label)));
      if (Array.isArray(parsed.optimalPortfolio)) setOptimalPortfolio(parsed.optimalPortfolio);
      if (Array.isArray(parsed.portfolioStrategies)) setPortfolioStrategies(parsed.portfolioStrategies);
      if (parsed.summaryInfo && typeof parsed.summaryInfo === "object") setSummaryInfo(parsed.summaryInfo);
      if (typeof parsed.bestPortfolioAssetsCount === "number") setBestPortfolioAssetsCount(parsed.bestPortfolioAssetsCount);
    } catch {
      // ignore broken persisted state
    }
  }, []);

  useEffect(() => {
    const payload = {
      error,
      serverRaw,
      clusterData,
      clusterGroups,
      metrics,
      optimalPortfolio,
      portfolioStrategies,
      summaryInfo,
      bestPortfolioAssetsCount,
    };
    window.localStorage.setItem(CLUSTER_STATE_KEY, JSON.stringify(payload));
  }, [error, serverRaw, clusterData, clusterGroups, metrics, optimalPortfolio, portfolioStrategies, summaryInfo, bestPortfolioAssetsCount]);

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

  useEffect(() => {
    if (!ENABLE_TEMP_LOGS) {
      return;
    }
    console.info("[Cluster][RequestData][Prepared]", {
      ts: new Date().toISOString(),
      sharesInCache: cache.shares.length,
      fundamentalsInCache: Object.keys(cache.fundamentalsByFigi).length,
      requestRows: requestData.length,
      sample: requestData.slice(0, 2),
    });
  }, [cache.fundamentalsByFigi, cache.shares.length, requestData]);

  const runClusterAnalysis = async () => {
    setError(null);
    setErrorDialogMessage(null);
    setIsRunning(true);
    const startedAt = performance.now();

    try {
      await submitOptimizerSettings(optimizerSettings);
      const body = JSON.stringify({ data: requestData });
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

      setServerRaw(parsed);

      const points = extractPoints(parsed);
      const groups = extractGroups(parsed, points);
      const parsedMetrics = extractMetrics(parsed, points, groups);
      const portfolio = extractPortfolio(parsed);
      const strategies = extractPortfolioStrategies(parsed);
      const summary = extractSummary(parsed);
      const bestAssetsCount = extractBestPortfolioAssetsCount(parsed);

      if (!points.length && ENABLE_TEMP_LOGS) {
        console.warn("[Cluster][Parse][NoPoints]", {
          ts: new Date().toISOString(),
          responseKeys: Object.keys(parsed),
          companiesPreview: Array.isArray(parsed.companies) ? parsed.companies.slice(0, 2) : null,
        });
      }

      setClusterData(points);
      setClusterGroups(groups);
      setMetrics(parsedMetrics);
      setOptimalPortfolio(portfolio);
      setPortfolioStrategies(strategies);
      setSummaryInfo(summary);
      setBestPortfolioAssetsCount(bestAssetsCount);

      if (ENABLE_TEMP_LOGS) {
        console.info("[Cluster][Request][Success]", {
          ts: new Date().toISOString(),
          durationMs: Number((performance.now() - startedAt).toFixed(1)),
          status: response.status,
          points: points.length,
          groups: groups.length,
          portfolioRows: portfolio.length,
          responseKeys: Object.keys(parsed),
        });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : t("Не удалось выполнить кластеризацию", "Failed to run clustering");
      showErrorDialog(message);
      setServerRaw(null);
      setClusterData([]);
      setClusterGroups([]);
      setMetrics([]);
      setOptimalPortfolio([]);
      setPortfolioStrategies([]);
      setSummaryInfo(null);
      setBestPortfolioAssetsCount(0);

      if (ENABLE_TEMP_LOGS) {
        console.error("[Cluster][Request][Error]", {
          ts: new Date().toISOString(),
          durationMs: Number((performance.now() - startedAt).toFixed(1)),
          message,
        });
      }
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
            "Кластеризация выполняется на сервере. По умолчанию используется алгоритм K-Means.",
            "Clustering is performed on the server. K-Means is used by default.",
          )}
          accent="violet"
        />
      )}
      sidebar={(
        <AnalysisSidebarCard
          icon={Settings}
          title={t("Параметры анализа", "Analysis Parameters")}
          description={t(
            "Единый запуск на базе кэша фундаментальных данных и настроек оптимизатора.",
            "Unified run based on fundamentals cache and shared optimizer settings.",
          )}
          accent="violet"
        >
          <div className="space-y-4">
            <div className="ui-surface-muted">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {t("Источник: кэш фундаментальных данных", "Source: fundamentals cache")}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t("Записей", "Records")}: {requestData.length}
              </p>
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
              disabled={!hasData || !requestData.length || isRunning}
              className="ui-primary-button w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700"
            >
              <Play className="h-5 w-5" />
              {isRunning ? t("Выполняется...", "Running...") : t("Запустить анализ", "Run Analysis")}
            </button>
          </div>
        </AnalysisSidebarCard>
      )}
    >
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
                <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
                  <div className="ui-stat-card">
                    <div className="text-slate-500 dark:text-slate-400">{t("Компаний", "Companies")}</div>
                    <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">{summaryInfo.companiesCount}</div>
                  </div>
                  <div className="ui-stat-card">
                    <div className="text-slate-500 dark:text-slate-400">{t("Кластеров", "Clusters")}</div>
                    <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">{summaryInfo.clustersCount}</div>
                  </div>
                  <div className="ui-stat-card">
                    <div className="text-slate-500 dark:text-slate-400">{t("Портфелей", "Portfolios")}</div>
                    <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">{summaryInfo.portfoliosCount}</div>
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

          {!!portfolioStrategies.length && (
            <SectionCard title={t("Стратегии портфелей", "Portfolio Strategies")}>
              <div className="ui-table-shell overflow-x-auto">
                <table className="ui-data-table">
                  <thead>
                    <tr>
                      <th>{t("Стратегия", "Strategy")}</th>
                      <th>Expected return</th>
                      <th>Risk</th>
                      <th>Sharpe</th>
                      <th>Diversification</th>
                      <th>{t("Позиций", "Positions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolioStrategies.map((row) => (
                      <tr key={row.name}>
                        <td className="font-medium text-slate-900 dark:text-slate-100">{row.name}</td>
                        <td>{row.expectedReturn.toFixed(4)}</td>
                        <td>{row.risk.toFixed(4)}</td>
                        <td>{row.sharpe.toFixed(4)}</td>
                        <td>{row.diversification.toFixed(4)}</td>
                        <td>{row.assetsCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                {Array.from(new Set(clusterData.map((d) => d.cluster))).map((cluster) => {
                  const points = clusterData.filter((d) => d.cluster === cluster);
                  return (
                    <Scatter key={cluster} name={`${t("Кластер", "Cluster")} ${cluster + 1}`} data={points}>
                      {points.map((entry) => (
                        <Cell key={`${entry.figi}-${entry.cluster}`} fill={entry.color} />
                      ))}
                    </Scatter>
                  );
                })}
                <Legend />
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
