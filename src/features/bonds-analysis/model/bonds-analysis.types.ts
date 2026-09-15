export type BondCouponScheduleItem = {
  payment_date: string;
  amount: number;
  coupon_period_days?: number;
};

export type BondSourceRow = {
  ticker: string;
  uid?: string;
  name: string;
  sector: string;
  currency: string;
  maturity_date: string;
  nominal: number;
  risk_level: number;
  coupon_rate: number | null;
  coupon_payments_per_year?: number;
  coupon_schedule?: BondCouponScheduleItem[];
  coupon_schedule_loaded?: boolean;
  floating_coupon_flag?: boolean;
  amortization_flag?: boolean;
  perpetual_flag?: boolean;
  callable_flag?: boolean;
  liquidity_flag?: boolean;
  issue_size?: number;
  source?: string;
};

export type BondPreviewRow = {
  id: string;
  ticker: string;
  name: string;
  sector: string;
  currency: string;
  maturityDate: string;
  nominal: number | null;
  riskLevel: number | null;
  couponRate: number | null;
  floatingCoupon: boolean;
  isValid: boolean;
  validationIssues: string[];
};

export type BondAnalysisBond = {
  ticker: string;
  uid?: string | null;
  name: string;
  sector: string;
  currency: string;
  riskLevel: number;
  riskName?: string | null;
  riskConfidence?: number | null;
  riskProbabilities?: Record<string, number> | null;
  yearsToMaturity: number;
  currentYield: number | null;
  modifiedDuration: number | null;
  totalScore: number | null;
  couponScheduleLoaded?: boolean;
};

export type BondPortfolioPosition = Omit<BondAnalysisBond, "currentYield" | "modifiedDuration" | "totalScore"> & {
  currentYield: number;
  modifiedDuration: number;
  totalScore: number;
  weight: number;
  quantity?: number;
  estimatedNominal?: number;
  cashFlowNextYear?: number;
};

export type BondPortfolioStatistics = {
  yield: number;
  duration: number;
  riskScore: number;
  convexity?: number;
  diversification: number;
  bondsCount: number;
};

export type BondPortfolioMethod = "matching" | "immunization";
export type BondRiskProfile = "mixed" | "0" | "1" | "2";
export type BondRejectedFeature = {
  feature: string;
  reason: string;
  related_feature?: string;
  correlation?: number;
  vif?: number | null;
};
export type BondRiskClassification = {
  status: "trained" | "source_fallback" | "unavailable";
  reason?: string | null;
  method: string;
  target_source: string;
  class_labels: Record<string, string>;
  training_bonds_count: number;
  distribution: Record<string, number>;
  factor_analysis: {
    selected_features: string[];
    rejected_features: BondRejectedFeature[];
    correlation_matrix?: Record<string, Record<string, number>>;
    vif?: Record<string, number | null>;
    correlation_threshold?: number;
    vif_threshold?: number;
    multicollinearity_detected?: boolean;
  };
};
export type BondPayoutFrequency = "monthly" | "quarterly";
export type BondPayoutScheduleItem = {
  period: string;
  startDate: string;
  endDate: string;
  targetCashFlow: number;
  projectedCashFlow: number;
};

export type BondPortfolioConstruction = {
  status: "constructed";
  method: BondPortfolioMethod;
  methodLabel: string;
  currency: string;
  investmentAmount: number;
  estimatedNominal: number;
  budgetRemaining: number;
  targetYieldPercent: number;
  targetAnnualCashFlow: number;
  projectedAnnualCashFlow: number;
  targetDurationYears: number | null;
  portfolioDurationYears: number;
  durationDeviationYears: number | null;
  riskProfile: BondRiskProfile;
  minimumPositions: number;
  positionWeightLimitPercent: number;
  payoutFrequency: BondPayoutFrequency;
  payoutFrequencyLabel: string;
  payoutSchedule: BondPayoutScheduleItem[];
  assumptions: string[];
};

export type BondPortfolioConstructionResponse = {
  portfolio: {
    positions: BondPortfolioPosition[];
    statistics: BondPortfolioStatistics;
  };
  bonds: BondAnalysisBond[];
  summary: BondAnalysisSummary;
  construction: BondPortfolioConstruction;
  source?: Record<string, unknown>;
  risk_classification?: BondRiskClassification;
};
export type BondRiskPortfolio = {
  key: string;
  riskLevel: number;
  riskName: string;
  portfolio: BondPortfolioPosition[];
  statistics: BondPortfolioStatistics;
};

export type BondRiskStatRow = {
  riskLevel: number;
  count: number;
  avgYield: number;
  avgDuration: number;
};

export type BondCurrencyStatRow = {
  currency: string;
  count: number;
  avgYield: number;
  avgDuration: number;
  totalNominal: number;
};

export type BondAnalysisSummary = {
  analyzedBondsCount: number;
  selectedBondsCount: number;
  portfolioYield: number;
  portfolioDuration: number;
  portfolioRisk: number;
};

export type BondSourceSummary = {
  provider: string;
  requestedLimit: number;
  rawBondsCount: number;
  eligibleBondsCount: number;
  loadedBondsCount: number;
  couponRatesAvailableCount: number;
};

export type BondAnalysisPreferences = {
  investmentAmount: string;
  targetYieldPercent: string;
  currency: "RUB" | "CNY" | "USD" | "EUR";
  riskProfile: BondRiskProfile;
  minPositions: string;
  maxPositions: string;
  payoutFrequency: BondPayoutFrequency;
  method: BondPortfolioMethod;
  targetDurationYears: string;
};
export type BondsAnalysisPersistedState = {
  analysisPreferences?: BondAnalysisPreferences;
  positions?: BondPortfolioPosition[];
  allBonds?: BondAnalysisBond[];
  riskPortfolios?: BondRiskPortfolio[];
  byRiskStats?: BondRiskStatRow[];
  byCurrencyStats?: BondCurrencyStatRow[];
  summary?: BondAnalysisSummary | null;
  construction?: BondPortfolioConstruction | null;
  riskClassification?: BondRiskClassification | null;
  error?: string | null;
  hideDetails?: boolean;
};
