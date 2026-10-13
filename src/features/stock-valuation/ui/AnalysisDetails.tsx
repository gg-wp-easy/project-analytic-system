import { useAppSettings } from "../../../app/context/AppSettingsContext";
import { SectionCard } from "../../../shared/ui/analysis-shell";
import { formatNumber, formatPercent, formatPValue } from "../lib/stock-valuation.format";
import { CLASS_STYLES } from "../model/stock-valuation.consts";
import type {
  ClusterDetails,
  FeatureShare,
  HybridDetails,
  NeuralDetails,
  RegressionDetails,
  StockValuationResult,
  TreeDetails,
} from "../model/stock-valuation.types";

function ShareBars({ rows }: { rows: FeatureShare[] }) {
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.feature} className="grid grid-cols-[minmax(0,14rem)_1fr_3.5rem] items-center gap-3 text-sm">
          <span className="truncate text-slate-700 dark:text-slate-300" title={row.label}>{row.label}</span>
          <span className="h-2 rounded-full bg-slate-100 dark:bg-white/10">
            <span className="block h-2 rounded-full bg-current opacity-70" style={{ width: `${Math.round(row.share * 100)}%` }} />
          </span>
          <span className="ui-cell-number text-right">{formatPercent(row.share, 0)}</span>
        </div>
      ))}
    </div>
  );
}

function RegressionBlock({ details }: { details: RegressionDetails }) {
  const { t } = useAppSettings();
  return (
    <div className="space-y-5">
      <div className="ui-table-shell overflow-x-auto">
        <table className="ui-data-table min-w-[36rem]">
          <thead>
            <tr>
              <th>{t("Показатель", "Indicator")}</th>
              <th>{t("Шаг (1 ст. откл.)", "Step (1 st. dev.)")}</th>
              <th>{t("P/E меняется на", "P/E changes by")}</th>
              <th>p</th>
            </tr>
          </thead>
          <tbody>
            {details.coefficients.map((row) => (
              <tr key={row.feature}>
                <td className="ui-cell-name">{row.label}</td>
                <td>{row.step}</td>
                <td className="ui-cell-number">{formatPercent(row.effect, 1, true)}</td>
                <td className="ui-cell-number">{formatPValue(row.p_value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {t(
          `Показатели объясняют ${formatPercent(details.r2_within, 0)} разброса P/E внутри отраслей; вместе с отраслью — ${formatPercent(details.r2, 0)}.`,
          `The indicators explain ${formatPercent(details.r2_within, 0)} of the P/E spread within sectors; with the sector — ${formatPercent(details.r2, 0)}.`,
        )}
      </p>
      <div>
        <p className="mb-2 text-sm font-medium text-slate-800 dark:text-slate-100">
          {t("База отрасли — P/E, от которого отсчитывается справедливый", "Sector base — the P/E the fair one starts from")}
        </p>
        <div className="flex flex-wrap gap-2">
          {details.sector_base.map((row) => (
            <span key={row.sector} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-700 dark:bg-white/10 dark:text-slate-200">
              {row.sector}: <b>{formatNumber(row.pe)}</b>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ClusterBlock({ details }: { details: ClusterDetails }) {
  const { t } = useAppSettings();
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {details.pays_for_growth
          ? t(
              "Рынок платит за рост: у групп с большим g P/E выше. Группа дешевле линии рынка — недооценена.",
              "The market pays for growth: groups with higher g have higher P/E. A group below the market line is undervalued.",
            )
          : t(
              `Рынок сейчас не платит за рост (P/E и g не связаны): группы сравниваются с медианным P/E рынка ${formatNumber(details.market_pe)}.`,
              `The market does not pay for growth now: groups are compared with the market median P/E of ${formatNumber(details.market_pe)}.`,
            )}
      </p>
      <div className="ui-table-shell overflow-x-auto">
        <table className="ui-data-table min-w-[40rem]">
          <thead>
            <tr>
              <th>{t("Группа", "Group")}</th>
              <th>{t("Компаний", "Companies")}</th>
              <th>P/E</th>
              <th>g</th>
              <th>{t("Оценка", "Valuation")}</th>
              <th>{t("Компании", "Companies")}</th>
            </tr>
          </thead>
          <tbody>
            {details.groups.map((group) => (
              <tr key={group.group}>
                <td className="ui-cell-number">{group.group}</td>
                <td className="ui-cell-number">{group.size}</td>
                <td className="ui-cell-number">{formatNumber(group.pe)}</td>
                <td className="ui-cell-number">{formatPercent(group.g)}</td>
                <td>
                  <span className={`rounded-md px-2 py-0.5 text-xs ${CLASS_STYLES[group.valuation_class]}`}>
                    {group.valuation_class_text}
                  </span>
                </td>
                <td className="whitespace-normal text-xs text-slate-600 dark:text-slate-300">{group.tickers.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TreeBlock({ details }: { details: TreeDetails }) {
  const { t } = useAppSettings();
  return (
    <div className="space-y-5">
      <div className="ui-table-shell overflow-x-auto">
        <table className="ui-data-table min-w-[36rem]">
          <thead>
            <tr>
              <th>{t("Условия", "Conditions")}</th>
              <th>{t("P/E к базе отрасли", "P/E vs sector base")}</th>
              <th>{t("Компаний", "Companies")}</th>
            </tr>
          </thead>
          <tbody>
            {details.rules.map((rule, index) => (
              <tr key={index}>
                <td className="whitespace-normal text-sm">{rule.conditions.join("; ")}</td>
                <td className="ui-cell-number">×{formatNumber(rule.relative_pe, 2)}</td>
                <td className="ui-cell-number">{rule.companies}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!!details.importance.length && (
        <div className="text-emerald-600">
          <p className="mb-2 text-sm font-medium text-slate-800 dark:text-slate-100">{t("Важность показателей", "Indicator importance")}</p>
          <ShareBars rows={details.importance} />
        </div>
      )}
    </div>
  );
}

function NeuralBlock({ details }: { details: NeuralDetails }) {
  const { t } = useAppSettings();
  return (
    <div className="space-y-3 text-orange-600">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {t(
          "Насколько вырастет ошибка прогноза, если перемешать показатель между компаниями:",
          "How much the forecast error grows if an indicator is shuffled between companies:",
        )}
      </p>
      <ShareBars rows={details.importance} />
    </div>
  );
}

function HybridBlock({ details }: { details: HybridDetails }) {
  const { t } = useAppSettings();
  return (
    <div className="ui-table-shell overflow-x-auto">
      <table className="ui-data-table min-w-[36rem]">
        <thead>
          <tr>
            <th>{t("Анализ", "Analysis")}</th>
            <th>{t("Вес", "Weight")}</th>
            <th>{t("Ошибка P/E", "P/E error")}</th>
            <th>{t("Недооценены", "Undervalued")}</th>
            <th>{t("Переоценены", "Overvalued")}</th>
          </tr>
        </thead>
        <tbody>
          {details.parts.map((part) => (
            <tr key={part.analysis}>
              <td className="ui-cell-name">{part.label}</td>
              <td className="ui-cell-number">{formatPercent(part.weight, 0)}</td>
              <td className="ui-cell-number">{formatPercent(part.typical_error, 0)}</td>
              <td className="ui-cell-number">{part.counts.undervalued}</td>
              <td className="ui-cell-number">{part.counts.overvalued}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TITLES = {
  regression: { ru: "Регрессия: как показатели меняют P/E", en: "Regression: how indicators move P/E" },
  cluster: { ru: "Группы компаний по P/E и росту g", en: "Company groups by P/E and growth g" },
  tree: { ru: "Правила дерева", en: "Tree rules" },
  neural: { ru: "Важность показателей для нейросети", en: "Indicator importance for the network" },
  hybrid: { ru: "Состав гибрида", en: "Hybrid composition" },
};

/** То, что отличает анализ: коэффициенты, группы, правила, важность или веса. */
export function AnalysisDetails({ result }: { result: StockValuationResult }) {
  const { t } = useAppSettings();
  const body = (() => {
    switch (result.analysis) {
      case "regression":
        return <RegressionBlock details={result.details as RegressionDetails} />;
      case "cluster":
        return <ClusterBlock details={result.details as ClusterDetails} />;
      case "tree":
        return <TreeBlock details={result.details as TreeDetails} />;
      case "neural":
        return <NeuralBlock details={result.details as NeuralDetails} />;
      default:
        return <HybridBlock details={result.details as HybridDetails} />;
    }
  })();

  return (
    <SectionCard title={t(TITLES[result.analysis])}>
      <div className="space-y-5">
        {body}
        <details className="text-sm text-slate-600 dark:text-slate-300">
          <summary className="cursor-pointer select-none font-medium text-slate-700 dark:text-slate-200">
            {t("Как считается", "How it works")}
          </summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            {result.method.map((step) => (
              <li key={step}>{step}</li>
            ))}
            <li>{result.summary.risk_note}</li>
          </ol>
        </details>
      </div>
    </SectionCard>
  );
}
