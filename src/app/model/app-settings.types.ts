export type Theme = "light" | "dark";
export type Locale = "ru" | "en";
export type InlineTranslation = {
  ru: string;
  en: string;
};

export type TranslationKey =
  | "nav.overview"
  | "nav.cluster"
  | "nav.decisionTree"
  | "nav.neuralNetwork"
  | "nav.hybrid"
  | "nav.fundamentals"
  | "header.title"
  | "header.subtitle"
  | "switch.themeLight"
  | "switch.themeDark"
  | "switch.langRu"
  | "switch.langEn"
  | "dashboard.badge"
  | "dashboard.title"
  | "dashboard.description"
  | "dashboard.toolsTitle"
  | "dashboard.open"
  | "dashboard.stats.activeAnalyses"
  | "dashboard.stats.hybridModels"
  | "dashboard.stats.cache"
  | "tool.cluster.title"
  | "tool.cluster.description"
  | "tool.tree.title"
  | "tool.tree.description"
  | "tool.neural.title"
  | "tool.neural.description"
  | "tool.hybrid.title"
  | "tool.hybrid.description"
  | "tool.fundamentals.title"
  | "tool.fundamentals.description"
  | "hybrid.title"
  | "hybrid.description"
  | "hybrid.paramsTitle"
  | "hybrid.run"
  | "hybrid.needFundamentals"
  | "hybrid.compareTitle"
  | "hybrid.resultTitle"
  | "fund.title"
  | "fund.description"
  | "fund.loadCache"
  | "fund.loading"
  | "fund.clearCache"
  | "fund.cacheLoaded"
  | "fund.cacheEmpty"
  | "fund.countShares"
  | "fund.countFundamentals"
  | "fund.lastUpdated"
  | "fund.never"
  | "fund.sampleTitle"
  | "fund.table.ticker"
  | "fund.table.name"
  | "fund.table.marketCap"
  | "fund.table.pe"
  | "fund.table.pb"
  | "fund.table.ps"
  | "fund.table.roe"
  | "fund.table.roa"
  | "fund.table.divYield"
  | "fund.table.beta"
  | "fund.table.ebitda"
  | "fund.table.netMargin"
  | "fund.table.netDebtToEbitda"
  | "fund.table.totalDebt"
  | "markowitz.title"
  | "markowitz.needFundamentals"
  | "markowitz.calculate"
  | "markowitz.updated"
  | "markowitz.frontier"
  | "markowitz.portfolio";

export type AppSettingsContextValue = {
  theme: Theme;
  locale: Locale;
  setTheme: (next: Theme) => void;
  setLocale: (next: Locale) => void;
  toggleTheme: () => void;
  t: (key: TranslationKey | InlineTranslation | string, en?: string) => string;
};
