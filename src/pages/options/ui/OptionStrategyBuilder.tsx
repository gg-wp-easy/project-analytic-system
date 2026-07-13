import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TBankOption } from "../../../shared/api/tbank";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import { SectionCard } from "../../../shared/ui/analysis-shell";
import type {
  BuilderMode,
  ManualPremiums,
  OptionStrategyBuilderProps,
  PayoffChartPoint,
} from "../model";
import {
  formatDate,
  formatNumber,
  getOptionSide,
  getOptionSideLabel,
  getOptionTypeLabel,
} from "../lib/options-helpers";
import {
  OPTIONS_STRATEGY_TEMPLATES,
  buildStrategyFromCustomLegs,
  buildStrategyFromTemplate,
  getOptionsForExpiration,
  getStrategyHelp,
  getStrategyTemplatesByOutlook,
  type StrategyBuildResult,
  type StrategyDraftLeg,
  type StrategyLegAction,
  type StrategyOutlook,
  type StrategyTemplateId,
} from "../lib/strategy-builder";

function createDraftLeg(optionUid: string): StrategyDraftLeg {
  return {
    optionUid,
    action: "buy",
    quantity: 1,
  };
}

function getStrategyLegUnits(result: StrategyBuildResult | null): number {
  return result?.legs.reduce((sum, leg) => sum + leg.quantity, 0) ?? 0;
}

function getStrategyStrikeRange(result: StrategyBuildResult | null): { min: number; max: number } | null {
  if (!result?.legs.length) {
    return null;
  }

  const strikes = result.legs.map((leg) => leg.option.strikePrice).filter(Number.isFinite);
  if (!strikes.length) {
    return null;
  }

  return {
    min: Math.min(...strikes),
    max: Math.max(...strikes),
  };
}

function getStrikePosition(strike: number, range: { min: number; max: number }): number {
  if (range.min === range.max) {
    return 50;
  }

  return 8 + ((strike - range.min) / (range.max - range.min)) * 84;
}

function formatSignedNumber(value: number, locale: "ru" | "en"): string {
  const formatted = formatNumber(Math.abs(value), locale);
  if (Math.abs(value) < 1e-8) {
    return "0";
  }
  return value > 0 ? `+${formatted}` : `-${formatted}`;
}

function getPayoffDomain(points: PayoffChartPoint[]): [number, number] {
  if (!points.length) {
    return [-1, 1];
  }

  const values = points.map((point) => point.pnl).filter(Number.isFinite);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const padding = Math.max((max - min) * 0.12, Math.max(Math.abs(min), Math.abs(max)) * 0.08, 1);
  return [min - padding, max + padding];
}

function normalizePremiumValue(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function buildManualClosePricesById(options: TBankOption[], premiums: ManualPremiums): Record<string, number> {
  const result: Record<string, number> = {};

  for (const option of options) {
    const premium = normalizePremiumValue(premiums[option.uid] ?? "");
    if (premium === null) {
      continue;
    }

    const keys = [
      option.uid,
      option.figi,
      option.positionUid,
      option.classCode && option.ticker ? `${option.ticker}_${option.classCode}` : "",
    ].filter(Boolean);

    for (const key of keys) {
      result[key] = premium;
    }
  }

  return result;
}

function formatNullableMoney(value: number | null, locale: "ru" | "en"): string {
  if (value === null) {
    return "—";
  }
  if (value === Number.POSITIVE_INFINITY) {
    return locale === "ru" ? "не ограничена" : "unlimited";
  }
  if (value === Number.NEGATIVE_INFINITY) {
    return locale === "ru" ? "не ограничен" : "unlimited";
  }
  return formatSignedNumber(value, locale);
}

export function OptionStrategyBuilder({
  options,
  activeExpirationKey,
  expirationChoices,
  closePricesById = {},
}: OptionStrategyBuilderProps) {
  const { locale, t } = useAppSettings();
  const [mode, setMode] = useState<BuilderMode>("template");
  const [outlookFilter, setOutlookFilter] = useState<StrategyOutlook>("all");
  const [selectedTemplateId, setSelectedTemplateId] = useState<Exclude<StrategyTemplateId, "custom">>("bear-call-spread");
  const [contracts, setContracts] = useState(1);
  const [strategyExpirationKey, setStrategyExpirationKey] = useState("");
  const [customLegs, setCustomLegs] = useState<StrategyDraftLeg[]>([]);
  const [manualPremiums, setManualPremiums] = useState<ManualPremiums>({});

  const expirationChoicesKey = expirationChoices.join("|");
  const availableTemplates = useMemo(
    () => getStrategyTemplatesByOutlook(outlookFilter),
    [outlookFilter],
  );
  const selectedTemplate = useMemo(
    () => OPTIONS_STRATEGY_TEMPLATES.find((template) => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId],
  );
  const selectedStrategyHelp = mode === "template" ? getStrategyHelp(selectedTemplateId) : null;

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

  useEffect(() => {
    const availableOptionUids = new Set(availableOptions.map((option) => option.uid));
    setManualPremiums((current) => {
      const next: ManualPremiums = {};
      for (const [uid, premium] of Object.entries(current)) {
        if (availableOptionUids.has(uid)) {
          next[uid] = premium;
        }
      }
      return next;
    });
  }, [availableOptionUidsKey, availableOptions]);

  const manualClosePricesById = useMemo(
    () => buildManualClosePricesById(availableOptions, manualPremiums),
    [availableOptions, manualPremiums],
  );
  const resolvedClosePricesById = useMemo(
    () => ({
      ...closePricesById,
      ...manualClosePricesById,
    }),
    [closePricesById, manualClosePricesById],
  );

  const strategyResult = useMemo(() => {
    if (!strategyExpirationKey) {
      return null;
    }

    if (mode === "custom") {
      return buildStrategyFromCustomLegs({
        options,
        expirationKey: strategyExpirationKey,
        legs: customLegs,
        closePricesById: resolvedClosePricesById,
      });
    }

    return buildStrategyFromTemplate({
      options,
      expirationKey: strategyExpirationKey,
      templateId: selectedTemplateId,
      closePricesById: resolvedClosePricesById,
      contracts,
    });
  }, [contracts, customLegs, mode, options, resolvedClosePricesById, selectedTemplateId, strategyExpirationKey]);
  const strategyLegRowsCount = strategyResult?.legs.length ?? customLegs.length;
  const strategyLegUnits = getStrategyLegUnits(strategyResult);
  const strategyStrikeRange = getStrategyStrikeRange(strategyResult);
  const strategyVisualLegs = useMemo(
    () =>
      strategyResult && strategyStrikeRange
        ? [...strategyResult.legs]
            .sort((left, right) => {
              if (left.option.strikePrice !== right.option.strikePrice) {
                return left.option.strikePrice - right.option.strikePrice;
              }
              return getOptionSide(left.option).localeCompare(getOptionSide(right.option));
            })
            .map((leg, index) => ({
              leg,
              index,
              x: getStrikePosition(leg.option.strikePrice, strategyStrikeRange),
              optionSide: getOptionSide(leg.option),
            }))
        : [],
    [strategyResult, strategyStrikeRange],
  );
  const payoffChartData = useMemo<PayoffChartPoint[]>(
    () =>
      strategyResult?.payoff.map((point) => ({
        price: Number(point.price.toFixed(2)),
        pnl: Number(point.pnl.toFixed(2)),
      })) ?? [],
    [strategyResult],
  );
  const payoffYDomain = useMemo(() => getPayoffDomain(payoffChartData), [payoffChartData]);
  const knownPremiumCount = strategyResult?.legs.filter((leg) => leg.premium !== null).length ?? 0;
  const hasManualPremiums = strategyResult?.legs.every((leg) => leg.premium !== null) ?? false;

  const outlookLabels: Record<StrategyOutlook, string> = {
    all: t({ ru: "Все идеи", en: "All ideas" }),
    bullish: t({ ru: "Бычьи", en: "Bullish" }),
    bearish: t({ ru: "Медвежьи", en: "Bearish" }),
    neutral: t({ ru: "Нейтральные", en: "Neutral" }),
  };

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

  const updateManualPremium = (optionUid: string, value: string) => {
    setManualPremiums((current) => ({
      ...current,
      [optionUid]: value,
    }));
  };

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
                        {t({ ru: `${template.legs} ног`, en: `${template.legs} legs` })}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedStrategyHelp && selectedTemplate ? (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900/60">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      {t({ ru: "Справка по стратегии", en: "Strategy guide" })}
                    </div>
                    <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {selectedTemplate.name[locale]}
                    </div>
                  </div>
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white dark:bg-slate-100 dark:text-slate-950">
                    {outlookLabels[selectedTemplate.outlook]}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {[
                    { label: t({ ru: "Идея", en: "Thesis" }), value: selectedStrategyHelp.thesis[locale] },
                    { label: t({ ru: "Когда применять", en: "Best for" }), value: selectedStrategyHelp.bestFor[locale] },
                    { label: t({ ru: "Макс. прибыль", en: "Max profit" }), value: selectedStrategyHelp.maxProfit[locale] },
                    { label: t({ ru: "Макс. убыток", en: "Max loss" }), value: selectedStrategyHelp.maxLoss[locale] },
                    { label: t({ ru: "Безубыток", en: "Break-even" }), value: selectedStrategyHelp.breakEven[locale] },
                    { label: t({ ru: "Важно", en: "Note" }), value: selectedStrategyHelp.note[locale] },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40"
                    >
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                        {item.label}
                      </div>
                      <div className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
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

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,280px)_minmax(0,220px)]">
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
              <div className="ui-input flex h-11 items-center">
                {t({
                  ru: `${customLegs.length} строк / ${customLegs.reduce((sum, leg) => sum + leg.quantity, 0)} контрактов`,
                  en: `${customLegs.length} rows / ${customLegs.reduce((sum, leg) => sum + leg.quantity, 0)} contracts`,
                })}
              </div>
            )}
          </div>
        </div>

        {strategyResult ? (
          <>
            <SectionCard
              title={t({ ru: "Визуальное представление", en: "Strategy View" })}
              description={t({
                ru: "Схема показывает ноги стратегии по страйкам: зелёные маркеры — покупка, красные — продажа.",
                en: "The scheme maps strategy legs by strike: green markers are buys, red markers are sells.",
              })}
            >
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                      {t({ ru: "Шаблон", en: "Template" })}
                    </div>
                    <div className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">
                      {strategyResult.template.name[locale]}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                      {t({ ru: "Ноги", en: "Legs" })}
                    </div>
                    <div className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">
                      {t({
                        ru: `${strategyLegRowsCount} строк / ${strategyLegUnits} контрактов`,
                        en: `${strategyLegRowsCount} rows / ${strategyLegUnits} contracts`,
                      })}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                      {t({ ru: "Экспирация", en: "Expiration" })}
                    </div>
                    <div className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">
                      {formatDate(strategyResult.expirationKey, locale)}
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                        {t({ ru: "Условная премия", en: "Manual premium" })}
                      </div>
                      <div className="mt-1 text-sm leading-6 text-amber-900/80 dark:text-amber-100/80">
                        {t({
                          ru: "Введите премию для каждой ноги, если текущих цен нет. График, безубыток, чистый дебет/кредит и риск пересчитаются сразу.",
                          en: "Enter a premium for each leg when live prices are unavailable. The chart, break-even, net debit/credit, and risk update immediately.",
                        })}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setManualPremiums({})}
                      disabled={!Object.keys(manualPremiums).length}
                      className="ui-secondary-button bg-white/70 px-3 py-2 text-xs dark:bg-slate-950/30"
                    >
                      {t({ ru: "Сбросить премии", en: "Reset premiums" })}
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {strategyResult.legs.map((leg) => {
                      const optionSide = getOptionSide(leg.option);
                      const sideLabel =
                        optionSide === "other"
                          ? getOptionTypeLabel(leg.option, locale)
                          : getOptionSideLabel(optionSide, locale);
                      const inputId = `premium-${leg.option.uid}`;

                      return (
                        <label
                          key={`${leg.action}-${leg.option.uid}-premium`}
                          htmlFor={inputId}
                          className="rounded-2xl border border-amber-200 bg-white p-3 dark:border-amber-500/30 dark:bg-slate-950/30"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-800 dark:text-amber-200">
                              {leg.action === "buy" ? "BUY" : "SELL"} {sideLabel}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {formatNumber(leg.option.strikePrice, locale)}
                            </span>
                          </div>
                          <input
                            id={inputId}
                            type="number"
                            min={0}
                            step={0.01}
                            inputMode="decimal"
                            value={manualPremiums[leg.option.uid] ?? ""}
                            onChange={(event) => updateManualPremium(leg.option.uid, event.target.value)}
                            placeholder="0"
                            className="ui-input mt-2"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>

                {strategyStrikeRange ? (
                  <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 dark:border-slate-800 dark:from-slate-900/80 dark:to-slate-950/40">
                    <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
                      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {t({ ru: "Профиль результата на экспирации", en: "Expiration payoff profile" })}
                          </div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {knownPremiumCount === 0
                              ? t({
                                  ru: "Без премий график показывает только внутреннюю стоимость на экспирации.",
                                  en: "Without premiums, the chart shows only intrinsic value at expiration.",
                                })
                              : hasManualPremiums
                                ? t({
                                    ru: "График учитывает введённые премии по всем ногам.",
                                    en: "The chart includes manually entered premiums for all legs.",
                                  })
                                : t({
                                    ru: "График учитывает заполненные премии, а пустые ноги считает с нулевой премией.",
                                    en: "The chart includes entered premiums and treats empty legs as zero-premium legs.",
                                  })}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          {strategyResult.breakEvenPrices.slice(0, 3).map((price) => (
                            <span
                              key={price}
                              className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                              BE {formatNumber(price, locale)}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900/60">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                            {t({ ru: "Чистая премия", en: "Net premium" })}
                          </div>
                          <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {formatNullableMoney(strategyResult.netPremium, locale)}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900/60">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                            {t({ ru: "Макс. прибыль", en: "Max profit" })}
                          </div>
                          <div className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                            {formatNullableMoney(strategyResult.maxProfit, locale)}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900/60">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                            {t({ ru: "Макс. убыток", en: "Max loss" })}
                          </div>
                          <div className="mt-1 text-sm font-semibold text-rose-700 dark:text-rose-300">
                            {formatNullableMoney(strategyResult.maxLoss, locale)}
                          </div>
                        </div>
                      </div>

                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={payoffChartData} margin={{ top: 12, right: 18, left: 4, bottom: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.28)" />
                            <XAxis
                              dataKey="price"
                              type="number"
                              domain={["dataMin", "dataMax"]}
                              tickFormatter={(value) => formatNumber(Number(value), locale)}
                              tick={{ fontSize: 12 }}
                              stroke="rgb(100, 116, 139)"
                            />
                            <YAxis
                              domain={payoffYDomain}
                              tickFormatter={(value) => formatSignedNumber(Number(value), locale)}
                              tick={{ fontSize: 12 }}
                              stroke="rgb(100, 116, 139)"
                              width={72}
                            />
                            <Tooltip
                              formatter={(value) => [
                                formatSignedNumber(Number(value), locale),
                                t({ ru: "Результат", en: "P&L" }),
                              ]}
                              labelFormatter={(value) =>
                                `${t({ ru: "Цена базового актива", en: "Underlying price" })}: ${formatNumber(Number(value), locale)}`
                              }
                              contentStyle={{
                                borderRadius: 12,
                                border: "1px solid rgba(148, 163, 184, 0.35)",
                                boxShadow: "0 18px 45px rgba(15, 23, 42, 0.14)",
                              }}
                            />
                            <ReferenceLine y={0} stroke="rgb(100, 116, 139)" strokeDasharray="5 5" />
                            <ReferenceLine
                              x={strategyResult.referenceStrike}
                              stroke="rgb(37, 99, 235)"
                              strokeDasharray="4 4"
                              label={{
                                value: t({ ru: "опора", en: "anchor" }),
                                position: "insideTop",
                                fill: "rgb(37, 99, 235)",
                                fontSize: 12,
                              }}
                            />
                            {strategyResult.breakEvenPrices.map((price) => (
                              <ReferenceLine
                                key={price}
                                x={price}
                                stroke="rgb(245, 158, 11)"
                                strokeDasharray="4 4"
                              />
                            ))}
                            <Line
                              type="linear"
                              dataKey="pnl"
                              stroke="rgb(16, 185, 129)"
                              strokeWidth={3}
                              dot={false}
                              activeDot={{ r: 5 }}
                              isAnimationActive={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="relative min-h-56">
                      <div className="absolute left-[8%] right-[8%] top-28 h-px bg-slate-300 dark:bg-slate-700" />
                      <div className="absolute left-[8%] top-[7.7rem] text-xs font-medium text-slate-500 dark:text-slate-400">
                        {formatNumber(strategyStrikeRange.min, locale)}
                      </div>
                      <div className="absolute right-[8%] top-[7.7rem] text-xs font-medium text-slate-500 dark:text-slate-400">
                        {formatNumber(strategyStrikeRange.max, locale)}
                      </div>
                      <div
                        className="absolute top-[6.2rem] h-9 w-px bg-blue-400 dark:bg-blue-300"
                        style={{ left: `${getStrikePosition(strategyResult.referenceStrike, strategyStrikeRange)}%` }}
                      >
                        <div className="-translate-x-1/2 -translate-y-8 whitespace-nowrap rounded-full bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
                          {t({ ru: "Опора", en: "Anchor" })} {formatNumber(strategyResult.referenceStrike, locale)}
                        </div>
                      </div>

                      {strategyVisualLegs.map(({ leg, index, x, optionSide }) => {
                        const isBuy = leg.action === "buy";
                        const sideLabel =
                          optionSide === "other"
                            ? getOptionTypeLabel(leg.option, locale)
                            : getOptionSideLabel(optionSide, locale);
                        const rowTop = optionSide === "put" ? 154 : 30;

                        return (
                          <div
                            key={`${leg.action}-${leg.option.uid}-${index}`}
                            className="absolute w-32 -translate-x-1/2"
                            style={{ left: `${x}%`, top: rowTop }}
                          >
                            <div
                              className={
                                isBuy
                                  ? "rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-center shadow-sm dark:border-emerald-500/30 dark:bg-emerald-500/10"
                                  : "rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-center shadow-sm dark:border-rose-500/30 dark:bg-rose-500/10"
                              }
                            >
                              <div
                                className={
                                  isBuy
                                    ? "text-xs font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-200"
                                    : "text-xs font-bold uppercase tracking-[0.16em] text-rose-700 dark:text-rose-200"
                                }
                              >
                                {isBuy ? "BUY" : "SELL"} {sideLabel}
                              </div>
                              <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {formatNumber(leg.option.strikePrice, locale)}
                              </div>
                              <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                x{leg.quantity}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        {t({ ru: "Покупка", en: "Buy" })}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
                        <span className="h-2 w-2 rounded-full bg-rose-500" />
                        {t({ ru: "Продажа", en: "Sell" })}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            </SectionCard>

            <SectionCard
              title={t({ ru: "Ноги стратегии", en: "Strategy Legs" })}
              description={t({
                ru: "Список ног, которые сейчас входят в выбранную конструкцию.",
                en: "The list of legs currently included in the selected construction.",
              })}
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

                <div className="ui-table-shell overflow-x-auto">
                  <table className="ui-data-table">
                    <thead>
                      <tr>
                        <th>{t({ ru: "B/S", en: "B/S" })}</th>
                        <th>{t({ ru: "Тикер", en: "Ticker" })}</th>
                        <th>{t({ ru: "Тип", en: "Type" })}</th>
                        <th>{t({ ru: "Страйк", en: "Strike" })}</th>
                        <th>{t({ ru: "Лот", en: "Lot" })}</th>
                        <th>{t({ ru: "Кол-во", en: "Qty" })}</th>
                        <th>{t({ ru: "Премия", en: "Premium" })}</th>
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
                            <td className="ui-cell-number">{formatNumber(leg.option.lot, locale)}</td>
                            <td className="ui-cell-number">{leg.quantity}</td>
                            <td className="ui-cell-number">
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                inputMode="decimal"
                                value={manualPremiums[leg.option.uid] ?? ""}
                                onChange={(event) => updateManualPremium(leg.option.uid, event.target.value)}
                                placeholder="0"
                                className="ui-input w-28"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </SectionCard>
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

      </div>
    </SectionCard>
  );
}
