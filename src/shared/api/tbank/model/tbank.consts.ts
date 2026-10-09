import { platformUrl } from "../../platform";

/**
 * Данные T-Invest приходят через шлюз платформы (сервис market) по серверному токену:
 * тело запроса и ответ — как у REST API Т-Инвестиций, меняется только адрес.
 */
function tinvestMethodUrl(method: string): string {
  return platformUrl(`/market/tinvest/${method}`);
}

export const SHARES_ENDPOINT =
  tinvestMethodUrl("InstrumentsService/Shares");
export const INDICATIVES_ENDPOINT =
  tinvestMethodUrl("InstrumentsService/Indicatives");
export const CURRENCIES_ENDPOINT =
  tinvestMethodUrl("InstrumentsService/Currencies");
export const BONDS_ENDPOINT =
  tinvestMethodUrl("InstrumentsService/Bonds");
export const FUTURES_ENDPOINT =
  tinvestMethodUrl("InstrumentsService/Futures");
export const OPTIONS_ENDPOINT =
  tinvestMethodUrl("InstrumentsService/Options");
export const OPTIONS_BY_ENDPOINT =
  tinvestMethodUrl("InstrumentsService/OptionsBy");
export const OPTION_BY_ENDPOINT =
  tinvestMethodUrl("InstrumentsService/OptionBy");
export const FIND_INSTRUMENT_ENDPOINT =
  tinvestMethodUrl("InstrumentsService/FindInstrument");
export const ASSETS_ENDPOINT =
  tinvestMethodUrl("InstrumentsService/GetAssets");
export const BOND_COUPONS_ENDPOINT =
  tinvestMethodUrl("InstrumentsService/GetBondCoupons");
export const DIVIDENDS_ENDPOINT =
  tinvestMethodUrl("InstrumentsService/GetDividends");
export const ASSET_FUNDAMENTALS_ENDPOINT =
  tinvestMethodUrl("InstrumentsService/GetAssetFundamentals");
export const CLOSE_PRICES_ENDPOINT =
  tinvestMethodUrl("MarketDataService/GetClosePrices");
export const LAST_PRICES_ENDPOINT =
  tinvestMethodUrl("MarketDataService/GetLastPrices");
export const CANDLES_ENDPOINT =
  tinvestMethodUrl("MarketDataService/GetCandles");

export const MAX_ASSETS_PER_REQUEST = 30;
export const LEGACY_OPTIONS_CACHE_STORAGE_KEY = "tbank_options_cache_v1";
export const OPTIONS_CACHE_STORAGE_KEY = "tbank_options_cache_v2";
export const OPTIONS_CACHE_TTL_MS = 5 * 60 * 1000;
export const OPTIONS_CACHE_STORAGE_LIMIT_CHARS = 4_000_000;
export const OPTIONS_DISCOVERY_PARALLEL_LIMIT = 6;
export const DIVIDEND_HISTORY_PARALLEL_LIMIT = 4;
// запрос может ждать очереди к T-Invest на сервере (лимит запросов в минуту общий)
export const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;
export const OPTIONS_REQUEST_TIMEOUT_MS = 60_000;
export const OPTIONS_DISCOVERY_ASSET_TYPES = [
  "INSTRUMENT_TYPE_BOND",
  "INSTRUMENT_TYPE_SHARE",
  "INSTRUMENT_TYPE_CURRENCY",
  "INSTRUMENT_TYPE_ETF",
  "INSTRUMENT_TYPE_SP",
  "INSTRUMENT_TYPE_COMMODITY",
  "INSTRUMENT_TYPE_INDEX",
  "INSTRUMENT_TYPE_CLEARING_CERTIFICATE",
] as const;
export const OPTIONS_DISCOVERY_ERROR_PREVIEW_LIMIT = 6;
