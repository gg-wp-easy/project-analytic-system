import type { TBankOption } from "../../../shared/api/tbank";
import {
  EMPTY_OPTIONS_CACHE,
  OPTIONS_CACHE_KEY,
  OPTIONS_CANDLES_ENDPOINT,
  OPTIONS_CLOSE_PRICES_ENDPOINT,
  OPTIONS_ENDPOINT,
  OPTIONS_LAST_PRICES_ENDPOINT,
} from "../model/options.consts";
import type { OptionsCache, StoredOptionRecord } from "../model/options.types";

export function normalizeStoredOption(item: unknown): TBankOption | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const raw = item as Partial<StoredOptionRecord>;
  if (typeof raw.uid !== "string" || !raw.uid.trim() || typeof raw.ticker !== "string" || !raw.ticker.trim()) {
    return null;
  }

  return {
    figi: typeof raw.figi === "string" ? raw.figi : "",
    uid: raw.uid,
    positionUid: typeof raw.positionUid === "string" ? raw.positionUid : "",
    assetUid: typeof raw.assetUid === "string" ? raw.assetUid : "",
    basicAssetUid: typeof raw.basicAssetUid === "string" ? raw.basicAssetUid : "",
    basicAssetPositionUid: typeof raw.basicAssetPositionUid === "string" ? raw.basicAssetPositionUid : "",
    ticker: raw.ticker,
    classCode: typeof raw.classCode === "string" ? raw.classCode : "",
    name: typeof raw.name === "string" ? raw.name : "",
    currency: typeof raw.currency === "string" ? raw.currency : "",
    settlementCurrency: typeof raw.settlementCurrency === "string" ? raw.settlementCurrency : "",
    assetType: typeof raw.assetType === "string" ? raw.assetType : "",
    basicAsset: typeof raw.basicAsset === "string" ? raw.basicAsset : "",
    exchange: typeof raw.exchange === "string" ? raw.exchange : "",
    lot: typeof raw.lot === "number" && Number.isFinite(raw.lot) ? raw.lot : 0,
    strikePrice:
      typeof raw.strikePrice === "number" && Number.isFinite(raw.strikePrice) ? raw.strikePrice : 0,
    expirationDate: typeof raw.expirationDate === "string" ? raw.expirationDate : "",
    firstTradeDate: "",
    lastTradeDate: "",
    direction: typeof raw.direction === "string" ? raw.direction : "",
    paymentType: "",
    style: typeof raw.style === "string" ? raw.style : "",
    settlementType: "",
    realExchange: typeof raw.realExchange === "string" ? raw.realExchange : "",
    tradingStatus: "",
    apiTradeAvailableFlag: Boolean(raw.apiTradeAvailableFlag),
    buyAvailableFlag: false,
    sellAvailableFlag: false,
    shortEnabledFlag: false,
    forIisFlag: false,
    forQualInvestorFlag: false,
    weekendFlag: false,
    blockedTcaFlag: false,
    otcFlag: false,
    requiredTests: [],
  };
}

export function toStoredOption(option: TBankOption): StoredOptionRecord {
  return {
    figi: option.figi,
    uid: option.uid,
    positionUid: option.positionUid,
    assetUid: option.assetUid,
    basicAssetUid: option.basicAssetUid,
    basicAssetPositionUid: option.basicAssetPositionUid,
    ticker: option.ticker,
    classCode: option.classCode,
    name: option.name,
    currency: option.currency,
    settlementCurrency: option.settlementCurrency,
    assetType: option.assetType,
    basicAsset: option.basicAsset,
    exchange: option.exchange,
    lot: option.lot,
    strikePrice: option.strikePrice,
    expirationDate: option.expirationDate,
    direction: option.direction,
    style: option.style,
    realExchange: option.realExchange,
    apiTradeAvailableFlag: option.apiTradeAvailableFlag,
  };
}

export function loadOptionsCacheFromStorage(): OptionsCache {
  if (typeof window === "undefined") {
    return EMPTY_OPTIONS_CACHE;
  }

  const raw = window.localStorage.getItem(OPTIONS_CACHE_KEY);
  if (!raw) {
    return EMPTY_OPTIONS_CACHE;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<OptionsCache & { options: StoredOptionRecord[] }>;
    const options = Array.isArray(parsed.options)
      ? parsed.options
          .map((item) => normalizeStoredOption(item))
          .filter((item): item is TBankOption => Boolean(item))
      : [];

    return {
      options,
      optionClosePricesByInstrumentId: parsed.optionClosePricesByInstrumentId ?? {},
      optionClosePricesMetaByUnderlyingKey: parsed.optionClosePricesMetaByUnderlyingKey ?? {},
      underlyingLastPricesByKey: parsed.underlyingLastPricesByKey ?? {},
      underlyingHistoryByKey: parsed.underlyingHistoryByKey ?? {},
      lastUpdated: typeof parsed.lastUpdated === "string" ? parsed.lastUpdated : null,
      source: {
        options: parsed.source?.options ?? OPTIONS_ENDPOINT,
        closePrices: parsed.source?.closePrices ?? OPTIONS_CLOSE_PRICES_ENDPOINT,
        lastPrices: parsed.source?.lastPrices ?? OPTIONS_LAST_PRICES_ENDPOINT,
        candles: parsed.source?.candles ?? OPTIONS_CANDLES_ENDPOINT,
      },
    };
  } catch {
    return EMPTY_OPTIONS_CACHE;
  }
}

export function saveOptionsCacheToStorage(cache: OptionsCache): void {
  if (typeof window === "undefined") {
    return;
  }

  const serializable = {
    ...cache,
    options: cache.options.map((option) => toStoredOption(option)),
  };
  window.localStorage.setItem(OPTIONS_CACHE_KEY, JSON.stringify(serializable));
}
