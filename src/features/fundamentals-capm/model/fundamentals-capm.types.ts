export type DailyReturnPoint = {
  date: string;
  close: number;
  value: number;
};

export type AlignedReturnPoint = {
  date: string;
  stockReturn: number;
  marketReturn: number;
};

export type FamaFrenchAlignedReturnPoint = AlignedReturnPoint & {
  smbReturn: number;
  hmlReturn: number;
};

export type CapmAdequacyLevel = "strong" | "moderate" | "weak" | "insufficient";

export type CapmRiskFreeRateSource = {
  bondTicker: string;
  bondName: string;
  bondFigi: string;
  maturityDate: string;
  annualRate: number;
  closePricePercent: number;
  pricingMethod: "ytm_solver" | "coupon_proxy";
};

export type CapmModelPoint = {
  date: string;
  marketExcessReturn: number;
  actualExcessReturn: number;
  predictedCapmReturn: number;
  predictedFamaFrenchReturn?: number;
};

export type FamaFrenchFactorSource = {
  query: string;
  ticker: string;
  name: string;
  figi: string;
};

export type FamaFrenchAnalysisResult = {
  sampleSize: number;
  marketBeta: number;
  smbBeta: number;
  hmlBeta: number;
  alphaDaily: number;
  alphaAnnual: number;
  expectedAnnualReturn: number;
  rSquared: number;
  periodStart: string;
  periodEnd: string;
  sources: {
    largeCap: FamaFrenchFactorSource;
    smallCap: FamaFrenchFactorSource;
    value: FamaFrenchFactorSource;
    growth: FamaFrenchFactorSource;
  };
};

export type CapmAnalysisResult = {
  stockFigi: string;
  marketFigi: string;
  marketTicker: string;
  marketName: string;
  sampleSize: number;
  beta: number;
  alphaDaily: number;
  alphaAnnual: number;
  expectedAnnualReturn: number;
  marketAnnualReturn: number;
  riskFreeAnnualRate: number;
  rSquared: number;
  correlation: number;
  adequacyLevel: CapmAdequacyLevel;
  periodStart: string;
  periodEnd: string;
  riskFreeSource: CapmRiskFreeRateSource;
  modelPoints: CapmModelPoint[];
  famaFrench?: FamaFrenchAnalysisResult;
  famaFrenchError?: string;
};
