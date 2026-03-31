import { useEffect, useMemo, useRef, useState } from "react";
import { FileSpreadsheet, FileText, GitBranch, ImageDown, Play, Settings } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useFundamentals } from "../../../app/context/FundamentalsContext";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import { OptimizerSettingsFields } from "../../../features/optimizer-settings/ui/OptimizerSettingsFields";
import { submitOptimizerSettings, useOptimizerSettings } from "../../../features/optimizer-settings/model/optimizerSettings";
import { API_BASE_URL } from "../../../config/api";
import type {
  DecisionTreeConfusionMatrixData as ConfusionMatrixData,
  DecisionTreeFeatureImportanceItem as FeatureImportanceItem,
  DecisionTreeMetricItem as MetricItem,
  DecisionTreeNumericSummaryItem as NumericSummaryItem,
  DecisionTreePortfolioPosition as PortfolioPosition,
  DecisionTreeSectorAllocationItem as SectorAllocationItem,
} from "../../../features/decision-tree-analysis/model/types";
import { formatMetricDisplay, getMetricTooltip, localizeMetricLabel } from "../../../shared/lib/analysis/metric-display";
import {
  downloadAnalysisResultsAsPdf,
  downloadAnalysisResultsAsXlsx,
  downloadSvgAsPng,
  getPortfolioHoldingColumns,
} from "../../../shared/lib/export/download";
import { formatPercentOrNumber, formatVarPercent } from "../../../shared/lib/format/finance";
import { numberOr } from "../../../shared/lib/number/numberOr";
import {
  AnalysisPageFrame,
  AnalysisSidebarCard,
  MetricCard,
  MetricGrid,
  PageHero,
  SectionCard,
} from "../../../shared/ui/analysis-shell";
import { AppErrorDialog } from "../../../shared/ui/app-error-dialog";
import { AnalysisRunningIndicator } from "../../../shared/ui/analysis/AnalysisRunningIndicator";
import { MetricTooltip } from "../../../shared/ui/analysis/MetricTooltip";
import { PortfolioHoldingsPanel } from "../../../shared/ui/analysis/PortfolioHoldingsPanel";

const ENABLE_TEMP_LOGS = true;
const palette = ["#10b981", "#059669", "#34d399", "#0ea5a4", "#22c55e", "#84cc16", "#14b8a6", "#2dd4bf"];
const TREE_STATE_KEY = "decision-tree-analysis-state-v1";

function formatMetricPercentOrNumber(value: number): string {
  return formatPercentOrNumber(value);
}

function extractMetrics(parsed: Record<string, unknown>): MetricItem[] {
  const source =
    (parsed.metrics as Record<string, unknown> | undefined) ??
    (parsed.model_metrics as Record<string, unknown> | undefined) ??
    (parsed.stats as Record<string, unknown> | undefined) ??
    (parsed.summary as Record<string, unknown> | undefined) ??
    {};

  const mapping: Array<{ key: string; label: string }> = [
    { key: "accuracy", label: "Accuracy" },
    { key: "precision", label: "Precision" },
    { key: "recall", label: "Recall" },
    { key: "f1", label: "F1" },
    { key: "f1_score", label: "F1 Score" },
    { key: "roc_auc", label: "ROC AUC" },
    { key: "balanced_accuracy", label: "Balanced Accuracy" },
    { key: "train_accuracy", label: "Train Accuracy" },
    { key: "test_accuracy", label: "Test Accuracy" },
  ];

  const result: MetricItem[] = [];
  for (const item of mapping) {
    if (item.key in source) {
      result.push({
        label: item.label,
        value: formatMetricPercentOrNumber(numberOr(source[item.key], NaN)),
      });
    }
  }

  return result;
}

function extractFeatureImportance(parsed: Record<string, unknown>): FeatureImportanceItem[] {
  const raw =
    parsed.feature_importance ??
    parsed.featureImportance ??
    parsed.importances ??
    parsed.feature_weights ??
    null;

  if (Array.isArray(raw)) {
    const rows = raw
      .map((item, idx) => {
        const row = item as Record<string, unknown>;
        return {
          feature: String(row.feature ?? row.name ?? row.column ?? `Feature ${idx + 1}`),
          importance: numberOr(row.importance, numberOr(row.score, numberOr(row.weight, 0))),
        };
      })
      .filter((r) => Number.isFinite(r.importance));

    const max = rows.length ? Math.max(...rows.map((r) => r.importance)) : 0;
    const normalized = max <= 1 ? rows.map((r) => ({ ...r, importance: r.importance * 100 })) : rows;
    return normalized.sort((a, b) => b.importance - a.importance);
  }

  if (raw && typeof raw === "object") {
    const entries = Object.entries(raw as Record<string, unknown>)
      .map(([feature, value]) => ({ feature, importance: numberOr(value, 0) }))
      .filter((r) => Number.isFinite(r.importance));

    const max = entries.length ? Math.max(...entries.map((r) => r.importance)) : 0;
    const normalized = max <= 1 ? entries.map((r) => ({ ...r, importance: r.importance * 100 })) : entries;
    return normalized.sort((a, b) => b.importance - a.importance);
  }

  return [];
}

function extractConfusionMatrix(parsed: Record<string, unknown>): ConfusionMatrixData | null {
  const raw = parsed.confusion_matrix ?? parsed.confusionMatrix ?? parsed.matrix;

  if (Array.isArray(raw) && raw.every((row) => Array.isArray(row))) {
    const matrix = raw.map((row) => (row as unknown[]).map((v) => numberOr(v, 0)));
    const labelsRaw = parsed.class_labels ?? parsed.classes;
    const labels = Array.isArray(labelsRaw)
      ? labelsRaw.map((v) => String(v))
      : Array.from({ length: matrix.length }, (_, i) => `Class ${i + 1}`);
    return { labels, matrix };
  }

  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if ("truePositive" in obj || "falsePositive" in obj || "trueNegative" in obj || "falseNegative" in obj) {
      const tp = numberOr(obj.truePositive, 0);
      const fp = numberOr(obj.falsePositive, 0);
      const tn = numberOr(obj.trueNegative, 0);
      const fn = numberOr(obj.falseNegative, 0);
      return {
        labels: ["Покупка", "Продажа"],
        matrix: [
          [tp, fn],
          [fp, tn],
        ],
      };
    }
  }

  return null;
}

function extractPortfolioMetrics(parsed: Record<string, unknown>): MetricItem[] {
  const portfolio = (parsed.portfolio as Record<string, unknown> | undefined) ?? {};
  const portfolioMetrics = (portfolio.metrics as Record<string, unknown> | undefined) ?? {};
  const stats = (parsed.stats as Record<string, unknown> | undefined) ?? {};
  const summary = (parsed.summary as Record<string, unknown> | undefined) ?? {};
  const summaryKeyMetrics = (summary.key_metrics as Record<string, unknown> | undefined) ?? {};

  const source = Object.keys(portfolioMetrics).length
    ? portfolioMetrics
    : Object.keys(summaryKeyMetrics).length
      ? summaryKeyMetrics
      : stats;

  const mapping: Array<{ key: string; label: string }> = [
    { key: "expected_return", label: "Expected Return" },
    { key: "risk", label: "Risk" },
    { key: "sharpe_ratio", label: "Sharpe Ratio" },
    { key: "sortino_ratio", label: "Sortino Ratio" },
    { key: "sortino", label: "Sortino" },
    { key: "value_at_risk", label: "VaR" },
    { key: "var", label: "VaR" },
    { key: "diversification_score", label: "Diversification" },
  ];

  return mapping
    .filter((item) => item.key in source)
    .map((item) => {
      const value = numberOr(source[item.key], NaN);
      if (!Number.isFinite(value)) {
        return { label: item.label, value: "-" };
      }
      if (item.label === "VaR") {
        return { label: item.label, value: formatVarPercent(value) };
      }
      if (item.label === "Sortino" || item.label === "Sortino Ratio") {
        return { label: item.label, value: value.toFixed(4) };
      }
      return { label: item.label, value: formatMetricPercentOrNumber(value) };
    });
}

function extractPortfolioPositions(parsed: Record<string, unknown>): PortfolioPosition[] {
  const portfolio = (parsed.portfolio as Record<string, unknown> | undefined) ?? {};
  const portfolioMetrics = (portfolio.metrics as Record<string, unknown> | undefined) ?? {};
  const stats = (parsed.stats as Record<string, unknown> | undefined) ?? {};
  const summary = (parsed.summary as Record<string, unknown> | undefined) ?? {};
  const summaryKeyMetrics = (summary.key_metrics as Record<string, unknown> | undefined) ?? {};
  const metricsSource = Object.keys(portfolioMetrics).length
    ? portfolioMetrics
    : Object.keys(summaryKeyMetrics).length
      ? summaryKeyMetrics
      : stats;
  const positions = Array.isArray(portfolio.positions) ? portfolio.positions : [];

  const rows = positions.map((item, idx) => {
    const row = item as Record<string, unknown>;
    return {
      ticker: String(row.ticker ?? row.Ticker ?? `Asset ${idx + 1}`),
      name: String(row.name ?? row.Company ?? "-"),
      sector: String(row["Сектор"] ?? row.sector ?? "-"),
      weight: numberOr(row.weights, numberOr(row.weight, 0)),
      expectedReturn: numberOr(row["Ожидаемая_доходность"], numberOr(row.expected_return, NaN)),
      risk: numberOr(row["Риск"], numberOr(row.risk, NaN)),
      sortino: numberOr(
        row.sortino,
        numberOr(row.sortino_ratio, numberOr(metricsSource.sortino, numberOr(metricsSource.sortino_ratio, NaN))),
      ),
      value_at_risk: numberOr(
        row.value_at_risk,
        numberOr(row.var, numberOr(metricsSource.value_at_risk, numberOr(metricsSource.var, NaN))),
      ),
      predictedText: String(row["Predicted_Оценка_текст"] ?? row.predicted_text ?? "-"),
    } satisfies PortfolioPosition;
  });

  const maxWeight = rows.length ? Math.max(...rows.map((r) => r.weight)) : 0;
  const normalized = maxWeight <= 1 ? rows.map((r) => ({ ...r, weight: r.weight * 100 })) : rows;
  return normalized.sort((a, b) => b.weight - a.weight);
}

function extractSectorAllocation(parsed: Record<string, unknown>): SectorAllocationItem[] {
  const portfolio = (parsed.portfolio as Record<string, unknown> | undefined) ?? {};
  const allocation = (portfolio.sector_allocation as Record<string, unknown> | undefined) ?? {};
  const rows = Object.entries(allocation).map(([sector, weight]) => ({ sector, weight: numberOr(weight, 0) }));
  const maxWeight = rows.length ? Math.max(...rows.map((r) => r.weight)) : 0;
  const normalized = maxWeight <= 1 ? rows.map((r) => ({ ...r, weight: r.weight * 100 })) : rows;
  return normalized.sort((a, b) => b.weight - a.weight);
}

function extractNumericSummary(parsed: Record<string, unknown>): NumericSummaryItem[] {
  const stats = (parsed.stats as Record<string, unknown> | undefined) ?? {};
  const numericSummary = (stats.numeric_summary as Record<string, unknown> | undefined) ?? {};

  return Object.entries(numericSummary)
    .map(([metric, raw]) => {
      const row = raw as Record<string, unknown>;
      return {
        metric,
        mean: numberOr(row.mean, NaN),
        median: numberOr(row.median, NaN),
        min: numberOr(row.min, NaN),
        max: numberOr(row.max, NaN),
      } satisfies NumericSummaryItem;
    })
    .filter((item) => Number.isFinite(item.mean));
}

function extractPortfolioAssetsCount(parsed: Record<string, unknown>): number {
  const portfolio = (parsed.portfolio as Record<string, unknown> | undefined) ?? {};
  const stats = (parsed.stats as Record<string, unknown> | undefined) ?? {};
  const summary = (parsed.summary as Record<string, unknown> | undefined) ?? {};

  return numberOr(
    portfolio.assets_count,
    numberOr(stats.portfolio_assets_count, numberOr(summary.portfolio_assets_count, 0)),
  );
}

export function DecisionTreeAnalysis() {
  const { cache, hasData } = useFundamentals();
  const { locale } = useAppSettings();
  const isEn = locale === "en";
  const { settings: optimizerSettings, setSettings: setOptimizerSettings } = useOptimizerSettings();
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDialogMessage, setErrorDialogMessage] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<MetricItem[]>([]);
  const [featureImportance, setFeatureImportance] = useState<FeatureImportanceItem[]>([]);
  const [confusionMatrix, setConfusionMatrix] = useState<ConfusionMatrixData | null>(null);
  const [portfolioPositions, setPortfolioPositions] = useState<PortfolioPosition[]>([]);
  const [sectorAllocation, setSectorAllocation] = useState<SectorAllocationItem[]>([]);
  const [numericSummary, setNumericSummary] = useState<NumericSummaryItem[]>([]);
  const [portfolioAssetsCount, setPortfolioAssetsCount] = useState(0);
  const [serverKeys, setServerKeys] = useState<string[]>([]);
  const portfolioChartRef = useRef<HTMLDivElement | null>(null);
  const showErrorDialog = (message: string) => {
    setError(message);
    setErrorDialogMessage(message);
  };
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(TREE_STATE_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as {
        error?: string | null;
        metrics?: MetricItem[];
        featureImportance?: FeatureImportanceItem[];
        confusionMatrix?: ConfusionMatrixData | null;
        portfolioPositions?: PortfolioPosition[];
        sectorAllocation?: SectorAllocationItem[];
        numericSummary?: NumericSummaryItem[];
        portfolioAssetsCount?: number;
        serverKeys?: string[];
      };
      if (typeof parsed.error === "string" || parsed.error === null) setError(parsed.error);
      if (Array.isArray(parsed.metrics)) setMetrics(parsed.metrics);
      if (Array.isArray(parsed.featureImportance)) setFeatureImportance(parsed.featureImportance);
      if (parsed.confusionMatrix && typeof parsed.confusionMatrix === "object") setConfusionMatrix(parsed.confusionMatrix);
      if (Array.isArray(parsed.portfolioPositions)) setPortfolioPositions(parsed.portfolioPositions);
      if (Array.isArray(parsed.sectorAllocation)) setSectorAllocation(parsed.sectorAllocation);
      if (Array.isArray(parsed.numericSummary)) setNumericSummary(parsed.numericSummary);
      if (typeof parsed.portfolioAssetsCount === "number") setPortfolioAssetsCount(parsed.portfolioAssetsCount);
      if (Array.isArray(parsed.serverKeys)) setServerKeys(parsed.serverKeys);
    } catch {
      // ignore broken persisted state
    }
  }, []);

  useEffect(() => {
    const payload = {
      error,
      metrics,
      featureImportance,
      confusionMatrix,
      portfolioPositions,
      sectorAllocation,
      numericSummary,
      portfolioAssetsCount,
      serverKeys,
    };
    window.localStorage.setItem(TREE_STATE_KEY, JSON.stringify(payload));
  }, [error, metrics, featureImportance, confusionMatrix, portfolioPositions, sectorAllocation, numericSummary, portfolioAssetsCount, serverKeys]);

  const requestData = useMemo(
    () =>
      cache.shares
        .map((share) => {
          const f = cache.fundamentalsByFigi[share.figi];
          if (!f) {
            return null;
          }

          return {
            figi: share.figi,
            ticker: share.ticker,
            name: share.name,
            exchange: share.exchange,
            currency: share.currency,
            lot: share.lot,
            market_cap_bn: f.marketCapBn,
            pe_ratio: f.peRatio,
            pb_ratio: f.pbRatio,
            ps_ratio: f.psRatio,
            ev_to_ebitda: f.evToEbitda,
            roa: f.roa,
            net_margin: f.netMargin,
            net_debt_to_ebitda: f.netDebtToEbitda,
            total_debt: f.totalDebt,
            roe: f.roe,
            dividend_yield: f.dividendYield,
            beta: f.beta,
            g: f.roe,
          };
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row)),
    [cache.fundamentalsByFigi, cache.shares],
  );

  const runAnalysis = async () => {
    setError(null);
    setErrorDialogMessage(null);
    setIsRunning(true);

    try {
      await submitOptimizerSettings(optimizerSettings);
      const response = await fetch(`${API_BASE_URL}/tree-solver-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: requestData }),
      });

      const text = await response.text();
      const parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}${text ? `: ${text}` : ""}`);
      }

      const parsedMetrics = extractPortfolioMetrics(parsed);
      const parsedImportance = extractFeatureImportance(parsed);
      const parsedMatrix = extractConfusionMatrix(parsed);
      const parsedPositions = extractPortfolioPositions(parsed);
      const parsedAllocation = extractSectorAllocation(parsed);
      const parsedNumericSummary = extractNumericSummary(parsed);
      const parsedAssetsCount = extractPortfolioAssetsCount(parsed);

      setMetrics(parsedMetrics);
      setFeatureImportance(parsedImportance);
      setConfusionMatrix(parsedMatrix);
      setPortfolioPositions(parsedPositions);
      setSectorAllocation(parsedAllocation);
      setNumericSummary(parsedNumericSummary);
      setPortfolioAssetsCount(parsedAssetsCount);
      setServerKeys(Object.keys(parsed));

      if (ENABLE_TEMP_LOGS) {
        console.info("[Tree][Request][Success]", {
          ts: new Date().toISOString(),
          status: response.status,
          metrics: parsedMetrics.length,
          featureImportance: parsedImportance.length,
          hasMatrix: Boolean(parsedMatrix),
          portfolioPositions: parsedPositions.length,
          sectorAllocation: parsedAllocation.length,
          responseKeys: Object.keys(parsed),
        });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : isEn ? "Failed to run decision tree analysis" : "Не удалось выполнить анализ дерева решений";
      showErrorDialog(message);
      setMetrics([]);
      setFeatureImportance([]);
      setConfusionMatrix(null);
      setPortfolioPositions([]);
      setSectorAllocation([]);
      setNumericSummary([]);
      setPortfolioAssetsCount(0);
      setServerKeys([]);

      if (ENABLE_TEMP_LOGS) {
        console.error("[Tree][Request][Error]", {
          ts: new Date().toISOString(),
          message,
        });
      }
    } finally {
      setIsRunning(false);
    }
  };

  const exportPortfolioToXlsx = async () => {
    if (!portfolioPositions.length) {
      return;
    }
    await downloadAnalysisResultsAsXlsx({
      title: isEn ? "Optimal Portfolio from Decision Tree" : "Оптимальный портфель из дерева решений",
      filename: "tree-optimal-portfolio.xlsx",
      rows: portfolioPositions,
      columns: getPortfolioHoldingColumns<PortfolioPosition>({
        name: isEn ? "Stock" : "Акция",
        weight: isEn ? "Weight, %" : "Вес, %",
      }),
      metrics: metrics.map((item) => ({
        label: localizeMetricLabel(item.label, isEn),
        value: formatMetricDisplay(item.label, item.value),
      })),
    });
  };

  const savePortfolioChartPng = async () => {
    const svg = portfolioChartRef.current?.querySelector("svg");
    if (!svg) {
      return;
    }
    try {
      await downloadSvgAsPng(svg as SVGSVGElement, "tree-optimal-portfolio.png");
    } catch (e) {
      const message = e instanceof Error ? e.message : isEn ? "Failed to save PNG" : "Не удалось сохранить PNG";
      showErrorDialog(message);
    }
  };

  const exportPortfolioToPdf = async () => {
    if (!portfolioPositions.length) {
      return;
    }
    try {
      await downloadAnalysisResultsAsPdf({
        title: isEn ? "Optimal Portfolio from Decision Tree" : "Оптимальный портфель из дерева решений",
        filename: "tree-optimal-portfolio.pdf",
        rows: portfolioPositions,
        columns: getPortfolioHoldingColumns<PortfolioPosition>({
          name: isEn ? "Stock" : "Акция",
          weight: isEn ? "Weight, %" : "Вес, %",
        }),
        metrics: metrics.map((item) => ({
          label: localizeMetricLabel(item.label, isEn),
          value: formatMetricDisplay(item.label, item.value),
        })),
        chartSvg: portfolioChartRef.current?.querySelector("svg"),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : isEn ? "Failed to save PDF" : "Не удалось сохранить PDF";
      showErrorDialog(message);
    }
  };

  return (
    <>
      <AnalysisPageFrame
      hero={(
        <PageHero
          icon={GitBranch}
          title={isEn ? "Decision Tree Analysis" : "Анализ дерева решений"}
          description={isEn ? "Model and hyperparameters are selected on the server." : "Модель и гиперпараметры автоматически подбираются на сервере."}
          badge={isEn ? "Server-side training" : "Серверное обучение"}
          accent="emerald"
        />
      )}
      sidebar={(
        <AnalysisSidebarCard
          icon={Settings}
          title={isEn ? "Run Analysis" : "Запуск анализа"}
          description={
            isEn
              ? "Shared optimizer inputs and cached fundamentals feed the tree model."
              : "Общие настройки оптимизатора и кэш фундаментальных данных используются для дерева решений."
          }
          accent="emerald"
        >
          <div className="space-y-4">
            <div className="ui-surface-muted">
              <p className="text-sm text-slate-700 dark:text-slate-300">{isEn ? "Source: fundamentals cache" : "Источник: кэш фундаментальных данных"}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{isEn ? "Records" : "Записей"}: {requestData.length}</p>
            </div>

            <OptimizerSettingsFields
              isEn={isEn}
              settings={optimizerSettings}
              onChange={setOptimizerSettings}
            />

            {!hasData && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/20">
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  {isEn ? "Cache is empty. Load fundamentals first." : "Кэш пуст. Сначала загрузите фундаментальные данные."}
                </p>
              </div>
            )}

            <button
              onClick={runAnalysis}
              disabled={!hasData || !requestData.length || isRunning}
              className="ui-primary-button w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700"
            >
              <Play className="h-5 w-5" />
              {isRunning ? (isEn ? "Running..." : "Выполняется...") : (isEn ? "Run Analysis" : "Запустить анализ")}
            </button>
          </div>
        </AnalysisSidebarCard>
      )}
    >
          {isRunning && (
            <AnalysisRunningIndicator
              title={isEn ? "Running decision tree analysis" : "Выполняем анализ дерева решений"}
              subtitle={isEn ? "Training model and generating portfolio metrics" : "Обучаем модель и формируем метрики портфеля"}
              accentClassName="text-emerald-600"
            />
          )}

          {!!metrics.length && (
            <MetricGrid>
              {metrics.map((m) => (
                <MetricCard
                  key={m.label}
                  label={(
                    <>
                      <span>{localizeMetricLabel(m.label, isEn)}</span>
                      {getMetricTooltip(m.label, isEn) && (
                        <MetricTooltip text={getMetricTooltip(m.label, isEn) ?? ""} />
                      )}
                    </>
                  )}
                  value={formatMetricDisplay(m.label, m.value)}
                />
              ))}
            </MetricGrid>
          )}

          {portfolioAssetsCount > 0 && (
            <MetricGrid className="xl:grid-cols-1">
              <MetricCard
                label={isEn ? "Assets in optimal portfolio" : "Активов в оптимальном портфеле"}
                value={portfolioAssetsCount}
                className="max-w-xs"
              />
            </MetricGrid>
          )}

          {!!sectorAllocation.length && (
            <SectionCard title={isEn ? "Sector Allocation" : "Распределение по секторам"}>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={sectorAllocation} layout="vertical" margin={{ top: 5, right: 30, left: 130, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" stroke="#64748b" unit="%" />
                  <YAxis type="category" dataKey="sector" stroke="#64748b" width={130} />
                  <Tooltip formatter={(v: number) => `${Number(v).toFixed(2)}%`} />
                  <Bar dataKey="weight" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
          )}

          {!!portfolioPositions.length && (
            <SectionCard
              title={isEn ? "Optimal Portfolio from Decision Tree" : "Оптимальный портфель из дерева решений"}
              action={(
                <div className="flex items-center gap-2">
                  <button
                    onClick={exportPortfolioToXlsx}
                    disabled={!portfolioPositions.length}
                    className="ui-secondary-button px-3 py-2 text-xs"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    XLSX
                  </button>
                  <button
                    onClick={exportPortfolioToPdf}
                    disabled={!portfolioPositions.length}
                    className="ui-secondary-button px-3 py-2 text-xs"
                  >
                    <FileText className="h-4 w-4" />
                    PDF
                  </button>
                  <button
                    onClick={savePortfolioChartPng}
                    disabled={!portfolioPositions.length}
                    className="ui-secondary-button px-3 py-2 text-xs"
                  >
                    <ImageDown className="h-4 w-4" />
                    PNG
                  </button>
                </div>
              )}
            >
              <PortfolioHoldingsPanel
                rows={portfolioPositions}
                palette={palette}
                chartRef={portfolioChartRef}
                companyLabel={isEn ? "Stock" : "Акция"}
                weightLabel={isEn ? "Weight, %" : "Вес, %"}
              />
            </SectionCard>
          )}

          {!!numericSummary.length && (
            <SectionCard title={isEn ? "Numeric Features Summary" : "Сводка по числовым признакам"}>
              <div className="ui-table-shell overflow-x-auto">
                <table className="ui-data-table">
                  <thead>
                    <tr>
                      <th>{isEn ? "Metric" : "Метрика"}</th>
                      <th>Mean</th>
                      <th>Median</th>
                      <th>Min</th>
                      <th>Max</th>
                    </tr>
                  </thead>
                  <tbody>
                    {numericSummary.map((row) => (
                      <tr key={row.metric}>
                        <td className="font-medium text-slate-900 dark:text-slate-100">{row.metric}</td>
                        <td>{row.mean.toFixed(4)}</td>
                        <td>{row.median.toFixed(4)}</td>
                        <td>{row.min.toFixed(4)}</td>
                        <td>{row.max.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {!!featureImportance.length && (
            <SectionCard title={isEn ? "Feature Importance" : "Важность признаков"}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={featureImportance} layout="vertical" margin={{ top: 5, right: 30, left: 90, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" stroke="#64748b" unit="%" />
                  <YAxis type="category" dataKey="feature" stroke="#64748b" width={90} />
                  <Tooltip formatter={(v: number) => `${Number(v).toFixed(2)}%`} />
                  <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                    {featureImportance.map((row, idx) => (
                      <Cell key={row.feature} fill={palette[idx % palette.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
          )}

          {confusionMatrix && (
            <SectionCard title={isEn ? "Confusion Matrix" : "Матрица ошибок"}>
              <div className="max-w-2xl overflow-x-auto">
                <table className="ui-data-table">
                  <thead>
                    <tr>
                      <th className="bg-slate-50 p-2 text-left dark:bg-slate-800"></th>
                      {confusionMatrix.labels.map((label) => (
                        <th key={`pred-${label}`} className="bg-slate-50 p-2 text-left dark:bg-slate-800">
                          {isEn ? "Predicted" : "Прогноз"}: {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {confusionMatrix.matrix.map((row, rowIndex) => (
                      <tr key={`row-${rowIndex}`}>
                        <td className="bg-slate-50 p-2 font-medium dark:bg-slate-800">{isEn ? "Actual" : "Факт"}: {confusionMatrix.labels[rowIndex] ?? `Class ${rowIndex + 1}`}</td>
                        {row.map((value, colIndex) => (
                          <td key={`cell-${rowIndex}-${colIndex}`} className="p-2 text-center font-semibold text-slate-900 dark:text-slate-100">
                            {value}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {/*{!!serverKeys.length && (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
              <p className="text-sm text-slate-600">{isEn ? "Server response keys" : "Ключи ответа сервера"}: {serverKeys.join(", ")}</p>
            </div>
          )}*/}
      </AnalysisPageFrame>

      <AppErrorDialog
        message={errorDialogMessage}
        onClose={() => setErrorDialogMessage(null)}
        title={isEn ? "Analysis Error" : "Ошибка анализа"}
        description={
          isEn
            ? "The request could not be completed. Check the input data and try again."
            : "Не удалось обработать запрос. Проверьте данные и попробуйте ещё раз."
        }
        closeLabel={isEn ? "Close" : "Закрыть"}
      />
    </>
  );
}




