import type { AssetFundamentalRecord, ShareRecord } from "../../../entities/fundamentals";
import { normalizeAnnualDividendYield } from "../../portfolio-simulation/lib";
import { numberOr } from "../../../shared/lib/number/numberOr";
import {
  SAVED_PORTFOLIOS_STORAGE_KEY,
  type SavedPortfolio,
  type SavedPortfolioHolding,
  type SavedPortfolioMetric,
  type SavePortfolioHoldingInput,
} from "../model";

export function readSavedPortfolios(): SavedPortfolio[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SAVED_PORTFOLIOS_STORAGE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map(normalizeSavedPortfolio)
      .filter((item): item is SavedPortfolio => Boolean(item))
      .sort((left, right) => new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime());
  } catch {
    return [];
  }
}

export function writeSavedPortfolios(portfolios: SavedPortfolio[]): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(SAVED_PORTFOLIOS_STORAGE_KEY, JSON.stringify(portfolios));
}

export function saveSavedPortfolio(portfolio: SavedPortfolio): SavedPortfolio[] {
  const existing = readSavedPortfolios().filter((item) => item.id !== portfolio.id);
  const next = [portfolio, ...existing].sort((left, right) => new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime());
  writeSavedPortfolios(next);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("saved-portfolios:changed"));
  }
  return next;
}

export function deleteSavedPortfolio(id: string): SavedPortfolio[] {
  const next = readSavedPortfolios().filter((item) => item.id !== id);
  writeSavedPortfolios(next);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("saved-portfolios:changed"));
  }
  return next;
}

export function createSavedPortfolioId(): string {
  const random = Math.random().toString(36).slice(2, 9);
  return `portfolio-${Date.now().toString(36)}-${random}`;
}

export function toDateInputValue(value: Date = new Date()): string {
  return value.toISOString().slice(0, 10);
}

export function enrichPortfolioHoldings(
  holdings: SavePortfolioHoldingInput[],
  shares: ShareRecord[] = [],
  fundamentalsByFigi: Record<string, AssetFundamentalRecord> = {},
): SavedPortfolioHolding[] {
  const shareByTicker = new Map(shares.map((share) => [share.ticker.toUpperCase(), share]));
  const maxWeight = holdings.reduce((max, row) => Math.max(max, numberOr(row.weight, 0)), 0);
  const shouldConvertFractionToPercent = maxWeight > 0 && maxWeight <= 1;

  return holdings
    .map((row) => {
      const ticker = String(row.ticker ?? "").trim().toUpperCase();
      if (!ticker) {
        return null;
      }
      const share = shareByTicker.get(ticker);
      const figi = String(row.figi || share?.figi || "").trim() || undefined;
      const fundamentals = figi ? fundamentalsByFigi[figi] : undefined;
      const rawDividendYield = row.annualDividendYield ?? row.dividendYield ?? row.currentYield ?? fundamentals?.dividendYield ?? null;
      const weight = numberOr(row.weight, 0) * (shouldConvertFractionToPercent ? 100 : 1);

      return {
        figi,
        ticker,
        name: row.name ?? share?.name ?? ticker,
        weight,
        currency: row.currency ?? share?.currency ?? null,
        annualDividendYield: normalizeAnnualDividendYield(rawDividendYield),
        expectedReturn: normalizedOptionalNumber(row.expectedReturn),
        risk: normalizedOptionalNumber(row.risk),
        sharpe: normalizedOptionalNumber(row.sharpe),
      } satisfies SavedPortfolioHolding;
    })
    .filter((row): row is SavedPortfolioHolding => Boolean(row) && row.weight > 0)
    .sort((left, right) => right.weight - left.weight);
}

export function normalizeSavedMetrics(metrics: SavedPortfolioMetric[]): SavedPortfolioMetric[] {
  return metrics
    .map((metric) => ({
      label: String(metric.label ?? "").trim(),
      value: String(metric.value ?? "").trim(),
      rawValue: metric.rawValue ?? null,
    }))
    .filter((metric) => metric.label && metric.value);
}

function normalizedOptionalNumber(value: unknown): number | null {
  const parsed = numberOr(value, NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSavedPortfolio(value: unknown): SavedPortfolio | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const row = value as SavedPortfolio;
  const holdings = Array.isArray(row.holdings) ? row.holdings : [];
  if (!holdings.length) {
    return null;
  }
  const name = String(row.name ?? "").trim();
  const sourceLabel = String(row.sourceLabel ?? "").trim();
  return {
    id: String(row.id || createSavedPortfolioId()),
    name: name || "Portfolio",
    sourceKey: row.sourceKey,
    sourceLabel: sourceLabel || "Analysis",
    assetClass: row.assetClass === "bond" ? "bond" : "stock",
    createdAt: String(row.createdAt || toDateInputValue()),
    savedAt: String(row.savedAt || new Date().toISOString()),
    holdings: holdings
      .map((holding) => ({
        figi: holding.figi || undefined,
        ticker: String(holding.ticker ?? "").trim().toUpperCase(),
        name: holding.name ?? holding.ticker,
        weight: numberOr(holding.weight, 0),
        currency: holding.currency ?? null,
        annualDividendYield: normalizedOptionalNumber(holding.annualDividendYield),
        expectedReturn: normalizedOptionalNumber(holding.expectedReturn),
        risk: normalizedOptionalNumber(holding.risk),
        sharpe: normalizedOptionalNumber(holding.sharpe),
      }))
      .filter((holding) => holding.ticker && holding.weight > 0),
    metrics: normalizeSavedMetrics(Array.isArray(row.metrics) ? row.metrics : []),
  };
}
