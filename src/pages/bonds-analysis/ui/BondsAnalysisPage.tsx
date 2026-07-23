import { useEffect, useMemo, useRef, useState } from "react";
import { FileSpreadsheet, FileText, ImageDown, Landmark, List, RefreshCw, ScatterChart as ScatterIcon, Settings, Trash2 } from "lucide-react";
import {
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import { analyzeBondSource, loadBondSourceFromClient } from "../../../features/bonds-analysis";
import type {
  BondAnalysisBond,
  BondAnalysisPreferences,
  BondAnalysisSummary,
  BondPortfolioPosition,
  BondsAnalysisPersistedState,
  BondSourceRow,
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
import { ChartSkeleton, MetricSkeletonGrid, TableSkeleton } from "../../../shared/ui/loading-state";
import {
  BONDS_CHART_PALETTE,
  BONDS_PAGE_SIZE,
  BONDS_RISK_PALETTE,
  BONDS_STATE_KEY,
  BOND_RISK_LEVEL_OPTIONS,
  DEFAULT_BOND_ANALYSIS_PREFERENCES,
} from "../model";
import type { BondBubblePoint, BondChartGroup, BondViewMode } from "../model";
import {
  buildBubblePoints,
  getVisiblePages,
  isCorporateBond,
  isCurrencyBond,
  isFixedCouponSourceRow,
  isGovernmentBond,
  isMunicipalBond,
  isPositiveNumberString,
  isPositiveYieldBond,
  isValidBondCountString,
  normalizeRiskPreference,
  normalizeSelectionMethod,
  riskLabel,
} from "../lib";

function BondBubbleTooltip({ payload }: { payload?: Array<{ payload: BondBubblePoint }> }) {
  if (!payload?.length) {
    return null;
  }
  const bond = payload[0].payload;
  return (
    <div className="min-w-64 rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-xl dark:border-slate-700 dark:bg-slate-900">
      <div className="font-semibold text-slate-900 dark:text-slate-100">{bond.ticker}</div>
      <div className="mb-2 max-w-64 text-slate-500 dark:text-slate-400">{bond.name}</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-slate-600 dark:text-slate-300">
        <span>Доходность</span><span className="text-right font-medium">{formatPercentOrNumber(bond.currentYield)}</span>
        <span>Погашение</span><span className="text-right font-medium">{bond.yearsToMaturity.toFixed(2)} лет</span>
        <span>Дюрация</span><span className="text-right font-medium">{bond.modifiedDuration.toFixed(2)}</span>
        <span>Риск</span><span className="text-right font-medium">{bond.riskLevel.toFixed(0)}</span>
        <span>Валюта</span><span className="text-right font-medium">{bond.currency}</span>
      </div>
    </div>
  );
}

function BondBubbleChart({ bonds, emptyLabel }: { bonds: BondAnalysisBond[]; emptyLabel: string }) {
  const points = useMemo(() => buildBubblePoints(bonds), [bonds]);

  if (!points.length) {
    return <div className="ui-surface-muted text-sm text-slate-600 dark:text-slate-300">{emptyLabel}</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={420}>
      <ScatterChart margin={{ top: 16, right: 28, bottom: 42, left: 18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          type="number"
          dataKey="maturityYears"
          name="Срок до погашения"
          stroke="#64748b"
          tickMargin={8}
          label={{ value: "Срок до погашения, лет", position: "insideBottom", offset: -26, fill: "#64748b" }}
        />
        <YAxis
          type="number"
          dataKey="yieldPct"
          name="Доходность"
          stroke="#64748b"
          tickMargin={8}
          tickFormatter={(value: number) => `${Number(value).toFixed(0)}%`}
          label={{ value: "Доходность, %", angle: -90, position: "insideLeft", fill: "#64748b" }}
        />
        <ZAxis type="number" dataKey="bubbleSize" range={[70, 520]} />
        <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<BondBubbleTooltip />} />
        <Scatter name="Bonds" data={points} fill="#f59e0b" fillOpacity={0.78}>
          {points.map((point) => (
            <Cell
              key={`${point.ticker}-${point.name}`}
              fill={BONDS_RISK_PALETTE[Math.round(point.riskLevel) % BONDS_RISK_PALETTE.length]}
            />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export function BondsAnalysisPage() {
  const { t } = useAppSettings();

  const [sourceRows, setSourceRows] = useState<BondSourceRow[]>([]);
  const [analysisPreferences, setAnalysisPreferences] = useState<BondAnalysisPreferences>(DEFAULT_BOND_ANALYSIS_PREFERENCES);
  const [positions, setPositions] = useState<BondPortfolioPosition[]>([]);
  const [allBonds, setAllBonds] = useState<BondAnalysisBond[]>([]);
  const [summary, setSummary] = useState<BondAnalysisSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDialogMessage, setErrorDialogMessage] = useState<string | null>(null);
  const [isLoadingSource, setIsLoadingSource] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<BondViewMode>("charts");
  const [typeChartPage, setTypeChartPage] = useState(0);
  const [riskChartPage, setRiskChartPage] = useState(0);

  const portfolioChartRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(BONDS_STATE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as BondsAnalysisPersistedState;
      if (Array.isArray(parsed.sourceRows)) setSourceRows(parsed.sourceRows.filter(isFixedCouponSourceRow));
      if (parsed.analysisPreferences && typeof parsed.analysisPreferences === "object") {
        setAnalysisPreferences({
          targetYield: String(parsed.analysisPreferences.targetYield ?? DEFAULT_BOND_ANALYSIS_PREFERENCES.targetYield),
          targetDuration: String(parsed.analysisPreferences.targetDuration ?? DEFAULT_BOND_ANALYSIS_PREFERENCES.targetDuration),
          paymentFrequency: parsed.analysisPreferences.paymentFrequency === "monthly" ? "monthly" : "quarterly",
          targetRiskLevel: normalizeRiskPreference(parsed.analysisPreferences.targetRiskLevel),
          selectionMethod: normalizeSelectionMethod(parsed.analysisPreferences.selectionMethod),
          portfolioBondsCount: String(
            parsed.analysisPreferences.portfolioBondsCount ?? DEFAULT_BOND_ANALYSIS_PREFERENCES.portfolioBondsCount,
          ),
        });
      }
      if (Array.isArray(parsed.positions)) setPositions(parsed.positions.filter(isPositiveYieldBond));
      if (Array.isArray(parsed.allBonds)) setAllBonds(parsed.allBonds.filter(isPositiveYieldBond));
      if (parsed.summary && typeof parsed.summary === "object") setSummary(parsed.summary);
      if (typeof parsed.error === "string" || parsed.error === null) setError(parsed.error ?? null);
    } catch {
      // Ignore broken persisted state.
    }
  }, []);

  useEffect(() => {
    const payload: BondsAnalysisPersistedState = {
      sourceRows,
      analysisPreferences,
      positions,
      allBonds,
      summary,
      error,
    };
    window.localStorage.setItem(BONDS_STATE_KEY, JSON.stringify(payload));
  }, [allBonds, analysisPreferences, error, positions, sourceRows, summary]);

  const isBusy = isLoadingSource || isRecalculating;
  const canRunAnalysis =
    isPositiveNumberString(analysisPreferences.targetYield) &&
    isPositiveNumberString(analysisPreferences.targetDuration) &&
    isValidBondCountString(analysisPreferences.portfolioBondsCount);

  const totalPages = Math.max(1, Math.ceil(allBonds.length / BONDS_PAGE_SIZE));
  const pageStartIndex = (currentPage - 1) * BONDS_PAGE_SIZE;
  const pageEndIndex = Math.min(pageStartIndex + BONDS_PAGE_SIZE, allBonds.length);
  const paginatedBonds = useMemo(() => allBonds.slice(pageStartIndex, pageEndIndex), [allBonds, pageEndIndex, pageStartIndex]);
  const visiblePages = useMemo(() => getVisiblePages(currentPage, totalPages), [currentPage, totalPages]);
  const bondTypeGroups = useMemo<BondChartGroup[]>(
    () => [
      {
        key: "ofz",
        label: t("ОФЗ", "OFZ"),
        description: t("Государственные рублевые облигации: доходность относительно срока до погашения.", "Government RUB bonds: yield versus maturity."),
        bonds: allBonds.filter(isGovernmentBond),
      },
      {
        key: "corporate",
        label: t("Корпоративные", "Corporate"),
        description: t("Корпоративные рублевые облигации без муниципальных и валютных выпусков.", "Corporate RUB bonds excluding municipal and FX issues."),
        bonds: allBonds.filter(isCorporateBond),
      },
      {
        key: "municipal",
        label: t("Муниципальные", "Municipal"),
        description: t("Муниципальные облигации: сравнение доходности и срока погашения.", "Municipal bonds: yield and maturity comparison."),
        bonds: allBonds.filter(isMunicipalBond),
      },
      {
        key: "currency",
        label: t("Валютные", "FX"),
        description: t("Облигации в валютах кроме RUB.", "Bonds denominated in currencies other than RUB."),
        bonds: allBonds.filter(isCurrencyBond),
      },
    ],
    [allBonds, t],
  );
  const riskGroups = useMemo<BondChartGroup[]>(
    () =>
      [0, 1, 2, 3].map((level) => ({
        key: `risk-${level}`,
        label: `${riskLabel(level, t)} (${level})`,
        description: t(
          `Облигации с уровнем риска ${level}: доходность относительно срока до погашения.`,
          `Bonds with risk level ${level}: yield versus maturity.`,
        ),
        bonds: allBonds.filter((bond) => Math.round(bond.riskLevel) === level),
      })),
    [allBonds, t],
  );
  const activeTypeGroup = bondTypeGroups[Math.min(typeChartPage, Math.max(bondTypeGroups.length - 1, 0))];
  const activeRiskGroup = riskGroups[Math.min(riskChartPage, Math.max(riskGroups.length - 1, 0))];

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (typeChartPage >= bondTypeGroups.length) {
      setTypeChartPage(Math.max(bondTypeGroups.length - 1, 0));
    }
  }, [bondTypeGroups.length, typeChartPage]);

  useEffect(() => {
    if (riskChartPage >= riskGroups.length) {
      setRiskChartPage(Math.max(riskGroups.length - 1, 0));
    }
  }, [riskChartPage, riskGroups.length]);

  const selectedRiskLabel =
    analysisPreferences.targetRiskLevel === "mixed"
      ? t("Смешанный риск", "Mixed risk")
      : t(`Риск ${analysisPreferences.targetRiskLevel}`, `Risk ${analysisPreferences.targetRiskLevel}`);

  const selectedRiskDescription =
    analysisPreferences.targetRiskLevel === "mixed"
      ? t("смешанный риск", "mixed risk")
      : t(`риск до ${analysisPreferences.targetRiskLevel}`, `risk up to ${analysisPreferences.targetRiskLevel}`);

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
              label: t("Метод подбора", "Selection method"),
              value: analysisPreferences.selectionMethod === "immunization" ? t("Иммунизация", "Immunization") : t("Мэтчинг", "Matching"),
            },
            { label: t("Количество облигаций", "Bond count"), value: analysisPreferences.portfolioBondsCount },
            {
              label: t("Уровень риска", "Risk level"),
              value: selectedRiskLabel,
            },
            {
              label: t("Платежи", "Payments"),
              value: analysisPreferences.paymentFrequency === "monthly" ? t("Ежемесячные", "Monthly") : t("Ежеквартальные", "Quarterly"),
            },
          ]
        : [],
    [analysisPreferences, selectedRiskLabel, summary, t],
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
              "Загрузите список облигаций, задайте параметры и пересоберите портфель под нужную доходность, дюрацию и риск.",
              "Load the bond list, set the parameters, and rebuild the portfolio for the target yield, duration, and risk.",
            )}
            accent="amber"
          />
        )}
        sidebar={(
          <AnalysisSidebarCard
            icon={Settings}
            title={(
              <span className="inline-flex items-center gap-2">
                {t("Параметры анализа", "Analysis Parameters")}
                <InfoTooltip label={t("Справка по анализу облигаций", "Bond analysis help")} side="right">
                  <div className="space-y-2">
                    <p>
                      {t(
                        "Параметры управляют скорингом и сборкой клиентского портфеля: целевая доходность, дюрация, периодичность выплат, метод подбора, количество бумаг и риск.",
                        "Parameters control scoring and client-side portfolio construction: target yield, duration, payment frequency, selection method, bond count, and risk.",
                      )}
                    </p>
                    <div className="grid gap-1.5">
                      <div>
                        <span className="font-semibold">{t("Мэтчинг", "Matching")}:</span>{" "}
                        {t("выбирает бумаги, максимально близкие к заданным целям.", "selects bonds closest to the target parameters.")}
                      </div>
                      <div>
                        <span className="font-semibold">{t("Иммунизация", "Immunization")}:</span>{" "}
                        {t("подбирает веса так, чтобы портфель был ближе к целевой дюрации.", "tilts weights so the portfolio is closer to the target duration.")}
                      </div>
                      <div>
                        <span className="font-semibold">{t("Смешанный риск", "Mixed risk")}:</span>{" "}
                        {t("формирует пул кандидатов из разных уровней риска.", "builds the candidate pool across multiple risk levels.")}
                      </div>
                    </div>
                  </div>
                </InfoTooltip>
              </span>
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
                {t("Метод подбора", "Selection method")}
                <select
                  className="ui-input mt-1"
                  value={analysisPreferences.selectionMethod}
                  onChange={(event) =>
                    setAnalysisPreferences((current) => ({
                      ...current,
                      selectionMethod: normalizeSelectionMethod(event.target.value),
                    }))
                  }
                >
                  <option value="matching">{t("Мэтчинг по параметрам", "Parameter matching")}</option>
                  <option value="immunization">{t("Иммунизация по дюрации", "Duration immunization")}</option>
                </select>
              </label>

              <label className="block text-xs text-slate-600 dark:text-slate-400">
                {t("Количество облигаций", "Bond count")}
                <input
                  type="number"
                  min="20"
                  step="1"
                  className="ui-input mt-1"
                  value={analysisPreferences.portfolioBondsCount}
                  onChange={(event) => setAnalysisPreferences((current) => ({ ...current, portfolioBondsCount: event.target.value }))}
                />
              </label>

              <label className="block text-xs text-slate-600 dark:text-slate-400">
                {t("Риск портфеля", "Portfolio risk")}
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
                  {BOND_RISK_LEVEL_OPTIONS.map((level) => (
                    <option key={level} value={level}>
                      {level === "mixed" ? t("Смешанный риск", "Mixed risk") : t(`Риск ${level}`, `Risk ${level}`)}
                    </option>
                  ))}
                </select>
              </label>

              {!canRunAnalysis ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
                  {t(
                    "Укажите положительные значения для целевой доходности и дюрации, а количество облигаций не меньше 20.",
                    "Enter positive target yield and duration values, and set bond count to at least 20.",
                  )}
                </div>
              ) : null}

              <button
                type="button"
                onClick={handleRecalculate}
                disabled={isBusy || !canRunAnalysis || !sourceRows.length}
                className="ui-secondary-button w-full justify-center px-3 py-2 text-xs"
              >
                <RefreshCw className={`h-4 w-4 ${isRecalculating ? "animate-spin" : ""}`} />
                {isRecalculating ? t("Считаем...", "Calculating...") : t("Рассчитать", "Calculate")}
              </button>

            </div>
          </AnalysisSidebarCard>
        )}
      >
        {isBusy ? (
          <AnalysisRunningIndicator
            title={t("Выполняем анализ облигаций", "Running bond analysis")}
            subtitle={t(
              "Загружаем список облигаций и применяем пользовательские параметры к клиентскому портфелю.",
              "Loading the bond universe and applying user-defined parameters to the client-side portfolio.",
            )}
            accentClassName="text-amber-600"
          />
        ) : null}

        <SectionCard
          title={t("Данные и просмотр", "Data and View")}
          description={t(
            "Загрузите облигации, затем переключайтесь между пузырьковыми диаграммами и табличным списком.",
            "Load bonds, then switch between bubble charts and the tabular list.",
          )}
          action={(
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isBusy || !canRunAnalysis}
                className="ui-primary-button bg-gradient-to-r from-amber-600 to-orange-600 px-3 py-2 text-xs hover:from-amber-700 hover:to-orange-700"
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingSource ? "animate-spin" : ""}`} />
                {isLoadingSource ? t("Загружаем...", "Loading...") : t("Загрузить облигации", "Load bonds")}
              </button>
              <button
                type="button"
                onClick={handleClear}
                disabled={isBusy || (!sourceRows.length && !summary)}
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
                <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{sourceRows.length}</div>
              </div>
              <div className="ui-surface-muted">
                <div className="text-xs text-slate-500 dark:text-slate-400">{t("После анализа", "Analyzed")}</div>
                <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{allBonds.length}</div>
              </div>
              <div className="ui-surface-muted">
                <div className="text-xs text-slate-500 dark:text-slate-400">{t("В портфеле", "Portfolio")}</div>
                <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{positions.length}</div>
              </div>
            </div>

            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
              {([
                { key: "charts" as const, label: t("Диаграммы", "Charts"), icon: ScatterIcon },
                { key: "list" as const, label: t("Список", "List"), icon: List },
              ]).map((item) => {
                const Icon = item.icon;
                const isActive = viewMode === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setViewMode(item.key)}
                    className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
                      isActive
                        ? "bg-amber-500 text-white"
                        : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </SectionCard>

        {isBusy && !allBonds.length && !summary ? (
          <SectionCard
            title={t("Готовим список облигаций", "Preparing bond list")}
            description={t(
              "После загрузки появятся строки облигаций и рассчитанный портфель.",
              "Rows and the calculated portfolio will appear after loading.",
            )}
          >
            <div className="space-y-5">
              <MetricSkeletonGrid count={3} />
              <ChartSkeleton
                title={t("Строим пузырьковую диаграмму", "Building bubble chart")}
                subtitle={t("Готовим доходность, дюрацию, риск и размер выпусков.", "Preparing yield, duration, risk, and issue size.")}
                variant="scatter"
                accentClassName="text-amber-600"
              />
              <TableSkeleton rows={10} columns={8} />
            </div>
          </SectionCard>
        ) : null}

        {!isBusy && !allBonds.length && !summary ? (
          <SectionCard
            title={t("Список облигаций не загружен", "Bond list is not loaded")}
            description={t(
              "Сначала задайте параметры анализа, затем загрузите облигации.",
              "Set the analysis parameters first, then load the bonds.",
            )}
          >
            <div className="ui-surface-muted text-sm text-slate-600 dark:text-slate-300">
              {t(
                "После загрузки здесь появится таблица облигаций с пагинацией, а ниже — портфель, построенный по текущим параметрам.",
                "After loading, this area will show a paginated bond table followed by the portfolio built from the current parameters.",
              )}
            </div>
          </SectionCard>
        ) : null}

        {allBonds.length && viewMode === "charts" && activeTypeGroup ? (
          <SectionCard
            title={t("Пузырьковые диаграммы по типам облигаций", "Bubble Charts by Bond Type")}
            description={activeTypeGroup.description}
            action={(
              <div className="flex flex-wrap items-center gap-2">
                {bondTypeGroups.map((group, index) => (
                  <button
                    key={group.key}
                    type="button"
                    onClick={() => setTypeChartPage(index)}
                    className={`inline-flex items-center rounded-md border px-3 py-2 text-xs font-medium ${
                      typeChartPage === index
                        ? "border-amber-500 bg-amber-500 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    }`}
                  >
                    {group.label}
                    <span className="ml-2 rounded bg-black/10 px-1.5 py-0.5 text-[10px]">{group.bonds.length}</span>
                  </button>
                ))}
              </div>
            )}
          >
            <div className="mb-3 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
              {[0, 1, 2, 3].map((level) => (
                <span key={level} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 dark:border-slate-700">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: BONDS_RISK_PALETTE[level] }} />
                  {riskLabel(level, t)}
                </span>
              ))}
            </div>
            <BondBubbleChart
              bonds={activeTypeGroup.bonds}
              emptyLabel={t("В этой группе пока нет облигаций.", "There are no bonds in this group yet.")}
            />
          </SectionCard>
        ) : null}

        {allBonds.length && viewMode === "charts" && activeRiskGroup ? (
          <SectionCard
            title={t("Пузырьковые диаграммы по уровню риска", "Bubble Charts by Risk Level")}
            description={activeRiskGroup.description}
            action={(
              <div className="flex flex-wrap items-center gap-2">
                {riskGroups.map((group, index) => (
                  <button
                    key={group.key}
                    type="button"
                    onClick={() => setRiskChartPage(index)}
                    className={`inline-flex items-center rounded-md border px-3 py-2 text-xs font-medium ${
                      riskChartPage === index
                        ? "border-amber-500 bg-amber-500 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    }`}
                  >
                    {group.label}
                    <span className="ml-2 rounded bg-black/10 px-1.5 py-0.5 text-[10px]">{group.bonds.length}</span>
                  </button>
                ))}
              </div>
            )}
          >
            <BondBubbleChart
              bonds={activeRiskGroup.bonds}
              emptyLabel={t("Для выбранного уровня риска нет облигаций.", "There are no bonds for the selected risk level.")}
            />
          </SectionCard>
        ) : null}

        {allBonds.length && viewMode === "list" ? (
          <SectionCard
            title={t("Список облигаций", "Bond list")}
            description={t(
              `Показаны все ${allBonds.length} облигаций, доступные после текущего фильтра анализа.`,
              `Showing all ${allBonds.length} bonds available after the current analysis filter.`,
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
                      <th>{t("Риск", "Risk")}</th>
                      <th>{t("Доходность", "Yield")}</th>
                      <th>{t("Лет до погашения", "Years to maturity")}</th>
                      <th>{t("Дюрация", "Duration")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedBonds.map((bond) => (
                      <tr key={`${bond.ticker}-${bond.name}`}>
                        <td className="min-w-28 whitespace-nowrap font-medium text-slate-900 dark:text-slate-100">{bond.ticker}</td>
                        <td className="ui-cell-name min-w-80 max-w-[28rem] whitespace-normal break-words pr-6 leading-5">{bond.name}</td>
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
              `Портфель собран методом ${analysisPreferences.selectionMethod === "immunization" ? "иммунизации" : "мэтчинга"} под доходность ${analysisPreferences.targetYield}%, дюрацию ${analysisPreferences.targetDuration}, ${selectedRiskDescription} и количество ${analysisPreferences.portfolioBondsCount}.`,
              `The portfolio is built with ${analysisPreferences.selectionMethod === "immunization" ? "immunization" : "matching"} for a ${analysisPreferences.targetYield}% target yield, ${analysisPreferences.targetDuration} duration, ${selectedRiskDescription}, and ${analysisPreferences.portfolioBondsCount} bonds.`,
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
              palette={BONDS_CHART_PALETTE}
              chartRef={portfolioChartRef}
              companyLabel={t("Облигация", "Bond")}
              weightLabel={t("Вес, %", "Weight, %")}
            />
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
