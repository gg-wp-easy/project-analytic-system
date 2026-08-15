import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, CalendarDays, RefreshCw, Trash2 } from "lucide-react";
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
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import { useFundamentals } from "../../../entities/fundamentals";
import { createTBankInstrumentsApi } from "../../../shared/api/tbank";
import { numberOr } from "../../../shared/lib/number/numberOr";
import { MetricCard, MetricGrid, PageHero, SectionCard } from "../../../shared/ui/analysis-shell";
import { ChartSkeleton, MetricSkeletonGrid } from "../../../shared/ui/loading-state";
import {
  buildMonthlyReturns,
  buildSimulation,
  formatNumber,
  formatPercent,
  normalizeAnnualDividendYield,
} from "../../../features/portfolio-simulation/lib";
import {
  deleteSavedPortfolio,
  readSavedPortfolios,
  type SavedPortfolio,
  type SavedPortfolioHolding,
} from "../../../features/saved-portfolios";

type PortfolioTrackingResult = {
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpe: number;
  months: number;
  rows: Array<{ month: string; portfolio: number }>;
  updatedAt: string;
};

function normalizeWeight(value: number, totalWeight: number): number {
  if (!Number.isFinite(value) || value <= 0 || totalWeight <= 0) {
    return 0;
  }
  return value / totalWeight;
}

function formatDate(value: string, locale: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return value || "-";
  }
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ru-RU").format(date);
}

function formatCurrency(value: number, currency: string, locale: string): string {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "ru-RU", {
    style: "currency",
    currency: currency || "RUB",
    maximumFractionDigits: 0,
  }).format(value);
}

function parseAmount(value: string): number {
  const parsed = Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function getPortfolioCurrency(portfolio: SavedPortfolio | null): string {
  const currency = portfolio?.holdings.find((holding) => holding.currency)?.currency;
  return String(currency || "RUB").toUpperCase();
}

function getHoldingDividendYield(holding: SavedPortfolioHolding, fundamentalsByFigi: ReturnType<typeof useFundamentals>["cache"]["fundamentalsByFigi"]): number {
  if (Number.isFinite(holding.annualDividendYield ?? NaN)) {
    return normalizeAnnualDividendYield(holding.annualDividendYield);
  }
  if (holding.figi && fundamentalsByFigi[holding.figi]) {
    return normalizeAnnualDividendYield(fundamentalsByFigi[holding.figi].dividendYield);
  }
  return 0;
}

function buildExpectedMetricRows(portfolio: SavedPortfolio | null) {
  return portfolio?.metrics ?? [];
}

export function PortfolioAnalysisPage() {
  const { locale, t } = useAppSettings();
  const { cache } = useFundamentals();
  const [portfolios, setPortfolios] = useState<SavedPortfolio[]>(() => readSavedPortfolios());
  const [selectedId, setSelectedId] = useState(() => readSavedPortfolios()[0]?.id ?? "");
  const [portfolioAmount, setPortfolioAmount] = useState("1000000");
  const [trackingResult, setTrackingResult] = useState<PortfolioTrackingResult | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => {
      const next = readSavedPortfolios();
      setPortfolios(next);
      setSelectedId((current) => (next.some((portfolio) => portfolio.id === current) ? current : next[0]?.id ?? ""));
    };
    window.addEventListener("saved-portfolios:changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("saved-portfolios:changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const selectedPortfolio = useMemo(
    () => portfolios.find((portfolio) => portfolio.id === selectedId) ?? portfolios[0] ?? null,
    [portfolios, selectedId],
  );
  const expectedMetricRows = useMemo(() => buildExpectedMetricRows(selectedPortfolio), [selectedPortfolio]);
  const amount = parseAmount(portfolioAmount);
  const currency = getPortfolioCurrency(selectedPortfolio);
  const totalWeight = useMemo(
    () => selectedPortfolio?.holdings.reduce((sum, holding) => sum + Math.max(numberOr(holding.weight, 0), 0), 0) ?? 0,
    [selectedPortfolio],
  );
  const passiveYield = useMemo(() => {
    if (!selectedPortfolio || totalWeight <= 0) {
      return 0;
    }
    return selectedPortfolio.holdings.reduce((sum, holding) => {
      const weight = normalizeWeight(numberOr(holding.weight, 0), totalWeight);
      return sum + weight * getHoldingDividendYield(holding, cache.fundamentalsByFigi);
    }, 0);
  }, [cache.fundamentalsByFigi, selectedPortfolio, totalWeight]);
  const annualPassiveIncome = amount * passiveYield;
  const monthlyPassiveIncome = annualPassiveIncome / 12;
  const currentProfit = trackingResult ? amount * trackingResult.totalReturn : 0;
  const currentValue = trackingResult ? amount + currentProfit : amount;

  const refreshTracking = async () => {
    if (!selectedPortfolio) {
      return;
    }
    const figiHoldings = selectedPortfolio.holdings.filter((holding) => holding.figi);
    if (!figiHoldings.length) {
      setError(t("Для некоторых позиций недостаточно данных, чтобы рассчитать текущую динамику.", "Some positions do not have enough data to calculate current performance."));
      setTrackingResult(null);
      return;
    }

    const from = new Date(selectedPortfolio.createdAt);
    const to = new Date();
    if (!Number.isFinite(from.getTime()) || from >= to) {
      setError(t("Дата создания должна быть раньше сегодняшнего дня.", "Creation date must be before today."));
      setTrackingResult(null);
      return;
    }

    setIsRefreshing(true);
    setError(null);
    try {
      const api = createTBankInstrumentsApi();
      const monthlyReturnsByTicker = new Map<string, Map<string, number>>();
      const weightsByTicker = new Map<string, number>();
      const weightSum = figiHoldings.reduce((sum, holding) => sum + Math.max(numberOr(holding.weight, 0), 0), 0);

      await Promise.all(
        figiHoldings.map(async (holding) => {
          const candles = await api.fetchCandles({
            figi: holding.figi ?? "",
            from: from.toISOString(),
            to: to.toISOString(),
            interval: "CANDLE_INTERVAL_DAY",
            limit: 2500,
          });
          const monthlyDividendAdjustment = getHoldingDividendYield(holding, cache.fundamentalsByFigi) / 12;
          monthlyReturnsByTicker.set(holding.ticker, buildMonthlyReturns(candles, monthlyDividendAdjustment));
          weightsByTicker.set(holding.ticker, normalizeWeight(numberOr(holding.weight, 0), weightSum));
        }),
      );

      const simulation = buildSimulation(monthlyReturnsByTicker, weightsByTicker, 0);
      if (!simulation.portfolioRows.length) {
        setError(t("Для выбранного периода не удалось получить свечи.", "Could not load candles for the selected period."));
        setTrackingResult(null);
        return;
      }

      setTrackingResult({
        totalReturn: simulation.metrics.totalReturn,
        annualizedReturn: simulation.metrics.annualizedReturn,
        volatility: simulation.metrics.volatility,
        sharpe: simulation.metrics.sharpe,
        months: simulation.metrics.months,
        rows: simulation.portfolioRows.map((row) => ({ month: row.month, portfolio: row.cumulativeReturn * 100 })),
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Не удалось обновить динамику портфеля.", "Failed to refresh portfolio dynamics."));
      setTrackingResult(null);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDelete = (id: string) => {
    const next = deleteSavedPortfolio(id);
    setPortfolios(next);
    setSelectedId(next[0]?.id ?? "");
    setTrackingResult(null);
  };

  return (
    <div className="space-y-8">
      <PageHero
        icon={BriefcaseBusiness}
        title={t("Анализ портфелей", "Portfolio Analysis")}
        description={t(
          "Сохранённые портфели из моделей: ожидаемые метрики, фактическая динамика, текущая доходность и оценка пассивного дохода.",
          "Saved model portfolios: expected metrics, factual dynamics, current return, and passive income estimate.",
        )}
        badge={t("Мониторинг портфелей", "Portfolio tracking")}
        accent="teal"
      />

      {!portfolios.length ? (
        <SectionCard
          title={t("Портфели ещё не сохранены", "No saved portfolios yet")}
          description={t(
            "Откройте любой анализ, сформируйте оптимальный портфель и нажмите кнопку сохранения в карточке портфеля.",
            "Open any analysis, build an optimal portfolio, and press the save button in the portfolio card.",
          )}
        >
          <div className="ui-surface-muted text-sm text-slate-600 dark:text-slate-300">
            {t("После сохранения здесь появятся карточки портфелей и их динамика.", "Saved portfolios and their dynamics will appear here.")}
          </div>
        </SectionCard>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)] xl:items-start">
          <aside className="xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto xl:pr-1">
            <SectionCard title={t("Сохранённые портфели", "Saved portfolios")}>
              <div className="space-y-2">
                {portfolios.map((portfolio) => {
                  const isActive = selectedPortfolio?.id === portfolio.id;
                  return (
                    <button
                      key={portfolio.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(portfolio.id);
                        setTrackingResult(null);
                        setError(null);
                      }}
                      className={`w-full rounded-md border px-3 py-3 text-left transition-colors ${
                        isActive
                          ? "border-teal-300 bg-teal-50 text-teal-900 dark:border-teal-800 dark:bg-teal-950/30 dark:text-teal-100"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:bg-slate-900"
                      }`}
                    >
                      <div className="font-semibold">{portfolio.name}</div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{portfolio.sourceLabel}</div>
                      <div className="mt-2 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatDate(portfolio.createdAt, locale)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </SectionCard>
          </aside>

          <div className="space-y-6">
            {selectedPortfolio ? (
              <>
                <SectionCard
                  title={selectedPortfolio.name}
                  description={`${selectedPortfolio.sourceLabel} • ${formatDate(selectedPortfolio.createdAt, locale)}`}
                  action={(
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={refreshTracking}
                        disabled={isRefreshing}
                        className="ui-primary-button px-3 py-2 text-xs"
                      >
                        <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                        {isRefreshing ? t("Обновляем...", "Refreshing...") : t("Обновить динамику", "Refresh dynamics")}
                      </button>
                      <button type="button" onClick={() => handleDelete(selectedPortfolio.id)} className="ui-secondary-button px-3 py-2 text-xs">
                        <Trash2 className="h-4 w-4" />
                        {t("Удалить", "Delete")}
                      </button>
                    </div>
                  )}
                >
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(13rem,16rem)]">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="ui-stat-card">
                        <div className="text-xs text-slate-500 dark:text-slate-400">{t("Позиций", "Positions")}</div>
                        <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">{selectedPortfolio.holdings.length}</div>
                      </div>
                      <div className="ui-stat-card">
                        <div className="text-xs text-slate-500 dark:text-slate-400">{t("Пассивная доходность", "Passive yield")}</div>
                        <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">{formatPercent(passiveYield)}</div>
                      </div>
                      <div className="ui-stat-card">
                        <div className="text-xs text-slate-500 dark:text-slate-400">{t("Сохранён", "Saved")}</div>
                        <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">{formatDate(selectedPortfolio.savedAt, locale)}</div>
                      </div>
                    </div>

                    <label className="block text-sm text-slate-700 dark:text-slate-200">
                      <span className="font-medium">{t("Размер портфеля", "Portfolio amount")}</span>
                      <input className="ui-input mt-1" value={portfolioAmount} onChange={(event) => setPortfolioAmount(event.target.value)} />
                    </label>
                  </div>
                </SectionCard>

                {isRefreshing ? (
                  <MetricSkeletonGrid count={8} />
                ) : (
                <>
                <MetricGrid className="xl:grid-cols-5">
                  <MetricCard label={t("Текущая доходность", "Current return")} value={trackingResult ? formatPercent(trackingResult.totalReturn) : "-"} />
                  <MetricCard label={t("Годовая доходность", "Annualized return")} value={trackingResult ? formatPercent(trackingResult.annualizedReturn) : "-"} />
                  <MetricCard label={t("Риск", "Risk")} value={trackingResult ? formatPercent(trackingResult.volatility) : "-"} />
                  <MetricCard label={t("Коэф. Шарпа", "Sharpe ratio")} value={trackingResult ? formatNumber(trackingResult.sharpe, 4) : "-"} />
                  <MetricCard label={t("Текущая стоимость", "Current value")} value={trackingResult ? formatCurrency(currentValue, currency, locale) : "-"} />
                </MetricGrid>

                <MetricGrid className="xl:grid-cols-3">
                  <MetricCard label={t("Пассивный доход в год", "Annual passive income")} value={formatCurrency(annualPassiveIncome, currency, locale)} />
                  <MetricCard label={t("Пассивный доход в месяц", "Monthly passive income")} value={formatCurrency(monthlyPassiveIncome, currency, locale)} />
                  <MetricCard label={t("Текущая прибыль", "Current profit")} value={trackingResult ? formatCurrency(currentProfit, currency, locale) : "-"} />
                </MetricGrid>
                </>
                )}

                {!!expectedMetricRows.length && (
                  <SectionCard title={t("Ожидаемые метрики анализа", "Expected analysis metrics")}>
                    <MetricGrid>
                      {expectedMetricRows.map((metric) => (
                        <MetricCard key={metric.label} label={metric.label} value={metric.value} />
                      ))}
                    </MetricGrid>
                  </SectionCard>
                )}

                <SectionCard
                  title={t("Динамика портфеля", "Portfolio dynamics")}
                  description={
                    trackingResult
                      ? t("Фактическая накопленная доходность с даты создания портфеля.", "Factual cumulative return since the portfolio creation date.")
                      : t("Нажмите обновить динамику, чтобы загрузить свечи и пересчитать текущую доходность.", "Click refresh dynamics to load candles and recalculate current return.")
                  }
                >
                  {isRefreshing ? (
                    <ChartSkeleton
                      title={t("Загружаем динамику", "Loading dynamics")}
                      subtitle={t("Получаем свечи по позициям и пересчитываем месячную доходность.", "Fetching candles and recalculating monthly performance.")}
                      variant="line"
                      accentClassName="text-teal-600"
                    />
                  ) : trackingResult ? (
                    <ResponsiveContainer width="100%" height={340}>
                      <LineChart data={trackingResult.rows} margin={{ top: 8, right: 24, left: 8, bottom: 28 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="month" stroke="#64748b" tickMargin={8} />
                        <YAxis stroke="#64748b" tickFormatter={(value: number) => `${Number(value).toFixed(0)}%`} />
                        <Tooltip formatter={(value: number) => `${Number(value).toFixed(2)}%`} />
                        <Legend verticalAlign="top" height={32} />
                        <Line type="monotone" dataKey="portfolio" name={t("Портфель", "Portfolio")} stroke="#0f766e" strokeWidth={3} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="ui-surface-muted text-sm text-slate-600 dark:text-slate-300">
                      {error ?? t("Динамика ещё не рассчитана.", "Dynamics has not been calculated yet.")}
                    </div>
                  )}
                </SectionCard>

                <SectionCard title={t("Состав портфеля", "Portfolio holdings")}>
                  <div className="ui-table-shell overflow-x-auto">
                    <table className="ui-data-table min-w-[58rem]">
                      <thead>
                        <tr>
                          <th>Ticker</th>
                          <th>{t("Название", "Name")}</th>
                          <th className="ui-cell-number">{t("Вес, %", "Weight, %")}</th>
                          <th className="ui-cell-number">{t("Пассивная доходность", "Passive yield")}</th>
                          <th className="ui-cell-number">{t("Пассивный доход / год", "Passive income / year")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPortfolio.holdings.map((holding) => {
                          const normalizedWeight = normalizeWeight(numberOr(holding.weight, 0), totalWeight);
                          const holdingYield = getHoldingDividendYield(holding, cache.fundamentalsByFigi);
                          return (
                            <tr key={`${selectedPortfolio.id}-${holding.ticker}`}>
                              <td className="font-medium text-slate-900 dark:text-slate-100">{holding.ticker}</td>
                              <td className="ui-cell-name">{holding.name ?? holding.ticker}</td>
                              <td className="ui-cell-number">{numberOr(holding.weight, 0).toFixed(2)}</td>
                              <td className="ui-cell-number">{formatPercent(holdingYield)}</td>
                              <td className="ui-cell-number">{formatCurrency(amount * normalizedWeight * holdingYield, currency, locale)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
