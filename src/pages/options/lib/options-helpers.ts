import type { TBankOption } from "../../../shared/api/tbank";
import { OPTIONS_EMPTY_VALUE } from "../model";
import type {
  OptionSideFilter,
  OptionSortDirection,
  OptionSortField,
  UnderlyingCategory,
  UnderlyingSummary,
} from "../model";

export type { OptionSideFilter, OptionSortDirection, OptionSortField, UnderlyingCategory, UnderlyingSummary } from "../model";

export function getLocaleCode(locale: "ru" | "en"): string {
  return locale === "en" ? "en-US" : "ru-RU";
}

export function formatNumber(value: number | undefined, locale: "ru" | "en"): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return OPTIONS_EMPTY_VALUE;
  }

  return new Intl.NumberFormat(getLocaleCode(locale), {
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(value: string | undefined, locale: "ru" | "en"): string {
  if (!value) {
    return OPTIONS_EMPTY_VALUE;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(getLocaleCode(locale), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatTimestamp(value: string | null, locale: "ru" | "en"): string {
  if (!value) {
    return OPTIONS_EMPTY_VALUE;
  }

  return new Date(value).toLocaleString(getLocaleCode(locale));
}

export function decodeRoutePart(value: string | undefined): string {
  if (!value) {
    return "";
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function getExpirationDateKey(value: string | undefined): string {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return value.trim();
}

export function getOptionSide(option: TBankOption): "call" | "put" | "other" {
  const direction = option.direction.trim().toLowerCase();
  if (direction.includes("call")) {
    return "call";
  }
  if (direction.includes("put")) {
    return "put";
  }
  return "other";
}

export function getOptionSideLabel(side: OptionSideFilter | "other", locale: "ru" | "en"): string {
  if (side === "call") {
    return locale === "en" ? "Call" : "Колл";
  }
  if (side === "put") {
    return locale === "en" ? "Put" : "Пут";
  }
  if (side === "all") {
    return locale === "en" ? "All" : "Все";
  }
  return locale === "en" ? "Other" : "Прочее";
}

export function getOptionTypeLabel(option: TBankOption, locale: "ru" | "en"): string {
  const sideLabel = getOptionSideLabel(getOptionSide(option), locale);
  return [sideLabel, option.style].filter(Boolean).join(" / ");
}

export function getOptionExpirationDateKey(option: TBankOption): string {
  return getExpirationDateKey(option.expirationDate);
}

export function getUnderlyingCategory(option: TBankOption): Exclude<UnderlyingCategory, "all"> {
  const assetType = option.assetType.trim().toLowerCase();

  if (assetType.includes("security")) {
    return "security";
  }
  if (assetType.includes("commodity")) {
    return "commodity";
  }
  if (assetType.includes("currency")) {
    return "currency";
  }

  return "other";
}

export function getCategoryLabel(category: UnderlyingCategory, locale: "ru" | "en"): string {
  if (category === "all") {
    return locale === "en" ? "All" : "Все";
  }
  if (category === "security") {
    return locale === "en" ? "Stocks" : "Акции";
  }
  if (category === "commodity") {
    return locale === "en" ? "Commodities" : "Товары";
  }
  if (category === "currency") {
    return locale === "en" ? "Currencies" : "Валюты";
  }
  return locale === "en" ? "Other" : "Прочее";
}

export function getUnderlyingLabel(option: TBankOption): string {
  return option.basicAsset || option.assetUid || option.classCode || option.ticker || option.uid;
}

function getUnderlyingKey(option: TBankOption): string {
  const category = getUnderlyingCategory(option);
  const suffix =
    option.basicAssetPositionUid ||
    option.basicAsset ||
    option.assetUid ||
    option.classCode ||
    option.ticker ||
    option.uid;

  return `${category}::${suffix}`;
}

export function sortOptions(items: TBankOption[]): TBankOption[] {
  return [...items].sort((left, right) => {
    const leftDate = Date.parse(left.expirationDate || "") || Number.MAX_SAFE_INTEGER;
    const rightDate = Date.parse(right.expirationDate || "") || Number.MAX_SAFE_INTEGER;
    if (leftDate !== rightDate) {
      return leftDate - rightDate;
    }

    if (left.strikePrice !== right.strikePrice) {
      return left.strikePrice - right.strikePrice;
    }

    return left.ticker.localeCompare(right.ticker, "ru");
  });
}

export function sortOptionContracts(
  items: TBankOption[],
  field: OptionSortField,
  direction: OptionSortDirection,
): TBankOption[] {
  const directionMultiplier = direction === "asc" ? 1 : -1;

  return [...items].sort((left, right) => {
    if (field === "expirationDate") {
      const leftTimestamp = Date.parse(left.expirationDate || "");
      const rightTimestamp = Date.parse(right.expirationDate || "");
      const leftHasValue = Number.isFinite(leftTimestamp);
      const rightHasValue = Number.isFinite(rightTimestamp);

      if (leftHasValue !== rightHasValue) {
        return leftHasValue ? -1 : 1;
      }

      if (leftHasValue && rightHasValue && leftTimestamp !== rightTimestamp) {
        return (leftTimestamp - rightTimestamp) * directionMultiplier;
      }
    }

    if (field === "strikePrice" && left.strikePrice !== right.strikePrice) {
      return (left.strikePrice - right.strikePrice) * directionMultiplier;
    }

    const fallbackDateCompare =
      (Date.parse(left.expirationDate || "") || Number.MAX_SAFE_INTEGER) -
      (Date.parse(right.expirationDate || "") || Number.MAX_SAFE_INTEGER);
    if (fallbackDateCompare !== 0) {
      return fallbackDateCompare;
    }

    if (left.strikePrice !== right.strikePrice) {
      return left.strikePrice - right.strikePrice;
    }

    return left.ticker.localeCompare(right.ticker, "ru");
  });
}

export function buildUnderlyingSummaries(items: TBankOption[]): UnderlyingSummary[] {
  const map = new Map<string, UnderlyingSummary>();

  for (const option of items) {
    const key = getUnderlyingKey(option);
    const current = map.get(key) ?? {
      key,
      label: getUnderlyingLabel(option),
      category: getUnderlyingCategory(option),
      calls: 0,
      puts: 0,
      otherCount: 0,
      tradableCount: 0,
      options: [],
      searchText: "",
    };

    current.options.push(option);

    const side = getOptionSide(option);
    if (side === "call") {
      current.calls += 1;
    } else if (side === "put") {
      current.puts += 1;
    } else {
      current.otherCount += 1;
    }

    if (option.apiTradeAvailableFlag) {
      current.tradableCount += 1;
    }

    map.set(key, current);
  }

  return [...map.values()]
    .map((summary) => ({
      ...summary,
      options: sortOptions(summary.options),
      searchText: [
        summary.label,
        summary.category,
        ...summary.options.flatMap((option) => [
          option.ticker,
          option.name,
          option.classCode,
          option.direction,
          option.style,
        ]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    }))
    .sort((left, right) => left.label.localeCompare(right.label, "ru"));
}
