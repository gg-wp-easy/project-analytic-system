import {
  ANALYSIS_COUNT_METRIC_LABELS,
  ANALYSIS_METRIC_LABELS,
  ANALYSIS_METRIC_TOOLTIPS,
  ANALYSIS_PERCENT_METRIC_LABELS,
  HIDDEN_ANALYSIS_METRIC_LABELS,
  type MetricKind,
} from "../model";

export function normalizeMetricLabelKey(label: string): string {
  return label.trim().toLowerCase();
}

export function toMetricNumber(value: string): number | null {
  const cleaned = value.trim().replace("%", "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function detectMetricKind(label: string): MetricKind {
  const key = normalizeMetricLabelKey(label);
  if (ANALYSIS_PERCENT_METRIC_LABELS.has(key)) {
    return "percent";
  }
  if (ANALYSIS_COUNT_METRIC_LABELS.has(key)) {
    return "count";
  }
  return "number";
}

export function localizeMetricLabel(label: string, isEn: boolean): string {
  const mapped = ANALYSIS_METRIC_LABELS[normalizeMetricLabelKey(label)];
  if (!mapped) {
    return label;
  }
  return isEn ? mapped.en : mapped.ru;
}

export function getMetricTooltip(label: string, isEn: boolean): string | null {
  const mapped = ANALYSIS_METRIC_TOOLTIPS[normalizeMetricLabelKey(label)];
  if (!mapped) {
    return null;
  }
  return isEn ? mapped.en : mapped.ru;
}

export function isVisibleAnalysisMetric(label: string): boolean {
  return !HIDDEN_ANALYSIS_METRIC_LABELS.has(normalizeMetricLabelKey(label));
}

export function formatMetricDisplay(label: string, rawValue: string): string {
  const numeric = toMetricNumber(rawValue);
  if (numeric === null) {
    return rawValue;
  }

  const kind = detectMetricKind(label);
  if (kind === "count") {
    return String(Math.round(numeric));
  }
  if (kind === "percent") {
    const normalized = Math.abs(numeric) <= 1 ? numeric * 100 : numeric;
    return `${normalized.toFixed(2)}%`;
  }
  return numeric.toFixed(4);
}
