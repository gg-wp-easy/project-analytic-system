import { useEffect, useMemo, useState } from "react";
import type { TBankOption } from "../../../shared/api/tbank";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import { SectionCard } from "../../../shared/ui/analysis-shell";
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
};

function createDraftLeg(optionUid: string): StrategyDraftLeg {
  return {
    optionUid,
    action: "buy",
    quantity: 1,
  };
}

export function OptionStrategyBuilder({
  options,
  activeExpirationKey,
  expirationChoices,
}: OptionStrategyBuilderProps) {
  const { locale, t } = useAppSettings();
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
  const selectedTemplate = useMemo(
    () => OPTIONS_STRATEGY_TEMPLATES.find((template) => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId],
  );
  const selectedStrategyHelp = mode === "template" ? getStrategyHelp(selectedTemplateId) : null;
  const strategyGuideItems = useMemo(
    () =>
      OPTIONS_STRATEGY_TEMPLATES.map((template) => ({
        template,
        help: getStrategyHelp(template.id),
      })).filter((item): item is { template: typeof item.template; help: NonNullable<typeof item.help> } =>
        Boolean(item.help),
      ),
    [],
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
        closePricesById: {},
      });
    }

    return buildStrategyFromTemplate({
      options,
      expirationKey: strategyExpirationKey,
      templateId: selectedTemplateId,
      closePricesById: {},
      contracts,
    });
  }, [contracts, customLegs, mode, options, selectedTemplateId, strategyExpirationKey]);

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
              <div className="ui-input flex h-11 items-center">{customLegs.length}</div>
            )}
          </div>
        </div>

        {strategyResult ? (
          <>
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

        <SectionCard
          title={t({ ru: "Справочник стратегий", en: "Strategy Reference" })}
          description={t({
            ru: "Краткая справка по всем шаблонам конструктора: рыночная идея, сценарий применения и основные ограничения риска.",
            en: "A quick reference for every builder template: market idea, use case, and main risk limits.",
          })}
        >
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {strategyGuideItems.map(({ template, help }) => (
              <article
                key={template.id}
                className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950/40"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      {template.name[locale]}
                    </div>
                    <div className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {help.thesis[locale]}
                    </div>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {outlookLabels[template.outlook]}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                      {t({ ru: "Сценарий", en: "Scenario" })}
                    </div>
                    {help.bestFor[locale]}
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                      {t({ ru: "Риск", en: "Risk" })}
                    </div>
                    {help.maxLoss[locale]}
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                      {t({ ru: "Прибыль", en: "Reward" })}
                    </div>
                    {help.maxProfit[locale]}
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                      {t({ ru: "Безубыток", en: "Break-even" })}
                    </div>
                    {help.breakEven[locale]}
                  </div>
                </div>
                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                  {help.note[locale]}
                </div>
              </article>
            ))}
          </div>
        </SectionCard>
      </div>
    </SectionCard>
  );
}
