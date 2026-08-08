import type { DashboardHeroConfig, DashboardSectionConfig } from "./dashboard.types";

export const DASHBOARD_HERO: DashboardHeroConfig = {
  badge: { ru: "Платформа аналитики", en: "Analytics Platform" },
  title: { ru: "Анализ фондового рынка", en: "Market Analysis" },
  description: {
    ru: "Разделы сгруппированы по рабочему процессу: данные акций, модели анализа, облигации и опционы.",
    en: "Sections are grouped by workflow: stock data, analysis models, bonds, and options.",
  },
};

export const DASHBOARD_SECTIONS_TITLE = {
  ru: "Разделы",
  en: "Sections",
};

export const DASHBOARD_OPEN_LABEL = {
  ru: "Перейти",
  en: "Open",
};

export const DASHBOARD_SECTIONS: DashboardSectionConfig[] = [
  {
    title: { ru: "Фундаментальные данные акций", en: "Stock Fundamentals" },
    description: {
      ru: "Список акций, фундаментальные показатели, детали по эмитентам и первичная обработка данных.",
      en: "Stock list, fundamentals, issuer details, and data preprocessing.",
    },
    path: "/fundamentals",
    icon: "database",
    color: "from-slate-600 to-slate-800",
  },
  {
    title: { ru: "Анализ акций", en: "Stock Analysis" },
    description: {
      ru: "Единая точка выбора: кластерный анализ, дерево решений, нейросеть и гибридный анализ.",
      en: "One entry point for clustering, decision tree, neural network, and hybrid analysis.",
    },
    path: "/stock-analysis",
    icon: "layers",
    color: "from-cyan-600 to-blue-700",
  },
  {
    title: { ru: "Анализ портфелей", en: "Portfolio Analysis" },
    description: {
      ru: "Сохранённые портфели из моделей, текущая динамика, доходность, риск, Шарп и пассивный доход.",
      en: "Saved model portfolios with current dynamics, return, risk, Sharpe, and passive income.",
    },
    path: "/portfolio-analysis",
    icon: "briefcase",
    color: "from-teal-600 to-emerald-700",
  },
  {
    title: { ru: "Анализ индексов", en: "Index Analysis" },
    description: {
      ru: "Месячные данные yfinance по ключевым мировым рынкам и портфель с максимальным коэффициентом Шарпа.",
      en: "Monthly yfinance data for key global markets and a maximum-Sharpe portfolio.",
    },
    path: "/indexes",
    icon: "trendingUp",
    color: "from-sky-600 to-blue-700",
  },
  {
    title: { ru: "Анализ товаров", en: "Commodity Analysis" },
    description: {
      ru: "Месячные данные yfinance по металлам, энергии и аграрным товарам с оптимизацией max Sharpe.",
      en: "Monthly yfinance data for metals, energy, and agricultural commodities with max-Sharpe optimization.",
    },
    path: "/commodities",
    icon: "gem",
    color: "from-amber-500 to-orange-600",
  },
  {
    title: { ru: "Анализ облигаций", en: "Bond Analysis" },
    description: {
      ru: "Загрузка облигаций, расчёт локальных метрик, подбор и выгрузка портфеля.",
      en: "Bond loading, local metrics, portfolio selection, and export.",
    },
    path: "/bonds",
    icon: "landmark",
    color: "from-amber-500 to-orange-600",
  },
  {
    title: { ru: "Анализ опционов", en: "Options Analysis" },
    description: {
      ru: "Общий список базовых активов, контракты, детали и конструктор опционных стратегий.",
      en: "Underlying assets, contracts, details, and option strategy builder.",
    },
    path: "/options",
    icon: "activity",
    color: "from-blue-500 to-cyan-600",
  },
];
