import { useEffect, useMemo, useRef, useState } from "react";
import { Download, ImageDown, Network, Play, Settings, Trophy } from "lucide-react";
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
import { useFundamentals } from "../context/FundamentalsContext";
import { useAppSettings } from "../context/AppSettingsContext";
import { OptimizerSettingsFields } from "./OptimizerSettingsFields";
import { submitOptimizerSettings, useOptimizerSettings } from "./optimizerSettings";
import { AnalysisRunningIndicator } from "./AnalysisRunningIndicator";
import { MetricTooltip } from "./MetricTooltip";
import { formatMetricDisplay, getMetricTooltip, localizeMetricLabel } from "./metricDisplay";
import type {
  ClusterAnalysisSummary as AnalysisSummary,
  ClusterGroup,
  ClusterMetricItem as MetricItem,
  ClusterPoint,
  ClusterPortfolioRow as PortfolioRow,
  ClusterStrategyPortfolio as StrategyPortfolio,
} from "../../features/cluster-analysis/model/types";
import { numberOr } from "../../shared/lib/number/numberOr";
import { formatVarPercent } from "../../shared/lib/format/finance";
import { downloadRowsAsExcel, downloadSvgAsPng } from "../../shared/lib/export/download";

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

function downloadPortfolioAsExcel(rows: PortfolioRow[], filename: string): void {
  downloadRowsAsExcel(
    rows,
    [
      { header: "Ticker", render: (row) => row.ticker },
      { header: "Name", render: (row) => row.name || "" },
      { header: "Weight, %", render: (row) => row.weight.toFixed(4) },
      { header: "Return", render: (row) => (Number.isFinite(row.expectedReturn) ? row.expectedReturn?.toFixed(6) : "") },
      { header: "Risk", render: (row) => (Number.isFinite(row.risk) ? row.risk?.toFixed(6) : "") },
      { header: "Sharpe", render: (row) => (Number.isFinite(row.sharpe) ? row.sharpe?.toFixed(6) : "") },
      { header: "Sortino", render: (row) => (Number.isFinite(row.sortino) ? row.sortino?.toFixed(6) : "") },
      { header: "VaR", render: (row) => (Number.isFinite(row.value_at_risk) ? row.value_at_risk?.toFixed(6) : "") },
    ],
    filename,
  );
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
    { key: "sortino", label: "Sortino" },
    { key: "sortino_ratio", label: "Sortino Ratio" },
    { key: "value_at_risk", label: "VaR" },
    { key: "var", label: "VaR" },
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
  const { locale } = useAppSettings();
  const isEn = locale === "en";
  const tx = (ru: string, en: string) => (isEn ? en : ru);
  const { settings: optimizerSettings, setSettings: setOptimizerSettings } = useOptimizerSettings();
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverRaw, setServerRaw] = useState<Record<string, unknown> | null>(null);
  const [clusterData, setClusterData] = useState<ClusterPoint[]>([]);
  const [clusterGroups, setClusterGroups] = useState<ClusterGroup[]>([]);
  const [metrics, setMetrics] = useState<MetricItem[]>([]);
  const [optimalPortfolio, setOptimalPortfolio] = useState<PortfolioRow[]>([]);
  const [portfolioStrategies, setPortfolioStrategies] = useState<StrategyPortfolio[]>([]);
  const [summaryInfo, setSummaryInfo] = useState<AnalysisSummary | null>(null);
  const [bestPortfolioAssetsCount, setBestPortfolioAssetsCount] = useState(0);
  const portfolioChartRef = useRef<HTMLDivElement | null>(null);

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
      if (Array.isArray(parsed.metrics)) setMetrics(parsed.metrics);
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

  const exportPortfolioToExcel = () => {
    if (!displayPortfolio.length) {
      return;
    }
    downloadPortfolioAsExcel(displayPortfolio, "optimal-portfolio.xls");
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
      setError(message);
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
    setIsRunning(true);
    const startedAt = performance.now();

    try {
      await submitOptimizerSettings(optimizerSettings);
      const body = JSON.stringify({ data: requestData });
      const response = await fetch("/api/cluster-analysis", {
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
      const message = e instanceof Error ? e.message : tx("Не удалось выполнить кластеризацию", "Failed to run clustering");
      setError(message);
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
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <Network className="w-8 h-8" />
          <h1 className="text-3xl font-bold">{tx("Кластерный анализ", "Cluster Analysis")}</h1>
        </div>
        <p className="text-purple-100">
          {tx("Кластеризация выполняется на сервере. По умолчанию используется алгоритм K-Means.", "Clustering is performed on the server. K-Means is used by default.")}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-6">
              <Settings className="w-5 h-5 text-purple-600" />
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">{tx("Параметры", "Parameters")}</h2>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800/40">
                <p className="text-sm text-slate-700 dark:text-slate-300">{tx("Источник: кэш фундаментальных данных", "Source: fundamentals cache")}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{tx("Записей", "Records")}: {requestData.length}</p>
              </div>
              <OptimizerSettingsFields
                isEn={isEn}
                settings={optimizerSettings}
                onChange={setOptimizerSettings}
              />

              {!hasData && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg p-3">
                  <p className="text-sm text-amber-800 dark:text-amber-300">{tx("Кэш пуст. Сначала загрузите фундаментальные данные.", "Cache is empty. Load fundamentals first.")}</p>
                </div>
              )}

              {error && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg p-3">
                  <p className="text-sm text-red-700 dark:text-red-300 break-words">{error}</p>
                </div>
              )}

              <button
                onClick={runClusterAnalysis}
                disabled={!hasData || !requestData.length || isRunning}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="w-5 h-5" />
                {isRunning ? tx("Выполняется...", "Running...") : tx("Запустить анализ", "Run Analysis")}
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
          {isRunning && (
            <AnalysisRunningIndicator
              title={tx("Выполняем кластеризацию", "Running clustering")}
              subtitle={tx("Подбираем структуру кластеров и оптимальный портфель", "Estimating clusters and optimal portfolio")}
              accentClassName="text-purple-600"
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

          {summaryInfo && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">{tx("Сводка по результату", "Result Summary")}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                  <div className="text-slate-500 dark:text-slate-400">{tx("Компаний", "Companies")}</div>
                  <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">{summaryInfo.companiesCount}</div>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                  <div className="text-slate-500 dark:text-slate-400">{tx("Кластеров", "Clusters")}</div>
                  <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">{summaryInfo.clustersCount}</div>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                  <div className="text-slate-500 dark:text-slate-400">{tx("Портфелей", "Portfolios")}</div>
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
          )}

          {!!portfolioStrategies.length && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">{tx("Стратегии портфелей", "Portfolio Strategies")}</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
                  <thead>
                    <tr className="text-left border-b border-slate-200 dark:border-slate-800">
                      <th className="py-2 pr-3">{tx("Стратегия", "Strategy")}</th>
                      <th className="py-2 pr-3">Expected return</th>
                      <th className="py-2 pr-3">Risk</th>
                      <th className="py-2 pr-3">Sharpe</th>
                      <th className="py-2 pr-3">Diversification</th>
                      <th className="py-2 pr-3">{tx("Позиций", "Positions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolioStrategies.map((row) => (
                      <tr key={row.name} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-2 pr-3 font-medium text-slate-900 dark:text-slate-100">{row.name}</td>
                        <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{row.expectedReturn.toFixed(4)}</td>
                        <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{row.risk.toFixed(4)}</td>
                        <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{row.sharpe.toFixed(4)}</td>
                        <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{row.diversification.toFixed(4)}</td>
                        <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{row.assetsCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!!clusterGroups.length && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {clusterGroups.map((cluster) => (
                <div key={cluster.name} className="bg-white dark:bg-slate-900 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cluster.color }} />
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">{cluster.name}</h3>
                      <p className="text-xs text-slate-600 dark:text-slate-300">{cluster.description}</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">{tx("Компаний:", "Companies:")}</span>
                      <span className="font-medium text-slate-900 dark:text-slate-100">{cluster.count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">{tx("Средний P/E:", "Average P/E:")}</span>
                      <span className="font-medium text-blue-600 dark:text-blue-400">{cluster.avgPE.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">{tx("Средний g:", "Average g:")}</span>
                      <span className="font-medium text-green-600 dark:text-green-400">{cluster.avgG.toFixed(2)}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">{tx("Визуализация кластеров (P/E vs g)", "Cluster Visualization (P/E vs g)")}</h3>
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
                      <div className="bg-white dark:bg-slate-900 p-3 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">{data.ticker}</p>
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
                    <Scatter key={cluster} name={`${tx("Кластер", "Cluster")} ${cluster + 1}`} data={points}>
                      {points.map((entry) => (
                        <Cell key={`${entry.figi}-${entry.cluster}`} fill={entry.color} />
                      ))}
                    </Scatter>
                  );
                })}
                <Legend />
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {(!!displayPortfolio.length || bestPortfolioAssetsCount > 0) && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">{tx("Оптимальный портфель из кластерного анализа", "Optimal Portfolio from Cluster Analysis")}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={savePortfolioChartPng}
                    disabled={!displayPortfolio.length}
                    className="inline-flex items-center gap-1 px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-50"
                  >
                    <ImageDown className="w-4 h-4" />
                    PNG
                  </button>
                  <button
                    onClick={exportPortfolioToExcel}
                    disabled={!displayPortfolio.length}
                    className="inline-flex items-center gap-1 px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    Excel
                  </button>
                </div>
              </div>

              {bestPortfolioAssetsCount > 0 && (
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                  {tx("Количество активов в портфеле:", "Assets in portfolio:")} <span className="font-semibold text-slate-900 dark:text-slate-100">{bestPortfolioAssetsCount}</span>
                </p>
              )}
              {!!displayPortfolio.length && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="h-72" ref={portfolioChartRef}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={displayPortfolio}
                          dataKey="weight"
                          nameKey="ticker"
                          cx="50%"
                          cy="50%"
                          outerRadius={105}
                          labelLine={false}
                          label={({ ticker, weight }) => (Number(weight) >= 6 ? `${ticker}: ${Number(weight).toFixed(1)}%` : "")}
                        >
                          {displayPortfolio.map((row, idx) => (
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
                        <th className="py-2 pr-3">Name</th>
                        <th className="py-2 pr-3">{tx("Вес, %", "Weight, %")}</th>
                        <th className="py-2 pr-3">Return</th>
                        <th className="py-2 pr-3">Risk</th>
                        <th className="py-2 pr-3">Sharpe</th>
                        <th className="py-2 pr-3">Sortino</th>
                        <th className="py-2 pr-3">VaR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayPortfolio.map((row) => (
                        <tr key={row.ticker} className="border-b border-slate-100 dark:border-slate-800">
                          <td className="py-2 pr-3 font-medium text-slate-900 dark:text-slate-100">{row.ticker}</td>
                          <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{row.name || "-"}</td>
                          <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{row.weight.toFixed(2)}</td>
                          <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">
                            {Number.isFinite(row.expectedReturn) ? row.expectedReturn?.toFixed(4) : "-"}
                          </td>
                          <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">
                            {Number.isFinite(row.risk) ? row.risk?.toFixed(4) : "-"}
                          </td>
                          <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">
                            {Number.isFinite(row.sharpe) ? row.sharpe?.toFixed(4) : "-"}
                          </td>
                          <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">
                            {Number.isFinite(row.sortino) ? row.sortino?.toFixed(4) : "-"}
                          </td>
                          <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">
                            {formatVarPercent(numberOr(row.value_at_risk, NaN))}
                          </td>
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
    </div>
  );
}

