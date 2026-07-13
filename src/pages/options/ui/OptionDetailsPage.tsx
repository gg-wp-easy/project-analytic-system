import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowLeft, RefreshCw } from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import { useFundamentals } from "../../../entities/fundamentals";
import { useOptionsData } from "../../../entities/options";
import { AppErrorDialog } from "../../../shared/ui/app-error-dialog";
import { MetricCard, MetricGrid, PageHero, SectionCard } from "../../../shared/ui/analysis-shell";
import { ChartSkeleton, MetricSkeletonGrid, PageLoadingState, TableSkeleton } from "../../../shared/ui/loading-state";
import {
  buildUnderlyingSummaries,
  decodeRoutePart,
  formatDate,
  formatNumber,
  formatTimestamp,
  getCategoryLabel,
  getOptionExpirationDateKey,
  getOptionSide,
  getOptionSideLabel,
  sortOptionContracts,
  type OptionSideFilter,
  type OptionSortDirection,
  type UnderlyingSummary,
} from "../lib/options-helpers";
import type { DetailsTab, UnderlyingCategory, UnderlyingLocationState } from "../model";
import { buildStrategyFromTemplate } from "../lib/strategy-builder";
import {
  buildAssetMovementForecast,
  buildOptionTradeRecommendation,
  type ForecastDirection,
} from "../lib/technical-forecast";
import { OptionContractsTable } from "./OptionContractsTable";
import { OptionStrategiesReference } from "./OptionStrategiesReference";
import { OptionStrategyBuilder } from "./OptionStrategyBuilder";
import { PaginationControls } from "./PaginationControls";

export function UnderlyingOptionsPage() {
  const { locale, t } = useAppSettings();
  const isEn = locale === "en";
  const {
    cache,
    hasData,
    isLoading,
    isLoadingClosePrices,
    isLoadingUnderlyingHistory,
    isLoadingUnderlyingPrice,
    loadOptions,
    loadClosePricesForUnderlying,
    loadUnderlyingHistoryForUnderlying,
    loadUnderlyingPriceForUnderlying,
  } = useOptionsData();
  const { cache: fundamentalsCache } = useFundamentals();
  const location = useLocation();
  const { underlyingKey: underlyingKeyParam = "" } = useParams();
  const underlyingKey = decodeRoutePart(underlyingKeyParam).trim();
  const locationState = location.state as UnderlyingLocationState | null;

  const [sideFilter, setSideFilter] = useState<OptionSideFilter>("all");
  const [expirationFilter, setExpirationFilter] = useState("all");
  const [sortDirection, setSortDirection] = useState<OptionSortDirection>("asc");
  const [activeTab, setActiveTab] = useState<DetailsTab>("list");
  const [optionPage, setOptionPage] = useState(1);
  const [optionPageSize, setOptionPageSize] = useState(50);
  const [errorDialogMessage, setErrorDialogMessage] = useState<string | null>(null);
  const [marketAnalysisError, setMarketAnalysisError] = useState<string | null>(null);
  const autoLoadedMarketKeysRef = useRef<Set<string>>(new Set());

  const summaries = useMemo(() => buildUnderlyingSummaries(cache.options), [cache.options]);
  const summary = useMemo<UnderlyingSummary | null>(
    () => summaries.find((item) => item.key === underlyingKey) ?? null,
    [summaries, underlyingKey],
  );

  const expirationChoices = useMemo(() => {
    if (!summary) {
      return [];
    }

    return [...new Set(summary.options.map((option) => getOptionExpirationDateKey(option)).filter(Boolean))]
      .sort((left, right) => {
        const leftTime = Date.parse(left);
        const rightTime = Date.parse(right);
        const leftValid = Number.isFinite(leftTime);
        const rightValid = Number.isFinite(rightTime);

        if (leftValid && rightValid && leftTime !== rightTime) {
          return leftTime - rightTime;
        }

        if (leftValid !== rightValid) {
          return leftValid ? -1 : 1;
        }

        return left.localeCompare(right, "ru");
      });
  }, [summary]);

  const filteredOptions = useMemo(() => {
    if (!summary) {
      return [];
    }

    return summary.options.filter((option) => {
      const matchesSide = sideFilter === "all" || getOptionSide(option) === sideFilter;
      const matchesExpiration =
        expirationFilter === "all" || getOptionExpirationDateKey(option) === expirationFilter;
      return matchesSide && matchesExpiration;
    });
  }, [expirationFilter, sideFilter, summary]);

  const sortedFilteredOptions = useMemo(
    () => sortOptionContracts(filteredOptions, "strikePrice", sortDirection),
    [filteredOptions, sortDirection],
  );
  const optionPageCount = Math.max(1, Math.ceil(sortedFilteredOptions.length / optionPageSize));
  const safeOptionPage = Math.min(optionPage, optionPageCount);
  const paginatedOptions = useMemo(
    () => sortedFilteredOptions.slice((safeOptionPage - 1) * optionPageSize, safeOptionPage * optionPageSize),
    [optionPageSize, safeOptionPage, sortedFilteredOptions],
  );

  const displayLabel = summary?.label || locationState?.summaryLabel || underlyingKey || "-";
  const displayCategory = summary?.category || locationState?.category || "other";
  const selectedExpirationLabel =
    expirationFilter === "all"
      ? t({ ru: "Все даты", en: "All dates" })
      : formatDate(expirationFilter, locale);
  const underlyingHistory = underlyingKey ? cache.underlyingHistoryByKey[underlyingKey] : undefined;
  const underlyingLastPrice = underlyingKey ? cache.underlyingLastPricesByKey[underlyingKey] : undefined;
  const preferredUnderlyingInstrumentIds = useMemo(() => {
    if (!summary) {
      return [];
    }

    const basicAssets = new Set(summary.options.map((option) => option.basicAsset.trim().toLowerCase()).filter(Boolean));
    const tickers = new Set(
      summary.options
        .flatMap((option) => [
          option.basicAsset,
          option.ticker.split("-")[0] ?? "",
        ])
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    );

    return fundamentalsCache.shares
      .filter((share) => {
        const ticker = share.ticker.trim().toLowerCase();
        return basicAssets.has(ticker) || tickers.has(ticker);
      })
      .map((share) => share.figi)
      .filter(Boolean);
  }, [fundamentalsCache.shares, summary]);
  const movementForecast = useMemo(
    () => buildAssetMovementForecast(underlyingHistory?.candles ?? []),
    [underlyingHistory],
  );
  const tradeRecommendation = useMemo(
    () =>
      movementForecast
        ? buildOptionTradeRecommendation(movementForecast, expirationChoices)
        : null,
    [expirationChoices, movementForecast],
  );
  const recommendedStrategy = useMemo(() => {
    if (!summary || !tradeRecommendation) {
      return null;
    }

    return buildStrategyFromTemplate({
      options: summary.options,
      expirationKey: tradeRecommendation.expirationKey,
      templateId: tradeRecommendation.templateId,
      closePricesById: cache.optionClosePricesByInstrumentId,
      contracts: 1,
    });
  }, [cache.optionClosePricesByInstrumentId, summary, tradeRecommendation]);
  const isLoadingMarketAnalysis = isLoadingUnderlyingHistory || isLoadingUnderlyingPrice;

  const formatPercent = (value: number | null | undefined) =>
    typeof value === "number" && Number.isFinite(value) ? `${formatNumber(value, locale)}%` : "-";
  const getDirectionLabel = (direction: ForecastDirection) => {
    if (direction === "bullish") {
      return t({ ru: "Рост", en: "Bullish" });
    }
    if (direction === "bearish") {
      return t({ ru: "Снижение", en: "Bearish" });
    }
    return t({ ru: "Боковик", en: "Neutral" });
  };

  const loadMarketAnalysis = async (force = false, includeOptionPrices = false) => {
    if (!summary || !underlyingKey) {
      return;
    }

    setMarketAnalysisError(null);
    const tasks = [
      loadUnderlyingPriceForUnderlying({
        underlyingKey,
        options: summary.options,
        force,
        preferredInstrumentIds: preferredUnderlyingInstrumentIds,
      }),
      loadUnderlyingHistoryForUnderlying({
        underlyingKey,
        options: summary.options,
        force,
        preferredInstrumentIds: preferredUnderlyingInstrumentIds,
      }),
    ];

    if (includeOptionPrices) {
      tasks.push(loadClosePricesForUnderlying({ underlyingKey, options: summary.options, force }));
    }

    const results = await Promise.allSettled(tasks);
    const rejected = results.find((result) => result.status === "rejected");
    if (rejected?.status === "rejected") {
      setMarketAnalysisError(
        rejected.reason instanceof Error
          ? rejected.reason.message
          : isEn
            ? "Failed to load market analysis data."
            : "Не удалось загрузить данные для рыночного прогноза.",
      );
    }
  };

  useEffect(() => {
    if (activeTab !== "forecast" || !summary || !underlyingKey) {
      return;
    }

    const autoLoadKey = `${underlyingKey}:${summary.options.length}`;
    if (autoLoadedMarketKeysRef.current.has(autoLoadKey)) {
      return;
    }
    autoLoadedMarketKeysRef.current.add(autoLoadKey);

    void loadMarketAnalysis(false);
  }, [activeTab, summary, underlyingKey]);

  useEffect(() => {
    setOptionPage(1);
  }, [expirationFilter, sideFilter, sortDirection, underlyingKey]);

  useEffect(() => {
    setOptionPage((current) => Math.min(current, optionPageCount));
  }, [optionPageCount]);

  const handleLoadOptions = async () => {
    try {
      await loadOptions(true);
    } catch (error) {
      setErrorDialogMessage(
        error instanceof Error
          ? error.message
          : isEn
            ? "Failed to load the asset option chain."
            : "Не удалось загрузить опционную цепочку актива.",
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHero
        icon={Activity}
        title={displayLabel}
        description={t({
          ru: "Страница использует сохранённую опционную цепочку, а загрузка и обновление выполняются только по кнопке.",
          en: "This page uses the saved option chain, and loading or updating only happens on button click.",
        })}
        accent="amber"
        aside={
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.18em] text-white/60">
              {t({ ru: "Группа актива", en: "Asset group" })}
            </div>
            <div className="text-lg font-semibold">{getCategoryLabel(displayCategory, locale)}</div>
            <div className="text-sm text-white/80">
              {t({ ru: "Обновлено", en: "Updated" })}: {formatTimestamp(cache.lastUpdated, locale)}
            </div>
          </div>
        }
        footer={
          <>
            <Link
              to="/options"
              className="ui-secondary-button border-white/20 bg-white/10 text-white hover:bg-white/16 dark:border-white/20 dark:bg-white/10 dark:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              {t({ ru: "Назад к списку", en: "Back to list" })}
            </Link>
            <button
              type="button"
              onClick={handleLoadOptions}
              disabled={isLoading}
              className="ui-secondary-button border-white/20 bg-white/10 text-white hover:bg-white/16 dark:border-white/20 dark:bg-white/10 dark:text-white"
            >
              {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {hasData
                ? t({ ru: "Обновить данные", en: "Update data" })
                : t({ ru: "Загрузить данные", en: "Load data" })}
            </button>
          </>
        }
      />

      {!hasData ? (
        <SectionCard>
          <div className="ui-surface-muted text-center text-sm leading-7 text-slate-600 dark:text-slate-300">
            {t({
              ru: "Опционы ещё не загружены. Нажмите кнопку «Загрузить данные», чтобы получить и сохранить их.",
              en: "Options have not been loaded yet. Click “Load data” to fetch and save them.",
            })}
          </div>
        </SectionCard>
      ) : !summary ? (
        <SectionCard>
          <div className="ui-surface-muted text-center text-sm leading-7 text-slate-600 dark:text-slate-300">
            {t({
              ru: "Этот актив не найден в текущем сохранённом списке опционов. Обновите данные или вернитесь к списку и выберите тикер снова.",
              en: "This asset was not found in the currently saved option list. Update the data or go back and choose the ticker again.",
            })}
          </div>
        </SectionCard>
      ) : (
        <>
          <MetricGrid className="xl:grid-cols-5">
            <MetricCard
              label={t({ ru: "Всего контрактов", en: "Total contracts" })}
              value={summary.options.length}
            />
            <MetricCard
              label={t({ ru: "Коллы", en: "Calls" })}
              value={summary.calls}
            />
            <MetricCard
              label={t({ ru: "Путы", en: "Puts" })}
              value={summary.puts}
            />
            <MetricCard
              label={t({ ru: "Дата экспирации", en: "Expiration date" })}
              value={selectedExpirationLabel}
            />
            <MetricCard
              label={t({ ru: "В текущем фильтре", en: "In current filter" })}
              value={sortedFilteredOptions.length}
            />
          </MetricGrid>

          <div className="flex flex-wrap gap-2">
            {([
              { value: "list", label: t({ ru: "Список опционов", en: "Option list" }) },
              { value: "forecast", label: t({ ru: "Прогноз и идеи", en: "Forecast and ideas" }) },
              { value: "builder", label: t({ ru: "Конструктор стратегий", en: "Strategy builder" }) },
              { value: "reference", label: t({ ru: "Справочник стратегий", en: "Strategy reference" }) },
            ] as Array<{ value: DetailsTab; label: string }>).map((tab) => {
              const isActive = activeTab === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveTab(tab.value)}
                  className={
                    isActive
                      ? "inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm dark:bg-slate-100 dark:text-slate-950"
                      : "inline-flex items-center rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  }
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {activeTab === "forecast" ? (
          <SectionCard
            title={t({ ru: "Прогноз и идея по опционам", en: "Forecast and Option Idea" })}
            description={t({
              ru: "История цены базового актива, техиндикаторы и выбранная серия опционов используются для первичной идеи buy/sell.",
              en: "Underlying price history, technical indicators, and the selected option series are used for the first buy/sell idea.",
            })}
            action={
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void loadMarketAnalysis(true)}
                  disabled={isLoadingMarketAnalysis}
                  className="ui-secondary-button"
                >
                  {isLoadingMarketAnalysis ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {t({ ru: "Обновить прогноз", en: "Refresh forecast" })}
                </button>
                <button
                  type="button"
                  onClick={() => void loadMarketAnalysis(true, true)}
                  disabled={isLoadingMarketAnalysis || isLoadingClosePrices}
                  className="ui-secondary-button"
                  title={t({
                    ru: "Загрузить close prices для контрактов выбранной опционной цепочки.",
                    en: "Load close prices for contracts in the selected option chain.",
                  })}
                >
                  {isLoadingClosePrices ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {t({ ru: "Обновить премии", en: "Refresh premiums" })}
                </button>
              </div>
            }
          >
            {isLoadingMarketAnalysis && !movementForecast ? (
              <div className="space-y-4">
                <PageLoadingState
                  title={t({ ru: "Загружаем рыночные данные", en: "Loading market data" })}
                  subtitle={t({
                    ru: "Получаем свечи базового актива, последнюю цену и готовим технические индикаторы.",
                    en: "Fetching underlying candles, last price, and preparing technical indicators.",
                  })}
                  accentClassName="text-amber-600"
                />
                <MetricSkeletonGrid count={5} />
                <ChartSkeleton className="min-h-[20rem]" />
              </div>
            ) : movementForecast && tradeRecommendation ? (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <MetricCard
                    label={t({ ru: "Сценарий", en: "Scenario" })}
                    value={getDirectionLabel(movementForecast.direction)}
                    helper={`${movementForecast.confidence}% ${t({ ru: "уверенность", en: "confidence" })}`}
                  />
                  <MetricCard
                    label={t({ ru: "Текущая цена", en: "Current price" })}
                    value={formatNumber(underlyingLastPrice?.price ?? movementForecast.indicators.currentPrice, locale)}
                    helper={underlyingLastPrice ? formatTimestamp(underlyingLastPrice.time, locale) : undefined}
                  />
                  <MetricCard
                    label={t({ ru: "Цель 20 дней", en: "20-day target" })}
                    value={formatNumber(movementForecast.targetPrice, locale)}
                    helper={formatPercent(movementForecast.expectedMovePct)}
                  />
                  <MetricCard
                    label={t({ ru: "RSI / ATR", en: "RSI / ATR" })}
                    value={`${formatNumber(movementForecast.indicators.rsi14 ?? undefined, locale)} / ${formatPercent(movementForecast.indicators.atrPct)}`}
                  />
                  <MetricCard
                    label={t({ ru: "Свечей", en: "Candles" })}
                    value={underlyingHistory?.candles.length ?? 0}
                    helper={underlyingHistory ? formatTimestamp(underlyingHistory.lastUpdated, locale) : undefined}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {t({ ru: "Техническая картина", en: "Technical picture" })}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      {[
                        { label: "SMA 20", value: formatNumber(movementForecast.indicators.sma20 ?? undefined, locale) },
                        { label: "SMA 50", value: formatNumber(movementForecast.indicators.sma50 ?? undefined, locale) },
                        { label: "EMA 12", value: formatNumber(movementForecast.indicators.ema12 ?? undefined, locale) },
                        { label: "EMA 26", value: formatNumber(movementForecast.indicators.ema26 ?? undefined, locale) },
                        { label: "MACD", value: formatNumber(movementForecast.indicators.macd ?? undefined, locale) },
                        { label: t({ ru: "Моментум 20д", en: "20d momentum" }), value: formatPercent(movementForecast.indicators.momentum20Pct) },
                      ].map((item) => (
                        <div key={item.label} className="rounded-xl bg-white p-3 dark:bg-slate-950/40">
                          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                            {item.label}
                          </div>
                          <div className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{item.value}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {movementForecast.reasons.map((reason) => (
                        <div key={reason}>{reason}</div>
                      ))}
                      {movementForecast.warnings.map((warning) => (
                        <div key={warning} className="text-amber-700 dark:text-amber-200">{warning}</div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">
                          {t({ ru: "Предложение по стратегии", en: "Strategy suggestion" })}
                        </div>
                        <div className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">
                          {recommendedStrategy?.template.name[locale] ?? tradeRecommendation.templateId}
                        </div>
                      </div>
                      <span className="rounded-full bg-emerald-700 px-3 py-1 text-xs font-semibold text-white dark:bg-emerald-300 dark:text-emerald-950">
                        {formatDate(tradeRecommendation.expirationKey, locale)}
                      </span>
                    </div>

                    <div className="mt-3 text-sm leading-6 text-emerald-950/80 dark:text-emerald-100/80">
                      {tradeRecommendation.thesis}
                    </div>
                    <div className="mt-2 text-sm leading-6 text-emerald-950/80 dark:text-emerald-100/80">
                      {tradeRecommendation.riskNote}
                    </div>

                    {recommendedStrategy ? (
                      <div className="mt-4 ui-table-shell overflow-x-auto bg-white/80 dark:bg-slate-950/30">
                        <table className="ui-data-table">
                          <thead>
                            <tr>
                              <th>{t({ ru: "Действие", en: "Action" })}</th>
                              <th>{t({ ru: "Тип", en: "Type" })}</th>
                              <th>{t({ ru: "Страйк", en: "Strike" })}</th>
                              <th>{t({ ru: "Кол-во", en: "Qty" })}</th>
                              <th>{t({ ru: "Премия", en: "Premium" })}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {recommendedStrategy.legs.map((leg) => {
                              const side = getOptionSide(leg.option);
                              return (
                                <tr key={`${leg.action}-${leg.option.uid}`}>
                                  <td className="ui-cell-number">{leg.action === "buy" ? "BUY" : "SELL"}</td>
                                  <td className="ui-cell-number">
                                    {side === "other"
                                      ? leg.option.direction || "-"
                                      : getOptionSideLabel(side, locale)}
                                  </td>
                                  <td className="ui-cell-number">{formatNumber(leg.option.strikePrice, locale)}</td>
                                  <td className="ui-cell-number">{leg.quantity}</td>
                                  <td className="ui-cell-number">
                                    {leg.premium === null ? "-" : formatNumber(leg.premium, locale)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl bg-white/70 p-3 text-sm text-slate-700 dark:bg-slate-950/30 dark:text-slate-200">
                        {t({
                          ru: "В выбранной серии не хватило подходящих страйков для автоматической сборки. Попробуйте другую дату экспирации в конструкторе ниже.",
                          en: "The selected series does not have enough suitable strikes for automatic construction. Try another expiration in the builder below.",
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="ui-surface-muted text-center text-sm leading-7 text-slate-600 dark:text-slate-300">
                {marketAnalysisError ??
                  t({
                    ru: "Пока нет достаточной истории цены для прогноза. Нажмите «Обновить прогноз», чтобы запросить свечи базового актива.",
                    en: "There is not enough price history for a forecast yet. Click “Refresh forecast” to request underlying candles.",
                  })}
              </div>
            )}
          </SectionCard>
          ) : null}

          {activeTab === "list" ? (
          <>
          <SectionCard
            title={t({ ru: "Фильтры и сортировка", en: "Filters and Sorting" })}
            description={t({
              ru: "Сначала выберите тип опциона и дату экспирации, а затем отсортируйте выбранную серию по цене страйка.",
              en: "First choose the option type and expiration date, then sort the selected series by strike price.",
            })}
          >
            <div className="space-y-4">
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  {t({ ru: "Тип опциона", en: "Option type" })}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["all", "call", "put"] as OptionSideFilter[]).map((side) => {
                    const isActive = sideFilter === side;
                    return (
                      <button
                        key={side}
                        type="button"
                        onClick={() => setSideFilter(side)}
                        className={
                          isActive
                            ? "inline-flex items-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm"
                            : "inline-flex items-center rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950/70"
                        }
                      >
                        {getOptionSideLabel(side, locale)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  {t({ ru: "Дата экспирации", en: "Expiration date" })}
                </div>
                <select
                  value={expirationFilter}
                  onChange={(event) => setExpirationFilter(event.target.value)}
                  className="ui-input w-full md:w-96"
                >
                  <option value="all">{t({ ru: "Все даты", en: "All dates" })}</option>
                  {expirationChoices.map((value) => (
                    <option key={value} value={value}>
                      {formatDate(value, locale)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  {t({ ru: "Сортировка по страйку", en: "Strike sorting" })}
                </div>
                <div className="flex flex-wrap gap-2">
                  {([
                    { value: "asc", label: t({ ru: "По возрастанию", en: "Ascending" }) },
                    { value: "desc", label: t({ ru: "По убыванию", en: "Descending" }) },
                  ] as Array<{ value: OptionSortDirection; label: string }>).map((item) => {
                    const isActive = sortDirection === item.value;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setSortDirection(item.value)}
                        className={
                          isActive
                            ? "inline-flex items-center rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm"
                            : "inline-flex items-center rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/70"
                        }
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title={t({ ru: "Опционная цепочка", en: "Option Chain" })}
            description={t({
              ru: "Таблица ниже содержит опционы выбранного базового актива только для выбранной даты экспирации и текущего фильтра.",
              en: "The table below contains options for the selected underlying asset only for the selected expiration date and current filter.",
            })}
          >
            {isLoading && !sortedFilteredOptions.length ? (
              <TableSkeleton rows={10} columns={7} />
            ) : sortedFilteredOptions.length === 0 ? (
              <div className="ui-surface-muted text-center text-sm leading-7 text-slate-600 dark:text-slate-300">
                {t({
                  ru: "Для выбранных фильтров по типу и дате экспирации контракты не найдены.",
                  en: "No contracts were found for the selected type and expiration date filters.",
                })}
              </div>
            ) : (
              <div className="ui-table-shell overflow-x-auto">
                <OptionContractsTable items={paginatedOptions} locale={locale} framed={false} />
                <PaginationControls
                  page={safeOptionPage}
                  pageSize={optionPageSize}
                  totalItems={sortedFilteredOptions.length}
                  pageSizeOptions={[25, 50, 100, 200]}
                  locale={locale}
                  onPageChange={setOptionPage}
                  onPageSizeChange={(value) => {
                    setOptionPageSize(value);
                    setOptionPage(1);
                  }}
                />
              </div>
            )}
          </SectionCard>
          </>
          ) : null}

          {activeTab === "builder" ? (
          <>
            <OptionStrategyBuilder
              options={summary.options}
              activeExpirationKey={expirationFilter === "all" ? "" : expirationFilter}
              expirationChoices={expirationChoices}
              closePricesById={cache.optionClosePricesByInstrumentId}
            />
          </>
          ) : null}

          {activeTab === "reference" ? <OptionStrategiesReference /> : null}
        </>
      )}

      <AppErrorDialog
        message={errorDialogMessage}
        onClose={() => setErrorDialogMessage(null)}
        title={t({ ru: "Ошибка загрузки цепочки", en: "Chain Loading Error" })}
        description={t({
          ru: "Приложение не смогло загрузить или обновить данные по опционам для выбранного актива.",
          en: "The application could not load or update option data for the selected asset.",
        })}
        closeLabel={t({ ru: "Закрыть", en: "Close" })}
      />
    </div>
  );
}
