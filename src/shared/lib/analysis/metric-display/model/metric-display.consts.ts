import type { MetricLocalizedText } from "./metric-display.types";

export const ANALYSIS_METRIC_LABELS: Record<string, MetricLocalizedText> = {
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
  sortino: { ru: "Сортино", en: "Sortino" },
  "sortino ratio": { ru: "Коэф. Сортино", en: "Sortino Ratio" },
  var: { ru: "VaR", en: "VaR" },
  "value at risk": { ru: "VaR", en: "Value at Risk" },
  "model score": { ru: "Оценка модели", en: "Model Score" },
  "train loss": { ru: "Потеря train", en: "Train Loss" },
  "val loss": { ru: "Потеря val", en: "Val Loss" },
  "best model": { ru: "Лучшая модель", en: "Best Model" },
  models: { ru: "Моделей", en: "Models" },
  undervalued: { ru: "Недооцененных", en: "Undervalued" },
  "cluster selected": { ru: "Отобрано кластером", en: "Cluster Selected" },
  "tree selected": { ru: "Отобрано деревом", en: "Tree Selected" },
  "hybrid selected": { ru: "Отобрано гибридом", en: "Hybrid Selected" },
  "assets in portfolio": { ru: "Активов в портфеле", en: "Assets in Portfolio" },
  assets: { ru: "Активов", en: "Assets" },
  clusters: { ru: "Кластеров", en: "Clusters" },
  companies: { ru: "Компаний", en: "Companies" },
  "eligible companies": { ru: "Eligible Companies", en: "Eligible Companies" },
  features: { ru: "Features", en: "Features" },
  silhouette: { ru: "Silhouette", en: "Silhouette" },
  inertia: { ru: "Inertia", en: "Inertia" },
  portfolios: { ru: "Портфелей", en: "Portfolios" },
};

export const ANALYSIS_METRIC_TOOLTIPS: Record<string, MetricLocalizedText> = {
  "expected return": {
    ru: "Ожидаемая доходность портфеля — средневзвешенная ожидаемая доходность активов. Состоит из роста цены акции + дивидендной доходности.",
    en: "Expected portfolio return — weighted average of constituent expected returns.",
  },
  risk: {
    ru: "Риск портфеля — стандартное отклонение доходностей (волатильность).",
    en: "Portfolio risk — standard deviation of returns (volatility).",
  },
  volatility: {
    ru: "Волатильность — стандартное отклонение доходностей.",
    en: "Volatility — standard deviation of returns.",
  },
  sharpe: {
    ru: "Коэффициент Шарпа — избыточная доходность к безрисковой ставке на единицу волатильности. Показывает, насколько эффективно портфель компенсирует риск.",
    en: "Sharpe ratio — excess return over risk‑free rate per unit of volatility.",
  },
  "sharpe ratio": {
    ru: "Коэффициент Шарпа — избыточная доходность к безрисковой ставке на единицу волатильности. Показывает, насколько эффективно портфель компенсирует риск.",
    en: "Sharpe ratio — excess return over risk‑free rate per unit of volatility.",
  },
  sortino: {
    ru: "Значение неточно. Коэффициент Сортино — избыточная доходность на единицу downside-риска (полуотклонение). Учитывает только негативные колебания, что делает его более точным для оценки эффективности портфеля с асимметричным распределением доходностей.",
    en: "Sortino ratio — excess return per unit of downside risk (downside deviation).",
  },
  "sortino ratio": {
    ru: "Значение неточно. Коэффициент Сортино — избыточная доходность на единицу downside-риска (полуотклонение). Учитывает только негативные колебания, что делает его более точным для оценки эффективности портфеля с асимметричным распределением доходностей.",
    en: "Sortino ratio — excess return per unit of downside risk (downside deviation).",
  },
  var: {
    ru: "VaR — оценка максимальной потери за период при заданном уровне доверия. В данном случае за год с вероятностью 95% вы можете потерять не более указанной доли от портфеля.",
    en: "VaR — estimated maximum loss over a period at a given confidence level.",
  },
  "value at risk": {
    ru: "VaR — оценка максимальной потери за период при заданном уровне доверия. В данном случае за год с вероятностью 95% вы можете потерять не более указанной доли от портфеля.",
    en: "VaR — estimated maximum loss over a period at a given confidence level.",
  },
  diversification: {
    ru: "Индекс диверсификации — внутренняя оценка распределения рисков по активам. Более высокий показатель означает более равномерное распределение рисков, что может способствовать устойчивости портфеля к негативным событиям, затрагивающим отдельные активы.",
    en: "Diversification score shows how evenly risk is distributed across holdings.",
  },
};

export const ANALYSIS_PERCENT_METRIC_LABELS = new Set([
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
  "var",
  "value at risk",
]);

export const ANALYSIS_COUNT_METRIC_LABELS = new Set([
  "models",
  "undervalued",
  "cluster selected",
  "tree selected",
  "hybrid selected",
  "assets in portfolio",
  "assets",
  "clusters",
  "companies",
  "eligible companies",
  "features",
  "portfolios",
]);

export const HIDDEN_ANALYSIS_METRIC_LABELS = new Set([
  "sortino",
  "sortino ratio",
  "var",
  "value at risk",
]);
