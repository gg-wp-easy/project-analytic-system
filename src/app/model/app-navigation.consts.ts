import type { AppNavigationItem } from "./app-navigation.types";
import { APP_ABSOLUTE_ROUTE_PATHS } from "./app-routes.consts";

export const APP_NAVIGATION_ITEMS: AppNavigationItem[] = [
  { title: { ru: "Обзор", en: "Overview" }, path: APP_ABSOLUTE_ROUTE_PATHS.root, icon: "trendingUp" },
  {
    title: { ru: "Фундаментальные данные акций", en: "Stock Fundamentals" },
    path: APP_ABSOLUTE_ROUTE_PATHS.fundamentals,
    icon: "database",
  },
  {
    title: { ru: "Анализ акций", en: "Stock Analysis" },
    path: APP_ABSOLUTE_ROUTE_PATHS.stockAnalysis,
    icon: "layers",
    activePaths: [
      APP_ABSOLUTE_ROUTE_PATHS.cluster,
      APP_ABSOLUTE_ROUTE_PATHS.decisionTree,
      APP_ABSOLUTE_ROUTE_PATHS.neuralNetwork,
      APP_ABSOLUTE_ROUTE_PATHS.hybrid,
    ],
  },
  { title: { ru: "Анализ портфелей", en: "Portfolio Analysis" }, path: APP_ABSOLUTE_ROUTE_PATHS.portfolioAnalysis, icon: "briefcase" },
  { title: { ru: "Анализ индексов", en: "Index Analysis" }, path: APP_ABSOLUTE_ROUTE_PATHS.indexes, icon: "trendingUp" },
  { title: { ru: "Анализ товаров", en: "Commodity Analysis" }, path: APP_ABSOLUTE_ROUTE_PATHS.commodities, icon: "gem" },
  { title: { ru: "Анализ облигаций", en: "Bond Analysis" }, path: APP_ABSOLUTE_ROUTE_PATHS.bonds, icon: "landmark" },
  { title: { ru: "Анализ опционов", en: "Options Analysis" }, path: APP_ABSOLUTE_ROUTE_PATHS.options, icon: "activity" },
  { title: { ru: "Настройки", en: "Settings" }, path: APP_ABSOLUTE_ROUTE_PATHS.settings, icon: "settings" },
  { title: { ru: "О программе", en: "About" }, path: APP_ABSOLUTE_ROUTE_PATHS.about, icon: "info" },
];
