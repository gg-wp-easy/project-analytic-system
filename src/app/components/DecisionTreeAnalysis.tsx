import { useEffect, useMemo, useRef, useState } from "react";
import { Download, GitBranch, ImageDown, Play, Settings, Trophy } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";
import { EmbeddedMarkowitz } from "./EmbeddedMarkowitz";
import { useFundamentals } from "../context/FundamentalsContext";
import { useAppSettings } from "../context/AppSettingsContext";
import { OptimizerSettingsFields } from "./OptimizerSettingsFields";
import { submitOptimizerSettings, useOptimizerSettings } from "./optimizerSettings";
import { AnalysisRunningIndicator } from "./AnalysisRunningIndicator";
import { MetricTooltip } from "./MetricTooltip";
import { formatMetricDisplay, getMetricTooltip, localizeMetricLabel } from "./metricDisplay";

type MetricItem = {
  label: string;
  value: string;
};

type FeatureImportanceItem = {
  feature: string;
  importance: number;
};

type ConfusionMatrixData = {
  labels: string[];
  matrix: number[][];
};

type PortfolioPosition = {
  ticker: string;
  name: string;
  sector: string;
  weight: number;
  expectedReturn: number;
  risk: number;
  predictedText: string;
  sortino?: number;
  value_at_risk?: number;
};

type SectorAllocationItem = {
  sector: string;
  weight: number;
};

type NumericSummaryItem = {
  metric: string;
  mean: number;
  median: number;
  min: number;
  max: number;
};

const ENABLE_TEMP_LOGS = true;
const palette = ["#10b981", "#059669", "#34d399", "#0ea5a4", "#22c55e", "#84cc16", "#14b8a6", "#2dd4bf"];
const TREE_STATE_KEY = "decision-tree-analysis-state-v1";
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function downloadPortfolioAsExcel(rows: PortfolioPosition[], filename: string): void {
  const tableRows = rows
    .map(
      (row) =>
        `<tr><td>${escapeHtml(row.ticker)}</td><td>${escapeHtml(row.name || "")}</td><td>${escapeHtml(row.sector || "")}</td><td>${row.weight.toFixed(4)}</td><td>${Number.isFinite(row.expectedReturn) ? row.expectedReturn.toFixed(6) : ""}</td><td>${Number.isFinite(row.risk) ? row.risk.toFixed(6) : ""}</td><td>${Number.isFinite(row.sortino) ? row.sortino?.toFixed(6) : ""}</td><td>${Number.isFinite(row.value_at_risk) ? row.value_at_risk?.toFixed(6) : ""}</td><td>${escapeHtml(row.predictedText || "")}</td></tr>`,
    )
    .join("");

  const html =
    `\uFEFF<html><head><meta charset="utf-8"></head><body>` +
    `<table border="1"><tr><th>Ticker</th><th>Name</th><th>Sector</th><th>Weight, %</th><th>Expected Return</th><th>Risk</th><th>Sortino</th><th>VaR</th><th>Prediction</th></tr>${tableRows}</table>` +
    `</body></html>`;

  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function downloadSvgAsPng(svg: SVGSVGElement, filename: string): Promise<void> {
  const xml = new XMLSerializer().serializeToString(svg);
  const svgBlob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  await new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const width = Math.max(svg.clientWidth, 600);
      const height = Math.max(svg.clientHeight, 400);
      const canvas = document.createElement("canvas");
      canvas.width = width * 2;
      canvas.height = height * 2;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Cannot create canvas context"));
        return;
      }

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Failed to create PNG blob"));
          return;
        }
        const pngUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = pngUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(pngUrl);
        resolve();
      }, "image/png");
    };
    img.onerror = () => reject(new Error("Failed to render chart image"));
    img.src = url;
  });

  URL.revokeObjectURL(url);
}

function numberOr(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function formatMetricPercentOrNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "-";
  }
  if (value >= 0 && value <= 1) {
    return `${(value * 100).toFixed(2)}%`;
  }
  return value.toFixed(4);
}

function formatVarPercent(value: number): string {
  if (!Number.isFinite(value)) {
    return "-";
  }
  const normalized = Math.abs(value) <= 1 ? value * 100 : value;
  return `${normalized.toFixed(2)}%`;
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
  const [metrics, setMetrics] = useState<MetricItem[]>([]);
  const [featureImportance, setFeatureImportance] = useState<FeatureImportanceItem[]>([]);
  const [confusionMatrix, setConfusionMatrix] = useState<ConfusionMatrixData | null>(null);
  const [portfolioPositions, setPortfolioPositions] = useState<PortfolioPosition[]>([]);
  const [sectorAllocation, setSectorAllocation] = useState<SectorAllocationItem[]>([]);
  const [numericSummary, setNumericSummary] = useState<NumericSummaryItem[]>([]);
  const [portfolioAssetsCount, setPortfolioAssetsCount] = useState(0);
  const [serverKeys, setServerKeys] = useState<string[]>([]);
  const portfolioChartRef = useRef<HTMLDivElement | null>(null);
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
    setIsRunning(true);

    try {
      await submitOptimizerSettings(optimizerSettings);
      const response = await fetch("/api/tree-solver-analysis", {
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
      setError(message);
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

  const exportPortfolioToExcel = () => {
    if (!portfolioPositions.length) {
      return;
    }
    downloadPortfolioAsExcel(portfolioPositions, "tree-optimal-portfolio.xls");
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
      setError(message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <GitBranch className="w-8 h-8" />
          <h1 className="text-3xl font-bold">{isEn ? "Decision Tree Analysis" : "Анализ дерева решений"}</h1>
        </div>
        <p className="text-green-100">{isEn ? "Model and hyperparameters are selected on the server." : "Модель и гиперпараметры автоматически подбираются на сервере."}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-6">
              <Settings className="w-5 h-5 text-green-600" />
              <h2 className="font-semibold text-slate-900">{isEn ? "Run Analysis" : "Запуск анализа"}</h2>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 p-3 bg-slate-50">
                <p className="text-sm text-slate-700">{isEn ? "Source: fundamentals cache" : "Источник: кэш фундаментальных данных"}</p>
                <p className="text-xs text-slate-500 mt-1">{isEn ? "Records" : "Записей"}: {requestData.length}</p>
              </div>
              <OptimizerSettingsFields
                isEn={isEn}
                settings={optimizerSettings}
                onChange={setOptimizerSettings}
              />

              {!hasData && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-800">{isEn ? "Cache is empty. Load fundamentals first." : "Кэш пуст. Сначала загрузите фундаментальные данные."}</p>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-700 break-words">{error}</p>
                </div>
              )}

              <button
                onClick={runAnalysis}
                disabled={!hasData || !requestData.length || isRunning}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 rounded-lg font-medium hover:from-green-700 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="w-5 h-5" />
                {isRunning ? (isEn ? "Running..." : "Выполняется...") : (isEn ? "Run Analysis" : "Запустить анализ")}
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
          {isRunning && (
            <AnalysisRunningIndicator
              title={isEn ? "Running decision tree analysis" : "Выполняем анализ дерева решений"}
              subtitle={isEn ? "Training model and generating portfolio metrics" : "Обучаем модель и формируем метрики портфеля"}
              accentClassName="text-emerald-600"
            />
          )}

          {!!metrics.length && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {metrics.map((m) => (
                <div key={m.label} className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                  <div className="text-sm text-slate-600 mb-1 flex items-center gap-1">
                    <span>{localizeMetricLabel(m.label, isEn)}</span>
                    {getMetricTooltip(m.label, isEn) && (
                      <MetricTooltip text={getMetricTooltip(m.label, isEn) ?? ""} />
                    )}
                  </div>
                  <div className="text-2xl font-semibold text-slate-900">{formatMetricDisplay(m.label, m.value)}</div>
                </div>
              ))}
            </div>
          )}

          {portfolioAssetsCount > 0 && (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
              <p className="text-sm text-slate-600">{isEn ? "Assets in optimal portfolio" : "Активов в оптимальном портфеле"}</p>
              <p className="text-2xl font-semibold text-slate-900">{portfolioAssetsCount}</p>
            </div>
          )}

          {!!sectorAllocation.length && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-4">{isEn ? "Sector Allocation" : "Распределение по секторам"}</h3>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={sectorAllocation} layout="vertical" margin={{ top: 5, right: 30, left: 130, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" stroke="#64748b" unit="%" />
                  <YAxis type="category" dataKey="sector" stroke="#64748b" width={130} />
                  <Tooltip formatter={(v: number) => `${Number(v).toFixed(2)}%`} />
                  <Bar dataKey="weight" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {!!portfolioPositions.length && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  <h3 className="font-semibold text-slate-900">{isEn ? "Optimal Portfolio from Decision Tree" : "Оптимальный портфель из дерева решений"}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={savePortfolioChartPng}
                    disabled={!portfolioPositions.length}
                    className="inline-flex items-center gap-1 px-3 py-2 text-xs rounded-md border border-slate-300 text-slate-700 disabled:opacity-50"
                  >
                    <ImageDown className="w-4 h-4" />
                    PNG
                  </button>
                  <button
                    onClick={exportPortfolioToExcel}
                    disabled={!portfolioPositions.length}
                    className="inline-flex items-center gap-1 px-3 py-2 text-xs rounded-md border border-slate-300 text-slate-700 disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    Excel
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="h-72" ref={portfolioChartRef}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={portfolioPositions}
                        dataKey="weight"
                        nameKey="ticker"
                        cx="50%"
                        cy="50%"
                        outerRadius={105}
                        labelLine={false}
                        label={({ ticker, weight }) => (Number(weight) >= 6 ? `${ticker}: ${Number(weight).toFixed(1)}%` : "")}
                      >
                        {portfolioPositions.map((row, idx) => (
                          <Cell key={row.ticker} fill={palette[idx % palette.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => `${Number(v).toFixed(2)}%`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[920px] text-sm [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
                    <thead>
                      <tr className="text-left border-b border-slate-200">
                        <th className="py-2 pr-3">Ticker</th>
                        <th className="py-2 pr-3">{isEn ? "Company" : "Компания"}</th>
                        <th className="py-2 pr-3">{isEn ? "Sector" : "Сектор"}</th>
                        <th className="py-2 pr-3">{isEn ? "Weight, %" : "Вес, %"}</th>
                        <th className="py-2 pr-3">{isEn ? "Expected Return" : "Ожид. доходность"}</th>
                        <th className="py-2 pr-3">{isEn ? "Risk" : "Риск"}</th>
                        <th className="py-2 pr-3">{isEn ? "Sortino" : "Сортино"}</th>
                        <th className="py-2 pr-3">VaR</th>
                        <th className="py-2 pr-3">{isEn ? "Prediction" : "Оценка"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {portfolioPositions.map((row) => (
                        <tr key={`${row.ticker}-${row.name}`} className="border-b border-slate-100">
                          <td className="py-2 pr-3 font-medium text-slate-900">{row.ticker}</td>
                          <td className="py-2 pr-3 text-slate-700">{row.name}</td>
                          <td className="py-2 pr-3 text-slate-700">{row.sector}</td>
                          <td className="py-2 pr-3 text-slate-700">{row.weight.toFixed(2)}</td>
                          <td className="py-2 pr-3 text-slate-700">
                            {Number.isFinite(row.expectedReturn) ? row.expectedReturn.toFixed(4) : "-"}
                          </td>
                          <td className="py-2 pr-3 text-slate-700">
                            {Number.isFinite(row.risk) ? row.risk.toFixed(4) : "-"}
                          </td>
                          <td className="py-2 pr-3 text-slate-700">
                            {Number.isFinite(row.sortino) ? row.sortino?.toFixed(4) : "-"}
                          </td>
                          <td className="py-2 pr-3 text-slate-700">
                            {formatVarPercent(numberOr(row.value_at_risk, NaN))}
                          </td>
                          <td className="py-2 pr-3 text-slate-700">{row.predictedText}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {!!numericSummary.length && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-4">{isEn ? "Numeric Features Summary" : "Сводка по числовым признакам"}</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-sm [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
                  <thead>
                    <tr className="text-left border-b border-slate-200">
                      <th className="py-2 pr-3">{isEn ? "Metric" : "Метрика"}</th>
                      <th className="py-2 pr-3">Mean</th>
                      <th className="py-2 pr-3">Median</th>
                      <th className="py-2 pr-3">Min</th>
                      <th className="py-2 pr-3">Max</th>
                    </tr>
                  </thead>
                  <tbody>
                    {numericSummary.map((row) => (
                      <tr key={row.metric} className="border-b border-slate-100">
                        <td className="py-2 pr-3 font-medium text-slate-900">{row.metric}</td>
                        <td className="py-2 pr-3 text-slate-700">{row.mean.toFixed(4)}</td>
                        <td className="py-2 pr-3 text-slate-700">{row.median.toFixed(4)}</td>
                        <td className="py-2 pr-3 text-slate-700">{row.min.toFixed(4)}</td>
                        <td className="py-2 pr-3 text-slate-700">{row.max.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!!featureImportance.length && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-4">{isEn ? "Feature Importance" : "Важность признаков"}</h3>
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
            </div>
          )}

          {confusionMatrix && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-4">{isEn ? "Confusion Matrix" : "Матрица ошибок"}</h3>
              <div className="max-w-2xl overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm border-collapse [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
                  <thead>
                    <tr>
                      <th className="p-2 border border-slate-200 bg-slate-50"></th>
                      {confusionMatrix.labels.map((label) => (
                        <th key={`pred-${label}`} className="p-2 border border-slate-200 bg-slate-50 text-left">
                          {isEn ? "Predicted" : "Прогноз"}: {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {confusionMatrix.matrix.map((row, rowIndex) => (
                      <tr key={`row-${rowIndex}`}>
                        <td className="p-2 border border-slate-200 bg-slate-50 font-medium">{isEn ? "Actual" : "Факт"}: {confusionMatrix.labels[rowIndex] ?? `Class ${rowIndex + 1}`}</td>
                        {row.map((value, colIndex) => (
                          <td key={`cell-${rowIndex}-${colIndex}`} className="p-2 border border-slate-200 text-center font-semibold text-slate-900">
                            {value}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/*{!!serverKeys.length && (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
              <p className="text-sm text-slate-600">{isEn ? "Server response keys" : "Ключи ответа сервера"}: {serverKeys.join(", ")}</p>
            </div>
          )}*/}
        </div>
      </div>
    </div>
  );
}




