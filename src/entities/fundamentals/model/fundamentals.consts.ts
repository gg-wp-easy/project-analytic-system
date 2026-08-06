import type { FundamentalsCache } from "./fundamentals.types";

export const FUNDAMENTALS_CACHE_KEY = "fundamentals-cache-v2";

export const FUNDAMENTALS_SHARES_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.InstrumentsService/Shares";
export const FUNDAMENTALS_ASSET_FUNDAMENTALS_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.InstrumentsService/GetAssetFundamentals";
export const FUNDAMENTALS_CLOSE_PRICES_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.MarketDataService/GetClosePrices";

export const EMPTY_FUNDAMENTALS_CACHE: FundamentalsCache = {
  shares: [],
  fundamentalsByFigi: {},
  closePricesByFigi: {},
  closePricesMetaByFigi: {},
  lastUpdated: null,
  source: {
    shares: FUNDAMENTALS_SHARES_ENDPOINT,
    assetFundamentals: FUNDAMENTALS_ASSET_FUNDAMENTALS_ENDPOINT,
    closePrices: FUNDAMENTALS_CLOSE_PRICES_ENDPOINT,
  },
};
