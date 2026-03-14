import { useEffect, useMemo, useRef, useState } from "react";
import { Brain, Download, ImageDown, Play, Settings, Trophy } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  LineChart,
  Line,
  Legend,
} from "recharts";
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

type PortfolioPosition = {
  ticker: string;
  name: string;
  weight: number;
  expectedReturn: number;
  risk: number;
  sharpe: number;
  sortino?: number;
  value_at_risk?: number;
};

type PortfolioStrategy = {
  key: string;
  name: string;
  expectedReturn: number;
  risk: number;
  sharpe: number;
  diversification: number;
  assetsCount: number;
  positions: PortfolioPosition[];
};

type TrainingPoint = {
  epoch: number;
  trainLoss: number;
  valLoss: number;
};

const ENABLE_TEMP_LOGS = true;
const palette = ["#f97316", "#ea580c", "#fb923c", "#f59e0b", "#f43f5e", "#ef4444", "#facc15", "#fdba74"];
const NEURAL_STATE_KEY = "neural-analysis-state-v1";

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
        `<tr><td>${escapeHtml(row.ticker)}</td><td>${escapeHtml(row.name || "")}</td><td>${row.weight.toFixed(4)}</td><td>${Number.isFinite(row.expectedReturn) ? row.expectedReturn.toFixed(6) : ""}</td><td>${Number.isFinite(row.risk) ? row.risk.toFixed(6) : ""}</td><td>${Number.isFinite(row.sharpe) ? row.sharpe.toFixed(6) : ""}</td><td>${Number.isFinite(row.sortino) ? row.sortino?.toFixed(6) : ""}</td><td>${Number.isFinite(row.value_at_risk) ? row.value_at_risk?.toFixed(6) : ""}</td></tr>`,
    )
    .join("");

  const html =
    `\uFEFF<html><head><meta charset="utf-8"></head><body>` +
    `<table border="1"><tr><th>Ticker</th><th>Name</th><th>Weight, %</th><th>Expected Return</th><th>Risk</th><th>Sharpe</th><th>Sortino</th><th>VaR</th></tr>${tableRows}</table>` +
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

function formatMetricValue(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (Math.abs(value) >= 1000) {
      return value.toFixed(0);
    }
    return formatMetricPercentOrNumber(value);
  }
  if (typeof value === "string") {
    return value;
  }
  return "-";
}

function extractFeatureImportance(parsed: Record<string, unknown>): FeatureImportanceItem[] {
  const raw =
    parsed.feature_importance ??
    parsed.featureImportance ??
    parsed.importances ??
    parsed.feature_weights ??
    parsed.feature_scores ??
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

function extractPortfolioStrategies(parsed: Record<string, unknown>): PortfolioStrategy[] {
  const portfolios = parsed.portfolios;
  if (!portfolios || typeof portfolios !== "object" || Array.isArray(portfolios)) {
    return [];
  }

  const undervaluedStocks = Array.isArray(parsed.undervalued_stocks) ? parsed.undervalued_stocks : [];
  const tickerToName = new Map<string, string>();
  const tickerToExpectedReturn = new Map<string, number>();
  for (const item of undervaluedStocks) {
    const row = item as Record<string, unknown>;
    const ticker = String(row.ticker ?? row.Ticker ?? "");
    if (!ticker) {
      continue;
    }
    tickerToName.set(ticker, String(row.name ?? row.Company ?? ticker));
    tickerToExpectedReturn.set(ticker, numberOr(row.expected_return, numberOr(row.g, numberOr(row.roe, NaN))));
  }

  const labelByKey: Record<string, string> = {
    max_sharpe: "Max Sharpe",
    min_volatility: "Min Volatility",
  };

  const strategies: PortfolioStrategy[] = [];
  for (const [key, raw] of Object.entries(portfolios as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") {
      continue;
    }
    const entry = raw as Record<string, unknown>;
    const metrics = (entry.metrics as Record<string, unknown> | undefined) ?? {};
    const rawPositions = Array.isArray(entry.positions) ? entry.positions : [];

    const rows = rawPositions.map((item, idx) => {
      const row = item as Record<string, unknown>;
      const ticker = String(row.ticker ?? row.Ticker ?? `Asset ${idx + 1}`);
      return {
        ticker,
        name: tickerToName.get(ticker) ?? ticker,
        weight: numberOr(row.weight, numberOr(row.weights, 0)),
        expectedReturn: numberOr(
          row.expected_return,
          numberOr(metrics.expected_return, numberOr(tickerToExpectedReturn.get(ticker), NaN)),
        ),
        risk: numberOr(row.risk, numberOr(metrics.volatility, numberOr(metrics.risk, NaN))),
        sharpe: numberOr(row.sharpe, numberOr(metrics.sharpe_ratio, NaN)),
        sortino: numberOr(row.sortino, numberOr(metrics.sortino, numberOr(metrics.sortino_ratio, NaN))),
        value_at_risk: numberOr(
          row.value_at_risk,
          numberOr(row.var, numberOr(metrics.value_at_risk, numberOr(metrics.var, NaN))),
        ),
      } satisfies PortfolioPosition;
    });

    const maxWeight = rows.length ? Math.max(...rows.map((r) => r.weight)) : 0;
    const normalized = maxWeight <= 1 ? rows.map((r) => ({ ...r, weight: r.weight * 100 })) : rows;

    strategies.push({
      key,
      name: labelByKey[key] ?? key,
      expectedReturn: numberOr(metrics.expected_return, NaN),
      risk: numberOr(metrics.volatility, numberOr(metrics.risk, NaN)),
      sharpe: numberOr(metrics.sharpe_ratio, NaN),
      diversification: numberOr(metrics.diversification_score, NaN),
      assetsCount: numberOr(entry.assets_count, normalized.length),
      positions: normalized.sort((a, b) => b.weight - a.weight),
    });
  }

  return strategies.sort((a, b) => numberOr(b.sharpe, -Infinity) - numberOr(a.sharpe, -Infinity));
}

function extractPortfolioPositions(parsed: Record<string, unknown>): PortfolioPosition[] {
  const strategies = extractPortfolioStrategies(parsed);
  const maxSharpe = strategies.find((s) => s.key === "max_sharpe");
  if (maxSharpe?.positions.length) {
    return maxSharpe.positions;
  }
  return strategies[0]?.positions ?? [];
}

function extractTrainingHistory(parsed: Record<string, unknown>): TrainingPoint[] {
  const history = (parsed.training_history as Record<string, unknown> | undefined) ?? {};
  const train = Array.isArray(history.train_loss) ? history.train_loss : [];
  const val = Array.isArray(history.val_loss) ? history.val_loss : [];
  const count = Math.max(train.length, val.length);

  return Array.from({ length: count }, (_, idx) => ({
    epoch: idx + 1,
    trainLoss: numberOr(train[idx], NaN),
    valLoss: numberOr(val[idx], NaN),
  })).filter((row) => Number.isFinite(row.trainLoss) || Number.isFinite(row.valLoss));
}

function extractMetrics(parsed: Record<string, unknown>): MetricItem[] {
  const stats = (parsed.stats as Record<string, unknown> | undefined) ?? {};
  const summary = (parsed.summary as Record<string, unknown> | undefined) ?? {};
  const finalLosses = (parsed.final_losses as Record<string, unknown> | undefined) ??
    ((summary.final_losses as Record<string, unknown> | undefined) ?? {});
  const portfolios = (parsed.portfolios as Record<string, unknown> | undefined) ?? {};
  const maxSharpe = (portfolios.max_sharpe as Record<string, unknown> | undefined) ?? {};
  const maxSharpeMetrics = (maxSharpe.metrics as Record<string, unknown> | undefined) ?? {};

  const rows: MetricItem[] = [];

  if ("best_model" in summary || "best_model" in parsed || "best_model" in stats) {
    rows.push({
      label: "Best Model",
      value: formatMetricValue(summary.best_model ?? parsed.best_model ?? stats.best_model),
    });
  }
  if ("undervalued_count" in stats || "undervalued_count" in summary) {
    rows.push({
      label: "Undervalued",
      value: formatMetricValue(stats.undervalued_count ?? summary.undervalued_count),
    });
  }
  if ("models_count" in stats) {
    rows.push({ label: "Models", value: formatMetricValue(stats.models_count) });
  }
  if ("train_loss" in finalLosses) {
    rows.push({ label: "Train Loss", value: formatMetricValue(finalLosses.train_loss) });
  }
  if ("val_loss" in finalLosses) {
    rows.push({ label: "Val Loss", value: formatMetricValue(finalLosses.val_loss) });
  }

  const portfolioMapping: Array<{ key: string; label: string }> = [
    { key: "expected_return", label: "Expected Return" },
    { key: "volatility", label: "Volatility" },
    { key: "sharpe_ratio", label: "Sharpe Ratio" },
    { key: "sortino_ratio", label: "Sortino Ratio" },
    { key: "sortino", label: "Sortino" },
    { key: "value_at_risk", label: "VaR" },
    { key: "var", label: "VaR" },
    { key: "diversification_score", label: "Diversification" },
  ];

  for (const item of portfolioMapping) {
    if (item.key in maxSharpeMetrics) {
      if (item.label === "VaR" || item.label === "Sortino" || item.label === "Sortino Ratio") {
        const raw = numberOr(maxSharpeMetrics[item.key], NaN);
        rows.push({
          label: item.label,
          value:
            item.label === "VaR"
              ? formatVarPercent(raw)
              : Number.isFinite(raw)
                ? raw.toFixed(4)
                : "-",
        });
        continue;
      }
      rows.push({
        label: item.label,
        value: formatMetricValue(maxSharpeMetrics[item.key]),
      });
    }
  }

  return rows;
}

function extractPortfolioAssetsCount(parsed: Record<string, unknown>): number {
  const summary = (parsed.summary as Record<string, unknown> | undefined) ?? {};
  const stats = (parsed.stats as Record<string, unknown> | undefined) ?? {};
  const portfolios = (parsed.portfolios as Record<string, unknown> | undefined) ?? {};
  const maxSharpe = (portfolios.max_sharpe as Record<string, unknown> | undefined) ?? {};
  const minVolatility = (portfolios.min_volatility as Record<string, unknown> | undefined) ?? {};

  return numberOr(
    maxSharpe.assets_count,
    numberOr(
      minVolatility.assets_count,
      numberOr(stats.portfolio_assets_count, numberOr(summary.portfolio_assets_count, 0)),
    ),
  );
}

export function NeuralNetworkAnalysis() {
  const { cache, hasData } = useFundamentals();
  const { locale } = useAppSettings();
  const isEn = locale === "en";
  const { settings: optimizerSettings, setSettings: setOptimizerSettings } = useOptimizerSettings();
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<MetricItem[]>([]);
  const [featureImportance, setFeatureImportance] = useState<FeatureImportanceItem[]>([]);
  const [portfolioStrategies, setPortfolioStrategies] = useState<PortfolioStrategy[]>([]);
  const [portfolioPositions, setPortfolioPositions] = useState<PortfolioPosition[]>([]);
  const [trainingHistory, setTrainingHistory] = useState<TrainingPoint[]>([]);
  const [portfolioAssetsCount, setPortfolioAssetsCount] = useState(0);
  const [serverKeys, setServerKeys] = useState<string[]>([]);
  const portfolioChartRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(NEURAL_STATE_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as {
        error?: string | null;
        metrics?: MetricItem[];
        featureImportance?: FeatureImportanceItem[];
        portfolioStrategies?: PortfolioStrategy[];
        portfolioPositions?: PortfolioPosition[];
        trainingHistory?: TrainingPoint[];
        portfolioAssetsCount?: number;
        serverKeys?: string[];
      };
      if (typeof parsed.error === "string" || parsed.error === null) setError(parsed.error);
      if (Array.isArray(parsed.metrics)) setMetrics(parsed.metrics);
      if (Array.isArray(parsed.featureImportance)) setFeatureImportance(parsed.featureImportance);
      if (Array.isArray(parsed.portfolioStrategies)) setPortfolioStrategies(parsed.portfolioStrategies);
      if (Array.isArray(parsed.portfolioPositions)) setPortfolioPositions(parsed.portfolioPositions);
      if (Array.isArray(parsed.trainingHistory)) setTrainingHistory(parsed.trainingHistory);
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
      portfolioStrategies,
      portfolioPositions,
      trainingHistory,
      portfolioAssetsCount,
      serverKeys,
    };
    window.localStorage.setItem(NEURAL_STATE_KEY, JSON.stringify(payload));
  }, [error, metrics, featureImportance, portfolioStrategies, portfolioPositions, trainingHistory, portfolioAssetsCount, serverKeys]);

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
      const response = await fetch("/api/ai-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: requestData }),
      });

      const text = await response.text();
      const parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}${text ? `: ${text}` : ""}`);
      }

      const parsedMetrics = extractMetrics(parsed);
      const parsedImportance = extractFeatureImportance(parsed);
      const parsedStrategies = extractPortfolioStrategies(parsed);
      const parsedPositions = extractPortfolioPositions(parsed);
      const parsedHistory = extractTrainingHistory(parsed);
      const parsedAssetsCount = extractPortfolioAssetsCount(parsed);

      setMetrics(parsedMetrics);
      setFeatureImportance(parsedImportance);
      setPortfolioStrategies(parsedStrategies);
      setPortfolioPositions(parsedPositions);
      setTrainingHistory(parsedHistory);
      setPortfolioAssetsCount(parsedAssetsCount);
      setServerKeys(Object.keys(parsed));

      if (ENABLE_TEMP_LOGS) {
        console.info("[AI][Request][Success]", {
          ts: new Date().toISOString(),
          status: response.status,
          metrics: parsedMetrics.length,
          featureImportance: parsedImportance.length,
          portfolioStrategies: parsedStrategies.length,
          portfolioPositions: parsedPositions.length,
          trainingHistory: parsedHistory.length,
          responseKeys: Object.keys(parsed),
        });
      }
    } catch (e) {
      const message = e instanceof Error
        ? e.message
        : isEn
          ? "Failed to run neural network analysis"
          : "Не удалось выполнить нейросетевой анализ";
      setError(message);
      setMetrics([]);
      setFeatureImportance([]);
      setPortfolioStrategies([]);
      setPortfolioPositions([]);
      setTrainingHistory([]);
      setPortfolioAssetsCount(0);
      setServerKeys([]);

      if (ENABLE_TEMP_LOGS) {
        console.error("[AI][Request][Error]", {
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
    downloadPortfolioAsExcel(portfolioPositions, "ai-optimal-portfolio.xls");
  };

  const savePortfolioChartPng = async () => {
    const svg = portfolioChartRef.current?.querySelector("svg");
    if (!svg) {
      return;
    }
    try {
      await downloadSvgAsPng(svg as SVGSVGElement, "ai-optimal-portfolio.png");
    } catch (e) {
      const message = e instanceof Error ? e.message : isEn ? "Failed to save PNG" : "Не удалось сохранить PNG";
      setError(message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-orange-600 to-red-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <Brain className="w-8 h-8" />
          <h1 className="text-3xl font-bold">{isEn ? "Neural Network Analysis" : "Анализ нейросети"}</h1>
        </div>
        <p className="text-orange-100">
          {isEn ? "Neural model selection and training are performed on the server." : "Нейросетевая модель подбирается и обучается на сервере."}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-6">
              <Settings className="w-5 h-5 text-orange-600" />
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
                  <p className="text-sm text-amber-800">
                    {isEn ? "Cache is empty. Load fundamentals first." : "Кэш пуст. Сначала загрузите фундаментальные данные."}
                  </p>
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
                className="w-full bg-gradient-to-r from-orange-600 to-red-600 text-white py-3 rounded-lg font-medium hover:from-orange-700 hover:to-red-700 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
              title={isEn ? "Running neural network analysis" : "Выполняем нейросетевой анализ"}
              subtitle={isEn ? "Training network and calculating portfolio strategies" : "Обучаем сеть и рассчитываем стратегии портфеля"}
              accentClassName="text-orange-600"
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

          {!!trainingHistory.length && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-4">{isEn ? "Training History" : "История обучения"}</h3>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={trainingHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="epoch" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip formatter={(v: number) => Number(v).toFixed(4)} />
                  <Legend />
                  <Line type="monotone" dataKey="trainLoss" name={isEn ? "Train Loss" : "Train Loss"} stroke="#f97316" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="valLoss" name={isEn ? "Val Loss" : "Val Loss"} stroke="#ef4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {!!portfolioStrategies.length && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-4">{isEn ? "Portfolio Strategies" : "Стратегии портфеля"}</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
                  <thead>
                    <tr className="text-left border-b border-slate-200">
                      <th className="py-2 pr-3">{isEn ? "Strategy" : "Стратегия"}</th>
                      <th className="py-2 pr-3">Expected return</th>
                      <th className="py-2 pr-3">Volatility</th>
                      <th className="py-2 pr-3">Sharpe</th>
                      <th className="py-2 pr-3">Diversification</th>
                      <th className="py-2 pr-3">{isEn ? "Positions" : "Позиций"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolioStrategies.map((s) => (
                      <tr key={s.key} className="border-b border-slate-100">
                        <td className="py-2 pr-3 font-medium text-slate-900">{s.name}</td>
                        <td className="py-2 pr-3 text-slate-700">{Number.isFinite(s.expectedReturn) ? s.expectedReturn.toFixed(4) : "-"}</td>
                        <td className="py-2 pr-3 text-slate-700">{Number.isFinite(s.risk) ? s.risk.toFixed(4) : "-"}</td>
                        <td className="py-2 pr-3 text-slate-700">{Number.isFinite(s.sharpe) ? s.sharpe.toFixed(4) : "-"}</td>
                        <td className="py-2 pr-3 text-slate-700">{Number.isFinite(s.diversification) ? s.diversification.toFixed(4) : "-"}</td>
                        <td className="py-2 pr-3 text-slate-700">{s.assetsCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(!!portfolioPositions.length || portfolioAssetsCount > 0) && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  <h3 className="font-semibold text-slate-900">
                    {isEn ? "Optimal Portfolio from Neural Analysis" : "Оптимальный портфель из нейросетевого анализа"}
                  </h3>
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

              {portfolioAssetsCount > 0 && (
                <p className="text-sm text-slate-600 mb-4">
                  {isEn ? "Assets in portfolio" : "Количество активов в портфеле"}:{" "}
                  <span className="font-semibold text-slate-900">{portfolioAssetsCount}</span>
                </p>
              )}

              {!!portfolioPositions.length && (
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
                    <table className="w-full min-w-[860px] text-sm [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
                      <thead>
                        <tr className="text-left border-b border-slate-200">
                          <th className="py-2 pr-3">Ticker</th>
                          <th className="py-2 pr-3">{isEn ? "Company" : "Компания"}</th>
                          <th className="py-2 pr-3">{isEn ? "Weight, %" : "Вес, %"}</th>
                          <th className="py-2 pr-3">Return</th>
                          <th className="py-2 pr-3">Risk</th>
                          <th className="py-2 pr-3">Sharpe</th>
                          <th className="py-2 pr-3">Sortino</th>
                          <th className="py-2 pr-3">VaR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {portfolioPositions.map((row) => (
                          <tr key={`${row.ticker}-${row.name}`} className="border-b border-slate-100">
                            <td className="py-2 pr-3 font-medium text-slate-900">{row.ticker}</td>
                            <td className="py-2 pr-3 text-slate-700">{row.name}</td>
                            <td className="py-2 pr-3 text-slate-700">{row.weight.toFixed(2)}</td>
                            <td className="py-2 pr-3 text-slate-700">
                              {Number.isFinite(row.expectedReturn) ? row.expectedReturn.toFixed(4) : "-"}
                            </td>
                            <td className="py-2 pr-3 text-slate-700">
                              {Number.isFinite(row.risk) ? row.risk.toFixed(4) : "-"}
                            </td>
                            <td className="py-2 pr-3 text-slate-700">
                              {Number.isFinite(row.sharpe) ? row.sharpe.toFixed(4) : "-"}
                            </td>
                            <td className="py-2 pr-3 text-slate-700">
                              {Number.isFinite(row.sortino) ? row.sortino?.toFixed(4) : "-"}
                            </td>
                            <td className="py-2 pr-3 text-slate-700">
                              {formatVarPercent(numberOr(row.value_at_risk, NaN))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
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

          {/*{!!serverKeys.length && (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
              <p className="text-sm text-slate-600">
                {isEn ? "Server response keys" : "Ключи ответа сервера"}: {serverKeys.join(", ")}
              </p>
            </div>
          )}*/}
        </div>
      </div>
    </div>
  );
}


