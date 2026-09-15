import type { BondAnalysisBond, BondAnalysisPreferences } from "../../../features/bonds-analysis";
import { DEFAULT_BOND_ANALYSIS_PREFERENCES } from "../model";
import type { BondsTranslationFn } from "../model";

export function normalizeRiskPreference(value: unknown): BondAnalysisPreferences["riskProfile"] {
  return value === "mixed" || value === "0" || value === "1" || value === "2"
    ? value
    : DEFAULT_BOND_ANALYSIS_PREFERENCES.riskProfile;
}

export function normalizeMethod(value: unknown): BondAnalysisPreferences["method"] {
  return value === "immunization" ? "immunization" : "matching";
}

export function isPositiveNumberString(value: string): boolean {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0;
}

export function isValidBondCountString(value: string, minimum = 1): boolean {
  const parsed = Math.trunc(Number(value.replace(",", ".")));
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= 50;
}

export function getVisiblePages(currentPage: number, totalPages: number): Array<number | null> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  if (currentPage <= 4) return [1, 2, 3, 4, 5, null, totalPages];
  if (currentPage >= totalPages - 3) return [1, null, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  return [1, null, currentPage - 1, currentPage, currentPage + 1, null, totalPages];
}

export function riskLabel(level: string | number, t: BondsTranslationFn): string {
  if (level === "mixed") return t("Смешанный риск", "Mixed risk");
  const numericLevel = Number(level);
  if (numericLevel <= 0) return t("Низкий риск", "Low risk");
  if (numericLevel === 1) return t("Средний риск", "Medium risk");
  return t("Высокий риск", "High risk");
}

export function isOfzBondIdentity(ticker: string, name: string): boolean {
  const tickerUpper = ticker.trim().toUpperCase();
  const nameLower = name.trim().toLowerCase();
  return tickerUpper.startsWith("SU") || tickerUpper.startsWith("OFZ") || nameLower.includes("офз") || nameLower.includes("ofz") || nameLower.includes("федерального займа");
}
export function isGovernmentBond(bond: BondAnalysisBond): boolean { return bond.currency === "RUB" && isOfzBondIdentity(bond.ticker, bond.name); }
export function isMunicipalBond(bond: BondAnalysisBond): boolean { return bond.currency === "RUB" && !isGovernmentBond(bond) && (bond.sector === "municipal" || bond.name.trim().toLowerCase().includes("муниц")); }
export function isCurrencyBond(bond: BondAnalysisBond): boolean { return bond.currency !== "RUB"; }
export function isCorporateBond(bond: BondAnalysisBond): boolean { return !isGovernmentBond(bond) && !isMunicipalBond(bond) && !isCurrencyBond(bond); }
