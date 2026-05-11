import { useEffect, useMemo, useRef, useState } from "react";
import { FileSpreadsheet, FileText, ImageDown, Landmark, RefreshCw, Settings, Trash2 } from "lucide-react";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import { analyzeBondSource } from "../../../features/bonds-analysis/model/clientAnalysis";
import { loadBondSourceFromClient } from "../../../features/bonds-analysis/model/tbankClient";
import type {
  BondAnalysisBond,
  BondAnalysisPreferences,
  BondAnalysisSummary,
  BondPortfolioPosition,
  BondPreviewRow,
  BondsAnalysisPersistedState,
  BondSourceSummary,
  BondSourceRow,
} from "../../../features/bonds-analysis/model/types";
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
import { PortfolioHoldingsPanel } from "../../../shared/ui/analysis/PortfolioHoldingsPanel";
import { AppErrorDialog } from "../../../shared/ui/app-error-dialog";

const BONDS_STATE_KEY = "bonds-analysis-state-v3";
const PAGE_SIZE = 25;
const palette = ["#b45309", "#f59e0b", "#f97316", "#fb7185", "#0ea5e9", "#14b8a6", "#84cc16", "#8b5cf6"];
const DEFAULT_ANALYSIS_PREFERENCES: BondAnalysisPreferences = {
  targetYield: "12",
  targetDuration: "3.5",
  paymentFrequency: "quarterly",
  targetRiskLevel: "3",
};

const RISK_LEVEL_OPTIONS = ["0", "1", "2", "3"] as const;

function normalizeRiskPreference(value: unknown): BondAnalysisPreferences["targetRiskLevel"] {
  return value === "0" || value === "1" || value === "2" || value === "3" ? value : DEFAULT_ANALYSIS_PREFERENCES.targetRiskLevel;
}

function createPreviewRows(rows: BondSourceRow[]): BondPreviewRow[] {
  return rows.map((row, index) => ({
    id: `${row.ticker}-${index}`,
    ticker: row.ticker,
    name: row.name || row.ticker,
    sector: row.sector,
    currency: row.currency.toUpperCase(),
    maturityDate: row.maturity_date,
    nominal: row.nominal,
    riskLevel: row.risk_level,
    couponRate: row.coupon_rate,
    floatingCoupon: Boolean(row.floating_coupon_flag),
    isValid: true,
    validationIssues: [],
  }));
}

function getVisiblePages(currentPage: number, totalPages: number): Array<number | null> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, null, totalPages];
  }
  if (currentPage >= totalPages - 3) {
    return [1, null, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, null, currentPage - 1, currentPage, currentPage + 1, null, totalPages];
}

function isPositiveNumberString(value: string): boolean {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0;
}

export function BondsAnalysisPage() {
  const { t } = useAppSettings();

  const [sourceRows, setSourceRows] = useState<BondSourceRow[]>([]);
  const [sourceLabel, setSourceLabel] = useState<string | null>(null);
  const [sourceSummary, setSourceSummary] = useState<BondSourceSummary | null>(null);
  const [analysisPreferences, setAnalysisPreferences] = useState<BondAnalysisPreferences>(DEFAULT_ANALYSIS_PREFERENCES);
  const [positions, setPositions] = useState<BondPortfolioPosition[]>([]);
  const [allBonds, setAllBonds] = useState<BondAnalysisBond[]>([]);
  const [summary, setSummary] = useState<BondAnalysisSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDialogMessage, setErrorDialogMessage] = useState<string | null>(null);
  const [isLoadingSource, setIsLoadingSource] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const portfolioChartRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(BONDS_STATE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as BondsAnalysisPersistedState;
      if (Array.isArray(parsed.sourceRows)) setSourceRows(parsed.sourceRows);
      if (typeof parsed.sourceLabel === "string" || parsed.sourceLabel === null) setSourceLabel(parsed.sourceLabel ?? null);
      if (parsed.sourceSummary && typeof parsed.sourceSummary === "object") setSourceSummary(parsed.sourceSummary);
      if (parsed.analysisPreferences && typeof parsed.analysisPreferences === "object") {
        setAnalysisPreferences({
          targetYield: String(parsed.analysisPreferences.targetYield ?? DEFAULT_ANALYSIS_PREFERENCES.targetYield),
          targetDuration: String(parsed.analysisPreferences.targetDuration ?? DEFAULT_ANALYSIS_PREFERENCES.targetDuration),
          paymentFrequency: parsed.analysisPreferences.paymentFrequency === "monthly" ? "monthly" : "quarterly",
          targetRiskLevel: normalizeRiskPreference(parsed.analysisPreferences.targetRiskLevel),
        });
      }
      if (Array.isArray(parsed.positions)) setPositions(parsed.positions);
      if (Array.isArray(parsed.allBonds)) setAllBonds(parsed.allBonds);
      if (parsed.summary && typeof parsed.summary === "object") setSummary(parsed.summary);
      if (typeof parsed.error === "string" || parsed.error === null) setError(parsed.error ?? null);
    } catch {
      // Ignore broken persisted state.
    }
  }, []);

  useEffect(() => {
    const payload: BondsAnalysisPersistedState = {
      sourceRows,
      sourceLabel,
      sourceSummary,
      analysisPreferences,
      positions,
      allBonds,
      summary,
      error,
    };
    window.localStorage.setItem(BONDS_STATE_KEY, JSON.stringify(payload));
  }, [allBonds, analysisPreferences, error, positions, sourceLabel, sourceRows, sourceSummary, summary]);

  const isBusy = isLoadingSource || isRecalculating;
  const canRunAnalysis =
    isPositiveNumberString(analysisPreferences.targetYield) &&
    isPositiveNumberString(analysisPreferences.targetDuration);

  const previewRows = useMemo(() => createPreviewRows(sourceRows), [sourceRows]);
  const previewTopRows = useMemo(() => previewRows.slice(0, 8), [previewRows]);
  const previewStats = useMemo(
    () => ({
      total: previewRows.length,
      withCoupon: previewRows.filter((row) => (row.couponRate ?? 0) > 0).length,
      currencies: new Set(previewRows.map((row) => row.currency)).size,
      sectors: new Set(previewRows.map((row) => row.sector)).size,
    }),
    [previewRows],
  );

  const sourceStatusMessage = useMemo(() => {
    if (!sourceSummary) {
      return null;
    }

    return t(
      `T-Bank API вернуло ${sourceSummary.rawBondsCount} инструментов. После фильтра доступно ${sourceSummary.eligibleBondsCount}. Загружено ${sourceSummary.loadedBondsCount}. ${summary ? `В анализ вошло ${summary.analyzedBondsCount}.` : ""}`,
      `The T-Bank API returned ${sourceSummary.rawBondsCount} instruments. ${sourceSummary.eligibleBondsCount} remained after filtering. ${sourceSummary.loadedBondsCount} were loaded. ${summary ? `${summary.analyzedBondsCount} made it into the analysis.` : ""}`,
    );
  }, [sourceSummary, summary, t]);

  const totalPages = Math.max(1, Math.ceil(allBonds.length / PAGE_SIZE));
  const pageStartIndex = (currentPage - 1) * PAGE_SIZE;
  const pageEndIndex = Math.min(pageStartIndex + PAGE_SIZE, allBonds.length);
  const paginatedBonds = useMemo(() => allBonds.slice(pageStartIndex, pageEndIndex), [allBonds, pageEndIndex, pageStartIndex]);
  const visiblePages = useMemo(() => getVisiblePages(currentPage, totalPages), [currentPage, totalPages]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const exportMetrics = useMemo<ExportMetric[]>(
    () =>
      summary
        ? [
            { label: t("Проанализировано облигаций", "Analyzed bonds"), value: summary.analyzedBondsCount },
            { label: t("Выбрано в портфель", "Selected for portfolio"), value: summary.selectedBondsCount },
            { label: t("Доходность портфеля", "Portfolio yield"), value: formatPercentOrNumber(summary.portfolioYield) },
            { label: t("Целевая доходность", "Target yield"), value: `${analysisPreferences.targetYield}%` },
            { label: t("Целевая дюрация", "Target duration"), value: analysisPreferences.targetDuration },
            {
              label: t("Уровень риска", "Risk level"),
              value: analysisPreferences.targetRiskLevel,
            },
            {
              label: t("Платежи", "Payments"),
              value: analysisPreferences.paymentFrequency === "monthly" ? t("Ежемесячные", "Monthly") : t("Ежеквартальные", "Quarterly"),
            },
          ]
        : [],
    [analysisPreferences, summary, t],
  );

  const portfolioColumns = useMemo<ExportColumn<BondPortfolioPosition>[]>(
    () => [
      { header: t("Тикер", "Ticker"), render: (row) => row.ticker },
      { header: t("Облигация", "Bond"), render: (row) => row.name },
      { header: t("Вес, %", "Weight, %"), render: (row) => row.weight.toFixed(2) },
      { header: t("Риск", "Risk"), render: (row) => row.riskLevel.toFixed(0) },
      { header: t("Доходность", "Yield"), render: (row) => formatPercentOrNumber(row.currentYield) },
      { header: t("Дюрация", "Duration"), render: (row) => row.modifiedDuration.toFixed(2) },
    ],
    [t],
  );

  const analyzedBondColumns = useMemo<ExportColumn<BondAnalysisBond>[]>(
    () => [
      { header: t("Тикер", "Ticker"), render: (row) => row.ticker },
      { header: t("Облигация", "Bond"), render: (row) => row.name },
      { header: t("Сектор", "Sector"), render: (row) => row.sector },
      { header: t("Валюта", "Currency"), render: (row) => row.currency },
      { header: t("Риск", "Risk"), render: (row) => row.riskLevel.toFixed(0) },
      { header: t("Доходность", "Yield"), render: (row) => formatPercentOrNumber(row.currentYield) },
      { header: t("Лет до погашения", "Years to maturity"), render: (row) => row.yearsToMaturity.toFixed(2) },
      { header: t("Дюрация", "Duration"), render: (row) => row.modifiedDuration.toFixed(2) },
    ],
    [t],
  );

  const clearResults = () => {
    setPositions([]);
    setAllBonds([]);
    setSummary(null);
    setError(null);
    setErrorDialogMessage(null);
    setCurrentPage(1);
  };

  const applyAnalysis = (rows: BondSourceRow[], preferences: BondAnalysisPreferences) => {
    const result = analyzeBondSource(rows, preferences);
    setPositions(result.positions);
    setAllBonds(result.allBonds);
    setSummary(result.summary);
    setCurrentPage(1);
  };

  const handleClear = () => {
    setSourceRows([]);
    setSourceLabel(null);
    setSourceSummary(null);
    clearResults();
  };

  const showError = (message: string) => {
    setError(message);
    setErrorDialogMessage(message);
  };

  const handleRefresh = async () => {
    if (!canRunAnalysis) {
      showError(t("Заполните параметры анализа облигаций.", "Fill in the bond analysis parameters."));
      return;
    }

    setIsLoadingSource(true);
    setError(null);
    setErrorDialogMessage(null);

    try {
      const loaded = await loadBondSourceFromClient();
      setSourceRows(loaded.data);
      setSourceLabel(t("T-Bank API на клиенте", "T-Bank API on client"));
      setSourceSummary(loaded.summary);
      applyAnalysis(loaded.data, analysisPreferences);
    } catch (err) {
      clearResults();
      showError(err instanceof Error ? err.message : t("Не удалось загрузить облигации.", "Failed to load bonds."));
    } finally {
      setIsLoadingSource(false);
    }
  };

  const handleRecalculate = () => {
    if (!canRunAnalysis) {
      showError(t("Заполните параметры анализа облигаций.", "Fill in the bond analysis parameters."));
      return;
    }
    if (!sourceRows.length) {
      return;
    }

    setIsRecalculating(true);
    setError(null);
    setErrorDialogMessage(null);

    try {
      applyAnalysis(sourceRows, analysisPreferences);
    } catch (err) {
      clearResults();
      showError(err instanceof Error ? err.message : t("Не удалось пересчитать анализ.", "Failed to recalculate the analysis."));
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
              "Задайте целевую доходность, дюрацию и частоту выплат, затем загрузите полный список облигаций из T-Bank API и пересчитайте портфель на клиенте.",
              "Set the target yield, duration, and payment frequency, then load the full bond universe from the T-Bank API and recalculate the portfolio on the client.",
            )}
            accent="amber"
            aside={(
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-[0.18em] text-white/70">{t("Источник", "Source")}</div>
                <div className="text-sm font-medium text-white">{sourceLabel || t("Не загружено", "Not loaded")}</div>
                <div className="text-sm text-white/80">{t("Загружено", "Loaded")}: {sourceSummary?.loadedBondsCount ?? previewStats.total}</div>
                {summary ? (
                  <div className="text-sm text-white/80">{t("В анализе", "In analysis")}: {summary.analyzedBondsCount}</div>
                ) : null}
              </div>
            )}
          />
        )}
        sidebar={(
          <AnalysisSidebarCard
            icon={Settings}
            title={t("Параметры анализа", "Analysis Parameters")}
            description={t(
              "Параметры пользователя влияют на скоринг и сбор клиентского портфеля.",
              "User-defined parameters affect scoring and client-side portfolio construction.",
            )}
            accent="amber"
          >
            <div className="space-y-4">
              <label className="block text-xs text-slate-600 dark:text-slate-400">
                {t("Целевая доходность, %", "Target yield, %")}
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  className="ui-input mt-1"
                  value={analysisPreferences.targetYield}
                  onChange={(event) => setAnalysisPreferences((current) => ({ ...current, targetYield: event.target.value }))}
                />
              </label>

              <label className="block text-xs text-slate-600 dark:text-slate-400">
                {t("Целевая дюрация, лет", "Target duration, years")}
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  className="ui-input mt-1"
                  value={analysisPreferences.targetDuration}
                  onChange={(event) => setAnalysisPreferences((current) => ({ ...current, targetDuration: event.target.value }))}
                />
              </label>

              <label className="block text-xs text-slate-600 dark:text-slate-400">
                {t("Периодичность выплат", "Payment frequency")}
                <select
                  className="ui-input mt-1"
                  value={analysisPreferences.paymentFrequency}
                  onChange={(event) =>
                    setAnalysisPreferences((current) => ({
                      ...current,
                      paymentFrequency: event.target.value === "monthly" ? "monthly" : "quarterly",
                    }))
                  }
                >
                  <option value="monthly">{t("Ежемесячные", "Monthly")}</option>
                  <option value="quarterly">{t("Ежеквартальные", "Quarterly")}</option>
                </select>
              </label>

              <label className="block text-xs text-slate-600 dark:text-slate-400">
                {t("Максимальный уровень риска", "Maximum risk level")}
                <select
                  className="ui-input mt-1"
                  value={analysisPreferences.targetRiskLevel}
                  onChange={(event) =>
                    setAnalysisPreferences((current) => ({
                      ...current,
                      targetRiskLevel: normalizeRiskPreference(event.target.value),
                    }))
                  }
                >
                  {RISK_LEVEL_OPTIONS.map((level) => (
                    <option key={level} value={level}>
                      {t(`Риск ${level}`, `Risk ${level}`)}
                    </option>
                  ))}
                </select>
              </label>

              {!canRunAnalysis ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
                  {t("Укажите положительные значения для целевой доходности и дюрации.", "Enter positive values for the target yield and duration.")}
                </div>
              ) : null}

              <button
                type="button"
                onClick={handleRefresh}
                disabled={isBusy || !canRunAnalysis}
                className="ui-primary-button w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingSource ? "animate-spin" : ""}`} />
                {isLoadingSource ? t("Загружаем...", "Loading...") : t("Загрузить облигации из API", "Load bonds from API")}
              </button>

              <button
                type="button"
                onClick={handleRecalculate}
                disabled={isBusy || !canRunAnalysis || !sourceRows.length}
                className="ui-secondary-button w-full"
              >
                <RefreshCw className={`h-4 w-4 ${isRecalculating ? "animate-spin" : ""}`} />
                {isRecalculating ? t("Пересчитываем...", "Recalculating...") : t("Пересчитать по параметрам", "Recalculate with parameters")}
              </button>

              <button type="button" onClick={handleClear} disabled={isBusy || (!sourceRows.length && !summary)} className="ui-secondary-button w-full">
                <Trash2 className="h-4 w-4" />
                {t("Очистить", "Clear")}
              </button>

              <div className="ui-surface-muted text-sm leading-6 text-slate-600 dark:text-slate-300">
                {t(
                  "После изменения параметров используйте «Пересчитать по параметрам», чтобы пересобрать портфель без повторной загрузки API.",
                  "After changing the parameters, use \"Recalculate with parameters\" to rebuild the portfolio without calling the API again.",
                )}
              </div>

              {sourceStatusMessage ? (
                <div className="ui-surface-muted text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {sourceStatusMessage}
                </div>
              ) : null}
            </div>
          </AnalysisSidebarCard>
        )}
      >
        {isBusy ? (
          <AnalysisRunningIndicator
            title={t("Выполняем анализ облигаций", "Running bond analysis")}
            subtitle={t(
              "Загружаем список облигаций из T-Bank API и применяем пользовательские параметры к клиентскому портфелю.",
              "Loading the bond universe from the T-Bank API and applying user-defined parameters to the client-side portfolio.",
            )}
            accentClassName="text-amber-600"
          />
        ) : null}

        {!previewRows.length && !summary ? (
          <SectionCard
            title={t("Данные не загружены", "No data loaded")}
            description={t(
              "Сначала задайте параметры анализа, затем загрузите облигации из T-Bank API.",
              "Set the analysis parameters first, then load the bonds from the T-Bank API.",
            )}
          >
            <div className="ui-surface-muted text-sm text-slate-600 dark:text-slate-300">
              {t(
                "Страница пытается загрузить весь доступный набор облигаций, а затем строит клиентский портфель под вашу целевую доходность, дюрацию и частоту выплат.",
                "The page tries to load the full available bond universe and then builds a client-side portfolio for your target yield, duration, and payment frequency.",
              )}
            </div>
          </SectionCard>
        ) : null}

        {previewRows.length ? (
          <SectionCard
            title={t("Загруженный набор", "Loaded universe")}
            description={t("Первые строки текущего списка облигаций.", "The first rows of the current bond universe.")}
          >
            <div className="space-y-5">
              {sourceStatusMessage ? (
                <div className="ui-surface-muted text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {sourceStatusMessage}
                </div>
              ) : null}

              <MetricGrid>
                <MetricCard label={t("Облигаций", "Bonds")} value={previewStats.total} />
                <MetricCard label={t("С купоном", "With coupon")} value={previewStats.withCoupon} />
                <MetricCard label={t("Валют", "Currencies")} value={previewStats.currencies} />
                <MetricCard label={t("Секторов", "Sectors")} value={previewStats.sectors} />
              </MetricGrid>

              <div className="ui-table-shell overflow-x-auto">
                <table className="ui-data-table">
                  <thead>
                    <tr>
                      <th>{t("Тикер", "Ticker")}</th>
                      <th>{t("Облигация", "Bond")}</th>
                      <th>{t("Валюта", "Currency")}</th>
                      <th>{t("Погашение", "Maturity")}</th>
                      <th>{t("Купон, %", "Coupon, %")}</th>
                      <th>{t("Риск", "Risk")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewTopRows.map((row) => (
                      <tr key={row.id}>
                        <td className="font-medium text-slate-900 dark:text-slate-100">{row.ticker}</td>
                        <td className="ui-cell-name">{row.name}</td>
                        <td>{row.currency}</td>
                        <td>{row.maturityDate}</td>
                        <td>{row.couponRate?.toFixed(2) ?? "-"}</td>
                        <td>{row.riskLevel ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </SectionCard>
        ) : null}

        {summary ? (
          <MetricGrid>
            <MetricCard label={t("Проанализировано облигаций", "Analyzed bonds")} value={summary.analyzedBondsCount} />
            <MetricCard label={t("Выбрано в портфель", "Selected bonds")} value={summary.selectedBondsCount} />
            <MetricCard label={t("Доходность портфеля", "Portfolio yield")} value={formatPercentOrNumber(summary.portfolioYield)} />
            <MetricCard label={t("Дюрация портфеля", "Portfolio duration")} value={summary.portfolioDuration.toFixed(2)} helper={t("лет", "years")} />
          </MetricGrid>
        ) : null}

        {positions.length ? (
          <SectionCard
            title={t("Оптимальный портфель облигаций", "Optimal bond portfolio")}
            description={t(
              `Портфель собран под доходность ${analysisPreferences.targetYield}%, дюрацию ${analysisPreferences.targetDuration} и риск до ${analysisPreferences.targetRiskLevel}.`,
              `The portfolio is built for a ${analysisPreferences.targetYield}% target yield, ${analysisPreferences.targetDuration} duration, and risk up to ${analysisPreferences.targetRiskLevel}.`,
            )}
            action={(
              <div className="flex items-center gap-2">
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
              </div>
            )}
          >
            <PortfolioHoldingsPanel
              rows={positions}
              palette={palette}
              chartRef={portfolioChartRef}
              companyLabel={t("Облигация", "Bond")}
              weightLabel={t("Вес, %", "Weight, %")}
            />
          </SectionCard>
        ) : null}

        {allBonds.length ? (
          <SectionCard
            title={t("Все облигации", "All bonds")}
            description={t(
              `Показаны все ${allBonds.length} облигаций из клиентского анализа.`,
              `Showing all ${allBonds.length} bonds from the client-side analysis.`,
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
              {sourceStatusMessage ? (
                <div className="ui-surface-muted text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {sourceStatusMessage}
                </div>
              ) : null}

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
                      <th>{t("Тикер", "Ticker")}</th>
                      <th>{t("Облигация", "Bond")}</th>
                      <th>{t("Сектор", "Sector")}</th>
                      <th>{t("Валюта", "Currency")}</th>
                      <th>{t("Риск", "Risk")}</th>
                      <th>{t("Доходность", "Yield")}</th>
                      <th>{t("Лет до погашения", "Years to maturity")}</th>
                      <th>{t("Дюрация", "Duration")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedBonds.map((bond) => (
                      <tr key={`${bond.ticker}-${bond.name}`}>
                        <td className="font-medium text-slate-900 dark:text-slate-100">{bond.ticker}</td>
                        <td className="ui-cell-name">{bond.name}</td>
                        <td>{bond.sector}</td>
                        <td>{bond.currency}</td>
                        <td>{bond.riskLevel.toFixed(0)}</td>
                        <td>{formatPercentOrNumber(bond.currentYield)}</td>
                        <td>{bond.yearsToMaturity.toFixed(2)}</td>
                        <td>{bond.modifiedDuration.toFixed(2)}</td>
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
      </AnalysisPageFrame>

      <AppErrorDialog
        message={errorDialogMessage}
        onClose={() => setErrorDialogMessage(null)}
        title={t("Ошибка анализа", "Analysis Error")}
        description={t(
          "Не удалось завершить клиентскую загрузку или расчёт.",
          "The client-side load or calculation could not be completed.",
        )}
        closeLabel={t("Закрыть", "Close")}
      />
    </>
  );
}
