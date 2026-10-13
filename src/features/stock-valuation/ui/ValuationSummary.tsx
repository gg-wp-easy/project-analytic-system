import { useAppSettings } from "../../../app/context/AppSettingsContext";
import { MetricCard, MetricGrid, SectionCard } from "../../../shared/ui/analysis-shell";
import { formatPercent } from "../lib/stock-valuation.format";
import { CLASS_TITLES } from "../model/stock-valuation.consts";
import type { StockValuationResult, ValuationClass } from "../model/stock-valuation.types";

const SHOWN: ValuationClass[] = ["undervalued", "fair", "overvalued"];

/** Итог анализа: сколько компаний в каждом классе и насколько точен прогноз P/E. */
export function ValuationSummary({ result }: { result: StockValuationResult }) {
  const { t } = useAppSettings();
  const { summary, factors } = result;
  const quality = summary.quality;

  return (
    <SectionCard
      title={t("Итог оценки P/E", "P/E valuation summary")}
      description={t(
        `Оценено ${summary.rated} из ${summary.companies} компаний. Класс — по отклонению P/E от справедливого с учётом ошибки анализа.`,
        `${summary.rated} of ${summary.companies} companies rated. The class follows the gap between P/E and its fair value, net of the analysis error.`,
      )}
    >
      <div className="space-y-4">
        <MetricGrid>
          {SHOWN.map((key) => (
            <MetricCard key={key} label={t(CLASS_TITLES[key])} value={summary.counts[key]} />
          ))}
          {quality ? (
            <MetricCard
              label={t("Ошибка прогноза P/E", "P/E forecast error")}
              value={formatPercent(quality.typical_error, 0)}
              helper={t(
                `вне выборки; у медианы отрасли — ${formatPercent(quality.sector_typical_error, 0)}`,
                `out of sample; sector median — ${formatPercent(quality.sector_typical_error, 0)}`,
              )}
            />
          ) : (
            <MetricCard label={t(CLASS_TITLES.not_rated)} value={summary.counts.not_rated} />
          )}
        </MetricGrid>
        {summary.data_source?.note && (
          <p className={`text-xs ${summary.data_source.fundamentals === "smart-lab" ? "text-slate-500 dark:text-slate-400" : "text-amber-700 dark:text-amber-300"}`}>
            {t("Данные: ", "Data: ")}
            {summary.data_source.note}
          </p>
        )}
        {!!factors.length && (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            <span className="font-medium text-slate-800 dark:text-slate-100">
              {t("Что определяет P/E внутри отрасли: ", "What drives P/E within a sector: ")}
            </span>
            {factors.map((factor) => factor.label.replace(/, %$/, "")).join(", ")}
          </p>
        )}
      </div>
    </SectionCard>
  );
}
