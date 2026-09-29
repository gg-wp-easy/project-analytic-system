import { useAppSettings } from "../../../app/context/AppSettingsContext";
import { MetricCard, MetricGrid, SectionCard } from "../../../shared/ui/analysis-shell";
import type { ValuationReport } from "../model/valuation-report.types";

const STATUS_LABELS: Record<string, { ru: string; en: string; tone: string }> = {
  selected: { ru: "Отобран", en: "Selected", tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  not_significant: { ru: "Незначим", en: "Not significant", tone: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  high_correlation: { ru: "Мультиколлинеарен (|r|)", en: "Collinear (|r|)", tone: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  high_vif: { ru: "Мультиколлинеарен (VIF)", en: "Collinear (VIF)", tone: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  low_coverage: { ru: "Мало данных", en: "Too sparse", tone: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  constant: { ru: "Нет вариации", en: "Constant", tone: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
};

const LEVEL_STATUS_LABELS: Record<string, { ru: string; en: string; tone: string }> = {
  selected: { ru: "В уровне", en: "In the level", tone: STATUS_LABELS.selected.tone },
  low_loading: { ru: "Слабая связь", en: "Weak loading", tone: STATUS_LABELS.not_significant.tone },
  few_observations: { ru: "Мало данных", en: "Too sparse", tone: STATUS_LABELS.low_coverage.tone },
};

const OBJECTIVE_SHORT_LABELS: Record<string, { ru: string; en: string }> = {
  min_risk: { ru: "Мин. риск", en: "Min risk" },
  max_sharpe: { ru: "Макс. Шарп", en: "Max Sharpe" },
  max_return: { ru: "Макс. доходность", en: "Max return" },
  target_return: { ru: "Мин. риск при цели", en: "Min risk at target" },
};

const NOT_RATED_LABELS: Record<string, { ru: string; en: string }> = {
  no_pe: { ru: "нет положительного P/E", en: "no positive P/E" },
  abnormal_low_pe: { ru: "P/E ниже 1 (разовая прибыль)", en: "P/E below 1 (one-off profit)" },
  abnormal_high_pe: { ru: "P/E выше 100", en: "P/E above 100" },
};

function percent(value: number, digits = 1): string {
  return Number.isFinite(value) ? `${(value * 100).toFixed(digits)}%` : "-";
}

function fixed(value: number, digits = 2): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "-";
}

function versusMarket(ratio: number): string {
  return Number.isFinite(ratio) ? `${ratio >= 1 ? "+" : ""}${((ratio - 1) * 100).toFixed(0)}%` : "-";
}

function pValue(value: number): string {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return value < 0.001 ? "< 0.001" : value.toFixed(3);
}

export function ValuationReportPanel({ report }: { report: ValuationReport }) {
  const { t } = useAppSettings();
  const notRated = Object.entries(report.notRated).filter(([, count]) => count > 0);
  const history = report.riskSource === "price_history";

  return (
    <div className="space-y-6">
      <SectionCard
        title={t("Как получен результат", "How the result is built")}
        description={t(
          "Анализы выполняются последовательно: каждый следующий шаг использует результат предыдущего.",
          "The analyses run in sequence: every step uses the result of the previous one.",
        )}
      >
        <ol className="grid gap-2 text-sm text-slate-700 dark:text-slate-300 md:grid-cols-2">
          {report.steps.map((step, index) => (
            <li key={step} className="flex gap-2">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <MetricGrid className="mt-5">
          <MetricCard label={t("Компаний в данных", "Companies")} value={report.companies} />
          <MetricCard
            label={t("Оценено компаний", "Companies valued")}
            value={report.ratedCompanies}
            helper={notRated.length
              ? notRated.map(([key, count]) => `${count} — ${t(NOT_RATED_LABELS[key] ?? { ru: key, en: key })}`).join("; ")
              : undefined}
          />
          <MetricCard label={t("Платят дивиденды 2 года подряд", "Paid dividends 2 years running")} value={report.dividendPayers} />
          <MetricCard
            label={t("Классы оценки", "Valuation classes")}
            value={`${report.classCounts.undervalued} / ${report.classCounts.fair} / ${report.classCounts.overvalued}`}
            helper={t("недооценены / справедливо / переоценены", "undervalued / fair / overvalued")}
          />
        </MetricGrid>
      </SectionCard>

      <SectionCard
        title={t("Уровень оценки по мультипликаторам", "Valuation level from multiples")}
        description={t(
          "Мультипликаторы измеряют одно — насколько дорога акция, и во всех есть цена. Поэтому они не факторы, а мера оценки: мультипликаторы, связанные общим фактором (нагрузка ≥ 0,5), усредняются относительно медианы рынка. Разница между справедливым и фактическим уровнем равна разнице между справедливой и текущей ценой.",
          "Multiples all measure how expensive a share is, and all contain the price. So they are the measure of valuation, not factors: the multiples sharing one common factor (loading ≥ 0.5) are averaged relative to the market median. The gap between the fair and the actual level equals the gap between the fair and the current price.",
        )}
      >
        <MetricGrid>
          <MetricCard label={t("Мультипликаторы в уровне", "Multiples in the level")} value={report.level.labels.join(", ") || "-"} />
          <MetricCard
            label="KMO / Bartlett"
            value={fixed(report.level.kmo, 2)}
            helper={`p ${pValue(report.level.bartlettPValue)}`}
          />
          <MetricCard
            label={t("Доля общего фактора", "Common factor share")}
            value={percent(report.level.explainedVariance, 0)}
            helper={`${t("факторов с λ > 1", "factors with λ > 1")}: ${fixed(report.level.factorsCount, 0)}`}
          />
        </MetricGrid>
        <div className="ui-table-shell mt-4 overflow-x-auto">
          <table className="ui-data-table">
            <thead>
              <tr>
                <th>{t("Мультипликатор", "Multiple")}</th>
                <th>{t("Статус", "Status")}</th>
                <th>{t("Нагрузка", "Loading")}</th>
                <th>{t("Медиана рынка", "Market median")}</th>
                <th>{t("Полнота", "Coverage")}</th>
              </tr>
            </thead>
            <tbody>
              {report.level.table.map((row) => {
                const status = LEVEL_STATUS_LABELS[row.status] ?? { ru: row.status, en: row.status, tone: STATUS_LABELS.not_significant.tone };
                return (
                  <tr key={row.multiple}>
                    <td className="font-medium text-slate-900 dark:text-slate-100">{row.label}</td>
                    <td>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${status.tone}`}>
                        {t(status)}
                      </span>
                    </td>
                    <td className="ui-cell-number">{fixed(row.loading, 2)}</td>
                    <td className="ui-cell-number">{fixed(row.median, 2)}</td>
                    <td className="ui-cell-number">{percent(row.coverage, 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {report.level.formula && (
          <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">{report.level.formula}</p>
        )}
      </SectionCard>

      <SectionCard
        title={t("Факторный анализ", "Factor analysis")}
        description={t(
          "Отобраны фундаментальные показатели, которые не дублируют друг друга (|r| < 0,8, VIF < 5) и значимо объясняют уровень оценки (p < 0,05, робастные ошибки HC3). Отрасль остаётся, если значим совместный тест Вальда.",
          "Selected fundamentals do not duplicate each other (|r| < 0.8, VIF < 5) and explain the valuation level significantly (p < 0.05, HC3 robust errors). Sector stays when its joint Wald test is significant.",
        )}
      >
        <MetricGrid>
          <MetricCard
            label={t("Отобранные факторы", "Selected factors")}
            value={report.candidates.filter((row) => row.status === "selected").length + (report.selectedFactors.includes("sector") ? 1 : 0)}
            helper={report.selectedFactors.includes("sector") ? t("включая отрасль", "including sector") : undefined}
          />
          <MetricCard
            label={t("R² факторной модели", "Factor model R²")}
            value={fixed(report.factorModel.r2, 3)}
            helper={`${t("скорр.", "adj.")} ${fixed(report.factorModel.adjR2, 3)}, n = ${fixed(report.factorModel.observations, 0)}`}
          />
          <MetricCard
            label={t("Влияние отрасли", "Sector effect")}
            value={report.selectedFactors.includes("sector") ? `p ${pValue(report.factorModel.sectorPValue)}` : t("незначимо", "not significant")}
            helper={`${t("все факторы вместе", "all factors jointly")}: p ${pValue(report.factorModel.jointPValue)}`}
          />
          <MetricCard
            label="KMO / Bartlett"
            value={fixed(report.factorStructure.kmo, 2)}
            helper={`p ${pValue(report.factorStructure.bartlettPValue)}, ${t("групп показателей", "indicator groups")}: ${fixed(report.factorStructure.factorsCount, 0)}`}
          />
        </MetricGrid>
        {report.weakEvidence && (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            {t(
              "Ни один показатель не значим: оставлен самый сильный, выводы моделей следует считать слабыми.",
              "No indicator is significant: the strongest one is kept, treat the model conclusions as weak.",
            )}
          </p>
        )}
        <div className="ui-table-shell mt-4 overflow-x-auto">
          <table className="ui-data-table">
            <thead>
              <tr>
                <th>{t("Показатель", "Indicator")}</th>
                <th>{t("Статус", "Status")}</th>
                <th>{t("Коэф. в уровне оценки", "Coef. on valuation level")}</th>
                <th>p</th>
                <th>VIF</th>
                <th>{t("Полнота", "Coverage")}</th>
                <th>{t("Бутстреп", "Bootstrap")}</th>
              </tr>
            </thead>
            <tbody>
              {report.candidates.map((row) => {
                const status = STATUS_LABELS[row.status] ?? { ru: row.status, en: row.status, tone: STATUS_LABELS.not_significant.tone };
                return (
                  <tr key={row.feature}>
                    <td className="font-medium text-slate-900 dark:text-slate-100">{row.label}</td>
                    <td>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${status.tone}`}>
                        {t(status)}
                      </span>
                      {row.relatedFeature && <span className="ml-1 text-xs text-slate-500">({row.relatedFeature})</span>}
                    </td>
                    <td className="ui-cell-number">{fixed(row.coefficient, 4)}</td>
                    <td className="ui-cell-number">{pValue(row.pValue)}</td>
                    <td className="ui-cell-number">{fixed(row.vif, 2)}</td>
                    <td className="ui-cell-number">{percent(row.coverage, 0)}</td>
                    <td className="ui-cell-number">{percent(row.bootstrapFrequency, 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {report.factorNote && (
          <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">{report.factorNote}</p>
        )}
      </SectionCard>

      <SectionCard
        title={t("Справедливая оценка вне выборки", "Out-of-sample fair valuation")}
        description={t(
          "Каждую компанию оценивает модель, обученная без её эмитента; факторный отбор повторяется внутри каждого обучающего блока.",
          "Every company is valued by a model trained without its issuer; factor selection is repeated inside every training fold.",
        )}
      >
        <div className="ui-table-shell overflow-x-auto">
          <table className="ui-data-table">
            <thead>
              <tr>
                <th>{t("Модель", "Model")}</th>
                <th>{t("Вес", "Weight")}</th>
                <th>{t("R² (уровень оценки)", "R² (valuation level)")}</th>
                <th>{t("Типичная ошибка оценки", "Typical valuation error")}</th>
              </tr>
            </thead>
            <tbody>
              {[...report.models, ...report.baselines].map((row) => (
                <tr key={row.key}>
                  <td className="font-medium text-slate-900 dark:text-slate-100">{row.label}</td>
                  <td className="ui-cell-number">{percent(row.weight, 0)}</td>
                  <td className="ui-cell-number">{fixed(row.r2, 3)}</td>
                  <td className="ui-cell-number">{percent(row.typicalError, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {Number.isFinite(report.ensembleR2) && (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            {t("R² ансамбля моделей", "Ensemble R²")}: <span className="font-semibold">{fixed(report.ensembleR2, 3)}</span>
          </p>
        )}
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{report.classRule}</p>
      </SectionCard>

      <SectionCard
        title={t("Кандидаты и модель портфеля", "Candidates and portfolio model")}
        description={t(
          "Сначала недооценённые плательщики дивидендов последних двух лет, затем справедливо оценённые плательщики; внутри очереди — по дивидендам и росту. Компании без дивидендов берутся, только если плательщиков меньше, чем позиций, и получают минимальный вес. Переоценённые и мелкие не берутся, от эмитента — один класс акций.",
          "Undervalued dividend payers of the last two years come first, then fairly valued payers; within a tier dividends and growth decide. Companies without dividends join only when payers are fewer than positions, at the minimum weight. Overvalued and small stocks are excluded, one share class per issuer.",
        )}
      >
        {Number.isFinite(report.marketCapScreen.minBn) && (
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
            {t("Капитализация", "Market cap")}: {t("от", "from")} {fixed(report.marketCapScreen.minBn, 0)} {t("млрд ₽", "bn RUB")}.
            {report.marketCapScreen.excluded.length > 0 && (
              <>
                {" "}
                {t("Отсеяны как мелкие", "Screened out as small")} ({report.marketCapScreen.excluded.length}): {report.marketCapScreen.excluded.join(", ")}
              </>
            )}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {Object.entries(report.tiers).map(([tier, label]) => (
            <span key={tier} className="ui-pill">
              {tier}. {label}: {report.tierCounts[tier] ?? 0}
            </span>
          ))}
        </div>
        {report.fillers.length > 0 && (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            {t("Добор позиций без дивидендов (минимальный вес)", "Positions filled without dividends (minimum weight)")}: {report.fillers.join(", ")}
          </p>
        )}
        {report.required.length > 0 && (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            {t("Обязательно в портфеле", "Always held")}: {report.required.join(", ")}
          </p>
        )}
        <MetricGrid className="mt-4">
          <MetricCard
            label={t("Ковариация доходностей", "Return covariance")}
            value={history ? t("История цен", "Price history") : t("Однофакторная (бета)", "Single-index (beta)")}
            helper={history
              ? `${fixed(report.riskWeeks, 0)} ${t("нед.", "weeks")}, ${report.riskWindow}, Ledoit–Wolf ${fixed(report.riskShrinkage, 2)}`
              : report.riskReason}
          />
          <MetricCard
            label={t("Ожидаемая доходность", "Expected return")}
            value={t("Дивиденды + g", "Dividends + g")}
            helper={report.expectedReturnFormula}
          />
          <MetricCard
            label={t("Цель оптимизации", "Objective")}
            value={OBJECTIVE_SHORT_LABELS[report.objective] ? t(OBJECTIVE_SHORT_LABELS[report.objective]) : report.objectiveLabel}
            helper={[report.objectiveLabel, report.portfolioMessage].filter(Boolean).join(". ")}
          />
        </MetricGrid>
        <div className="ui-table-shell mt-4 overflow-x-auto">
          <table className="ui-data-table">
            <thead>
              <tr>
                <th>{t("Акция", "Stock")}</th>
                <th>{t("Ярус", "Tier")}</th>
                <th>{t("Капит., млрд ₽", "Cap, bn RUB")}</th>
                <th>{t("Оценка", "Valuation")}</th>
                <th>P/E</th>
                <th>{t("Справедливый P/E", "Fair P/E")}</th>
                <th>{t("Мультипл. к медиане", "Multiples vs market")}</th>
                <th>{t("Потенциал", "Upside")}</th>
                <th>{t("Дивиденды", "Dividends")}</th>
                <th>{t("Див. дох.", "Div. yield")}</th>
                <th>g</th>
                <th>E[R]</th>
                <th>{t("Риск", "Risk")}</th>
              </tr>
            </thead>
            <tbody>
              {report.pool.map((row) => (
                <tr key={row.ticker}>
                  <td className="ui-cell-name">
                    <div className="font-medium text-slate-900 dark:text-slate-100">{row.ticker}</div>
                    <div className="text-xs text-slate-500">{row.name}</div>
                  </td>
                  <td className="ui-cell-number">{fixed(row.tier, 0)}</td>
                  <td className="ui-cell-number">
                    {fixed(row.marketCapBn, 0)}
                    {row.sizeLabel && <div className="text-xs text-slate-500">{row.sizeLabel}</div>}
                  </td>
                  <td>{row.valuationClass}</td>
                  <td className="ui-cell-number">{fixed(row.pe, 2)}</td>
                  <td className="ui-cell-number">{fixed(row.fairPe, 2)}</td>
                  <td className="ui-cell-number">{versusMarket(row.multiplesVsMarket)}</td>
                  <td className="ui-cell-number">{percent(row.upside, 0)}</td>
                  <td>{row.dividendPayer ? t("да", "yes") : t("нет", "no")}</td>
                  <td className="ui-cell-number">{percent(row.dividendYieldUsed)}</td>
                  <td className="ui-cell-number">{percent(row.growthUsed)}</td>
                  <td className="ui-cell-number">{percent(row.expectedReturn)}</td>
                  <td className="ui-cell-number">{percent(row.risk)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
