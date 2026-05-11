import type {
  BondAnalysisBond,
  BondAnalysisPreferences,
  BondAnalysisSummary,
  BondCurrencyStatRow,
  BondPortfolioPosition,
  BondPortfolioStatistics,
  BondRiskPortfolio,
  BondRiskStatRow,
  BondSourceRow,
} from "./types";

const BASE_RISK_FREE_RATE = 0.155;
const INFLATION_RATE = 0.075;
const TAX_RATE = 0.13;
const MIN_BONDS = 15;
const MAX_BONDS = 50;
const MAX_WEIGHT_PER_BOND = 0.15;
const DEFAULT_TARGET_DURATION = 3.5;
const DEFAULT_TARGET_YIELD = 0.12;

const CURRENCY_PARAMS = {
  rub: { riskFreeRate: 0.155, minYield: 0.12 },
  cny: { riskFreeRate: 0.03, minYield: 0.04 },
  usd: { riskFreeRate: 0.045, minYield: 0.05 },
  eur: { riskFreeRate: 0.03, minYield: 0.035 },
} as const;

const SECTOR_MAX_WEIGHTS: Record<string, number> = {
  government: 0.4,
  municipal: 0.25,
  financial: 0.3,
  energy: 0.25,
  materials: 0.25,
  industrials: 0.2,
  consumer: 0.2,
  telecom: 0.15,
  it: 0.1,
  utilities: 0.15,
  real_estate: 0.15,
  health_care: 0.1,
  other: 0.1,
};

type InternalBond = BondAnalysisBond & {
  nominal: number;
  couponRate: number;
  couponPaymentsPerYear: number;
  convexity: number;
  creditSpread: number;
  realYield: number;
  taxEquivalentYield: number;
  liquidityScore: number;
  durationScore: number;
  sectorScore: number;
  currencyScore: number;
  yieldScore: number;
  issuerKey: string;
};

type AnalysisResult = {
  positions: BondPortfolioPosition[];
  allBonds: BondAnalysisBond[];
  riskPortfolios: BondRiskPortfolio[];
  byRiskStats: BondRiskStatRow[];
  byCurrencyStats: BondCurrencyStatRow[];
  summary: BondAnalysisSummary;
};

type ResolvedBondAnalysisPreferences = {
  targetYield: number;
  targetDuration: number;
  paymentFrequency: BondAnalysisPreferences["paymentFrequency"];
  desiredPaymentsPerYear: number;
  targetRiskLevel: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function parsePositiveNumber(value: string, fallback: number): number {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolvePreferences(preferences?: BondAnalysisPreferences): ResolvedBondAnalysisPreferences {
  const paymentFrequency = preferences?.paymentFrequency === "monthly" ? "monthly" : "quarterly";
  const parsedRiskLevel = Number(preferences?.targetRiskLevel ?? "3");
  return {
    targetYield: parsePositiveNumber(preferences?.targetYield ?? "", DEFAULT_TARGET_YIELD * 100) / 100,
    targetDuration: parsePositiveNumber(preferences?.targetDuration ?? "", DEFAULT_TARGET_DURATION),
    paymentFrequency,
    desiredPaymentsPerYear: paymentFrequency === "monthly" ? 12 : 4,
    targetRiskLevel: Number.isFinite(parsedRiskLevel) ? clamp(parsedRiskLevel, 0, 3) : 3,
  };
}

function matchesPreferredFrequency(bond: InternalBond, preferences: ResolvedBondAnalysisPreferences): boolean {
  if (bond.couponPaymentsPerYear <= 0) {
    return false;
  }
  if (preferences.paymentFrequency === "monthly") {
    return bond.couponPaymentsPerYear >= 10;
  }
  return bond.couponPaymentsPerYear >= 3 && bond.couponPaymentsPerYear <= 5;
}

function getFrequencyScore(bond: InternalBond, preferences: ResolvedBondAnalysisPreferences): number {
  if (matchesPreferredFrequency(bond, preferences)) {
    return 1;
  }
  if (bond.couponPaymentsPerYear <= 0) {
    return 0.2;
  }
  return clamp(1 - Math.abs(bond.couponPaymentsPerYear - preferences.desiredPaymentsPerYear) / preferences.desiredPaymentsPerYear, 0.1, 0.85);
}

function normalizeWeights(weights: number[]): number[] {
  const safeWeights = weights.map((weight) => (Number.isFinite(weight) && weight > 0 ? weight : 0));
  const total = safeWeights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) {
    const equalWeight = safeWeights.length ? 1 / safeWeights.length : 0;
    return safeWeights.map(() => equalWeight);
  }
  return safeWeights.map((weight) => weight / total);
}

function capWeights(weights: number[], maxWeight: number): number[] {
  const adjusted = normalizeWeights(weights);

  for (let iteration = 0; iteration < 24; iteration += 1) {
    const cappedIndices = adjusted
      .map((weight, index) => ({ weight, index }))
      .filter(({ weight }) => weight > maxWeight + 1e-9)
      .map(({ index }) => index);

    if (!cappedIndices.length) {
      break;
    }

    let excess = 0;
    for (const index of cappedIndices) {
      excess += adjusted[index] - maxWeight;
      adjusted[index] = maxWeight;
    }

    const openIndices = adjusted
      .map((weight, index) => ({ weight, index }))
      .filter(({ weight, index }) => weight < maxWeight - 1e-9 && !cappedIndices.includes(index))
      .map(({ index }) => index);

    if (!openIndices.length || excess <= 0) {
      break;
    }

    const openBase = openIndices.reduce((sum, index) => sum + Math.max(adjusted[index], 1e-6), 0);
    for (const index of openIndices) {
      const room = maxWeight - adjusted[index];
      const share = excess * (Math.max(adjusted[index], 1e-6) / openBase);
      adjusted[index] += Math.min(share, room);
    }
  }

  return normalizeWeights(adjusted);
}

function getIssuerKey(name: string, ticker: string): string {
  const firstWord = name.trim().split(/\s+/)[0];
  return (firstWord || ticker).toUpperCase();
}

function toDateOnly(value: string): Date | null {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeRow(row: BondSourceRow): InternalBond | null {
  const maturity = toDateOnly(row.maturity_date);
  if (!maturity || !row.ticker) {
    return null;
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const maturityCopy = new Date(maturity);
  maturityCopy.setHours(0, 0, 0, 0);

  const daysToMaturity = Math.floor((maturityCopy.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  if (daysToMaturity <= 0) {
    return null;
  }

  const yearsToMaturity = Math.max(daysToMaturity / 365, 0.1);
  const currency = (row.currency || "rub").toLowerCase();
  const currencyParams = CURRENCY_PARAMS[currency as keyof typeof CURRENCY_PARAMS] ?? CURRENCY_PARAMS.rub;
  const currentYield = row.nominal > 0 ? row.coupon_rate / 100 : 0;
  const yieldToMaturity = row.floating_coupon_flag ? BASE_RISK_FREE_RATE + currentYield : currentYield;
  const modifiedDuration = row.floating_coupon_flag ? 0.1 : yearsToMaturity / (1 + yieldToMaturity);
  const convexity = (yearsToMaturity ** 2) / 100;
  const liquidityScore = clamp(Math.min(row.nominal / 1000, 1) * (1 - clamp(row.risk_level, 0, 3) * 0.2), 0, 1);
  const sector = (row.sector || "other").toLowerCase();

  return {
    ticker: row.ticker,
    name: row.name || row.ticker,
    sector,
    currency: currency.toUpperCase(),
    riskLevel: clamp(row.risk_level, 0, 3),
    yearsToMaturity,
    currentYield,
    modifiedDuration,
    totalScore: 0,
    nominal: row.nominal || 1000,
    couponRate: row.coupon_rate || 0,
    couponPaymentsPerYear: Math.max(0, row.coupon_payments_per_year ?? 0),
    convexity,
    creditSpread: yieldToMaturity - currencyParams.riskFreeRate,
    realYield: currentYield - INFLATION_RATE,
    taxEquivalentYield: currentYield / (1 - TAX_RATE),
    liquidityScore,
    durationScore: 0,
    sectorScore: 0,
    currencyScore: 0,
    yieldScore: 0,
    issuerKey: getIssuerKey(row.name || row.ticker, row.ticker),
  };
}

function scoreBonds(bonds: InternalBond[], preferences: ResolvedBondAnalysisPreferences): InternalBond[] {
  if (!bonds.length) {
    return [];
  }

  const yields = bonds.map((bond) => bond.currentYield);
  const minYield = Math.min(...yields);
  const maxYield = Math.max(...yields);
  const yieldRange = maxYield > minYield ? maxYield - minYield : 1;

  return bonds.map((bond) => {
    const sectorWeight = SECTOR_MAX_WEIGHTS[bond.sector] ?? SECTOR_MAX_WEIGHTS.other;
    const currencyKey = bond.currency.toLowerCase() as keyof typeof CURRENCY_PARAMS;
    const currencyParams = CURRENCY_PARAMS[currencyKey] ?? CURRENCY_PARAMS.rub;
    const yieldScore = (bond.currentYield - minYield) / yieldRange;
    const riskScore = 1 - bond.riskLevel / 3;
    const durationScore = 1 - Math.min(Math.abs(bond.modifiedDuration - preferences.targetDuration) / preferences.targetDuration, 1);
    const sectorScore = Math.min(sectorWeight * 5, 1);
    const currencyScore = bond.currentYield >= currencyParams.minYield ? 1 : bond.currentYield / currencyParams.minYield;
    const targetYieldScore = clamp(bond.currentYield / Math.max(preferences.targetYield, 0.0001), 0, 1);
    const frequencyScore = getFrequencyScore(bond, preferences);
    const totalScore =
      yieldScore * 0.2 +
      riskScore * 0.18 +
      bond.liquidityScore * 0.12 +
      durationScore * 0.18 +
      sectorScore * 0.07 +
      currencyScore * 0.08 +
      targetYieldScore * 0.1 +
      frequencyScore * 0.07;

    return {
      ...bond,
      yieldScore,
      durationScore,
      sectorScore,
      currencyScore,
      totalScore,
    };
  });
}

function pickDiversifiedBonds(bonds: InternalBond[], desiredCount: number): InternalBond[] {
  if (bonds.length <= desiredCount) {
    return bonds.slice();
  }

  const selected: InternalBond[] = [];
  const issuerCounts = new Map<string, number>();

  for (const bond of bonds) {
    if (selected.length >= desiredCount) {
      break;
    }
    if ((issuerCounts.get(bond.issuerKey) ?? 0) === 0) {
      selected.push(bond);
      issuerCounts.set(bond.issuerKey, 1);
    }
  }

  for (const bond of bonds) {
    if (selected.length >= desiredCount) {
      break;
    }
    if (selected.includes(bond)) {
      continue;
    }
    const issuerCount = issuerCounts.get(bond.issuerKey) ?? 0;
    if (issuerCount < 2) {
      selected.push(bond);
      issuerCounts.set(bond.issuerKey, issuerCount + 1);
    }
  }

  for (const bond of bonds) {
    if (selected.length >= desiredCount) {
      break;
    }
    if (!selected.includes(bond)) {
      selected.push(bond);
    }
  }

  return selected;
}

function computePortfolioStatistics(bonds: InternalBond[], weights: number[]): BondPortfolioStatistics {
  const activeWeights = normalizeWeights(weights);
  const hhi = activeWeights.reduce((sum, weight) => sum + weight ** 2, 0);
  const bondsCount = activeWeights.filter((weight) => weight > 0.001).length;
  const diversification =
    bonds.length <= 1 ? 1 : 1 - (hhi - 1 / bonds.length) / (1 - 1 / bonds.length);

  return {
    yield: bonds.reduce((sum, bond, index) => sum + activeWeights[index] * bond.currentYield, 0),
    duration: bonds.reduce((sum, bond, index) => sum + activeWeights[index] * bond.modifiedDuration, 0),
    riskScore: bonds.reduce((sum, bond, index) => sum + activeWeights[index] * bond.riskLevel, 0),
    convexity: bonds.reduce((sum, bond, index) => sum + activeWeights[index] * bond.convexity, 0),
    diversification,
    bondsCount,
  };
}

function buildPortfolioPositions(bonds: InternalBond[], weights: number[]): BondPortfolioPosition[] {
  return bonds
    .map((bond, index) => ({
      ticker: bond.ticker,
      name: bond.name,
      sector: bond.sector,
      currency: bond.currency,
      riskLevel: bond.riskLevel,
      yearsToMaturity: bond.yearsToMaturity,
      currentYield: bond.currentYield,
      modifiedDuration: bond.modifiedDuration,
      totalScore: bond.totalScore,
      weight: weights[index] * 100,
    }))
    .filter((bond) => bond.weight > 0.001)
    .sort((left, right) => right.weight - left.weight);
}

function buildPortfolio(
  candidates: InternalBond[],
  preferences: ResolvedBondAnalysisPreferences,
): { positions: BondPortfolioPosition[]; statistics: BondPortfolioStatistics } {
  const sorted = [...candidates].sort((left, right) => right.totalScore - left.totalScore);
  const preferredFrequency = sorted.filter((bond) => matchesPreferredFrequency(bond, preferences));
  const frequencyPool =
    preferredFrequency.length >= Math.min(MIN_BONDS, sorted.length) ? preferredFrequency : sorted;
  const highYield = frequencyPool.filter((bond) => bond.currentYield >= preferences.targetYield);
  const preferredPool =
    highYield.length >= Math.min(MIN_BONDS, frequencyPool.length) ? highYield : frequencyPool;

  const desiredCount =
    preferredPool.length <= MIN_BONDS
      ? preferredPool.length
      : Math.min(Math.max(MIN_BONDS, Math.round(preferredPool.length * 0.4)), 22, preferredPool.length, MAX_BONDS);

  const selected = pickDiversifiedBonds(preferredPool, desiredCount);
  const rawWeights = selected.map((bond, index) => {
    const rankBoost = 1 + (selected.length - index) / Math.max(selected.length, 1) * 0.15;
    return Math.max(
      0.0001,
      bond.totalScore *
        (1 + bond.currentYield * 6) *
        (1 + bond.durationScore * 0.35) *
        rankBoost,
    );
  });

  const weights = capWeights(rawWeights, MAX_WEIGHT_PER_BOND);
  const stats = computePortfolioStatistics(selected, weights);

  return {
    positions: buildPortfolioPositions(selected, weights),
    statistics: stats,
  };
}

function buildAllBonds(bonds: InternalBond[]): BondAnalysisBond[] {
  return [...bonds]
    .sort((left, right) => right.currentYield - left.currentYield)
    .map((bond) => ({
      ticker: bond.ticker,
      name: bond.name,
      sector: bond.sector,
      currency: bond.currency,
      riskLevel: bond.riskLevel,
      yearsToMaturity: bond.yearsToMaturity,
      currentYield: bond.currentYield,
      modifiedDuration: bond.modifiedDuration,
      totalScore: bond.totalScore,
    }));
}

function buildRiskStats(bonds: InternalBond[]): BondRiskStatRow[] {
  const grouped = new Map<number, InternalBond[]>();
  for (const bond of bonds) {
    const rows = grouped.get(bond.riskLevel) ?? [];
    rows.push(bond);
    grouped.set(bond.riskLevel, rows);
  }

  return [...grouped.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([riskLevel, rows]) => ({
      riskLevel,
      count: rows.length,
      avgYield: rows.reduce((sum, row) => sum + row.currentYield, 0) / rows.length,
      avgDuration: rows.reduce((sum, row) => sum + row.modifiedDuration, 0) / rows.length,
    }));
}

function buildCurrencyStats(bonds: InternalBond[]): BondCurrencyStatRow[] {
  const grouped = new Map<string, InternalBond[]>();
  for (const bond of bonds) {
    const rows = grouped.get(bond.currency) ?? [];
    rows.push(bond);
    grouped.set(bond.currency, rows);
  }

  return [...grouped.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([currency, rows]) => ({
      currency,
      count: rows.length,
      avgYield: rows.reduce((sum, row) => sum + row.currentYield, 0) / rows.length,
      avgDuration: rows.reduce((sum, row) => sum + row.modifiedDuration, 0) / rows.length,
      totalNominal: rows.reduce((sum, row) => sum + row.nominal, 0),
    }));
}

export function getRiskProfileName(level: number): string {
  switch (level) {
    case 0:
      return "Conservative";
    case 1:
      return "Moderate";
    case 2:
      return "Balanced";
    case 3:
    default:
      return "Aggressive";
  }
}

export function analyzeBondSource(rows: BondSourceRow[], preferences?: BondAnalysisPreferences): AnalysisResult {
  const resolvedPreferences = resolvePreferences(preferences);
  const normalized = rows
    .map((row) => normalizeRow(row))
    .filter((row): row is InternalBond => Boolean(row));

  const scored = scoreBonds(normalized, resolvedPreferences);
  const allBonds = buildAllBonds(scored);
  const riskPortfolios: BondRiskPortfolio[] = [0, 1, 2, 3]
    .map((riskLevel) => {
      const candidates = scored
        .filter((bond) => bond.riskLevel <= riskLevel)
        .sort((left, right) => right.totalScore - left.totalScore)
        .slice(0, 30);

      if (!candidates.length) {
        return null;
      }

      const portfolio = buildPortfolio(candidates, resolvedPreferences);
      return {
        key: String(riskLevel),
        riskLevel,
        riskName: getRiskProfileName(riskLevel),
        portfolio: portfolio.positions,
        statistics: portfolio.statistics,
      } satisfies BondRiskPortfolio;
    })
    .filter((portfolio): portfolio is BondRiskPortfolio => Boolean(portfolio));
  const selectedRiskPortfolio = riskPortfolios.find((portfolio) => portfolio.riskLevel === resolvedPreferences.targetRiskLevel);
  const selectedPortfolio = selectedRiskPortfolio
    ? {
        positions: selectedRiskPortfolio.portfolio,
        statistics: selectedRiskPortfolio.statistics,
      }
    : {
        positions: [],
        statistics: {
          yield: 0,
          duration: 0,
          riskScore: 0,
          convexity: 0,
          diversification: 0,
          bondsCount: 0,
        },
      };

  return {
    positions: selectedPortfolio.positions,
    allBonds,
    riskPortfolios,
    byRiskStats: buildRiskStats(scored),
    byCurrencyStats: buildCurrencyStats(scored),
    summary: {
      analyzedBondsCount: allBonds.length,
      selectedBondsCount: selectedPortfolio.positions.length,
      portfolioYield: selectedPortfolio.statistics.yield,
      portfolioDuration: selectedPortfolio.statistics.duration,
      portfolioRisk: selectedPortfolio.statistics.riskScore,
    },
  };
}
