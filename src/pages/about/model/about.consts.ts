declare const __APP_VERSION__: string;

export const ABOUT_APP_VERSION: string = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "";

export const ABOUT_COMPANY_NAME = "NK-Tech";
export const ABOUT_COPYRIGHT_YEAR = 2026;

export const ABOUT_APP_NAME = {
  ru: "NK-Tech Инвестиционная аналитика",
  en: "NK-Tech Investment Analytics",
} as const;

export const ABOUT_COMPANY_SLOGAN = {
  ru: "Решения в одном • Решения во всём",
  en: "All-in-one solutions • Solutions for everything",
} as const;

export const ABOUT_MODULES = [
  { ru: "Фундаментальные данные акций и предобработка", en: "Stock fundamentals and data preprocessing" },
  { ru: "Кластерный анализ, деревья решений, нейросеть и гибридный анализ", en: "Cluster analysis, decision trees, neural network and hybrid analysis" },
  { ru: "Анализ и оптимизация портфелей (Марковиц, CAPM)", en: "Portfolio analysis and optimization (Markowitz, CAPM)" },
  { ru: "Анализ индексов, товаров, облигаций и опционов", en: "Index, commodity, bond and options analysis" },
] as const;
