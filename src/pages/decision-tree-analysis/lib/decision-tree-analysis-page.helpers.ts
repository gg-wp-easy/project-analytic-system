import type {
  DecisionTreeConfusionMatrixData as ConfusionMatrixData,
  DecisionTreeFeatureImportanceItem as FeatureImportanceItem,
  DecisionTreeMetricItem as MetricItem,
  DecisionTreeNumericSummaryItem as NumericSummaryItem,
  DecisionTreePortfolioPosition as PortfolioPosition,
  DecisionTreeSectorAllocationItem as SectorAllocationItem,
} from "../../../features/decision-tree-analysis";
import { formatPercentOrNumber } from "../../../shared/lib/format/finance";
import { numberOr } from "../../../shared/lib/number/numberOr";

function formatMetricPercentOrNumber(value: number): string {
  return formatPercentOrNumber(value);
}

export function extractMetrics(parsed: Record<string, unknown>): MetricItem[] {
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

export function extractFeatureImportance(parsed: Record<string, unknown>): FeatureImportanceItem[] {
  const raw = parsed.feature_importance ?? parsed.featureImportance ?? parsed.importances ?? parsed.feature_weights ?? null;

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

export function extractConfusionMatrix(parsed: Record<string, unknown>): ConfusionMatrixData | null {
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

export function extractPortfolioMetrics(parsed: Record<string, unknown>): MetricItem[] {
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
    { key: "diversification_score", label: "Diversification" },
  ];

  return mapping
    .filter((item) => item.key in source)
    .map((item) => {
      const value = numberOr(source[item.key], NaN);
      if (!Number.isFinite(value)) {
        return { label: item.label, value: "-" };
      }
      return { label: item.label, value: formatMetricPercentOrNumber(value) };
    });
}

export function extractPortfolioPositions(parsed: Record<string, unknown>): PortfolioPosition[] {
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
      figi: String(row.figi ?? row.FIGI ?? row.instrumentFigi ?? ""),
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

export function extractSectorAllocation(parsed: Record<string, unknown>): SectorAllocationItem[] {
  const portfolio = (parsed.portfolio as Record<string, unknown> | undefined) ?? {};
  const allocation = (portfolio.sector_allocation as Record<string, unknown> | undefined) ?? {};
  const rows = Object.entries(allocation).map(([sector, weight]) => ({ sector, weight: numberOr(weight, 0) }));
  const maxWeight = rows.length ? Math.max(...rows.map((r) => r.weight)) : 0;
  const normalized = maxWeight <= 1 ? rows.map((r) => ({ ...r, weight: r.weight * 100 })) : rows;
  return normalized.sort((a, b) => b.weight - a.weight);
}

export function extractNumericSummary(parsed: Record<string, unknown>): NumericSummaryItem[] {
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

export function extractPortfolioAssetsCount(parsed: Record<string, unknown>): number {
  const portfolio = (parsed.portfolio as Record<string, unknown> | undefined) ?? {};
  const stats = (parsed.stats as Record<string, unknown> | undefined) ?? {};
  const summary = (parsed.summary as Record<string, unknown> | undefined) ?? {};

  return numberOr(portfolio.assets_count, numberOr(stats.portfolio_assets_count, numberOr(summary.portfolio_assets_count, 0)));
}
