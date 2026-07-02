import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type Theme = "light" | "dark";
type Locale = "ru" | "en";
type InlineTranslation = {
  ru: string;
  en: string;
};

type TranslationKey =
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
  | "hybrid.resultText"
  | "fund.title"
  | "fund.description"
  | "fund.sourcesTitle"
  | "fund.sharesEndpoint"
  | "fund.assetEndpoint"
  | "fund.mockHint"
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
  | "fund.table.pe"
  | "fund.table.pb"
  | "fund.table.roe"
  | "fund.table.divYield"
  | "markowitz.title"
  | "markowitz.needFundamentals"
  | "markowitz.calculate"
  | "markowitz.updated"
  | "markowitz.frontier"
  | "markowitz.portfolio";

const translations: Record<Locale, Record<TranslationKey, string>> = {
  ru: {
    "nav.overview": "Обзор",
    "nav.cluster": "Кластеризация",
    "nav.decisionTree": "Деревья решений",
    "nav.neuralNetwork": "Нейросеть",
    "nav.hybrid": "Гибридный анализ",
    "nav.fundamentals": "Фундаментальные данные",
    "header.title": "Анализ фондового рынка",
    "header.subtitle": "Профессиональная аналитика",
    "switch.themeLight": "Светлая",
    "switch.themeDark": "Тёмная",
    "switch.langRu": "Рус",
    "switch.langEn": "Eng",
    "dashboard.badge": "Платформа машинного обучения",
    "dashboard.title": "Анализ фондового рынка",
    "dashboard.description":
      "Рабочее пространство для анализа акций, в котором фундаментальные данные кэшируются и используются во всех аналитических моделях.",
    "dashboard.toolsTitle": "Виды анализа",
    "dashboard.open": "Перейти",
    "dashboard.stats.activeAnalyses": "Активных анализов",
    "dashboard.stats.hybridModels": "Моделей в гибриде",
    "dashboard.stats.cache": "Данные в кэше",
    "tool.cluster.title": "Кластерный анализ",
    "tool.cluster.description": "Группировка акций по поведенческим и мультипликаторным признакам.",
    "tool.tree.title": "Деревья решений",
    "tool.tree.description": "Классификация инвестиционных решений и факторов риска.",
    "tool.neural.title": "Нейросеть",
    "tool.neural.description": "Нелинейные зависимости и прогнозирование метрик компаний.",
    "tool.hybrid.title": "Гибридный анализ",
    "tool.hybrid.description": "Ансамбль нескольких моделей для итогового сигнала.",
    "tool.fundamentals.title": "Фундаментальные данные",
    "tool.fundamentals.description": "Загрузка и кэш данных для переиспользования во всех анализах.",
    "hybrid.title": "Гибридный анализ",
    "hybrid.description": "Комбинированный сигнал на базе кластеризации, дерева решений и нейросети.",
    "hybrid.paramsTitle": "Параметры ансамбля",
    "hybrid.run": "Запустить гибрид",
    "hybrid.needFundamentals": "Для запуска сначала загрузите фундаментальные данные в отдельной вкладке.",
    "hybrid.compareTitle": "Сравнение качества моделей",
    "hybrid.resultTitle": "Результат ансамбля",
    "hybrid.resultText": "На текущем mock-наборе гибрид показал лучший aggregated score.",
    "fund.title": "Фундаментальные данные",
    "fund.description": "Загрузка справочника акций и фундаментальных показателей с кэшированием для всех анализов.",
    "fund.sourcesTitle": "Источники данных",
    "fund.sharesEndpoint": "Shares endpoint",
    "fund.assetEndpoint": "Asset fundamentals endpoint",
    "fund.mockHint":
      "Сейчас реальные запросы не выполняются. Вкладка заполняет кэш mock-данными в формате, совместимом с будущей интеграцией.",
    "fund.loadCache": "Загрузить и обновить кэш",
    "fund.loading": "Загрузка...",
    "fund.clearCache": "Очистить кэш",
    "fund.cacheLoaded": "Кэш заполнен",
    "fund.cacheEmpty": "Кэш пуст. Загрузите данные для использования в анализах.",
    "fund.countShares": "Акций",
    "fund.countFundamentals": "Фундаменталок",
    "fund.lastUpdated": "Обновлено",
    "fund.never": "Никогда",
    "fund.sampleTitle": "Фундаментальные данные",
    "fund.table.ticker": "Ticker",
    "fund.table.name": "Name",
    "fund.table.marketCap": "Market Cap",
    "fund.table.pe": "P/E",
    "fund.table.pb": "P/B",
    "fund.table.ps": "P/S",
    "fund.table.roe": "ROE",
    "fund.table.roa": "ROA",
    "fund.table.divYield": "Div Yield",
    "fund.table.beta": "Beta",
    "fund.table.ebitda": "EV/EBITDA",
    "fund.table.netMargin": "Net Margin",
    "fund.table.netDebtToEbitda": "Net Debt/EBITDA",
    "fund.table.totalDebt": "Total Debt",
    "markowitz.title": "Оптимизация Марковица",
    "markowitz.needFundamentals": "Сначала загрузите фундаментальные данные во вкладке \"Фундаментальные данные\".",
    "markowitz.calculate": "Рассчитать портфель",
    "markowitz.updated": "Портфель обновлен",
    "markowitz.frontier": "Эффективная граница",
    "markowitz.portfolio": "Портфель",
  },
  en: {
    "nav.overview": "Overview",
    "nav.cluster": "Clustering",
    "nav.decisionTree": "Decision Trees",
    "nav.neuralNetwork": "Neural Network",
    "nav.hybrid": "Hybrid Analysis",
    "nav.fundamentals": "Fundamentals",
    "header.title": "Stock Market Analytics",
    "header.subtitle": "Professional analytics",
    "switch.themeLight": "Light",
    "switch.themeDark": "Dark",
    "switch.langRu": "Rus",
    "switch.langEn": "Eng",
    "dashboard.badge": "Machine Learning Platform",
    "dashboard.title": "Stock Market Analytics",
    "dashboard.description":
      "Workspace for stock analytics where fundamentals are cached and reused across all analysis models.",
    "dashboard.toolsTitle": "Analysis Types",
    "dashboard.open": "Open",
    "dashboard.stats.activeAnalyses": "Active analyses",
    "dashboard.stats.hybridModels": "Models in hybrid",
    "dashboard.stats.cache": "Cache storage",
    "tool.cluster.title": "Cluster Analysis",
    "tool.cluster.description": "Grouping stocks by behavioral and valuation features.",
    "tool.tree.title": "Decision Trees",
    "tool.tree.description": "Classification of investment decisions and risk factors.",
    "tool.neural.title": "Neural Network",
    "tool.neural.description": "Nonlinear dependencies and company metrics forecasting.",
    "tool.hybrid.title": "Hybrid Analysis",
    "tool.hybrid.description": "Ensemble of multiple models for a final signal.",
    "tool.fundamentals.title": "Fundamentals",
    "tool.fundamentals.description": "Load and cache data for reuse in all analyses.",
    "hybrid.title": "Hybrid Analysis",
    "hybrid.description": "Combined signal based on clustering, decision trees, and neural network.",
    "hybrid.paramsTitle": "Ensemble Parameters",
    "hybrid.run": "Run Hybrid",
    "hybrid.needFundamentals": "Load fundamentals first on the dedicated tab.",
    "hybrid.compareTitle": "Model Quality Comparison",
    "hybrid.resultTitle": "Ensemble Result",
    "hybrid.resultText": "On the current mock set, hybrid shows the best aggregated score.",
    "fund.title": "Fundamentals",
    "fund.description": "Load shares and fundamentals with caching for all analysis tabs.",
    "fund.sourcesTitle": "Data Sources",
    "fund.sharesEndpoint": "Shares endpoint",
    "fund.assetEndpoint": "Asset fundamentals endpoint",
    "fund.mockHint":
      "No real requests are made yet. This tab fills cache with mock data compatible with future integration.",
    "fund.loadCache": "Load and refresh cache",
    "fund.loading": "Loading...",
    "fund.clearCache": "Clear cache",
    "fund.cacheLoaded": "Cache ready",
    "fund.cacheEmpty": "Cache is empty. Load data to reuse it in analyses.",
    "fund.countShares": "Shares",
    "fund.countFundamentals": "Fundamentals",
    "fund.lastUpdated": "Updated",
    "fund.never": "Never",
    "fund.sampleTitle": "Fundamental Data Sample",
    "fund.table.ticker": "Ticker",
    "fund.table.name": "Name",
    "fund.table.marketCap": "Market Cap",
    "fund.table.pe": "P/E",
    "fund.table.pb": "P/B",
    "fund.table.ps": "P/S",
    "fund.table.roe": "ROE",
    "fund.table.roa": "ROA",
    "fund.table.divYield": "Div Yield",
    "fund.table.beta": "Beta",
    "fund.table.ebitda": "EV/EBITDA",
    "fund.table.netMargin": "Net Margin",
    "fund.table.netDebtToEbitda": "Net Debt/EBITDA",
    "fund.table.totalDebt": "Total Debt",
    "markowitz.title": "Markowitz Optimization",
    "markowitz.needFundamentals": "Load fundamentals first on the Fundamentals tab.",
    "markowitz.calculate": "Calculate Portfolio",
    "markowitz.updated": "Portfolio updated",
    "markowitz.frontier": "Efficient Frontier",
    "markowitz.portfolio": "Portfolio",
  },
};

type AppSettingsContextValue = {
  theme: Theme;
  locale: Locale;
  setTheme: (next: Theme) => void;
  setLocale: (next: Locale) => void;
  toggleTheme: () => void;
  t: (key: TranslationKey | InlineTranslation | string, en?: string) => string;
};

const THEME_KEY = "app-theme-v1";
const LOCALE_KEY = "app-locale-v1";

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

function initialTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }
  const saved = window.localStorage.getItem(THEME_KEY);
  return saved === "dark" ? "dark" : "light";
}

function initialLocale(): Locale {
  if (typeof window === "undefined") {
    return "ru";
  }
  const saved = window.localStorage.getItem(LOCALE_KEY);
  return saved === "en" ? "en" : "ru";
}

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => initialTheme());
  const [locale, setLocaleState] = useState<Locale>(() => initialLocale());

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", theme === "dark");
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_KEY, theme);
    }
  }, [theme]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCALE_KEY, locale);
    }
  }, [locale]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);
  const setLocale = useCallback((next: Locale) => setLocaleState(next), []);
  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === "light" ? "dark" : "light"));
  }, []);
  const t = useCallback(
    (key: TranslationKey | InlineTranslation | string, en?: string) => {
      if (typeof en === "string") {
        return locale === "en" ? en : String(key);
      }

      if (typeof key === "string") {
        return key in translations[locale]
          ? translations[locale][key as TranslationKey]
          : key;
      }

      return key[locale];
    },
    [locale],
  );

  const value = useMemo<AppSettingsContextValue>(
    () => ({
      theme,
      locale,
      setTheme,
      setLocale,
      toggleTheme,
      t,
    }),
    [theme, locale, setTheme, setLocale, toggleTheme, t],
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings(): AppSettingsContextValue {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) {
    throw new Error("useAppSettings must be used inside AppSettingsProvider");
  }
  return ctx;
}
