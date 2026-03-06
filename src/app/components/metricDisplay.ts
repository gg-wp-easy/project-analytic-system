type MetricKind = "percent" | "count" | "number";

const labelMap: Record<string, { ru: string; en: string }> = {
  accuracy: { ru: "Точность", en: "Accuracy" },
  precision: { ru: "Прецизионность", en: "Precision" },
  recall: { ru: "Полнота", en: "Recall" },
  f1: { ru: "F1", en: "F1" },
  "f1 score": { ru: "F1", en: "F1 Score" },
  "roc auc": { ru: "ROC AUC", en: "ROC AUC" },
  "balanced accuracy": { ru: "Сбалансированная точность", en: "Balanced Accuracy" },
  "train accuracy": { ru: "Точность train", en: "Train Accuracy" },
  "test accuracy": { ru: "Точность test", en: "Test Accuracy" },
  "expected return": { ru: "Ожидаемая доходность", en: "Expected Return" },
  risk: { ru: "Риск", en: "Risk" },
  volatility: { ru: "Волатильность", en: "Volatility" },
  diversification: { ru: "Диверсификация", en: "Diversification" },
  sharpe: { ru: "Шарп", en: "Sharpe" },
  "sharpe ratio": { ru: "Коэф. Шарпа", en: "Sharpe Ratio" },
  "model score": { ru: "Оценка модели", en: "Model Score" },
  "train loss": { ru: "Потеря train", en: "Train Loss" },
  "val loss": { ru: "Потеря val", en: "Val Loss" },
  "best model": { ru: "Лучшая модель", en: "Best Model" },
  models: { ru: "Моделей", en: "Models" },
  undervalued: { ru: "Недооцененных", en: "Undervalued" },
  "cluster selected": { ru: "Отобрано кластером", en: "Cluster Selected" },
  "tree selected": { ru: "Отобрано деревом", en: "Tree Selected" },
  "assets in portfolio": { ru: "Активов в портфеле", en: "Assets in Portfolio" },
  assets: { ru: "Активов", en: "Assets" },
  clusters: { ru: "Кластеров", en: "Clusters" },
  companies: { ru: "Компаний", en: "Companies" },
  portfolios: { ru: "Портфелей", en: "Portfolios" },
};

const percentLabels = new Set([
  "accuracy",
  "precision",
  "recall",
  "f1",
  "f1 score",
  "roc auc",
  "balanced accuracy",
  "train accuracy",
  "test accuracy",
  "expected return",
  "risk",
  "volatility",
  "diversification",
]);

const countLabels = new Set([
  "models",
  "undervalued",
  "cluster selected",
  "tree selected",
  "assets in portfolio",
  "assets",
  "clusters",
  "companies",
  "portfolios",
]);

function normalizeLabelKey(label: string): string {
  return label.trim().toLowerCase();
}

function toNumber(value: string): number | null {
  const cleaned = value.trim().replace("%", "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function detectKind(label: string): MetricKind {
  const key = normalizeLabelKey(label);
  if (percentLabels.has(key)) {
    return "percent";
  }
  if (countLabels.has(key)) {
    return "count";
  }
  return "number";
}

export function localizeMetricLabel(label: string, isEn: boolean): string {
  const mapped = labelMap[normalizeLabelKey(label)];
  if (!mapped) {
    return label;
  }
  return isEn ? mapped.en : mapped.ru;
}

export function formatMetricDisplay(label: string, rawValue: string): string {
  const numeric = toNumber(rawValue);
  if (numeric === null) {
    return rawValue;
  }

  const kind = detectKind(label);
  if (kind === "count") {
    return String(Math.round(numeric));
  }
  if (kind === "percent") {
    const normalized = Math.abs(numeric) <= 1 ? numeric * 100 : numeric;
    return `${normalized.toFixed(2)}%`;
  }
  return numeric.toFixed(4);
}
