import type { BondAnalysisBond, BondAnalysisPreferences } from "../../../features/bonds-analysis";
import { DEFAULT_BOND_ANALYSIS_PREFERENCES } from "../model";
import type { BondBubblePoint, BondsTranslationFn } from "../model";

export function normalizeRiskPreference(value: unknown): BondAnalysisPreferences["targetRiskLevel"] {
  return value === "0" || value === "1" || value === "2" || value === "3"
    ? value
    : DEFAULT_BOND_ANALYSIS_PREFERENCES.targetRiskLevel;
}

export function getVisiblePages(currentPage: number, totalPages: number): Array<number | null> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, null, totalPages];
  }
  if (currentPage >= totalPages - 3) {
    return [1, null, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, null, currentPage - 1, currentPage, currentPage + 1, null, totalPages];
}

export function isValidBondCountString(value: string): boolean {
  const parsed = Math.trunc(Number(value.replace(",", ".")));
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 50;
}

export function riskLabel(level: number, t: BondsTranslationFn): string {
  if (level <= 0) return t("Низкий риск", "Low risk");
  if (level === 1) return t("Умеренный риск", "Moderate risk");
  if (level === 2) return t("Повышенный риск", "Elevated risk");
  return t("Высокий риск", "High risk");
}

export function isOfzBondIdentity(ticker: string, name: string): boolean {
  const tickerUpper = ticker.trim().toUpperCase();
  const nameLower = name.trim().toLowerCase();
  return (
    tickerUpper.startsWith("SU") ||
    tickerUpper.startsWith("OFZ") ||
    nameLower.includes("офз") ||
    nameLower.includes("ofz") ||
    nameLower.includes("федерального займа")
  );
}

export function isGovernmentBond(bond: BondAnalysisBond): boolean {
  return bond.currency === "RUB" && isOfzBondIdentity(bond.ticker, bond.name);
}

export function isMunicipalBond(bond: BondAnalysisBond): boolean {
  const nameLower = bond.name.trim().toLowerCase();
  return bond.currency === "RUB" && !isGovernmentBond(bond) && (bond.sector === "municipal" || nameLower.includes("муниц"));
}

export function isCurrencyBond(bond: BondAnalysisBond): boolean {
  return bond.currency !== "RUB";
}

export function isCorporateBond(bond: BondAnalysisBond): boolean {
  return !isGovernmentBond(bond) && !isMunicipalBond(bond) && !isCurrencyBond(bond);
}

export function buildBubblePoints(bonds: BondAnalysisBond[]): BondBubblePoint[] {
  return bonds
    .filter((bond) => Number.isFinite(bond.currentYield) && Number.isFinite(bond.yearsToMaturity))
    .map((bond) => ({
      ...bond,
      yieldPct: bond.currentYield * 100,
      maturityYears: bond.yearsToMaturity,
      bubbleSize: Math.max(40, 70 + bond.totalScore * 260),
    }));
}
