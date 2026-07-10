import type { CurrencyTarget } from "./market-indicatives.types";

export const MARKET_INDICATIVES_CACHE_KEY = "market-indicatives-ticker-v2";
export const MARKET_INDICATIVES_CACHE_TTL_MS = 5 * 60 * 1000;

export const MARKET_PRIORITY = [
  "IMOEX",
  "RTSI",
  "RGBI",
  "MOEXBC",
  "MOEXFN",
  "MOEXOG",
  "MOEXMM",
  "MOEXCN",
  "MOEXEU",
  "MOEXIT",
];

export const CURRENCY_TARGETS: CurrencyTarget[] = [
  { key: "usd", label: "USD/RUB", group: "currency", aliases: ["USD", "USDRUB", "USD000", "DOLLAR", "ДОЛЛАР"] },
  { key: "cny", label: "CNY/RUB", group: "currency", aliases: ["CNY", "CNYRUB", "YUAN", "ЮАН"] },
  { key: "eur", label: "EUR/RUB", group: "currency", aliases: ["EUR", "EURRUB", "EURO", "ЕВРО"] },
  { key: "aed", label: "AED/RUB", group: "currency", aliases: ["AED", "AEDRUB", "DIRHAM", "ДИРХАМ"] },
  { key: "gold", label: "GOLD", group: "metal", aliases: ["XAU", "GLD", "GOLD", "ЗОЛОТ"] },
  { key: "silver", label: "SILVER", group: "metal", aliases: ["XAG", "SLV", "SILVER", "СЕРЕБР"] },
];
