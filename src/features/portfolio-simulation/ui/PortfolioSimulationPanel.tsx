import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, Play, RefreshCw } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import * as XLSX from "xlsx";
import type { AssetFundamentalRecord, ShareRecord } from "../../../entities/fundamentals";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import { createTBankInstrumentsApi, type TBankCandle } from "../../../shared/api/tbank";
import { numberOr } from "../../../shared/lib/number/numberOr";
import { MetricCard, MetricGrid, SectionCard } from "../../../shared/ui/analysis-shell";

type PortfolioSimulationHolding = {
  figi?: string;
  ticker: string;
  name?: string | null;
  weight: number;
};

type NormalizedHolding = PortfolioSimulationHolding & {
  figi: string;
  normalizedWeight: number;
  annualDividendYield: number;
};

type AssetMonthlyRow = {
  month: string;
  ticker: string;
  monthlyReturn: number;
  cumulativeReturn: number;
};

type PortfolioMonthlyRow = {
  month: string;
  monthlyReturn: number;
  cumulativeReturn: number;
};

type SimulationResult = {
  portfolioRows: PortfolioMonthlyRow[];
  assetRows: AssetMonthlyRow[];
  metrics: {
    totalReturn: number;
    annualizedReturn: number;
    volatility: number;
    sharpe: number;
    sortino: number;
    months: number;
  };
};

type PortfolioSimulationPanelProps = {
  holdings: PortfolioSimulationHolding[];
  shares: ShareRecord[];
  fundamentalsByFigi: Record<string, AssetFundamentalRecord>;
  analysisName: string;
  filenamePrefix: string;
};

const chartColors = ["#2563eb", "#059669", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2"];
const SIMULATION_CACHE_KEY = "portfolio-simulation-cache-v1";
const SIMULATION_CACHE_LIMIT = 40;

type SimulationCacheEntry = {
  key: string;
  savedAt: string;
  result: SimulationResult;
};

function defaultFormationDate(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 1);
  return date.toISOString().slice(0, 10);
}

function monthKey(value: string): string {
  return value.slice(0, 7);
}

function formatPercent(value: number, digits = 2): string {
  return Number.isFinite(value) ? `${(value * 100).toFixed(digits)}%` : "-";
}

function formatNumber(value: number, digits = 2): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "-";
}

function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function loadSimulationCache(): Record<string, SimulationCacheEntry> {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SIMULATION_CACHE_KEY) ?? "{}") as Record<string, SimulationCacheEntry>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function readCachedSimulation(key: string): SimulationCacheEntry | null {
  return loadSimulationCache()[key] ?? null;
}

function saveCachedSimulation(key: string, result: SimulationResult): void {
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
    .slice(0, SIMULATION_CACHE_LIMIT);
  window.localStorage.setItem(
    SIMULATION_CACHE_KEY,
    JSON.stringify(Object.fromEntries(entries.map((entry) => [entry.key, entry]))),
  );
}

function normalizeAnnualDividendYield(value: unknown): number {
  const raw = numberOr(value, 0);
  if (!Number.isFinite(raw) || raw <= 0) {
    return 0;
  }
  return raw > 1 ? raw / 100 : raw;
}

function stdev(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(Math.max(variance, 0));
}

function buildMonthlyReturns(candles: TBankCandle[], monthlyDividendAdjustment: number): Map<string, number> {
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

function buildSimulation(
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

function estimateSheetWidths(table: Array<Array<string | number>>): XLSX.ColInfo[] {
  const count = Math.max(...table.map((row) => row.length), 0);
  return Array.from({ length: count }, (_, colIndex) => {
    const width = table.reduce((max, row) => Math.max(max, String(row[colIndex] ?? "").length), 10);
    return { wch: Math.min(Math.max(width + 2, 10), 42) };
  });
}

function appendSheet(workbook: XLSX.WorkBook, name: string, rows: Array<Array<string | number>>): void {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = estimateSheetWidths(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, name);
}

export function PortfolioSimulationPanel({
  holdings,
  shares,
  fundamentalsByFigi,
  analysisName,
  filenamePrefix,
}: PortfolioSimulationPanelProps) {
  const { t } = useAppSettings();
  const [formationDate, setFormationDate] = useState(defaultFormationDate);
  const [riskFreeRate, setRiskFreeRate] = useState("0");
  const [includeDividendGap, setIncludeDividendGap] = useState(true);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tickerToShare = useMemo(() => {
    const map = new Map<string, ShareRecord>();
    shares.forEach((share) => map.set(share.ticker.toUpperCase(), share));
    return map;
  }, [shares]);

  const normalizedHoldings = useMemo<NormalizedHolding[]>(() => {
    const rows = holdings
      .map((holding) => {
        const ticker = holding.ticker.trim().toUpperCase();
        const share = tickerToShare.get(ticker);
        const figi = holding.figi || share?.figi || "";
        const fundamentals = figi ? fundamentalsByFigi[figi] : undefined;
        return {
          ...holding,
          ticker,
          figi,
          name: holding.name || share?.name || ticker,
          weight: numberOr(holding.weight, 0),
          annualDividendYield: normalizeAnnualDividendYield(fundamentals?.dividendYield),
        };
      })
      .filter((holding) => holding.figi && holding.weight > 0);

    const weightSum = rows.reduce((sum, holding) => sum + holding.weight, 0);
    return rows.map((holding) => ({
      ...holding,
      normalizedWeight: weightSum > 0 ? holding.weight / weightSum : 0,
    }));
  }, [fundamentalsByFigi, holdings, tickerToShare]);

  const simulationCacheKey = useMemo(() => {
    if (!normalizedHoldings.length) {
      return "";
    }
    const payload = {
      analysisName,
      filenamePrefix,
      formationDate,
      riskFreeRate: String(numberOr(riskFreeRate, 0)),
      includeDividendGap,
      holdings: normalizedHoldings
        .map((holding) => ({
          figi: holding.figi,
          ticker: holding.ticker,
          weight: Number(holding.normalizedWeight.toFixed(8)),
          dividendYield: Number(holding.annualDividendYield.toFixed(8)),
        }))
        .sort((left, right) => left.ticker.localeCompare(right.ticker)),
    };
    return `${filenamePrefix}-${hashString(JSON.stringify(payload))}`;
  }, [analysisName, filenamePrefix, formationDate, includeDividendGap, normalizedHoldings, riskFreeRate]);

  useEffect(() => {
    if (!simulationCacheKey) {
      setResult(null);
      setCachedAt(null);
      return;
    }

    const cached = readCachedSimulation(simulationCacheKey);
    if (cached) {
      setResult(cached.result);
      setCachedAt(cached.savedAt);
      setError(null);
      return;
    }

    setResult(null);
    setCachedAt(null);
  }, [simulationCacheKey]);

  const chartRows = useMemo(() => {
    if (!result) {
      return [];
    }
    const byMonth = new Map<string, Record<string, string | number>>();
    result.portfolioRows.forEach((row) => {
      byMonth.set(row.month, {
        month: row.month,
        [t("Портфель", "Portfolio")]: row.cumulativeReturn * 100,
      });
    });

    normalizedHoldings.slice(0, 5).forEach((holding) => {
      result.assetRows
        .filter((row) => row.ticker === holding.ticker)
        .forEach((row) => {
          const item = byMonth.get(row.month);
          if (item) {
            item[holding.ticker] = row.cumulativeReturn * 100;
          }
        });
    });

    return [...byMonth.values()];
  }, [normalizedHoldings, result, t]);

  const monthlyMatrix = useMemo(() => {
    if (!result) {
      return { months: [] as string[], rows: [] as Array<{ ticker: string; name: string; values: number[]; total: number }>, portfolioValues: [] as number[], portfolioTotal: 0 };
    }
    const months = result.portfolioRows.map((row) => row.month);
    const rows = normalizedHoldings.map((holding) => {
      let cumulative = 1;
      const byMonth = new Map(
        result.assetRows
          .filter((row) => row.ticker === holding.ticker)
          .map((row) => [row.month, row.monthlyReturn]),
      );
      const values = months.map((month) => {
        const monthlyReturn = byMonth.get(month) ?? 0;
        cumulative *= 1 + monthlyReturn;
        return monthlyReturn;
      });
      return {
        ticker: holding.ticker,
        name: holding.name ?? holding.ticker,
        values,
        total: cumulative - 1,
      };
    });

    return {
      months,
      rows,
      portfolioValues: result.portfolioRows.map((row) => row.monthlyReturn),
      portfolioTotal: result.metrics.totalReturn,
    };
  }, [normalizedHoldings, result]);

  const runSimulation = async () => {
    if (!normalizedHoldings.length) {
      setError(t("Не удалось сопоставить акции портфеля с FIGI.", "Could not match portfolio stocks to FIGI."));
      return;
    }

    const from = new Date(formationDate);
    if (!Number.isFinite(from.getTime())) {
      setError(t("Укажите корректную дату формирования портфеля.", "Enter a valid portfolio formation date."));
      return;
    }

    const to = new Date();
    if (from >= to) {
      setError(t("Дата формирования должна быть раньше сегодняшней даты.", "Formation date must be before today."));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const api = createTBankInstrumentsApi();
      const monthlyReturnsByTicker = new Map<string, Map<string, number>>();
      const weightsByTicker = new Map<string, number>();

      await Promise.all(
        normalizedHoldings.map(async (holding) => {
          const candles = await api.fetchCandles({
            figi: holding.figi ?? "",
            from: from.toISOString(),
            to: to.toISOString(),
            interval: "CANDLE_INTERVAL_DAY",
            limit: 2500,
          });
          const monthlyDividendAdjustment = includeDividendGap ? holding.annualDividendYield / 12 : 0;
          monthlyReturnsByTicker.set(holding.ticker, buildMonthlyReturns(candles, monthlyDividendAdjustment));
          weightsByTicker.set(holding.ticker, holding.normalizedWeight);
        }),
      );

      const nextResult = buildSimulation(
        monthlyReturnsByTicker,
        weightsByTicker,
        Math.max(numberOr(riskFreeRate, 0), 0) / 100,
      );

      if (!nextResult.portfolioRows.length) {
        setError(t("За выбранный период нет дневных свечей по акциям портфеля.", "No daily candles for the selected period."));
        setResult(null);
        setCachedAt(null);
        return;
      }

      setResult(nextResult);
      setCachedAt(null);
      if (simulationCacheKey) {
        saveCachedSimulation(simulationCacheKey, nextResult);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Не удалось рассчитать динамику.", "Failed to calculate performance."));
      setResult(null);
      setCachedAt(null);
    } finally {
      setIsLoading(false);
    }
  };

  const exportToXlsx = () => {
    if (!result) {
      return;
    }

    const workbook = XLSX.utils.book_new();
    appendSheet(workbook, "Summary", [
      ["Analysis", analysisName],
      ["Formation Date", formationDate],
      ["Risk Free Rate", `${riskFreeRate}%`],
      ["Dividend Gap Adjustment", includeDividendGap ? "Enabled" : "Disabled"],
      ["Dividend Gap Method", "Monthly return = price return + annual dividend yield / 12"],
      ["Months", result.metrics.months],
      ["Total Return", result.metrics.totalReturn],
      ["Annualized Return", result.metrics.annualizedReturn],
      ["Volatility", result.metrics.volatility],
      ["Sharpe", result.metrics.sharpe],
      ["Sortino", result.metrics.sortino],
    ]);
    appendSheet(workbook, "Portfolio Dynamics", [
      ["Month", "Monthly Return", "Cumulative Return"],
      ...result.portfolioRows.map((row) => [row.month, row.monthlyReturn, row.cumulativeReturn]),
    ]);
    appendSheet(workbook, "Asset Dynamics", [
      ["Month", "Ticker", "Monthly Return", "Cumulative Return"],
      ...result.assetRows.map((row) => [row.month, row.ticker, row.monthlyReturn, row.cumulativeReturn]),
    ]);
    appendSheet(workbook, "Monthly Matrix", [
      ["Ticker", "Name", ...monthlyMatrix.months, "Total"],
      ...monthlyMatrix.rows.map((row) => [row.ticker, row.name, ...row.values, row.total]),
      ["Portfolio Total", "", ...monthlyMatrix.portfolioValues, monthlyMatrix.portfolioTotal],
    ]);
    appendSheet(workbook, "Holdings", [
      ["Ticker", "Name", "Weight", "Annual Dividend Yield"],
      ...normalizedHoldings.map((row) => [row.ticker, row.name ?? "", row.normalizedWeight, row.annualDividendYield]),
    ]);

    XLSX.writeFile(workbook, `${filenamePrefix}-performance.xlsx`, { compression: true });
  };

  if (!holdings.length) {
    return null;
  }

  return (
    <SectionCard
      title={t("Моделирование доходности портфеля", "Portfolio Return Simulation")}
      description={t(
        "Расчет месячной динамики акций и всего портфеля от даты формирования.",
        "Monthly performance for individual stocks and the whole portfolio from the formation date.",
      )}
      action={(
        <button
          type="button"
          onClick={exportToXlsx}
          disabled={!result}
          className="ui-secondary-button px-3 py-2 text-xs"
        >
          <FileSpreadsheet className="h-4 w-4" />
          XLSX
        </button>
      )}
    >
      <div className="mb-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_10rem_minmax(12rem,14rem)_auto]">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">{t("Дата формирования", "Formation date")}</span>
          <input
            type="date"
            value={formationDate}
            onChange={(event) => setFormationDate(event.target.value)}
            className="ui-input w-full"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">{t("Безрисковая, %", "Risk-free, %")}</span>
          <input
            type="number"
            min="0"
            step="0.1"
            value={riskFreeRate}
            onChange={(event) => setRiskFreeRate(event.target.value)}
            className="ui-input w-full"
          />
        </label>
        <label className="flex items-center gap-2 self-end rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={includeDividendGap}
            onChange={(event) => setIncludeDividendGap(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          {t("Учитывать див. гэп", "Dividend gap")}
        </label>
        <button
          type="button"
          onClick={runSimulation}
          disabled={isLoading || !normalizedHoldings.length}
          className="ui-primary-button self-end px-4 py-2"
        >
          {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {isLoading ? t("Расчет...", "Calculating...") : t("Рассчитать", "Calculate")}
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {error}
        </p>
      )}

      {cachedAt && !error && (
        <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          {t("Результат моделирования загружен из кэша.", "Simulation result loaded from cache.")}
        </p>
      )}

      {result && (
        <div className="space-y-5">
          <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
            {includeDividendGap
              ? t(
                  "Дивидендный гэп учтен приближенно: к месячной доходности каждой акции добавляется 1/12 ее годовой дивидендной доходности из фундаментальных данных.",
                  "Dividend gap is approximated by adding 1/12 of each stock's annual dividend yield to its monthly return.",
                )
              : t(
                  "Показана доходность только по изменению цены без дивидендной поправки.",
                  "Performance is based on price changes only, without dividend adjustment.",
                )}
          </p>

          <MetricGrid>
            <MetricCard label={t("Доходность", "Total return")} value={formatPercent(result.metrics.totalReturn)} />
            <MetricCard label={t("Годовая доходность", "Annualized return")} value={formatPercent(result.metrics.annualizedReturn)} />
            <MetricCard label={t("Волатильность", "Volatility")} value={formatPercent(result.metrics.volatility)} />
            <MetricCard label={t("Шарп", "Sharpe")} value={formatNumber(result.metrics.sharpe)} />
            <MetricCard label={t("Сортино", "Sortino")} value={formatNumber(result.metrics.sortino)} />
          </MetricGrid>

          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={chartRows} margin={{ top: 8, right: 24, left: 8, bottom: 28 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="month"
                stroke="#64748b"
                tickMargin={8}
                label={{ value: t("Месяц", "Month"), position: "insideBottom", offset: -20, fill: "#64748b" }}
              />
              <YAxis
                stroke="#64748b"
                tickMargin={8}
                tickFormatter={(value: number) => `${Number(value).toFixed(0)}%`}
                label={{ value: t("Накопленная доходность", "Cumulative return"), angle: -90, position: "insideLeft", fill: "#64748b" }}
              />
              <Tooltip formatter={(value: number) => `${Number(value).toFixed(2)}%`} />
              <Legend verticalAlign="top" height={32} />
              <Line
                type="monotone"
                dataKey={t("Портфель", "Portfolio")}
                stroke="#111827"
                strokeWidth={3}
                dot={false}
              />
              {normalizedHoldings.slice(0, 5).map((holding, index) => (
                <Line
                  key={holding.ticker}
                  type="monotone"
                  dataKey={holding.ticker}
                  stroke={chartColors[index % chartColors.length]}
                  strokeWidth={1.8}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t("Месячная доходность по акциям", "Monthly Returns by Stock")}
            </h3>
            <div className="ui-table-shell overflow-x-auto">
              <table className="ui-data-table min-w-[64rem]">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-white dark:bg-slate-950">Ticker</th>
                    <th>{t("Акция", "Stock")}</th>
                    {monthlyMatrix.months.map((month) => (
                      <th key={month} className="ui-cell-number whitespace-nowrap">{month}</th>
                    ))}
                    <th className="ui-cell-number">{t("Итого", "Total")}</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyMatrix.rows.map((row) => (
                    <tr key={row.ticker}>
                      <td className="sticky left-0 z-10 bg-white font-medium text-slate-900 dark:bg-slate-950 dark:text-slate-100">{row.ticker}</td>
                      <td className="min-w-48">{row.name}</td>
                      {row.values.map((value, index) => (
                        <td key={`${row.ticker}-${monthlyMatrix.months[index]}`} className="ui-cell-number">{formatPercent(value)}</td>
                      ))}
                      <td className="ui-cell-number font-semibold text-slate-900 dark:text-slate-100">{formatPercent(row.total)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold dark:border-slate-600 dark:bg-slate-900/70">
                    <td className="sticky left-0 z-10 bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
                      {t("Итого", "Total")}
                    </td>
                    <td>{t("Портфель", "Portfolio")}</td>
                    {monthlyMatrix.portfolioValues.map((value, index) => (
                      <td key={`portfolio-${monthlyMatrix.months[index]}`} className="ui-cell-number">{formatPercent(value)}</td>
                    ))}
                    <td className="ui-cell-number text-slate-900 dark:text-slate-100">{formatPercent(monthlyMatrix.portfolioTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="ui-table-shell overflow-x-auto">
            <table className="ui-data-table min-w-[42rem]">
              <thead>
                <tr>
                  <th>{t("Месяц", "Month")}</th>
                  <th>{t("Доходность портфеля", "Portfolio return")}</th>
                  <th>{t("Накопленная доходность", "Cumulative return")}</th>
                </tr>
              </thead>
              <tbody>
                {result.portfolioRows.map((row) => (
                  <tr key={row.month}>
                    <td>{row.month}</td>
                    <td className="ui-cell-number">{formatPercent(row.monthlyReturn)}</td>
                    <td className="ui-cell-number">{formatPercent(row.cumulativeReturn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
