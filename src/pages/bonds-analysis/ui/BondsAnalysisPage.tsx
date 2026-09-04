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
import { runBondCashFlowMatching } from "../../../features/bonds-analysis";

import { SavePortfolioButton } from "../../../features/saved-portfolios";
import type {
  BondAnalysisBond,
  BondAnalysisPreferences,
  BondAnalysisSummary,
  BondCashFlowMatching,
  BondPortfolioPosition,
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
  isGovernmentBond,
  isMunicipalBond,
  isValidBondCountString,
  normalizeRiskPreference,
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

  const [analysisPreferences, setAnalysisPreferences] = useState<BondAnalysisPreferences>(DEFAULT_BOND_ANALYSIS_PREFERENCES);
  const [positions, setPositions] = useState<BondPortfolioPosition[]>([]);
  const [allBonds, setAllBonds] = useState<BondAnalysisBond[]>([]);
  const [summary, setSummary] = useState<BondAnalysisSummary | null>(null);
  const [matching, setMatching] = useState<BondCashFlowMatching | null>(null);
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
      if (parsed.analysisPreferences && typeof parsed.analysisPreferences === "object") {
        const preferences = parsed.analysisPreferences;
        const currency = ["RUB", "CNY", "USD", "EUR"].includes(preferences.currency)
          ? preferences.currency
          : DEFAULT_BOND_ANALYSIS_PREFERENCES.currency;
        setAnalysisPreferences({
          ...DEFAULT_BOND_ANALYSIS_PREFERENCES,
          desiredCashFlows:
            typeof preferences.desiredCashFlows === "string"
              ? preferences.desiredCashFlows
              : DEFAULT_BOND_ANALYSIS_PREFERENCES.desiredCashFlows,
          currency,
          targetRiskLevel: normalizeRiskPreference(preferences.targetRiskLevel),
          maxPositions: String(preferences.maxPositions ?? DEFAULT_BOND_ANALYSIS_PREFERENCES.maxPositions),
        });
      }
      if (Array.isArray(parsed.positions)) setPositions(parsed.positions);
      if (Array.isArray(parsed.allBonds)) setAllBonds(parsed.allBonds);
      if (parsed.summary && typeof parsed.summary === "object") setSummary(parsed.summary);
      if (parsed.matching && typeof parsed.matching === "object") setMatching(parsed.matching);
      if (typeof parsed.error === "string" || parsed.error === null) setError(parsed.error ?? null);
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
      matching,
      error,
    };
    window.localStorage.setItem(BONDS_STATE_KEY, JSON.stringify(payload));
  }, [allBonds, analysisPreferences, error, matching, positions, summary]);

  const isBusy = isLoadingSource || isRecalculating;
  const canRunAnalysis =
    analysisPreferences.desiredCashFlows.trim().length > 0 &&
    isValidBondCountString(analysisPreferences.maxPositions);
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

  const selectedRiskLabel = t(
    `Риск до ${analysisPreferences.targetRiskLevel}`,
    `Risk up to ${analysisPreferences.targetRiskLevel}`,
  );
  const selectedRiskDescription = t(
    `риск до ${analysisPreferences.targetRiskLevel}`,
    `risk up to ${analysisPreferences.targetRiskLevel}`,
  );
  const exportMetrics = useMemo<ExportMetric[]>(
    () =>
      summary
        ? [
            { label: t("Проанализировано облигаций", "Analyzed bonds"), value: summary.analyzedBondsCount },
            { label: t("Выбрано выпусков", "Selected issues"), value: summary.selectedBondsCount },
            { label: t("Желаемый поток", "Desired cash flow"), value: matching ? `${matching.totalDesiredCashFlow.toLocaleString()} ${matching.currency}` : "—" },
            { label: t("Расчётный поток", "Projected cash flow"), value: matching ? `${matching.totalProjectedCashFlow.toLocaleString()} ${matching.currency}` : "—" },
            { label: t("Расчётный номинал", "Estimated nominal"), value: matching ? `${matching.estimatedNominal.toLocaleString()} ${matching.currency}` : "—" },
            { label: t("Допустимый риск", "Maximum risk"), value: selectedRiskLabel },
          ]
        : [],
    [matching, selectedRiskLabel, summary, t],
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
    setMatching(null);
    setError(null);
    setErrorDialogMessage(null);
    setCurrentPage(1);
  };

  const applyAnalysis = async () => {
    const result = await runBondCashFlowMatching(analysisPreferences);
    setPositions(result.portfolio.positions);
    setAllBonds(result.bonds);
    setSummary(result.summary);
    setMatching(result.matching);
    setCurrentPage(1);
  };

  const handleClear = () => {
    clearResults();
  };

  const showError = (message: string) => {
    setError(message);
    setErrorDialogMessage(message);
  };

  const handleRefresh = async () => {
    if (!canRunAnalysis) {
      showError(t("Заполните желаемый денежный поток и максимальное число позиций.", "Enter the desired cash flow and maximum number of positions."));
      return;
    }
    setIsLoadingSource(true);
    setError(null);
    setErrorDialogMessage(null);
    try {
      await applyAnalysis();
    } catch (err) {
      clearResults();
      showError(err instanceof Error ? err.message : t("Не удалось построить денежный поток.", "Could not build the cash flow."));
    } finally {
      setIsLoadingSource(false);
    }
  };

  const handleRecalculate = async () => {
    if (!canRunAnalysis) {
      showError(t("Заполните желаемый денежный поток и максимальное число позиций.", "Enter the desired cash flow and maximum number of positions."));
      return;
    }
    setIsRecalculating(true);
    setError(null);
    setErrorDialogMessage(null);
    try {
      await applyAnalysis();
    } catch (err) {
      clearResults();
      showError(err instanceof Error ? err.message : t("Не удалось пересчитать денежный поток.", "Could not recalculate the cash flow."));
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
              "Задайте желаемые суммы по будущим датам. Сервер сопоставит их с известными купонами и номиналом облигаций, а интерфейс покажет полученный сценарий.",
              "Enter desired amounts on future dates. The server matches them to known bond coupons and principal; the interface shows the resulting scenario.",
            )}
            accent="amber"
          />
        )}
        sidebar={(
          <AnalysisSidebarCard
            icon={Settings}
            title={(
              <span className="inline-flex items-center gap-2">
                {t("Параметры денежного потока", "Cash-flow parameters")}
                <InfoTooltip label={t("Справка по мэтчингу облигаций", "Bond matching help")} side="right">
                  <div className="space-y-2">
                    <p>{t("Сервер получает известный календарь купонов и номинал при погашении, затем подбирает целые количества облигаций для покрытия накопленных сумм к заданным датам.", "The server reads known coupon dates and principal at maturity, then selects integer bond quantities to cover cumulative amounts by the requested dates.")}</p>
                    <p>{t("Не включаются выпуски с плавающим купоном, амортизацией, бессрочностью и пометкой callable. Это расчётный сценарий, не обязательство и не гарантия выплат.", "Floating-rate, amortizing, perpetual, and callable-flagged issues are excluded. This is a calculation scenario, not an obligation or payment guarantee.")}</p>
                  </div>
                </InfoTooltip>
              </span>
            )}
            accent="amber"
          >
            <div className="space-y-4">
              <label className="block text-xs text-slate-600 dark:text-slate-400">
                {t("Желаемый денежный поток", "Desired cash flow")}
                <textarea
                  rows={5}
                  className="ui-input mt-1 min-h-32 font-mono"
                  value={analysisPreferences.desiredCashFlows}
                  onChange={(event) => setAnalysisPreferences((current) => ({ ...current, desiredCashFlows: event.target.value }))}
                  placeholder={'2027-06-15; 50000\n2028-06-15; 75000'}
                />
                <span className="mt-1 block text-[11px] text-slate-500">{t("Одна строка: ГГГГ-ММ-ДД; сумма. Даты должны быть в будущем.", "One line: YYYY-MM-DD; amount. Dates must be in the future.")}</span>
              </label>

              <label className="block text-xs text-slate-600 dark:text-slate-400">
                {t("Валюта", "Currency")}
                <select
                  className="ui-input mt-1"
                  value={analysisPreferences.currency}
                  onChange={(event) => setAnalysisPreferences((current) => ({ ...current, currency: event.target.value as BondAnalysisPreferences["currency"] }))}
                >
                  {(["RUB", "CNY", "USD", "EUR"] as const).map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                </select>
              </label>

              <label className="block text-xs text-slate-600 dark:text-slate-400">
                {t("Максимальный риск", "Maximum risk")}
                <select
                  className="ui-input mt-1"
                  value={analysisPreferences.targetRiskLevel}
                  onChange={(event) => setAnalysisPreferences((current) => ({ ...current, targetRiskLevel: event.target.value as BondAnalysisPreferences["targetRiskLevel"] }))}
                >
                  {BOND_RISK_LEVEL_OPTIONS.map((level) => <option key={level} value={level}>{riskLabel(Number(level), t)} ({level})</option>)}
                </select>
              </label>

              <label className="block text-xs text-slate-600 dark:text-slate-400">
                {t("Максимум выпусков", "Maximum issues")}
                <input
                  type="number"
                  min="1"
                  max="50"
                  step="1"
                  className="ui-input mt-1"
                  value={analysisPreferences.maxPositions}
                  onChange={(event) => setAnalysisPreferences((current) => ({ ...current, maxPositions: event.target.value }))}
                />
              </label>

              <button
                type="button"
                onClick={handleRecalculate}
                disabled={isBusy || !canRunAnalysis}
                className="ui-secondary-button w-full justify-center px-3 py-2 text-xs"
              >
                <RefreshCw className={`h-4 w-4 ${isRecalculating ? "animate-spin" : ""}`} />
                {isRecalculating ? t("Считаем...", "Calculating...") : t("Построить поток", "Build cash flow")}
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

        {!isBusy && (
          <>
        <SectionCard
          title={t("Данные и просмотр", "Data and View")}
          description={t(
            "Загрузите облигации, затем переключайтесь между пузырьковыми диаграммами и табличным списком.",
            "Build the cash flow, then switch between bubble charts and the tabular list.",
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
                {isLoadingSource ? t("Строим...", "Building...") : t("Построить поток", "Build cash flow")}
              </button>
              <button
                type="button"
                onClick={handleClear}
                disabled={isBusy || !summary}
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
            <MetricCard label={t("Проанализировано выпусков", "Analyzed issues")} value={summary.analyzedBondsCount} />
            <MetricCard label={t("Выбрано выпусков", "Selected issues")} value={summary.selectedBondsCount} />
            <MetricCard label={t("Желаемый поток", "Desired cash flow")} value={matching ? `${matching.totalDesiredCashFlow.toLocaleString()} ${matching.currency}` : "—"} />
            <MetricCard label={t("Расчётный номинал", "Estimated nominal")} value={matching ? `${matching.estimatedNominal.toLocaleString()} ${matching.currency}` : "—"} />
          </MetricGrid>
        ) : null}

        {matching ? (
          <SectionCard
            title={t("Покрытие желаемого денежного потока", "Desired cash-flow coverage")}
            description={t("Сервер суммирует известные платежи, пришедшие не позднее каждой целевой даты. Ранний остаток переносится без доходности.", "The server sums known payments received no later than each target date. Earlier surplus is carried at a zero return.")}
          >
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100">
              {t("Расчётный сценарий: суммы не учитывают цену покупки, налоги, комиссии, дефолт и изменения условий. Это не обязательство и не гарантия выплат.", "Calculation scenario: amounts do not include purchase price, taxes, fees, default, or changing terms. It is not an obligation or payment guarantee.")}
            </div>
            <div className="ui-table-shell overflow-x-auto">
              <table className="ui-data-table min-w-[48rem]">
                <thead>
                  <tr>
                    <th>{t("Дата", "Date")}</th>
                    <th>{t("Желаемый поток", "Desired flow")}</th>
                    <th>{t("Расчётный поток", "Projected flow")}</th>
                    <th>{t("Накопленный остаток", "Cumulative surplus")}</th>
                    <th>{t("Покрытие", "Coverage")}</th>
                  </tr>
                </thead>
                <tbody>
                  {matching.periods.map((period) => (
                    <tr key={period.date}>
                      <td>{period.date}</td>
                      <td>{period.desiredCashFlow.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} {matching.currency}</td>
                      <td>{period.projectedCashFlow.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} {matching.currency}</td>
                      <td className={period.cumulativeSurplus >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}>{period.cumulativeSurplus.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} {matching.currency}</td>
                      <td><span className={period.isCovered ? "rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "rounded-full bg-rose-100 px-2 py-1 text-xs font-medium text-rose-800 dark:bg-rose-950 dark:text-rose-200"}>{period.isCovered ? t("Покрыт", "Covered") : t("Не покрыт", "Not covered")}</span></td>
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
              `Сервер сопоставил известные купоны и номинал с желаемыми датами в ${matching?.currency ?? analysisPreferences.currency}; ${selectedRiskDescription}. Количества и номинал расчётные.`,
              `The server matched known coupons and principal to desired dates in ${matching?.currency ?? analysisPreferences.currency}; ${selectedRiskDescription}. Quantities and nominal are estimates.`,
            )}
            action={(
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
                    <th>{t("Количество", "Quantity")}</th>
                    <th>{t("Расчётный номинал", "Estimated nominal")}</th>
                    <th>{t("Поток до последней даты", "Flow through last date")}</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((position) => (
                    <tr key={`${position.ticker}-${position.name}`}>
                      <td className="font-medium text-slate-900 dark:text-slate-100">{position.ticker}</td>
                      <td className="ui-cell-name max-w-[28rem] whitespace-normal break-words pr-6 leading-5">{position.name}</td>
                      <td>{position.quantity ?? "—"}</td>
                      <td>{position.estimatedNominal?.toLocaleString("ru-RU", { maximumFractionDigits: 2 }) ?? "—"} {matching?.currency ?? analysisPreferences.currency}</td>
                      <td>{position.cashFlowToTarget?.toLocaleString("ru-RU", { maximumFractionDigits: 2 }) ?? "—"} {matching?.currency ?? analysisPreferences.currency}</td>
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
