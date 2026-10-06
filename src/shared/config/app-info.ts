import siteIcon from "../../assets/products/site.png";
import trackerIcon from "../../assets/products/tracker.png";
import analyticsIcon from "../../assets/products/analytics.png";
import finanalysisIcon from "../../assets/products/finanalysis.png";

type Text = { ru: string; en: string };

/**
 * Сведения о приложении. Одинаковый набор полей во всех продуктах NK-Tech Finance:
 * сайт, учёт инвестиций, финанализ и эта инвестиционная аналитика.
 */
export const APP_INFO = {
  brand: "NK-Tech Finance",
  product: { ru: "Инвестиционная аналитика", en: "Investment Analytics" } satisfies Text,
  fullName: { ru: "NK-Tech Finance · Инвестиционная аналитика", en: "NK-Tech Finance · Investment Analytics" } satisfies Text,
  description: {
    ru: "Оценка акций, облигационные портфели и оптимизация.",
    en: "Stock valuation, bond portfolios and optimization.",
  } satisfies Text,
  developer: { ru: "NK-Tech · Никита Каев", en: "NK-Tech · Nikita Kaev" } satisfies Text,
  email: "nikitakaev25@gmail.com",
  copyright: "© 2026 NK-Tech Finance",
  slogan: { ru: "Решения в одном • решения во всём", en: "All-in-one solutions • Solutions for everything" } satisfies Text,
  disclaimer: {
    ru: "Расчёты носят информационный характер и не являются индивидуальной инвестиционной рекомендацией.",
    en: "Calculations are for information only and do not constitute individual investment advice.",
  } satisfies Text,
} as const;

export type ProductId = "site" | "tracker" | "analytics" | "finanalysis";

/** Продукты NK-Tech Finance — один и тот же список в каждом приложении. */
export const NK_PRODUCTS: ReadonlyArray<{ id: ProductId; name: Text; description: Text; platforms: Text; icon: string }> = [
  {
    id: "site",
    name: { ru: "NK-Tech Finance", en: "NK-Tech Finance" },
    description: { ru: "Рынки, новости и база знаний", en: "Markets, news and knowledge base" },
    platforms: { ru: "Веб", en: "Web" },
    icon: siteIcon,
  },
  {
    id: "tracker",
    name: { ru: "Учёт инвестиций", en: "Investment Tracker" },
    description: { ru: "Портфели, доходность, выплаты и налоги", en: "Portfolios, returns, payouts and taxes" },
    platforms: { ru: "Веб · Android · Windows · Linux", en: "Web · Android · Windows · Linux" },
    icon: trackerIcon,
  },
  {
    id: "analytics",
    name: { ru: "Инвестиционная аналитика", en: "Investment Analytics" },
    description: { ru: "Оценка акций, облигационные портфели, оптимизация", en: "Stock valuation, bond portfolios, optimization" },
    platforms: { ru: "Windows · Linux · macOS", en: "Windows · Linux · macOS" },
    icon: analyticsIcon,
  },
  {
    id: "finanalysis",
    name: { ru: "Финансово-экономический анализ", en: "Financial Analysis" },
    description: { ru: "Отчётность, прогноз и оценка компании", en: "Statements, forecasts and company valuation" },
    platforms: { ru: "Windows · Linux · macOS", en: "Windows · Linux · macOS" },
    icon: finanalysisIcon,
  },
];
