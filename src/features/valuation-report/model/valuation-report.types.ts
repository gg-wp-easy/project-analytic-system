export type FactorCandidate = {
  feature: string;
  label: string;
  status: string;
  coverage: number;
  coefficient: number;
  pValue: number;
  vif: number;
  bootstrapFrequency: number;
  relatedFeature?: string;
};

export type ModelQuality = {
  key: string;
  label: string;
  weight: number;
  r2: number;
  typicalError: number;
};

export type LevelMultiple = {
  multiple: string;
  label: string;
  status: string;
  loading: number;
  median: number;
  coverage: number;
};

export type ValuationLevelInfo = {
  labels: string[];
  formula: string;
  minLoading: number;
  kmo: number;
  bartlettPValue: number;
  explainedVariance: number;
  factorsCount: number;
  table: LevelMultiple[];
};

export type CandidateRow = {
  ticker: string;
  name: string;
  sector: string;
  tier: number;
  tierLabel: string;
  sizeLabel: string;
  marketCapBn: number;
  valuationClass: string;
  pe: number;
  fairPe: number;
  multiplesVsMarket: number;
  upside: number;
  dividendPayer: boolean;
  expectedReturn: number;
  dividendYieldUsed: number;
  growthUsed: number;
  risk: number;
};

export type ValuationReport = {
  steps: string[];
  companies: number;
  ratedCompanies: number;
  notRated: Record<string, number>;
  dividendPayers: number;
  level: ValuationLevelInfo;
  selectedFactors: string[];
  factorModel: { observations: number; r2: number; adjR2: number; sectorPValue: number; jointPValue: number };
  factorStructure: { kmo: number; bartlettPValue: number; factorsCount: number; groups: Record<string, string[]> };
  weakEvidence: boolean;
  factorNote: string;
  candidates: FactorCandidate[];
  models: ModelQuality[];
  baselines: ModelQuality[];
  ensembleR2: number;
  classCounts: { undervalued: number; fair: number; overvalued: number };
  classRule: string;
  tiers: Record<string, string>;
  tierCounts: Record<string, number>;
  required: string[];
  marketCapScreen: { minBn: number; largeBn: number; excluded: string[] };
  fillers: string[];
  pool: CandidateRow[];
  riskSource: string;
  riskWeeks: number;
  riskWindow: string;
  riskShrinkage: number;
  riskReason: string;
  riskDropped: Record<string, string>;
  expectedReturnFormula: string;
  objective: string;
  objectiveLabel: string;
  portfolioStatus: string;
  portfolioMessage: string;
};
