import { numberOr } from "../../../shared/lib/number/numberOr";
import type {
  CandidateRow,
  FactorCandidate,
  LevelMultiple,
  ModelQuality,
  ValuationReport,
} from "../model/valuation-report.types";

type AnyRecord = Record<string, unknown>;

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as AnyRecord) : {};
}

function asArray(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

function numberRecord(value: unknown): Record<string, number> {
  return Object.fromEntries(Object.entries(asRecord(value)).map(([key, item]) => [key, numberOr(item, 0)]));
}

function stringRecord(value: unknown): Record<string, string> {
  return Object.fromEntries(Object.entries(asRecord(value)).map(([key, item]) => [key, String(item ?? "")]));
}

const BASELINE_LABELS: Record<string, string> = {
  train_mean: "Средний уровень рынка (ориентир)",
  sector_median: "Медиана отрасли (ориентир)",
};

/** Factors the factor analysis kept (the sector block counts as one factor). */
export function selectedFactorLabels(report: ValuationReport | null, isEn = false): string[] {
  if (!report) {
    return [];
  }
  const labels = report.candidates.filter((row) => row.status === "selected").map((row) => row.label);
  return report.selectedFactors.includes("sector") ? [...labels, isEn ? "Sector" : "Отрасль"] : labels;
}

export function parseValuationReport(parsed: AnyRecord): ValuationReport | null {
  const report = asRecord(parsed.valuation_report);
  if (!Object.keys(report).length) {
    return null;
  }
  const dataset = asRecord(report.dataset);
  const level = asRecord(report.valuation_level);
  const factor = asRecord(report.factor_analysis);
  const model = asRecord(factor.model);
  const structure = asRecord(factor.structure);
  const valuation = asRecord(report.valuation);
  const counts = asRecord(valuation.counts);
  const candidates = asRecord(report.candidates);
  const screen = asRecord(candidates.market_cap_screen);
  const risk = asRecord(report.risk_model);
  const returns = asRecord(report.expected_return_model);

  const factorRows: FactorCandidate[] = asArray(factor.candidates).map((row) => ({
    feature: String(row.feature ?? ""),
    label: String(row.label ?? row.feature ?? ""),
    status: String(row.status ?? ""),
    coverage: numberOr(row.coverage, NaN),
    coefficient: numberOr(row.coefficient, NaN),
    pValue: numberOr(row.p_value, NaN),
    vif: numberOr(row.vif, NaN),
    bootstrapFrequency: numberOr(row.bootstrap_frequency, NaN),
    relatedFeature: typeof row.related_feature === "string" ? row.related_feature : undefined,
  }));
  const models: ModelQuality[] = asArray(report.models).map((row) => ({
    key: String(row.model ?? ""),
    label: String(row.label ?? row.model ?? ""),
    weight: numberOr(row.weight, NaN),
    r2: numberOr(row.r2, NaN),
    typicalError: numberOr(row.typical_error, NaN),
  }));
  const baselines: ModelQuality[] = Object.entries(asRecord(report.baselines)).map(([key, value]) => {
    const row = asRecord(value);
    return { key, label: BASELINE_LABELS[key] ?? key, weight: NaN, r2: numberOr(row.r2, NaN),
      typicalError: numberOr(row.typical_error, NaN) };
  });
  const levelMultiples: LevelMultiple[] = asArray(level.table).map((row) => ({
    multiple: String(row.multiple ?? ""),
    label: String(row.label ?? row.multiple ?? ""),
    status: String(row.status ?? ""),
    loading: numberOr(row.loading, NaN),
    median: numberOr(row.median, NaN),
    coverage: numberOr(row.coverage, NaN),
  }));
  const pool: CandidateRow[] = asArray(candidates.pool).map((row) => ({
    ticker: String(row.ticker ?? ""),
    name: String(row.name ?? row.ticker ?? ""),
    sector: String(row.sector ?? ""),
    tier: numberOr(row.tier, NaN),
    tierLabel: String(row.tier_label ?? ""),
    sizeLabel: String(row.size_label ?? ""),
    marketCapBn: numberOr(row.market_cap_bn, NaN),
    valuationClass: String(row.valuation_class_text ?? ""),
    pe: numberOr(row.pe, NaN),
    fairPe: numberOr(row.fair_pe, NaN),
    multiplesVsMarket: numberOr(row.multiples_vs_market, NaN),
    upside: numberOr(row.upside, NaN),
    dividendPayer: row.dividend_payer === true,
    expectedReturn: numberOr(row.expected_return, NaN),
    dividendYieldUsed: numberOr(row.dividend_yield_used, NaN),
    growthUsed: numberOr(row.growth_used, NaN),
    risk: numberOr(row.risk, NaN),
  }));

  return {
    steps: Array.isArray(report.pipeline) ? report.pipeline.map(String) : [],
    companies: numberOr(dataset.companies, 0),
    ratedCompanies: numberOr(dataset.rated_companies, 0),
    notRated: numberRecord(dataset.not_rated),
    dividendPayers: numberOr(dataset.dividend_payers, 0),
    level: {
      labels: Array.isArray(level.labels) ? level.labels.map(String) : [],
      formula: String(level.formula ?? ""),
      minLoading: numberOr(level.min_loading, NaN),
      kmo: numberOr(level.kmo, NaN),
      bartlettPValue: numberOr(level.bartlett_p_value, NaN),
      explainedVariance: numberOr(level.explained_variance, NaN),
      factorsCount: numberOr(level.factors_count, NaN),
      table: levelMultiples,
    },
    selectedFactors: Array.isArray(factor.selected_features) ? factor.selected_features.map(String) : [],
    factorModel: {
      observations: numberOr(model.observations, NaN),
      r2: numberOr(model.r2, NaN),
      adjR2: numberOr(model.adj_r2, NaN),
      sectorPValue: numberOr(model.sector_p_value, NaN),
      jointPValue: numberOr(model.joint_p_value, NaN),
    },
    factorStructure: {
      kmo: numberOr(structure.kmo, NaN),
      bartlettPValue: numberOr(structure.bartlett_p_value, NaN),
      factorsCount: numberOr(structure.factors_count, NaN),
      groups: Object.fromEntries(
        Object.entries(asRecord(structure.groups)).map(([key, members]) => [key, Array.isArray(members) ? members.map(String) : []]),
      ),
    },
    weakEvidence: factor.weak_evidence === true,
    factorNote: String(factor.note ?? ""),
    candidates: factorRows,
    models,
    baselines,
    ensembleR2: numberOr(asRecord(report.ensemble).r2, NaN),
    classCounts: {
      undervalued: numberOr(counts.undervalued, 0),
      fair: numberOr(counts.fair, 0),
      overvalued: numberOr(counts.overvalued, 0),
    },
    classRule: String(valuation.rule ?? ""),
    tiers: stringRecord(candidates.tiers),
    tierCounts: numberRecord(candidates.tier_counts),
    required: Array.isArray(candidates.required) ? candidates.required.map(String) : [],
    marketCapScreen: {
      minBn: numberOr(screen.min_market_cap_bn, NaN),
      largeBn: numberOr(screen.large_cap_bn, NaN),
      excluded: Array.isArray(screen.excluded) ? screen.excluded.map(String) : [],
    },
    fillers: Array.isArray(candidates.fillers) ? candidates.fillers.map(String) : [],
    pool,
    riskSource: String(risk.source ?? ""),
    riskWeeks: numberOr(risk.weeks, NaN),
    riskWindow: risk.window_start && risk.window_end ? `${String(risk.window_start)} — ${String(risk.window_end)}` : "",
    riskShrinkage: numberOr(risk.shrinkage, NaN),
    riskReason: String(risk.reason ?? ""),
    riskDropped: stringRecord(risk.dropped),
    expectedReturnFormula: String(returns.formula ?? ""),
    objective: String(report.objective ?? ""),
    objectiveLabel: String(report.objective_label ?? ""),
    portfolioStatus: String(report.portfolio_status ?? ""),
    portfolioMessage: String(report.portfolio_message ?? ""),
  };
}
