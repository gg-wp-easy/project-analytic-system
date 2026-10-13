// Ответ /analytics/<анализ> платформы (nk-platform/services/analytics/app/stocks.py).
// Доли и доходности — десятичные: 0.2 = 20 %.

export type StockAnalysisKey = "regression" | "cluster" | "tree" | "neural" | "hybrid";

export type ValuationClass = "undervalued" | "fair" | "overvalued" | "not_rated";

export type ClassCounts = Record<ValuationClass, number>;

export type ValuationQuality = {
  r2: number | null;
  typical_error: number | null;
  sector_r2: number | null;
  sector_typical_error: number | null;
  observations: number;
};

export type ValuationFactor = {
  feature: string;
  label: string;
  stability: number | null;
};

export type RegressionDetails = {
  coefficients: Array<{
    feature: string;
    label: string;
    coefficient: number;
    effect: number;
    step: string;
    p_value: number | null;
    vif: number | null;
  }>;
  r2_within: number | null;
  sector_r2: number | null;
  r2: number | null;
  p_value: number | null;
  observations: number;
  sector_base: Array<{ sector: string; pe: number | null; companies: number }>;
  market_pe: number | null;
};

export type ClusterDetails = {
  groups: Array<{
    group: number;
    size: number;
    pe: number | null;
    g: number | null;
    valuation_class: ValuationClass;
    valuation_class_text: string;
    tickers: string[];
  }>;
  silhouette: number | null;
  market_pe: number | null;
  market_g: number | null;
  correlation: number | null;
  pays_for_growth: boolean;
};

export type FeatureShare = { feature: string; label: string; share: number };

export type TreeDetails = {
  rules: Array<{ conditions: string[]; relative_pe: number | null; companies: number }>;
  importance: FeatureShare[];
  depth: number | null;
};

export type NeuralDetails = {
  importance: FeatureShare[];
  hidden_layers: number[] | null;
  ensemble_size: number | null;
};

export type HybridDetails = {
  parts: Array<{
    analysis: StockAnalysisKey;
    label: string;
    weight: number;
    r2: number | null;
    typical_error: number | null;
    counts: ClassCounts;
  }>;
};

export type ValuationCompany = {
  ticker: string;
  figi: string | null;
  name: string | null;
  sector: string | null;
  pe: number | null;
  fair_pe: number | null;
  upside: number | null;
  probability: number | null;
  valuation_class: ValuationClass;
  valuation_class_text: string | null;
  dividend_payer: boolean;
  dividend_yield: number | null;
  g: number | null;
  market_cap_bn: number | null;
  group?: number | null;
  report?: string | null;
};

export type PortfolioKey = "min_risk" | "max_sharpe" | "max_return" | "target_return";

export type ValuationPosition = {
  ticker: string;
  figi: string | null;
  name: string | null;
  sector: string | null;
  weight: number;
  expected_return: number | null;
  dividend_yield: number | null;
  growth: number | null;
  risk: number | null;
  pe: number | null;
  fair_pe: number | null;
  upside: number | null;
  valuation_class_text: string | null;
};

export type ValuationPortfolio = {
  key: PortfolioKey;
  label: string;
  status: string;
  message: string | null;
  metrics: {
    expected_return: number | null;
    risk: number | null;
    sharpe_ratio: number | null;
    diversification: number | null;
    assets: number;
  };
  positions: ValuationPosition[];
};

export type StockValuationResult = {
  analysis: StockAnalysisKey;
  title: string;
  multiple: string;
  summary: {
    companies: number;
    rated: number;
    excluded: number;
    counts: ClassCounts;
    quality: ValuationQuality | null;
    risk_note: string;
    data_source?: {
      fundamentals: "smart-lab" | "t-invest";
      note: string;
      as_of?: string;
      price_date?: string | null;
      reports?: number;
    } | null;
    cached: boolean;
  };
  factors: ValuationFactor[];
  details: RegressionDetails | ClusterDetails | TreeDetails | NeuralDetails | HybridDetails;
  companies: ValuationCompany[];
  portfolios: ValuationPortfolio[];
  selected_portfolio: PortfolioKey;
  settings: {
    risk_free_rate: number;
    min_weight: number;
    max_weight: number;
    assets: number;
    objective: string | null;
    target_risk: number | null;
    target_return: number | null;
  };
  class_labels: Record<ValuationClass, string>;
  method: string[];
};

export type HybridWeights = Record<"regression" | "cluster" | "tree" | "neural", string>;
