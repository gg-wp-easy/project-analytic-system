export type BondCouponScheduleItem = {
  payment_date: string;
  amount: number;
  coupon_period_days?: number;
};

export type BondSourceRow = {
  ticker: string;
  name: string;
  sector: string;
  currency: string;
  maturity_date: string;
  nominal: number;
  risk_level: number;
  coupon_rate: number;
  coupon_payments_per_year?: number;
  coupon_schedule?: BondCouponScheduleItem[];
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
  name: string;
  sector: string;
  currency: string;
  riskLevel: number;
  yearsToMaturity: number;
  currentYield: number;
  modifiedDuration: number;
  totalScore: number;
};

export type BondPortfolioPosition = BondAnalysisBond & {
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
export type BondRiskProfile = "mixed" | "0" | "1" | "2" | "3";
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
  error?: string | null;
};