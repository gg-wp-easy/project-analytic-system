import type { OptionsCache } from "./options.types";

export const OPTIONS_CACHE_KEY = "options-cache-v1";

export const OPTIONS_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.InstrumentsService/OptionsBy";
export const OPTIONS_CLOSE_PRICES_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.MarketDataService/GetClosePrices";
export const OPTIONS_LAST_PRICES_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.MarketDataService/GetLastPrices";
export const OPTIONS_CANDLES_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.MarketDataService/GetCandles";

export const OPTIONS_PRICE_CACHE_TTL_MS = 60 * 60 * 1000;
export const OPTIONS_HISTORY_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export const EMPTY_OPTIONS_CACHE: OptionsCache = {
  options: [],
  optionClosePricesByInstrumentId: {},
  optionClosePricesMetaByUnderlyingKey: {},
  underlyingLastPricesByKey: {},
  underlyingHistoryByKey: {},
  lastUpdated: null,
  source: {
    options: OPTIONS_ENDPOINT,
    closePrices: OPTIONS_CLOSE_PRICES_ENDPOINT,
    lastPrices: OPTIONS_LAST_PRICES_ENDPOINT,
    candles: OPTIONS_CANDLES_ENDPOINT,
  },
};
