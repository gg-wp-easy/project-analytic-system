export type FundamentalMetricKey =
  | "marketCapBn"
  | "peRatio"
  | "pbRatio"
  | "psRatio"
  | "evToEbitda"
  | "roe"
  | "roa"
  | "netMargin"
  | "netDebtToEbitda"
  | "totalDebt"
  | "dividendYield"
  | "beta";

type AppLocaleCode = "ru" | "en";

function resolveLocale(appLocale: AppLocaleCode): string {
  return appLocale === "en" ? "en-US" : "ru-RU";
}

function formatLocaleNumber(
  value: number,
  appLocale: AppLocaleCode,
  options: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(resolveLocale(appLocale), options).format(value);
}

function normalizePercentForDisplay(value: number): number {
  return Math.abs(value) <= 1 ? value * 100 : value;
}

function formatScaledValue(value: number, appLocale: AppLocaleCode): string {
  const abs = Math.abs(value);
  return formatLocaleNumber(value, appLocale, {
    minimumFractionDigits: abs < 10 ? 2 : 0,
    maximumFractionDigits: abs >= 100 ? 0 : abs >= 10 ? 1 : 2,
  });
}

function formatRatioValue(value: number, appLocale: AppLocaleCode): string {
  const abs = Math.abs(value);
  return formatLocaleNumber(value, appLocale, {
    minimumFractionDigits: abs < 10 ? 2 : 0,
    maximumFractionDigits: abs >= 100 ? 1 : 2,
  });
}

function formatPercentValue(value: number, appLocale: AppLocaleCode): string {
  const normalized = normalizePercentForDisplay(value);
  const abs = Math.abs(normalized);
  return `${formatLocaleNumber(normalized, appLocale, {
    minimumFractionDigits: abs < 10 ? 2 : 1,
    maximumFractionDigits: 2,
  })}%`;
}

export function formatFundamentalMetricValue(
  metric: FundamentalMetricKey,
  value: number | null | undefined,
  appLocale: AppLocaleCode,
): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }

  switch (metric) {
    case "marketCapBn":
    case "totalDebt":
      return formatScaledValue(value, appLocale);
    case "roe":
    case "roa":
    case "netMargin":
    case "dividendYield":
      return formatPercentValue(value, appLocale);
    case "peRatio":
    case "pbRatio":
    case "psRatio":
    case "evToEbitda":
    case "netDebtToEbitda":
    case "beta":
      return formatRatioValue(value, appLocale);
    default:
      return formatRatioValue(value, appLocale);
  }
}
