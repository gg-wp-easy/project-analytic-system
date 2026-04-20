import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TBankOption } from "../../../shared/api/tbank";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import { MetricCard, MetricGrid, SectionCard } from "../../../shared/ui/analysis-shell";
import {
  formatDate,
  formatNumber,
  formatTimestamp,
  getOptionSide,
  getOptionSideLabel,
  getOptionTypeLabel,
} from "../lib/options-helpers";
import {
  buildStrategyFromCustomLegs,
  buildStrategyFromTemplate,
  getOptionsForExpiration,
  getStrategyTemplatesByOutlook,
  type StrategyBuildResult,
  type StrategyDraftLeg,
  type StrategyLegAction,
  type StrategyOutlook,
  type StrategyTemplateId,
} from "../lib/strategy-builder";

type BuilderMode = "template" | "custom";

type OptionStrategyBuilderProps = {
  options: TBankOption[];
  activeExpirationKey: string;
  expirationChoices: string[];
  closePricesById: Record<string, number>;
  isPricingLoading: boolean;
  pricingErrorMessage: string | null;
  pricingUpdatedAt: string | null;
  onLoadPricing: () => void;
  pricingActionLabel: string;
  isPricingActionDisabled?: boolean;
};

function createDraftLeg(optionUid: string): StrategyDraftLeg {
  return {
    optionUid,
    action: "buy",
    quantity: 1,
  };
}

function formatPnLValue(value: number | null, locale: "ru" | "en"): string {
  if (value === null) {
    return "-";
  }

  if (!Number.isFinite(value)) {
    return locale === "en" ? "Unlimited" : "Не ограничено";
  }

  return formatNumber(value, locale);
}

function formatBreakEvenValues(result: StrategyBuildResult | null, locale: "ru" | "en"): string {
  if (!result || result.breakEvenPrices.length === 0) {
    return "-";
  }

  return result.breakEvenPrices
    .map((value) => formatNumber(value, locale))
    .join(" / ");
}

export function OptionStrategyBuilder({
  options,
  activeExpirationKey,
  expirationChoices,
  closePricesById,
  isPricingLoading,
  pricingErrorMessage,
  pricingUpdatedAt,
  onLoadPricing,
  pricingActionLabel,
  isPricingActionDisabled = false,
}: OptionStrategyBuilderProps) {
  const { locale, t } = useAppSettings();
  const isEn = locale === "en";
  const [mode, setMode] = useState<BuilderMode>("template");
  const [outlookFilter, setOutlookFilter] = useState<StrategyOutlook>("all");
  const [selectedTemplateId, setSelectedTemplateId] = useState<Exclude<StrategyTemplateId, "custom">>("bear-call-spread");
  const [contracts, setContracts] = useState(1);
  const [strategyExpirationKey, setStrategyExpirationKey] = useState("");
  const [customLegs, setCustomLegs] = useState<StrategyDraftLeg[]>([]);

  const expirationChoicesKey = expirationChoices.join("|");
  const availableTemplates = useMemo(
    () => getStrategyTemplatesByOutlook(outlookFilter),
    [outlookFilter],
  );

  useEffect(() => {
    const preferred =
      activeExpirationKey && expirationChoices.includes(activeExpirationKey)
        ? activeExpirationKey
        : "";

    setStrategyExpirationKey((current) => {
      if (preferred) {
        return preferred;
      }
      if (current && expirationChoices.includes(current)) {
        return current;
      }
      return expirationChoices[0] ?? "";
    });
  }, [activeExpirationKey, expirationChoices, expirationChoicesKey]);

  useEffect(() => {
    if (availableTemplates.some((template) => template.id === selectedTemplateId)) {
      return;
    }

    setSelectedTemplateId(availableTemplates[0]?.id ?? "bear-call-spread");
  }, [availableTemplates, selectedTemplateId]);

  const availableOptions = useMemo(
    () => (strategyExpirationKey ? getOptionsForExpiration(options, strategyExpirationKey) : []),
    [options, strategyExpirationKey],
  );
  const availableOptionUidsKey = availableOptions.map((option) => option.uid).join("|");

  useEffect(() => {
    const availableOptionUids = new Set(availableOptions.map((option) => option.uid));
    setCustomLegs((current) => current.filter((leg) => availableOptionUids.has(leg.optionUid)));
  }, [availableOptionUidsKey, availableOptions]);

  const strategyResult = useMemo(() => {
    if (!strategyExpirationKey) {
      return null;
    }

    if (mode === "custom") {
      return buildStrategyFromCustomLegs({
        options,
        expirationKey: strategyExpirationKey,
        legs: customLegs,
        closePricesById,
      });
    }

    return buildStrategyFromTemplate({
      options,
      expirationKey: strategyExpirationKey,
      templateId: selectedTemplateId,
      closePricesById,
      contracts,
    });
  }, [closePricesById, contracts, customLegs, mode, options, selectedTemplateId, strategyExpirationKey]);

  const pricingCoverage = useMemo(() => {
    if (!strategyResult || strategyResult.legs.length === 0) {
      return "-";
    }

    const pricedLegs = strategyResult.legs.filter((leg) => leg.premium !== null).length;
    return `${pricedLegs}/${strategyResult.legs.length}`;
  }, [strategyResult]);

  const outlookLabels: Record<StrategyOutlook, string> = {
    all: t({ ru: "Все идеи", en: "All ideas" }),
    bullish: t({ ru: "Бычьи", en: "Bullish" }),
    bearish: t({ ru: "Медвежьи", en: "Bearish" }),
    neutral: t({ ru: "Нейтральные", en: "Neutral" }),
  };

  const netPremiumLabel = useMemo(() => {
    if (!strategyResult || strategyResult.netPremium === null) {
      return "-";
    }

    if (Math.abs(strategyResult.netPremium) < 1e-8) {
      return isEn ? "Flat" : "Около нуля";
    }

    const direction =
      strategyResult.netPremium > 0
        ? t({ ru: "Кредит", en: "Credit" })
        : t({ ru: "Дебет", en: "Debit" });
    return `${direction}: ${formatNumber(Math.abs(strategyResult.netPremium), locale)}`;
  }, [isEn, locale, strategyResult, t]);

  const chartData = useMemo(
    () =>
      strategyResult?.payoff.map((point) => ({
        price: Number(point.price.toFixed(2)),
        pnl: Number(point.pnl.toFixed(2)),
      })) ?? [],
    [strategyResult],
  );

  const addCustomLeg = () => {
    const firstOption = availableOptions[0];
    if (!firstOption) {
      return;
    }

    setCustomLegs((current) => [...current, createDraftLeg(firstOption.uid)]);
  };

  const updateCustomLeg = (index: number, patch: Partial<StrategyDraftLeg>) => {
    setCustomLegs((current) =>
      current.map((leg, currentIndex) =>
        currentIndex === index
          ? {
              ...leg,
              ...patch,
            }
          : leg,
      ),
    );
  };

  const removeCustomLeg = (index: number) => {
    setCustomLegs((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const greekGuideItems = [
    {
      key: "delta",
      title: "Delta",
      summary: t({ ru: "Направление", en: "Direction" }),
      description: t({
        ru: "Показывает, как меняется цена опциона при движении базового актива на 1 единицу.",
        en: "Shows how the option price changes when the underlying moves by 1 point.",
      }),
    },
    {
      key: "gamma",
      title: "Gamma",
      summary: t({ ru: "Изменение дельты", en: "Delta change" }),
      description: t({
        ru: "Показывает, насколько быстро меняется delta при движении базового актива.",
        en: "Measures how quickly delta changes as the underlying moves.",
      }),
    },
    {
      key: "theta",
      title: "Theta",
      summary: t({ ru: "Временной распад", en: "Time decay" }),
      description: t({
        ru: "Показывает, сколько стоимости теряет опцион при прочих равных по мере приближения экспирации.",
        en: "Shows how much option value is lost as time passes, all else equal.",
      }),
    },
    {
      key: "vega",
      title: "Vega",
      summary: t({ ru: "Чувствительность к IV", en: "IV sensitivity" }),
      description: t({
        ru: "Показывает, как меняется цена опциона при изменении подразумеваемой волатильности.",
        en: "Shows how the option price reacts to changes in implied volatility.",
      }),
    },
    {
      key: "rho",
      title: "Rho",
      summary: t({ ru: "Чувствительность к ставкам", en: "Rate sensitivity" }),
      description: t({
        ru: "Показывает влияние изменения процентных ставок на цену опциона.",
        en: "Shows how changes in interest rates affect the option price.",
      }),
    },
  ];

  return (
    <SectionCard
      title={t({ ru: "Конструктор стратегий", en: "Strategy Builder" })}
      description={t({
        ru: "Теперь здесь есть два режима: быстрые шаблоны и ручная сборка ног на выбранной серии опционов.",
        en: "This builder now supports both quick templates and manual leg construction on the selected option series.",
      })}
    >
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            {t({ ru: "Режим работы", en: "Mode" })}
          </div>
          <div className="flex flex-wrap gap-2">
            {([
              { value: "template", label: t({ ru: "Шаблон", en: "Template" }) },
              { value: "custom", label: t({ ru: "Вручную", en: "Manual" }) },
            ] as Array<{ value: BuilderMode; label: string }>).map((item) => {
              const isActive = mode === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setMode(item.value)}
                  className={
                    isActive
                      ? "inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm dark:bg-slate-100 dark:text-slate-950"
                      : "inline-flex items-center rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  }
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {mode === "template" ? (
          <>
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                {t({ ru: "Рыночный взгляд", en: "Market outlook" })}
              </div>
              <div className="flex flex-wrap gap-2">
                {(["all", "bullish", "bearish", "neutral"] as StrategyOutlook[]).map((outlook) => {
                  const isActive = outlookFilter === outlook;
                  return (
                    <button
                      key={outlook}
                      type="button"
                      onClick={() => setOutlookFilter(outlook)}
                      className={
                        isActive
                          ? "inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm dark:bg-slate-100 dark:text-slate-950"
                          : "inline-flex items-center rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      }
                    >
                      {outlookLabels[outlook]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {availableTemplates.map((template) => {
                const isActive = selectedTemplateId === template.id;
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => setSelectedTemplateId(template.id)}
                    className={
                      isActive
                        ? "rounded-3xl border border-blue-500 bg-blue-50 p-4 text-left shadow-sm transition dark:border-blue-400/60 dark:bg-blue-950/30"
                        : "rounded-3xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:border-slate-700 dark:hover:bg-slate-900/60"
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
                          {template.name[locale]}
                        </div>
                        <div className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                          {template.description[locale]}
                        </div>
                      </div>
                      <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white dark:bg-slate-100 dark:text-slate-950">
                        {template.legs}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <SectionCard
            title={t({ ru: "Ручная сборка ног", en: "Manual Leg Builder" })}
            description={t({
              ru: "Добавляйте и редактируйте ноги вручную: выбирайте конкретный контракт, действие buy/sell и количество.",
              en: "Add and edit strategy legs manually: pick the exact contract, buy/sell side, and quantity.",
            })}
            action={
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={addCustomLeg}
                  disabled={availableOptions.length === 0}
                  className="ui-secondary-button"
                >
                  {t({ ru: "Добавить ногу", en: "Add leg" })}
                </button>
                <button
                  type="button"
                  onClick={() => setCustomLegs([])}
                  disabled={customLegs.length === 0}
                  className="ui-secondary-button"
                >
                  {t({ ru: "Очистить", en: "Clear" })}
                </button>
              </div>
            }
          >
            {availableOptions.length === 0 ? (
              <div className="ui-surface-muted text-center text-sm leading-7 text-slate-600 dark:text-slate-300">
                {t({
                  ru: "Для выбранной даты экспирации пока нет доступных контрактов для ручной сборки.",
                  en: "No contracts are available for manual construction on the selected expiration.",
                })}
              </div>
            ) : customLegs.length === 0 ? (
              <div className="ui-surface-muted text-center text-sm leading-7 text-slate-600 dark:text-slate-300">
                {t({
                  ru: "Пока нет ни одной ноги. Добавьте первую ногу и соберите собственную стратегию.",
                  en: "There are no legs yet. Add the first leg to build your own strategy.",
                })}
              </div>
            ) : (
              <div className="ui-table-shell overflow-x-auto">
                <table className="ui-data-table">
                  <thead>
                    <tr>
                      <th>{t({ ru: "B/S", en: "B/S" })}</th>
                      <th>{t({ ru: "Контракт", en: "Contract" })}</th>
                      <th>{t({ ru: "Кол-во", en: "Qty" })}</th>
                      <th>{t({ ru: "Удалить", en: "Remove" })}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customLegs.map((leg, index) => (
                      <tr key={`${leg.optionUid}-${index}`}>
                        <td className="ui-cell-number">
                          <select
                            value={leg.action}
                            onChange={(event) =>
                              updateCustomLeg(index, { action: event.target.value as StrategyLegAction })
                            }
                            className="ui-input min-w-24"
                          >
                            <option value="buy">B</option>
                            <option value="sell">S</option>
                          </select>
                        </td>
                        <td className="ui-cell-name">
                          <select
                            value={leg.optionUid}
                            onChange={(event) => updateCustomLeg(index, { optionUid: event.target.value })}
                            className="ui-input w-full min-w-[260px]"
                          >
                            {availableOptions.map((option) => {
                              const side = getOptionSide(option);
                              const sideLabel =
                                side === "other"
                                  ? getOptionTypeLabel(option, locale)
                                  : getOptionSideLabel(side, locale);

                              return (
                                <option key={option.uid} value={option.uid}>
                                  {`${sideLabel} • ${formatNumber(option.strikePrice, locale)} • ${option.ticker}`}
                                </option>
                              );
                            })}
                          </select>
                        </td>
                        <td className="ui-cell-number">
                          <input
                            type="number"
                            min={1}
                            max={25}
                            step={1}
                            value={leg.quantity}
                            onChange={(event) => {
                              const nextValue = Number(event.target.value);
                              updateCustomLeg(index, {
                                quantity: Number.isFinite(nextValue) ? Math.min(25, Math.max(1, Math.floor(nextValue))) : 1,
                              });
                            }}
                            className="ui-input w-24"
                          />
                        </td>
                        <td className="ui-cell-number">
                          <button
                            type="button"
                            onClick={() => removeCustomLeg(index)}
                            className="ui-secondary-button px-2.5 py-1.5 text-xs"
                          >
                            {t({ ru: "Убрать", en: "Remove" })}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        )}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,280px)_minmax(0,220px)_minmax(0,1fr)]">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              {t({ ru: "Экспирация стратегии", en: "Strategy expiration" })}
            </div>
            <select
              value={strategyExpirationKey}
              onChange={(event) => setStrategyExpirationKey(event.target.value)}
              className="ui-input w-full"
            >
              {expirationChoices.map((value) => (
                <option key={value} value={value}>
                  {formatDate(value, locale)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              {mode === "template"
                ? t({ ru: "Количество наборов", en: "Strategy size" })
                : t({ ru: "Ног в стратегии", en: "Legs in strategy" })}
            </div>
            {mode === "template" ? (
              <input
                type="number"
                min={1}
                max={25}
                step={1}
                value={contracts}
                onChange={(event) => {
                  const nextValue = Number(event.target.value);
                  if (!Number.isFinite(nextValue)) {
                    setContracts(1);
                    return;
                  }
                  setContracts(Math.min(25, Math.max(1, Math.floor(nextValue))));
                }}
                className="ui-input w-full"
              />
            ) : (
              <div className="ui-input flex h-11 items-center">{customLegs.length}</div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                {t({ ru: "Ценообразование для ног", en: "Leg pricing" })}
              </div>
              <button
                type="button"
                onClick={onLoadPricing}
                disabled={isPricingLoading || isPricingActionDisabled}
                className="ui-secondary-button px-3 py-1.5 text-xs"
              >
                {isPricingLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {pricingActionLabel}
              </button>
            </div>
            <div className="mt-2 leading-6">
              {isPricingLoading
                ? t({
                    ru: "Подтягиваем close prices T-Bank для выбранного актива...",
                    en: "Loading T-Bank close prices for the selected asset...",
                  })
                : pricingErrorMessage
                  ? pricingErrorMessage
                  : t({
                      ru: "Если по отдельному контракту нет close price, профиль строится без премии для этой ноги.",
                      en: "If a specific contract has no close price, that leg is modeled without premium.",
                    })}
            </div>
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {t({ ru: "Обновлено", en: "Updated" })}: {formatTimestamp(pricingUpdatedAt, locale)}
            </div>
          </div>
        </div>

        {strategyResult ? (
          <>
            <MetricGrid className="xl:grid-cols-5">
              <MetricCard
                label={t({ ru: "Чистая премия", en: "Net premium" })}
                value={netPremiumLabel}
                helper={t({ ru: "С учётом лотов и количества", en: "Includes lots and quantities" })}
              />
              <MetricCard
                label={t({ ru: "Макс. прибыль", en: "Max profit" })}
                value={formatPnLValue(strategyResult.maxProfit, locale)}
              />
              <MetricCard
                label={t({ ru: "Макс. убыток", en: "Max loss" })}
                value={formatPnLValue(strategyResult.maxLoss, locale)}
              />
              <MetricCard
                label={t({ ru: "Точки безубытка", en: "Break-even" })}
                value={formatBreakEvenValues(strategyResult, locale)}
              />
              <MetricCard
                label={t({ ru: "Есть close prices", en: "Close prices found" })}
                value={pricingCoverage}
                helper={t({ ru: "По ногам выбранной стратегии", en: "Across the selected strategy legs" })}
              />
            </MetricGrid>

            <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1.2fr)_minmax(420px,0.8fr)]">
              <SectionCard
                title={t({ ru: "Профиль P&L на экспирации", en: "Expiration P&L Profile" })}
                description={t({
                  ru: "Вертикальные линии отмечают break-even уровни. График строится на выбранной серии и текущем наборе ног.",
                  en: "Vertical lines mark break-even levels. The chart is built from the selected series and current leg set.",
                })}
                className="h-full"
              >
                <div className="h-[360px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 8, right: 18, left: 0, bottom: 8 }}>
                      <defs>
                        <linearGradient id="strategy-pnl-fill" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#2563eb" stopOpacity={0.28} />
                          <stop offset="100%" stopColor="#2563eb" stopOpacity={0.04} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.25)" />
                      <XAxis
                        dataKey="price"
                        tickFormatter={(value) => formatNumber(Number(value), locale)}
                        stroke="rgba(100, 116, 139, 0.9)"
                      />
                      <YAxis
                        tickFormatter={(value) => formatNumber(Number(value), locale)}
                        stroke="rgba(100, 116, 139, 0.9)"
                        width={88}
                      />
                      <ReferenceLine y={0} stroke="rgba(15, 23, 42, 0.5)" strokeDasharray="4 4" />
                      {strategyResult.breakEvenPrices.map((value) => (
                        <ReferenceLine
                          key={value}
                          x={Number(value.toFixed(2))}
                          stroke="rgba(245, 158, 11, 0.9)"
                          strokeDasharray="5 5"
                        />
                      ))}
                      <Tooltip
                        formatter={(value: number) => [formatNumber(Number(value), locale), "P&L"]}
                        labelFormatter={(value) =>
                          `${t({ ru: "Цена базового актива", en: "Underlying price" })}: ${formatNumber(Number(value), locale)}`
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="pnl"
                        stroke="#2563eb"
                        strokeWidth={2.5}
                        fill="url(#strategy-pnl-fill)"
                        activeDot={{ r: 4 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>

              <SectionCard
                title={t({ ru: "Ноги стратегии", en: "Strategy Legs" })}
                description={t({
                  ru: "Список ног, которые сейчас участвуют в расчёте профиля, премии и точек безубытка.",
                  en: "The list of legs currently used for profile, premium, and break-even calculations.",
                })}
                className="h-full"
              >
                <div className="space-y-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {t({ ru: "Опорный страйк", en: "Anchor strike" })}: {formatNumber(strategyResult.referenceStrike, locale)}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {t({ ru: "Серия", en: "Series" })}: {formatDate(strategyResult.expirationKey, locale)}
                    </div>
                  </div>

                  {strategyResult.warnings.includes("missing-close-prices") ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                      {t({
                        ru: "Для части ног close price не найден, поэтому некоторые расчёты используют нулевую премию как fallback.",
                        en: "Some legs have no close price, so parts of the calculation use zero premium as a fallback.",
                      })}
                    </div>
                  ) : null}

                  <div className="ui-table-shell overflow-x-auto">
                    <table className="ui-data-table">
                      <thead>
                        <tr>
                          <th>{t({ ru: "B/S", en: "B/S" })}</th>
                          <th>{t({ ru: "Тикер", en: "Ticker" })}</th>
                          <th>{t({ ru: "Тип", en: "Type" })}</th>
                          <th>{t({ ru: "Страйк", en: "Strike" })}</th>
                          <th>{t({ ru: "Премия", en: "Premium" })}</th>
                          <th>{t({ ru: "Лот", en: "Lot" })}</th>
                          <th>{t({ ru: "Кол-во", en: "Qty" })}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {strategyResult.legs.map((leg) => {
                          const optionSide = getOptionSide(leg.option);
                          return (
                            <tr key={`${leg.action}-${leg.option.uid}`}>
                              <td className="ui-cell-number">{leg.action === "buy" ? "B" : "S"}</td>
                              <td className="ui-cell-name">
                                <div className="font-medium text-slate-900 dark:text-slate-100">{leg.option.ticker}</div>
                                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                  {leg.option.name || "-"}
                                </div>
                              </td>
                              <td className="ui-cell-number">
                                {optionSide === "other"
                                  ? getOptionTypeLabel(leg.option, locale)
                                  : getOptionSideLabel(optionSide, locale)}
                              </td>
                              <td className="ui-cell-number">{formatNumber(leg.option.strikePrice, locale)}</td>
                              <td className="ui-cell-number">
                                {leg.premium === null ? "-" : formatNumber(leg.premium, locale)}
                              </td>
                              <td className="ui-cell-number">{formatNumber(leg.option.lot, locale)}</td>
                              <td className="ui-cell-number">{leg.quantity}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </SectionCard>
            </div>
          </>
        ) : (
          <div className="ui-surface-muted text-center text-sm leading-7 text-slate-600 dark:text-slate-300">
            {mode === "custom"
              ? t({
                  ru: "Добавьте хотя бы одну ногу, чтобы увидеть профиль стратегии и её метрики.",
                  en: "Add at least one leg to see the strategy profile and metrics.",
                })
              : expirationChoices.length === 0
                ? t({
                    ru: "Для этого актива пока нет доступных дат экспирации, поэтому стратегию собрать нельзя.",
                    en: "This asset has no available expiration dates, so a strategy cannot be built yet.",
                  })
                : t({
                    ru: "Для выбранного шаблона и серии не хватило страйков. Попробуйте другую дату экспирации или другой шаблон.",
                    en: "There are not enough strikes for the selected template and series. Try another expiration or another template.",
                  })}
          </div>
        )}

        <SectionCard
          title={t({ ru: "Справка по Greeks", en: "Greeks Guide" })}
          description={t({
            ru: "Текущие T-Bank endpoints, которые мы используем для списка опционов, не возвращают Greeks напрямую, поэтому здесь пока даётся справка, а не автоматический расчёт.",
            en: "The T-Bank endpoints used here for option lists do not return Greeks directly, so this section currently provides a guide rather than an automatic calculation.",
          })}
        >
          <MetricGrid className="xl:grid-cols-5">
            {greekGuideItems.map((item) => (
              <MetricCard
                key={item.key}
                label={item.title}
                value={item.summary}
                helper={item.description}
              />
            ))}
          </MetricGrid>
        </SectionCard>
      </div>
    </SectionCard>
  );
}
