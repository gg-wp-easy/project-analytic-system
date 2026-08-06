export const SHARES_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.InstrumentsService/Shares";
export const INDICATIVES_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.InstrumentsService/Indicatives";
export const CURRENCIES_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.InstrumentsService/Currencies";
export const BONDS_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.InstrumentsService/Bonds";
export const FUTURES_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.InstrumentsService/Futures";
export const OPTIONS_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.InstrumentsService/Options";
export const OPTIONS_BY_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.InstrumentsService/OptionsBy";
export const OPTION_BY_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.InstrumentsService/OptionBy";
export const FIND_INSTRUMENT_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.InstrumentsService/FindInstrument";
export const ASSETS_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.InstrumentsService/GetAssets";
export const BOND_COUPONS_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.InstrumentsService/GetBondCoupons";
export const DIVIDENDS_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.InstrumentsService/GetDividends";
export const ASSET_FUNDAMENTALS_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.InstrumentsService/GetAssetFundamentals";
export const CLOSE_PRICES_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.MarketDataService/GetClosePrices";
export const LAST_PRICES_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.MarketDataService/GetLastPrices";
export const CANDLES_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.MarketDataService/GetCandles";

export const MAX_ASSETS_PER_REQUEST = 30;
export const TBANK_TOKEN_STORAGE_KEY = "tbank_api_token";
export const LEGACY_OPTIONS_CACHE_STORAGE_KEY = "tbank_options_cache_v1";
export const OPTIONS_CACHE_STORAGE_KEY = "tbank_options_cache_v2";
export const OPTIONS_CACHE_TTL_MS = 5 * 60 * 1000;
export const OPTIONS_CACHE_STORAGE_LIMIT_CHARS = 4_000_000;
export const OPTIONS_DISCOVERY_PARALLEL_LIMIT = 6;
export const DIVIDEND_HISTORY_PARALLEL_LIMIT = 4;
export const DEFAULT_REQUEST_TIMEOUT_MS = 20_000;
export const OPTIONS_REQUEST_TIMEOUT_MS = 35_000;
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
