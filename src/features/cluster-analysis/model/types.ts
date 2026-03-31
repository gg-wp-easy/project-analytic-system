export type ClusterPoint = {
  ticker: string;
  figi: string;
  pe: number;
  g: number;
  cluster: number;
  color: string;
  label: string;
};

export type ClusterGroup = {
  name: string;
  count: number;
  avgPE: number;
  avgG: number;
  color: string;
  description: string;
};

export type ClusterMetricItem = {
  label: string;
  value: string;
};

export type ClusterPortfolioRow = {
  ticker: string;
  name: string;
  weight: number;
  expectedReturn?: number;
  risk?: number;
  sharpe?: number;
  sortino?: number;
  value_at_risk?: number;
};

export type ClusterStrategyPortfolio = {
  name: string;
  expectedReturn: number;
  risk: number;
  sharpe: number;
  diversification: number;
  rows: ClusterPortfolioRow[];
  assetsCount: number;
};

export type ClusterAnalysisSummary = {
  companiesCount: number;
  clustersCount: number;
  portfoliosCount: number;
  clusterDistribution: Array<{ cluster: string; count: number; color: string }>;
};

