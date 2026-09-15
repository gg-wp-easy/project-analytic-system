import { useEffect, useMemo, useRef, useState } from "react";
import { FileSpreadsheet, FileText, ImageDown, Landmark, RefreshCw, Settings, Trash2 } from "lucide-react";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import { BondPortfolioConstructionError, runBondPortfolioConstruction } from "../../../features/bonds-analysis";

import { SavePortfolioButton } from "../../../features/saved-portfolios";
import type {
  BondAnalysisBond,
  BondAnalysisPreferences,
  BondAnalysisSummary,
  BondPortfolioConstruction,
  BondPortfolioPosition,
  BondRiskClassification,
  BondsAnalysisPersistedState,
} from "../../../features/bonds-analysis";
import type { ExportColumn, ExportMetric } from "../../../shared/lib/export/download";
import {
  downloadAnalysisResultsAsPdf,
  downloadAnalysisResultsAsXlsx,
  downloadRowsAsXlsx,
  downloadSvgAsPng,
} from "../../../shared/lib/export/download";
import { formatPercentOrNumber } from "../../../shared/lib/format/finance";
import {
  AnalysisPageFrame,
  AnalysisSidebarCard,
  MetricCard,
  MetricGrid,
  PageHero,
  SectionCard,
} from "../../../shared/ui/analysis-shell";
import { AnalysisRunningIndicator } from "../../../shared/ui/analysis/AnalysisRunningIndicator";
import { InfoTooltip } from "../../../shared/ui/analysis/InfoTooltip";
import { PortfolioHoldingsPanel } from "../../../shared/ui/analysis/PortfolioHoldingsPanel";
import { AppErrorDialog } from "../../../shared/ui/app-error-dialog";
import { MetricSkeletonGrid, TableSkeleton } from "../../../shared/ui/loading-state";
import {
  BONDS_CHART_PALETTE,
  BONDS_PAGE_SIZE,
  BONDS_RISK_PALETTE,
  BONDS_STATE_KEY,
  BOND_RISK_LEVEL_OPTIONS,
  DEFAULT_BOND_ANALYSIS_PREFERENCES,
} from "../model";
import {
  getVisiblePages,
  isCorporateBond,
  isCurrencyBond,
  isGovernmentBond,
  isMunicipalBond,
  isPositiveNumberString,
  isValidBondCountString,
  normalizeMethod,
  normalizeRiskPreference,
  riskLabel,
} from "../lib";


export function BondsAnalysisPage() {
  const { t } = useAppSettings();

  const [analysisPreferences, setAnalysisPreferences] = useState<BondAnalysisPreferences>(DEFAULT_BOND_ANALYSIS_PREFERENCES);
  const [positions, setPositions] = useState<BondPortfolioPosition[]>([]);
  const [allBonds, setAllBonds] = useState<BondAnalysisBond[]>([]);
  const [summary, setSummary] = useState<BondAnalysisSummary | null>(null);
  const [construction, setConstruction] = useState<BondPortfolioConstruction | null>(null);
  const [riskClassification, setRiskClassification] = useState<BondRiskClassification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDialogMessage, setErrorDialogMessage] = useState<string | null>(null);
  const [isLoadingSource, setIsLoadingSource] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const portfolioChartRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const currentRaw = window.localStorage.getItem(BONDS_STATE_KEY);
      const raw = currentRaw ?? window.localStorage.getItem("bonds-analysis-state-v7") ?? window.localStorage.getItem("bonds-analysis-state-v6");
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as BondsAnalysisPersistedState;
      if (parsed.analysisPreferences && typeof parsed.analysisPreferences === "object") {
        const preferences = parsed.analysisPreferences;
        const currency = ["RUB", "CNY", "USD", "EUR"].includes(preferences.currency)
          ? preferences.currency
          : DEFAULT_BOND_ANALYSIS_PREFERENCES.currency;
        setAnalysisPreferences({
          ...DEFAULT_BOND_ANALYSIS_PREFERENCES,
          investmentAmount: String(preferences.investmentAmount ?? DEFAULT_BOND_ANALYSIS_PREFERENCES.investmentAmount),
          targetYieldPercent: String(preferences.targetYieldPercent ?? DEFAULT_BOND_ANALYSIS_PREFERENCES.targetYieldPercent),
          currency,
          riskProfile: normalizeRiskPreference(preferences.riskProfile),
          minPositions: String(Math.max(10, Number(preferences.minPositions ?? DEFAULT_BOND_ANALYSIS_PREFERENCES.minPositions))),
          maxPositions: String(Math.max(10, Number(preferences.maxPositions ?? DEFAULT_BOND_ANALYSIS_PREFERENCES.maxPositions))),
          payoutFrequency: preferences.payoutFrequency === "monthly" ? "monthly" : "quarterly",
          method: normalizeMethod(preferences.method),
          targetDurationYears: String(preferences.targetDurationYears ?? DEFAULT_BOND_ANALYSIS_PREFERENCES.targetDurationYears),
        });
      }
      if (currentRaw) {
        if (Array.isArray(parsed.positions)) setPositions(parsed.positions);
        if (Array.isArray(parsed.allBonds)) setAllBonds(parsed.allBonds);
        if (parsed.summary && typeof parsed.summary === "object") setSummary(parsed.summary);
        if (parsed.construction && typeof parsed.construction === "object") setConstruction(parsed.construction);
        if (parsed.riskClassification && typeof parsed.riskClassification === "object") setRiskClassification(parsed.riskClassification);
        if (typeof parsed.error === "string" || parsed.error === null) setError(parsed.error ?? null);
      }
    } catch {
      // Ignore broken persisted state.
    }
  }, []);

  useEffect(() => {
    const payload: BondsAnalysisPersistedState = {
      analysisPreferences,
      positions,
      allBonds,
      summary,
      construction,
      riskClassification,
      error,
    };
    window.localStorage.setItem(BONDS_STATE_KEY, JSON.stringify(payload));
  }, [allBonds, analysisPreferences, error, construction, riskClassification, positions, summary]);

  const isBusy = isLoadingSource || isRecalculating;
  const canRunAnalysis =
    isPositiveNumberString(analysisPreferences.investmentAmount) &&
    isPositiveNumberString(analysisPreferences.targetYieldPercent) &&
    isValidBondCountString(analysisPreferences.minPositions, 10) &&
    isValidBondCountString(analysisPreferences.maxPositions, 10) &&
    Number(analysisPreferences.minPositions) <= Number(analysisPreferences.maxPositions) &&
    (analysisPreferences.method !== "immunization" || isPositiveNumberString(analysisPreferences.targetDurationYears));
  const totalPages = Math.max(1, Math.ceil(allBonds.length / BONDS_PAGE_SIZE));
  const pageStartIndex = (currentPage - 1) * BONDS_PAGE_SIZE;
  const pageEndIndex = Math.min(pageStartIndex + BONDS_PAGE_SIZE, allBonds.length);
  const paginatedBonds = useMemo(() => allBonds.slice(pageStartIndex, pageEndIndex), [allBonds, pageEndIndex, pageStartIndex]);
  const visiblePages = useMemo(() => getVisiblePages(currentPage, totalPages), [currentPage, totalPages]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);


  const selectedRiskLabel = riskLabel(analysisPreferences.riskProfile, t);
  const selectedRiskDescription = analysisPreferences.riskProfile === "mixed"
    ? t("смешанный риск", "mixed risk")
    : t(`риск до ${analysisPreferences.riskProfile}`, `risk up to ${analysisPreferences.riskProfile}`);
  const exportMetrics = useMemo<ExportMetric[]>(
    () =>
      summary
        ? [
            { label: t("Метод", "Method"), value: construction?.methodLabel ?? "—" },
            { label: t("Сумма вложения", "Investment amount"), value: construction ? `${construction.investmentAmount.toLocaleString()} ${construction.currency}` : "—" },
            { label: t("Целевой годовой поток", "Target annual cash flow"), value: construction ? `${construction.targetAnnualCashFlow.toLocaleString()} ${construction.currency}` : "—" },
            { label: t("Расчётный поток за год", "Projected annual cash flow"), value: construction ? `${construction.projectedAnnualCashFlow.toLocaleString()} ${construction.currency}` : "—" },
            { label: t("Расчётный номинал", "Estimated nominal"), value: construction ? `${construction.estimatedNominal.toLocaleString()} ${construction.currency}` : "—" },
            { label: t("Минимум выпусков", "Minimum issues"), value: construction?.minimumPositions ?? "—" },
            { label: t("Регулярность выплат", "Payout frequency"), value: construction?.payoutFrequencyLabel ?? "—" },
            { label: t("Лимит на выпуск", "Issue weight limit"), value: construction ? `${construction.positionWeightLimitPercent}%` : "—" },
            { label: t("Профиль риска", "Risk profile"), value: selectedRiskLabel },
          ]
        : [],
    [construction, selectedRiskLabel, summary, t],
  );
  const portfolioColumns = useMemo<ExportColumn<BondPortfolioPosition>[]>(
    () => [
      { header: t("Тикер", "Ticker"), render: (row) => row.ticker },
      { header: t("Облигация", "Bond"), render: (row) => row.name },
      { header: t("Вес, %", "Weight, %"), render: (row) => row.weight.toFixed(2) },
      { header: t("Уровень риска", "Risk level"), render: (row) => `${riskLabel(row.riskLevel, t)} (${row.riskLevel.toFixed(0)})` },
      { header: t("Доходность", "Yield"), render: (row) => row.currentYield == null ? "—" : formatPercentOrNumber(row.currentYield) },
      { header: t("Дюрация", "Duration"), render: (row) => row.modifiedDuration == null ? "—" : row.modifiedDuration.toFixed(2) },
    ],
    [t],
  );

  const analyzedBondColumns = useMemo<ExportColumn<BondAnalysisBond>[]>(
    () => [
      { header: t("Тикер", "Ticker"), render: (row) => row.ticker },
      { header: t("Облигация", "Bond"), render: (row) => row.name },
      { header: t("Сектор", "Sector"), render: (row) => row.sector },
      { header: t("Валюта", "Currency"), render: (row) => row.currency },
      { header: t("Уровень риска", "Risk level"), render: (row) => `${riskLabel(row.riskLevel, t)} (${row.riskLevel.toFixed(0)})` },
      { header: t("Вероятность модели*", "Model probability*"), render: (row) => row.riskConfidence == null ? "—" : `${(row.riskConfidence * 100).toFixed(1)}%` },
      { header: t("Купонный график", "Coupon schedule"), render: (row) => row.couponScheduleLoaded ? t("Загружен", "Loaded") : t("Не загружен", "Not loaded") },
      { header: t("Доходность", "Yield"), render: (row) => row.currentYield == null ? "—" : formatPercentOrNumber(row.currentYield) },
      { header: t("Лет до погашения", "Years to maturity"), render: (row) => row.yearsToMaturity.toFixed(2) },
      { header: t("Дюрация", "Duration"), render: (row) => row.modifiedDuration == null ? "—" : row.modifiedDuration.toFixed(2) },
    ],
    [t],
  );

  const clearResults = () => {
    setPositions([]);
    setAllBonds([]);
    setSummary(null);
    setConstruction(null);
    setRiskClassification(null);
    setError(null);
    setErrorDialogMessage(null);
    setCurrentPage(1);
  };

  const applyAnalysis = async (refreshSource = false) => {
    const result = await runBondPortfolioConstruction(analysisPreferences, { refreshSource });
    setPositions(result.portfolio.positions);
    setAllBonds(result.bonds);
    setSummary(result.summary);
    setConstruction(result.construction);
    setRiskClassification(result.risk_classification ?? null);
    setCurrentPage(1);
  };

  const handleClear = () => {
    clearResults();
  };

  const showError = (message: string) => {
    setError(message);
    setErrorDialogMessage(message);
  };

  const handleAnalysisFailure = (err: unknown, fallbackMessage: string) => {
    if (err instanceof BondPortfolioConstructionError) {
      setPositions([]);
      setAllBonds(err.bonds);
      setSummary(null);
      setConstruction(null);
      setRiskClassification(err.riskClassification);
      setCurrentPage(1);
    } else {
      clearResults();
    }
    showError(err instanceof Error ? err.message : fallbackMessage);
  };

  const handleRefresh = async () => {
    if (!canRunAnalysis) {
      showError(t("Укажите желаемый поток, минимум и максимум выпусков.", "Enter the desired cash flow and the minimum and maximum number of issues."));
      return;
    }
    setIsLoadingSource(true);
    setError(null);
    setErrorDialogMessage(null);
    try {
      await applyAnalysis(true);
    } catch (err) {
      handleAnalysisFailure(err, t("Не удалось обновить данные по облигациям.", "Could not refresh bond data."));
    } finally {
      setIsLoadingSource(false);
    }
  };

  const handleRecalculate = async () => {
    if (!canRunAnalysis) {
      showError(t("Укажите желаемый поток, минимум и максимум выпусков.", "Enter the desired cash flow and the minimum and maximum number of issues."));
      return;
    }
    setIsRecalculating(true);
    setError(null);
    setErrorDialogMessage(null);
    try {
      await applyAnalysis();
    } catch (err) {
      handleAnalysisFailure(err, t("Не удалось пересчитать денежный поток.", "Could not recalculate the cash flow."));
    } finally {
      setIsRecalculating(false);
    }
  };
  const exportPortfolioToXlsx = async () => {
    if (!positions.length) {
      return;
    }
    await downloadAnalysisResultsAsXlsx({
      title: t("Оптимальный портфель облигаций", "Optimal bond portfolio"),
      filename: "bonds-optimal-portfolio.xlsx",
      rows: positions,
      columns: portfolioColumns,
      metrics: exportMetrics,
    });
  };

  const exportPortfolioToPdf = async () => {
    if (!positions.length) {
      return;
    }

    try {
      await downloadAnalysisResultsAsPdf({
        title: t("Оптимальный портфель облигаций", "Optimal bond portfolio"),
        filename: "bonds-optimal-portfolio.pdf",
        rows: positions,
        columns: portfolioColumns,
        metrics: exportMetrics,
        chartSvg: portfolioChartRef.current?.querySelector("svg"),
      });
    } catch (err) {
      showError(err instanceof Error ? err.message : t("Не удалось сохранить PDF.", "Failed to save PDF."));
    }
  };

  const savePortfolioChartPng = async () => {
    const svg = portfolioChartRef.current?.querySelector("svg");
    if (!svg) {
      return;
    }

    try {
      await downloadSvgAsPng(svg as SVGSVGElement, "bonds-optimal-portfolio.png");
    } catch (err) {
      showError(err instanceof Error ? err.message : t("Не удалось сохранить PNG.", "Failed to save PNG."));
    }
  };

  return (
    <>
      <AnalysisPageFrame
        hero={(
          <PageHero
            icon={Landmark}
            title={t("Анализ облигаций", "Bond Analysis")}
            description={t(
              "Укажите сумму вложения, целевой годовой процент и риск. Сервер построит портфель методом мэтчинга или иммунизации, а интерфейс покажет готовый расчёт.",
              "Enter the investment amount, target annual percentage, and risk. The server builds matching or immunization portfolio; the interface shows the completed calculation.",
            )}
            accent="amber"
          />
        )}
        sidebar={(
          <AnalysisSidebarCard
            icon={Settings}
            title={(
              <span className="inline-flex items-center gap-2">
                {t("Параметры построения", "Construction parameters")}
                <InfoTooltip label={t("Справка по построению облигаций", "Bond construction help")} side="right">
                  <div className="space-y-2">
                    <p>{t("Сумма задаёт номинальный лимит, а процент — целевой поток за ближайшие 12 месяцев. При смешанном риске сервер рассматривает уровни 0–2.", "The amount is a nominal limit and the percentage is the target cash flow for the next 12 months. Mixed risk lets the server consider levels 0–2.")}</p>
                    <p>{t("Мэтчинг подбирает известные выплаты в пределах лимита. Иммунизация дополнительно удерживает оценочную модифицированную дюрацию рядом с заданной. Это сценарий без обязательств и гарантий.", "Matching selects known payments within the limit. Immunization also keeps estimated modified duration near the target. This is a scenario without obligations or guarantees.")}</p>
                  </div>
                </InfoTooltip>
              </span>
            )}
            accent="amber"
          >
            <div className="space-y-4">
              <label className="block text-xs text-slate-600 dark:text-slate-400">
                {t("Сумма вложения", "Investment amount")}
                <input
                  type="number"
                  min="1"
                  step="1"
                  className="ui-input mt-1"
                  value={analysisPreferences.investmentAmount}
                  onChange={(event) => setAnalysisPreferences((current) => ({ ...current, investmentAmount: event.target.value }))}
                />
              </label>

              <label className="block text-xs text-slate-600 dark:text-slate-400">
                {t("Целевой годовой поток, %", "Target annual cash flow, %")}
                <input
                  type="number"
                  min="0.01"
                  max="100"
                  step="0.01"
                  className="ui-input mt-1"
                  value={analysisPreferences.targetYieldPercent}
                  onChange={(event) => setAnalysisPreferences((current) => ({ ...current, targetYieldPercent: event.target.value }))}
                />
              </label>

              <label className="block text-xs text-slate-600 dark:text-slate-400">
                {t("Валюта", "Currency")}
                <select className="ui-input mt-1" value={analysisPreferences.currency} onChange={(event) => setAnalysisPreferences((current) => ({ ...current, currency: event.target.value as BondAnalysisPreferences["currency"] }))}>
                  {(["RUB", "CNY", "USD", "EUR"] as const).map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                </select>
              </label>

              <label className="block text-xs text-slate-600 dark:text-slate-400">
                {t("Профиль риска", "Risk profile")}
                <select className="ui-input mt-1" value={analysisPreferences.riskProfile} onChange={(event) => setAnalysisPreferences((current) => ({ ...current, riskProfile: event.target.value as BondAnalysisPreferences["riskProfile"] }))}>
                  {BOND_RISK_LEVEL_OPTIONS.map((level) => <option key={level} value={level}>{riskLabel(level, t)}</option>)}
                </select>
              </label>

              <label className="block text-xs text-slate-600 dark:text-slate-400">
                {t("Метод", "Method")}
                <select className="ui-input mt-1" value={analysisPreferences.method} onChange={(event) => setAnalysisPreferences((current) => ({ ...current, method: event.target.value as BondAnalysisPreferences["method"] }))}>
                  <option value="matching">{t("Мэтчинг потока", "Cash-flow matching")}</option>
                  <option value="immunization">{t("Иммунизация дюрации", "Duration immunization")}</option>
                </select>
              </label>

              {analysisPreferences.method === "immunization" ? (
                <label className="block text-xs text-slate-600 dark:text-slate-400">
                  {t("Целевая дюрация, лет", "Target duration, years")}
                  <input type="number" min="0.01" max="50" step="0.1" className="ui-input mt-1" value={analysisPreferences.targetDurationYears} onChange={(event) => setAnalysisPreferences((current) => ({ ...current, targetDurationYears: event.target.value }))} />
                </label>
              ) : null}

              <label className="block text-xs text-slate-600 dark:text-slate-400">
                {t("Регулярность выплат", "Payout frequency")}
                <select className="ui-input mt-1" value={analysisPreferences.payoutFrequency} onChange={(event) => setAnalysisPreferences((current) => ({ ...current, payoutFrequency: event.target.value as BondAnalysisPreferences["payoutFrequency"] }))}>
                  <option value="monthly">{t("Ежемесячно", "Monthly")}</option>
                  <option value="quarterly">{t("Ежеквартально", "Quarterly")}</option>
                </select>
              </label>

              <label className="block text-xs text-slate-600 dark:text-slate-400">
                {t("Минимум разных выпусков", "Minimum distinct issues")}
                <input type="number" min="10" max="50" step="1" className="ui-input mt-1" value={analysisPreferences.minPositions} onChange={(event) => setAnalysisPreferences((current) => ({ ...current, minPositions: event.target.value }))} />
              </label>

              <label className="block text-xs text-slate-600 dark:text-slate-400">
                {t("Максимум выпусков", "Maximum issues")}
                <input type="number" min={Math.max(10, Number(analysisPreferences.minPositions) || 10)} max="50" step="1" className="ui-input mt-1" value={analysisPreferences.maxPositions} onChange={(event) => setAnalysisPreferences((current) => ({ ...current, maxPositions: event.target.value }))} />
              </label>

              <button type="button" onClick={handleRecalculate} disabled={isBusy || !canRunAnalysis} className="ui-secondary-button w-full justify-center px-3 py-2 text-xs">
                <RefreshCw className={`h-4 w-4 ${isRecalculating ? "animate-spin" : ""}`} />
                {isRecalculating ? t("Считаем...", "Calculating...") : t("Построить портфель", "Build portfolio")}
              </button>
            </div>
          </AnalysisSidebarCard>
        )}
      >        {isBusy ? (
          <AnalysisRunningIndicator
            title={t("Выполняем анализ облигаций", "Running bond analysis")}
            subtitle={t(
              "Загружаем список облигаций и применяем пользовательские параметры к клиентскому портфелю.",
              "The server loads the bond universe, matches the coupon calendar to the requested dates, and returns the result.",
            )}
            accentClassName="text-amber-600"
          />
        ) : null}

        {isBusy ? (
          <SectionCard
            title={t("Готовим список облигаций", "Preparing bond list")}
            description={t(
              "После загрузки появятся строки облигаций и рассчитанный портфель.",
              "Rows and the calculated portfolio will appear after loading.",
            )}
          >
            <div className="space-y-5">
              <MetricSkeletonGrid count={3} />
              <TableSkeleton rows={10} columns={8} />
            </div>
          </SectionCard>
        ) : null}

        {!isBusy && (
          <>
        <SectionCard
          title={t("Данные и просмотр", "Data and View")}
          description={t(
            "Список облигаций доступен и при невозможности построить портфель с заданными ограничениями.",
            "The bond list remains available even when no portfolio meets the selected constraints.",
          )}
          action={(
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleRecalculate}
                disabled={isBusy || !canRunAnalysis}
                className="ui-primary-button bg-gradient-to-r from-amber-600 to-orange-600 px-3 py-2 text-xs hover:from-amber-700 hover:to-orange-700"
              >
                <RefreshCw className={`h-4 w-4 ${isRecalculating ? "animate-spin" : ""}`} />
                {isRecalculating ? t("Считаем...", "Calculating...") : t("Построить по кэшу", "Build from cache")}
              </button>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isBusy || !canRunAnalysis}
                className="ui-secondary-button px-3 py-2 text-xs"
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingSource ? "animate-spin" : ""}`} />
                {isLoadingSource ? t("Обновляем...", "Refreshing...") : t("Обновить облигации", "Refresh bonds")}
              </button>
              <button
                type="button"
                onClick={handleClear}
                disabled={isBusy || (!summary && !allBonds.length)}
                className="ui-secondary-button px-3 py-2 text-xs"
              >
                <Trash2 className="h-4 w-4" />
                {t("Очистить", "Clear")}
              </button>
            </div>
          )}
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="grid gap-2 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-3">
              <div className="ui-surface-muted">
                <div className="text-xs text-slate-500 dark:text-slate-400">{t("Загружено", "Loaded")}</div>
                <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{allBonds.length}</div>
              </div>
              <div className="ui-surface-muted">
                <div className="text-xs text-slate-500 dark:text-slate-400">{t("Купонные графики", "Coupon schedules")}</div>
                <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{allBonds.filter((bond) => bond.couponScheduleLoaded).length}</div>
              </div>
              <div className="ui-surface-muted">
                <div className="text-xs text-slate-500 dark:text-slate-400">{t("В портфеле", "Portfolio")}</div>
                <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{positions.length}</div>
              </div>
            </div>

          </div>
        </SectionCard>

        {!isBusy && !allBonds.length && !summary ? (
          <SectionCard
            title={t("Список облигаций не загружен", "Bond list is not loaded")}
            description={t(
              "Сначала задайте параметры анализа, затем загрузите облигации.",
              "Set the desired cash flow first, then build the server-side result.",
            )}
          >
            <div className="ui-surface-muted text-sm text-slate-600 dark:text-slate-300">
              {t(
                "После загрузки здесь появится таблица облигаций с пагинацией, а ниже — портфель, построенный по текущим параметрам.",
                "After calculation, this area will show a paginated candidate table followed by the server-built portfolio.",
              )}
            </div>
          </SectionCard>
        ) : null}



        {riskClassification && allBonds.length ? (
          <SectionCard
            title={t("Логистическая регрессия: уровни риска", "Logistic regression: risk levels")}
            description={t(
              "Оценка строится по отобранным признакам выпуска. Исходные категории риска служат обучающими метками, но не являются кредитным рейтингом или гарантией.",
              "The estimate uses selected issue features. Source risk categories are training labels, not a credit rating or guarantee.",
            )}
          >
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {riskClassification.status === "trained"
                  ? t("Модель обучена: многоклассовая логистическая регрессия.", "Model trained: multiclass logistic regression.")
                  : t("Недостаточно данных для обучения; показаны категории, сопоставленные с исходной шкалой риска.", "Not enough data to train; categories are mapped from the source risk scale.")}
                {" "}{t("Обучающих облигаций", "Training bonds")}: {riskClassification.training_bonds_count}.
              </p>
              {riskClassification.status === "trained" ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t("* Вероятности модели не калиброваны и не заменяют независимую оценку кредитного риска.", "* Model probabilities are not calibrated and do not replace an independent credit-risk assessment.")}
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-3">
                {([0, 1, 2] as const).map((level) => (
                  <div key={level} className="ui-surface-muted border-l-4" style={{ borderLeftColor: BONDS_RISK_PALETTE[level] }}>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{riskLabel(level, t)} ({level})</div>
                    <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">{allBonds.filter((bond) => bond.riskLevel === level).length}</div>
                  </div>
                ))}
              </div>
              <div className="ui-surface-muted text-sm text-slate-600 dark:text-slate-300">
                <div className="font-medium text-slate-800 dark:text-slate-100">{t("Отобранные факторы", "Selected factors")}</div>
                <div className="mt-1">{riskClassification.factor_analysis.selected_features.length
                  ? riskClassification.factor_analysis.selected_features.join(", ")
                  : t("Не отобраны: используется исходная оценка", "None selected: source assessment is used")}</div>
                {riskClassification.factor_analysis.rejected_features.length ? (
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {t("Исключено", "Excluded")}: {riskClassification.factor_analysis.rejected_features.map((item) => `${item.feature} (${item.reason})`).join(", ")}
                  </div>
                ) : null}
              </div>
            </div>
          </SectionCard>
        ) : null}

        {allBonds.length ? (
          <SectionCard
            title={t("Список облигаций", "Bond list")}
            description={t(
              `Показаны все ${allBonds.length} облигаций выбранной валюты. Купонный график получен только для подвыборки портфельного расчёта; неизвестные показатели отмечены «—».`,
              `Showing all ${allBonds.length} bonds in the selected currency. Coupon schedules are loaded only for the portfolio subset; unknown metrics are shown as —.`,
            )}
            action={(
              <button
                type="button"
                onClick={() => downloadRowsAsXlsx(allBonds, analyzedBondColumns, "bonds-analyzed-universe.xlsx", "Bonds")}
                className="ui-secondary-button px-3 py-2 text-xs"
              >
                <FileSpreadsheet className="h-4 w-4" />
                XLSX
              </button>
            )}
          >
            <div className="space-y-4">
              <div className="flex flex-col gap-2 text-sm text-slate-500 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  {t("Показано", "Showing")} {allBonds.length ? pageStartIndex + 1 : 0}-{pageEndIndex} {t("из", "of")} {allBonds.length}
                </div>
                <div>
                  {t("Страница", "Page")} {currentPage} / {totalPages}
                </div>
              </div>

              <div className="ui-table-shell overflow-x-auto">
                <table className="ui-data-table">
                  <thead>
                    <tr>
                      <th className="min-w-28 whitespace-nowrap">{t("Тикер", "Ticker")}</th>
                      <th className="min-w-80">{t("Облигация", "Bond")}</th>
                      <th>{t("Сектор", "Sector")}</th>
                      <th>{t("Валюта", "Currency")}</th>
                      <th>{t("Уровень риска", "Risk level")}</th>
                      <th>{t("Вероятность модели*", "Model probability*")}</th>
                      <th>{t("Купонный график", "Coupon schedule")}</th>
                      <th>{t("Доходность", "Yield")}</th>
                      <th>{t("Лет до погашения", "Years to maturity")}</th>
                      <th>{t("Дюрация", "Duration")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedBonds.map((bond) => (
                      <tr key={bond.uid || `${bond.ticker}-${bond.name}`}>
                        <td className="min-w-28 whitespace-nowrap font-medium text-slate-900 dark:text-slate-100">{bond.ticker}</td>
                        <td className="ui-cell-name min-w-80 max-w-[28rem] whitespace-normal break-words pr-6 leading-5">{bond.name}</td>
                        <td>{bond.sector}</td>
                        <td>{bond.currency}</td>
                        <td>{riskLabel(bond.riskLevel, t)} ({bond.riskLevel.toFixed(0)})</td>
                        <td>{bond.riskConfidence == null ? "—" : `${(bond.riskConfidence * 100).toFixed(1)}%`}</td>
                        <td>{bond.couponScheduleLoaded ? t("Загружен", "Loaded") : t("Не загружен", "Not loaded")}</td>
                        <td>{bond.currentYield == null ? "—" : formatPercentOrNumber(bond.currentYield)}</td>
                        <td>{bond.yearsToMaturity.toFixed(2)}</td>
                        <td>{bond.modifiedDuration == null ? "—" : bond.modifiedDuration.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    className="ui-secondary-button"
                  >
                    {t("Назад", "Previous")}
                  </button>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {visiblePages.map((page, index) =>
                      page === null ? (
                        <span key={`ellipsis-${index}`} className="px-2 text-sm text-slate-400">
                          ...
                        </span>
                      ) : (
                        <button
                          key={page}
                          type="button"
                          onClick={() => setCurrentPage(page)}
                          className={`inline-flex min-w-10 items-center justify-center rounded-lg border px-3 py-2 text-sm ${
                            currentPage === page
                              ? "border-amber-500 bg-amber-500 text-white"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                          }`}
                        >
                          {page}
                        </button>
                      ),
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    className="ui-secondary-button"
                  >
                    {t("Вперёд", "Next")}
                  </button>
                </div>
              ) : null}
            </div>
          </SectionCard>
        ) : null}

        {summary ? (
          <MetricGrid>
            <MetricCard label={t("Метод", "Method")} value={construction?.methodLabel ?? "—"} />
            <MetricCard label={t("Сумма вложения", "Investment amount")} value={construction ? `${construction.investmentAmount.toLocaleString()} ${construction.currency}` : "—"} />
            <MetricCard label={t("Целевой поток за год", "Target annual cash flow")} value={construction ? `${construction.targetAnnualCashFlow.toLocaleString()} ${construction.currency}` : "—"} />
            <MetricCard label={t("Расчётный поток за год", "Projected annual cash flow")} value={construction ? `${construction.projectedAnnualCashFlow.toLocaleString()} ${construction.currency}` : "—"} />
          </MetricGrid>
        ) : null}

        {construction ? (
          <SectionCard
            title={t("Результат серверного построения", "Server construction result")}
            description={t("Известные купоны и погашения агрегированы за следующие 12 месяцев. Для иммунизации показано отклонение дюрации от цели.", "Known coupons and principal are aggregated over the next 12 months. Immunization shows duration deviation from the target.")}
          >
            <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div className="ui-surface-muted"><div className="text-xs text-slate-500">{t("Расчётный номинал", "Estimated nominal")}</div><div className="mt-1 font-semibold">{construction.estimatedNominal.toLocaleString()} {construction.currency}</div></div>
              <div className="ui-surface-muted"><div className="text-xs text-slate-500">{t("Остаток лимита", "Remaining limit")}</div><div className="mt-1 font-semibold">{construction.budgetRemaining.toLocaleString()} {construction.currency}</div></div>
              <div className="ui-surface-muted"><div className="text-xs text-slate-500">{t("Оценочная дюрация", "Estimated duration")}</div><div className="mt-1 font-semibold">{construction.portfolioDurationYears.toFixed(2)} {t("лет", "years")}</div></div>
              {construction.targetDurationYears !== null ? <div className="ui-surface-muted"><div className="text-xs text-slate-500">{t("Цель / отклонение дюрации", "Duration target / deviation")}</div><div className="mt-1 font-semibold">{construction.targetDurationYears.toFixed(2)} / {construction.durationDeviationYears?.toFixed(2)} {t("лет", "years")}</div></div> : null}
              <div className="ui-surface-muted"><div className="text-xs text-slate-500">{t("Профиль риска", "Risk profile")}</div><div className="mt-1 font-semibold">{riskLabel(construction.riskProfile, t)}</div></div>
              <div className="ui-surface-muted"><div className="text-xs text-slate-500">{t("Минимум выпусков", "Minimum issues")}</div><div className="mt-1 font-semibold">{construction.minimumPositions}</div></div>
              <div className="ui-surface-muted"><div className="text-xs text-slate-500">{t("Регулярность выплат", "Payout frequency")}</div><div className="mt-1 font-semibold">{construction.payoutFrequencyLabel}</div></div>
              <div className="ui-surface-muted"><div className="text-xs text-slate-500">{t("Лимит на выпуск", "Issue weight limit")}</div><div className="mt-1 font-semibold">{construction.positionWeightLimitPercent.toFixed(0)}%</div></div>
            </div>
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100">
              {t("Расчётный сценарий: номинал не является ценой покупки и не учитывает НКД, налоги, комиссии, ликвидность, дефолт или изменение условий. Это не обязательство и не гарантия выплат.", "Calculation scenario: nominal is not a purchase price and does not include accrued interest, taxes, fees, liquidity, default, or changing terms. It is not an obligation or payment guarantee.")}
            </div>
          </SectionCard>
        ) : null}
        {construction?.payoutSchedule.length ? (
          <SectionCard
            title={t("График расчётных выплат", "Projected payout schedule")}
            description={t("Сервер проверил целевой поток в каждом выбранном периоде. Это календарь известных выплат, а не гарантия.", "The server checked the target flow in every selected period. This is a known-payment calendar, not a guarantee.")}
          >
            <div className="ui-table-shell overflow-x-auto">
              <table className="ui-data-table">
                <thead><tr><th>{t("Период", "Period")}</th><th>{t("Цель", "Target")}</th><th>{t("Расчётный поток", "Projected flow")}</th></tr></thead>
                <tbody>
                  {construction.payoutSchedule.map((item) => (
                    <tr key={item.period}>
                      <td>{item.period}</td>
                      <td>{item.targetCashFlow.toLocaleString()} {construction.currency}</td>
                      <td>{item.projectedCashFlow.toLocaleString()} {construction.currency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        ) : null}
        {positions.length ? (
          <SectionCard
            title={t("Оптимальный портфель облигаций", "Optimal bond portfolio")}
            description={t(
              `Сервер построил портфель методом ${construction?.methodLabel.toLowerCase() ?? "мэтчинга"}: ${selectedRiskDescription}. Количества и номинал расчётные.`,
              `The server built a ${construction?.methodLabel.toLowerCase() ?? "matching"} portfolio with ${selectedRiskDescription}. Quantities and nominal are estimates.`,
            )}            action={(
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={exportPortfolioToXlsx} className="ui-secondary-button px-3 py-2 text-xs">
                  <FileSpreadsheet className="h-4 w-4" />
                  XLSX
                </button>
                <button onClick={exportPortfolioToPdf} className="ui-secondary-button px-3 py-2 text-xs">
                  <FileText className="h-4 w-4" />
                  PDF
                </button>
                <button onClick={savePortfolioChartPng} className="ui-secondary-button px-3 py-2 text-xs">
                  <ImageDown className="h-4 w-4" />
                  PNG
                </button>
                <SavePortfolioButton
                  holdings={positions.map((position) => ({
                    ...position,
                    annualDividendYield: position.currentYield,
                    currentYield: position.currentYield,
                  }))}
                  metrics={exportMetrics.map((metric) => ({
                    label: metric.label,
                    value: String(metric.value),
                    rawValue: typeof metric.value === "number" ? metric.value : null,
                  }))}
                  sourceKey="bonds"
                  sourceLabel={t("Анализ облигаций", "Bond Analysis")}
                  assetClass="bond"
                  defaultName={t("Облигационный портфель", "Bond Portfolio")}
                  disabled={!positions.length}
                />
              </div>
            )}
          >
            <div className="ui-table-shell mb-6 overflow-x-auto">
              <table className="ui-data-table min-w-[44rem]">
                <thead>
                  <tr>
                    <th>{t("Тикер", "Ticker")}</th>
                    <th>{t("Облигация", "Bond")}</th>
                    <th>{t("Уровень риска", "Risk level")}</th>
                    <th>{t("Количество", "Quantity")}</th>
                    <th>{t("Расчётный номинал", "Estimated nominal")}</th>
                    <th>{t("Поток за 12 месяцев", "Cash flow over 12 months")}</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((position) => (
                    <tr key={`${position.ticker}-${position.name}`}>
                      <td className="font-medium text-slate-900 dark:text-slate-100">{position.ticker}</td>
                      <td className="ui-cell-name max-w-[28rem] whitespace-normal break-words pr-6 leading-5">{position.name}</td>
                      <td>{riskLabel(position.riskLevel, t)} ({position.riskLevel.toFixed(0)})</td>
                      <td>{position.quantity ?? "—"}</td>
                      <td>{position.estimatedNominal?.toLocaleString("ru-RU", { maximumFractionDigits: 2 }) ?? "—"} {construction?.currency ?? analysisPreferences.currency}</td>
                      <td>{position.cashFlowNextYear?.toLocaleString("ru-RU", { maximumFractionDigits: 2 }) ?? "—"} {construction?.currency ?? analysisPreferences.currency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PortfolioHoldingsPanel
              rows={positions}
              palette={BONDS_CHART_PALETTE}
              chartRef={portfolioChartRef}
              companyLabel={t("Облигация", "Bond")}
              weightLabel={t("Доля номинала, %", "Nominal share, %")}
            />
          </SectionCard>
        ) : null}
          </>
        )}

      </AnalysisPageFrame>

      <AppErrorDialog
        message={errorDialogMessage}
        onClose={() => setErrorDialogMessage(null)}
        title={t("Ошибка анализа", "Analysis Error")}
        description={t(
          "Не удалось завершить запрос к серверу или расчёт.",
          "The server request or calculation could not be completed.",
        )}
        closeLabel={t("Закрыть", "Close")}
      />
    </>
  );
}
