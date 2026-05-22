import { useMemo } from "react";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import { SectionCard } from "../../../shared/ui/analysis-shell";
import {
  OPTIONS_STRATEGY_TEMPLATES,
  getStrategyHelp,
  type StrategyOutlook,
} from "../lib/strategy-builder";

export function OptionStrategiesReference() {
  const { locale, t } = useAppSettings();
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
  const outlookLabels: Record<Exclude<StrategyOutlook, "all">, string> = {
    bullish: t({ ru: "Бычья", en: "Bullish" }),
    bearish: t({ ru: "Медвежья", en: "Bearish" }),
    neutral: t({ ru: "Нейтральная", en: "Neutral" }),
  };

  return (
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
            className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950/40"
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
              {[
                { label: t({ ru: "Сценарий", en: "Scenario" }), value: help.bestFor[locale] },
                { label: t({ ru: "Риск", en: "Risk" }), value: help.maxLoss[locale] },
                { label: t({ ru: "Прибыль", en: "Reward" }), value: help.maxProfit[locale] },
                { label: t({ ru: "Безубыток", en: "Break-even" }), value: help.breakEven[locale] },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700 dark:bg-slate-900/70 dark:text-slate-200"
                >
                  <div className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    {item.label}
                  </div>
                  {item.value}
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
              {help.note[locale]}
            </div>
          </article>
        ))}
      </div>
    </SectionCard>
  );
}
