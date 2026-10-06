import { APP_INFO } from "../../../shared/config/app-info";

declare const __APP_VERSION__: string;

export const ABOUT_APP_VERSION: string = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "";

export const ABOUT_BRAND = APP_INFO.brand;
export const ABOUT_APP_NAME = APP_INFO.product;
export const ABOUT_APP_DESCRIPTION = APP_INFO.description;
export const ABOUT_DEVELOPER = APP_INFO.developer;
export const ABOUT_EMAIL = APP_INFO.email;
export const ABOUT_COPYRIGHT = APP_INFO.copyright;
export const ABOUT_COMPANY_SLOGAN = APP_INFO.slogan;
export const ABOUT_DISCLAIMER = APP_INFO.disclaimer;

export const ABOUT_MODULES = [
  { ru: "Фундаментальные данные акций и предобработка", en: "Stock fundamentals and data preprocessing" },
  { ru: "Кластерный анализ, деревья решений, нейросеть и гибридный анализ", en: "Cluster analysis, decision trees, neural network and hybrid analysis" },
  { ru: "Анализ и оптимизация портфелей (Марковиц, CAPM)", en: "Portfolio analysis and optimization (Markowitz, CAPM)" },
  { ru: "Анализ индексов, товаров, облигаций и опционов", en: "Index, commodity, bond and options analysis" },
] as const;
