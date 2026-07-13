import type {
  ClusterAnalysisSummary as AnalysisSummary,
  ClusterGroup,
  ClusterMetricItem as MetricItem,
  ClusterPoint,
  ClusterPortfolioRow as PortfolioRow,
  ClusterStrategyPortfolio as StrategyPortfolio,
} from "../../../features/cluster-analysis";
import { numberOr } from "../../../shared/lib/number/numberOr";
import { CLUSTER_PALETTE } from "../model";

export function getClusterColor(cluster: number): string {
  const safeCluster = Number.isFinite(cluster) ? Math.abs(Math.trunc(cluster)) : 0;
  return CLUSTER_PALETTE[safeCluster % CLUSTER_PALETTE.length]!;
}

export function formatMetric(value: unknown): string {
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

function normalizeWeights(rows: PortfolioRow[]): PortfolioRow[] {
  if (!rows.length) {
    return [];
  }
  const max = Math.max(...rows.map((r) => r.weight));
  const scaled = max <= 1 ? rows.map((r) => ({ ...r, weight: r.weight * 100 })) : rows;
  return scaled.sort((a, b) => b.weight - a.weight);
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

export function extractPoints(parsed: Record<string, unknown>): ClusterPoint[] {
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

export function extractGroups(parsed: Record<string, unknown>, points: ClusterPoint[]): ClusterGroup[] {
  const profilesSource = Array.isArray(parsed.cluster_profiles) ? parsed.cluster_profiles : [];
  if (profilesSource.length > 0) {
    return profilesSource.map((item, index) => {
      const row = item as Record<string, unknown>;
      const cluster = numberOr(row.cluster, numberOr(row.cluster_id, numberOr(row.clusterId, numberOr(row.group, index))));

      const count = numberOr(
        row.count,
        numberOr(row.size, numberOr(row.companies_count, points.filter((p) => p.cluster === cluster).length)),
      );

      const avgPE = numberOr(row.avg_pe, numberOr(row.avgPE, numberOr(row.mean_pe, numberOr(row.pe_mean, 0))));
      const avgG = numberOr(row.avg_g, numberOr(row.avg_roe, numberOr(row.avgROE, numberOr(row.g_mean, numberOr(row.mean_growth, 0)))));

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

export function extractMetrics(parsed: Record<string, unknown>, points: ClusterPoint[], groups: ClusterGroup[]): MetricItem[] {
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

  collected.unshift({ label: "Кластеров", value: String(groups.length) }, { label: "Активов", value: String(points.length) });

  return collected;
}

export function extractPortfolioStrategies(parsed: Record<string, unknown>): StrategyPortfolio[] {
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

export function extractBestPortfolioAssetsCount(parsed: Record<string, unknown>): number {
  const summary = (parsed.summary as Record<string, unknown> | undefined) ?? {};
  const bestPortfolio = (summary.best_portfolio as Record<string, unknown> | undefined) ?? {};
  return readAssetsCount(bestPortfolio);
}

export function extractSummary(parsed: Record<string, unknown>): AnalysisSummary | null {
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

export function extractPortfolio(parsed: Record<string, unknown>): PortfolioRow[] {
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
    const fromWeights = first.weights ?? first.optimal_weights ?? first.portfolio ?? first.best_portfolio;

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
    parsed.optimal_portfolio ?? parsed.portfolio ?? parsed.best_portfolio ?? parsed.optimal_weights ?? parsed.weights;

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
