export type ClusterPoint = {
  ticker: string;
  figi: string;
  name?: string;
  pe: number;
  g: number;
  cluster: number;
  color: string;
  label: string;
  expectedReturn?: number;
  risk?: number;
  roe?: number;
  marketCap?: number;
  valueScore?: number;
  qualityScore?: number;
  growthScore?: number;
  incomeScore?: number;
  dividendScore?: number;
  dividendYield?: number;
  dividendYearsCount?: number;
  consecutiveDividendYears?: number;
  compositeScore?: number;
};

export type ClusterGroup = {
  name: string;
  count: number;
  avgPE: number;
  avgG: number;
  avgROE?: number;
  avgDividendYield?: number;
  avgRisk?: number;
  color: string;
  description: string;
  recommendation?: string;
  growthCategory?: string;
  valuationCategory?: string;
};

export type ClusterMetricItem = {
  label: string;
  value: string;
};

export type ClusterPortfolioRow = {
  figi?: string;
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

export type ClusterFeatureImportanceItem = {
  feature: string;
  importance: number;
  featureKey?: string;
  sourceColumn?: string;
  modelFeature?: string;
};
