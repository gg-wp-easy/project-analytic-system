import type { ColInfo, WorkBook } from "xlsx";
import type { TBankCandle } from "../../../shared/api/tbank";
import { numberOr } from "../../../shared/lib/number/numberOr";
import {
  PORTFOLIO_SIMULATION_CACHE_KEY,
  PORTFOLIO_SIMULATION_CACHE_LIMIT,
} from "../model";
import type {
  AssetMonthlyRow,
  PortfolioMonthlyRow,
  SimulationCacheEntry,
  SimulationResult,
} from "../model";

export function defaultFormationDate(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 1);
  return date.toISOString().slice(0, 10);
}

export function formatPercent(value: number, digits = 2): string {
  return Number.isFinite(value) ? `${(value * 100).toFixed(digits)}%` : "-";
}

export function formatNumber(value: number, digits = 2): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "-";
}

export function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function readCachedSimulation(key: string): SimulationCacheEntry | null {
  return loadSimulationCache()[key] ?? null;
}

export function saveCachedSimulation(key: string, result: SimulationResult): void {
  if (typeof window === "undefined") {
    return;
  }
  const cache = loadSimulationCache();
  cache[key] = {
    key,
    savedAt: new Date().toISOString(),
    result,
  };

  const entries = Object.values(cache)
    .sort((left, right) => new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime())
    .slice(0, PORTFOLIO_SIMULATION_CACHE_LIMIT);
  window.localStorage.setItem(
    PORTFOLIO_SIMULATION_CACHE_KEY,
    JSON.stringify(Object.fromEntries(entries.map((entry) => [entry.key, entry]))),
  );
}

export function normalizeAnnualDividendYield(value: unknown): number {
  const raw = numberOr(value, 0);
  if (!Number.isFinite(raw) || raw <= 0) {
    return 0;
  }
  return raw > 1 ? raw / 100 : raw;
}

export function buildMonthlyReturns(candles: TBankCandle[], monthlyDividendAdjustment: number): Map<string, number> {
  const ordered = [...candles]
    .filter((row) => Number.isFinite(row.close) && row.close > 0)
    .sort((left, right) => new Date(left.time).getTime() - new Date(right.time).getTime());
  const grouped = new Map<string, TBankCandle[]>();

  ordered.forEach((row) => {
    const key = monthKey(row.time);
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  });

  const returns = new Map<string, number>();
  grouped.forEach((items, key) => {
    const first = items[0]?.close;
    const last = items[items.length - 1]?.close;
    if (Number.isFinite(first) && Number.isFinite(last) && first > 0) {
      returns.set(key, last / first - 1 + monthlyDividendAdjustment);
    }
  });

  return returns;
}

export function buildSimulation(
  monthlyReturnsByTicker: Map<string, Map<string, number>>,
  weightsByTicker: Map<string, number>,
  riskFreeRate: number,
): SimulationResult {
  const months = [...new Set([...monthlyReturnsByTicker.values()].flatMap((values) => [...values.keys()]))].sort();
  const assetCumulative = new Map<string, number>();
  const assetRows: AssetMonthlyRow[] = [];
  let portfolioCumulative = 1;
  const portfolioRows: PortfolioMonthlyRow[] = [];

  months.forEach((month) => {
    let portfolioReturn = 0;
    monthlyReturnsByTicker.forEach((returns, ticker) => {
      const monthlyReturn = returns.get(month) ?? 0;
      const nextCumulative = (assetCumulative.get(ticker) ?? 1) * (1 + monthlyReturn);
      assetCumulative.set(ticker, nextCumulative);
      assetRows.push({
        month,
        ticker,
        monthlyReturn,
        cumulativeReturn: nextCumulative - 1,
      });
      portfolioReturn += monthlyReturn * (weightsByTicker.get(ticker) ?? 0);
    });

    portfolioCumulative *= 1 + portfolioReturn;
    portfolioRows.push({
      month,
      monthlyReturn: portfolioReturn,
      cumulativeReturn: portfolioCumulative - 1,
    });
  });

  return {
    portfolioRows,
    assetRows,
    metrics: calculateMetrics(portfolioRows.map((row) => row.monthlyReturn), riskFreeRate),
  };
}

type XlsxUtils = typeof import("xlsx")["utils"];

export function appendSheet(utils: XlsxUtils, workbook: WorkBook, name: string, rows: Array<Array<string | number>>): void {
  const sheet = utils.aoa_to_sheet(rows);
  sheet["!cols"] = estimateSheetWidths(rows);
  utils.book_append_sheet(workbook, sheet, name);
}

function loadSimulationCache(): Record<string, SimulationCacheEntry> {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PORTFOLIO_SIMULATION_CACHE_KEY) ?? "{}") as Record<string, SimulationCacheEntry>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function monthKey(value: string): string {
  return value.slice(0, 7);
}

function stdev(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(Math.max(variance, 0));
}

function calculateMetrics(returns: number[], riskFreeRate: number): SimulationResult["metrics"] {
  if (!returns.length) {
    return {
      totalReturn: 0,
      annualizedReturn: 0,
      volatility: 0,
      sharpe: 0,
      sortino: 0,
      months: 0,
    };
  }

  const cumulative = returns.reduce((value, item) => value * (1 + item), 1) - 1;
  const years = returns.length / 12;
  const annualizedReturn = years > 0 ? (1 + cumulative) ** (1 / years) - 1 : cumulative;
  const monthlyMean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const monthlyVolatility = stdev(returns);
  const volatility = monthlyVolatility * Math.sqrt(12);
  const monthlyRiskFree = riskFreeRate / 12;
  const excessMean = monthlyMean - monthlyRiskFree;
  const downside = returns.map((value) => Math.min(value - monthlyRiskFree, 0)).filter((value) => value < 0);
  const downsideDeviation = stdev(downside) * Math.sqrt(12);
  const sharpe = monthlyVolatility > 0 ? (excessMean / monthlyVolatility) * Math.sqrt(12) : 0;
  const sortino = downsideDeviation > 0 ? (annualizedReturn - riskFreeRate) / downsideDeviation : 0;

  return {
    totalReturn: cumulative,
    annualizedReturn,
    volatility,
    sharpe: Math.abs(sharpe),
    sortino: Math.abs(sortino),
    months: returns.length,
  };
}

function estimateSheetWidths(table: Array<Array<string | number>>): ColInfo[] {
  const count = Math.max(...table.map((row) => row.length), 0);
  return Array.from({ length: count }, (_, colIndex) => {
    const width = table.reduce((max, row) => Math.max(max, String(row[colIndex] ?? "").length), 10);
    return { wch: Math.min(Math.max(width + 2, 10), 42) };
  });
}
