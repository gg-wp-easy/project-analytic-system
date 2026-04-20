const SHARES_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.InstrumentsService/Shares";
const INDICATIVES_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.InstrumentsService/Indicatives";
const BONDS_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.InstrumentsService/Bonds";
const FUTURES_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.InstrumentsService/Futures";
const OPTIONS_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.InstrumentsService/Options";
const OPTIONS_BY_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.InstrumentsService/OptionsBy";
const OPTION_BY_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.InstrumentsService/OptionBy";
const FIND_INSTRUMENT_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.InstrumentsService/FindInstrument";
const ASSETS_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.InstrumentsService/GetAssets";
const BOND_COUPONS_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.InstrumentsService/GetBondCoupons";
const ASSET_FUNDAMENTALS_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.InstrumentsService/GetAssetFundamentals";
const CLOSE_PRICES_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.MarketDataService/GetClosePrices";
const CANDLES_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.MarketDataService/GetCandles";
const MAX_ASSETS_PER_REQUEST = 30;

const TOKEN_STORAGE_KEY = "tbank_api_token";
const TOKEN_FROM_CODE = "t.V4QVXUA5khrTJcMQNsCCDC3IfD94uJA5Yj_FpR8UfaMs3KxSY0tlIlSDe3ix6G7CcKYMbfQTNlLSWR2l1aHQjQ";
const LEGACY_OPTIONS_CACHE_STORAGE_KEY = "tbank_options_cache_v1";
const OPTIONS_CACHE_STORAGE_KEY = "tbank_options_cache_v2";
const OPTIONS_CACHE_TTL_MS = 5 * 60 * 1000;
const OPTIONS_CACHE_STORAGE_LIMIT_CHARS = 4_000_000;
const OPTIONS_DISCOVERY_PARALLEL_LIMIT = 6;
const OPTIONS_DISCOVERY_ASSET_TYPES = [
  "INSTRUMENT_TYPE_BOND",
  "INSTRUMENT_TYPE_SHARE",
  "INSTRUMENT_TYPE_CURRENCY",
  "INSTRUMENT_TYPE_ETF",
  "INSTRUMENT_TYPE_SP",
  "INSTRUMENT_TYPE_COMMODITY",
  "INSTRUMENT_TYPE_INDEX",
  "INSTRUMENT_TYPE_CLEARING_CERTIFICATE",
] as const;
const OPTIONS_DISCOVERY_ERROR_PREVIEW_LIMIT = 6;

type AnyRecord = Record<string, unknown>;
type TBankOptionsCachePayload = {
  savedAt: string;
  items: CachedTBankOption[];
};
type TBankOptionsLoadTarget = {
  key: string;
  payload: Record<string, string>;
};
type CachedTBankOption = Pick<
  TBankOption,
  | "uid"
  | "figi"
  | "positionUid"
  | "assetUid"
  | "basicAssetUid"
  | "basicAssetPositionUid"
  | "ticker"
  | "classCode"
  | "name"
  | "currency"
  | "settlementCurrency"
  | "assetType"
  | "basicAsset"
  | "exchange"
  | "lot"
  | "strikePrice"
  | "expirationDate"
  | "direction"
  | "style"
  | "realExchange"
  | "apiTradeAvailableFlag"
>;

let optionsCacheMemory: { savedAtMs: number; items: TBankOption[] } | null = null;
let optionsCacheInFlight: Promise<TBankOption[]> | null = null;

export type TBankShare = {
  figi: string;
  assetUid: string;
  ticker: string;
  name: string;
  lot: number;
  currency: string;
  exchange: string;
};

export type TBankIndicative = {
  figi: string;
  uid: string;
  ticker: string;
  name: string;
  exchange: string;
  classCode: string;
  instrumentKind: string;
  buyAvailableFlag: boolean;
  sellAvailableFlag: boolean;
};

export type TBankBond = {
  figi: string;
  uid: string;
  ticker: string;
  name: string;
  currency: string;
  sector: string;
  maturityDate: string;
  nominal: number;
  aciValue: number;
  couponQuantityPerYear: number;
  floatingCouponFlag: boolean;
  amortizationFlag: boolean;
  liquidityFlag: boolean;
};

export type TBankOption = {
  figi: string;
  uid: string;
  positionUid: string;
  assetUid: string;
  basicAssetUid: string;
  basicAssetPositionUid: string;
  ticker: string;
  classCode: string;
  name: string;
  currency: string;
  settlementCurrency: string;
  assetType: string;
  basicAsset: string;
  exchange: string;
  lot: number;
  strikePrice: number;
  expirationDate: string;
  firstTradeDate: string;
  lastTradeDate: string;
  direction: string;
  paymentType: string;
  style: string;
  settlementType: string;
  realExchange: string;
  tradingStatus: string;
  apiTradeAvailableFlag: boolean;
  buyAvailableFlag: boolean;
  sellAvailableFlag: boolean;
  shortEnabledFlag: boolean;
  forIisFlag: boolean;
  forQualInvestorFlag: boolean;
  weekendFlag: boolean;
  blockedTcaFlag: boolean;
  otcFlag: boolean;
  requiredTests: string[];
};

export type TBankInstrumentReference = {
  uid: string;
  figi: string;
  positionUid: string;
  ticker: string;
  classCode: string;
  name: string;
  instrumentType: string;
};

export type TBankOptionsByResult = {
  options: TBankOption[];
  underlying: TBankInstrumentReference | null;
  resolvedInstrumentId: string;
  requestQuery: string;
};

export type TBankFundamental = {
  figi: string;
  peRatio: number;
  pbRatio: number;
  psRatio: number;
  evToEbitda: number;
  roe: number;
  roa: number;
  netMargin: number;
  netDebtToEbitda: number;
  totalDebt: number;
  dividendYield: number;
  marketCapBn: number;
  beta: number;
  updatedAt: string;
};

export type TBankClosePrice = {
  figi: string;
  instrumentUid: string;
  ticker: string;
  classCode: string;
  price: number;
  time: string;
};

export type TBankCandle = {
  figi: string;
  time: string;
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
};

export type TBankBondCoupon = {
  figi: string;
  couponDate: string;
  couponNumber: number;
  payOneBond: number;
  couponType: string;
  couponStartDate: string;
  couponEndDate: string;
  couponPeriod: number;
};

function pickString(source: AnyRecord, keys: string[]): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return "";
}

function pickNumber(source: AnyRecord, keys: string[]): number {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return 0;
}

function pickTimestampIso(source: AnyRecord, keys: string[]): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
    if (value && typeof value === "object") {
      const ts = value as AnyRecord;
      const secondsRaw = ts.seconds;
      if (typeof secondsRaw === "number" && Number.isFinite(secondsRaw)) {
        return new Date(secondsRaw * 1000).toISOString();
      }
      if (typeof secondsRaw === "string") {
        const parsed = Number(secondsRaw);
        if (Number.isFinite(parsed)) {
          return new Date(parsed * 1000).toISOString();
        }
      }
    }
  }
  return "";
}

function roundTo(value: number, digits: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function normalizeScaledBillions(value: number): number {
  return value > 0 ? roundTo(value / 1_000_000_000, 2) : 0;
}

function normalizeRatio(value: number): number {
  return roundTo(value, 2);
}

function normalizeRate(value: number): number {
  return roundTo(value, 4);
}

function quotationToNumber(value: unknown): number {
  if (!value || typeof value !== "object") {
    return 0;
  }
  const quote = value as AnyRecord;
  const unitsRaw = quote.units;
  const nanoRaw = quote.nano;
  const units = typeof unitsRaw === "number" ? unitsRaw : Number(unitsRaw ?? 0);
  const nano = typeof nanoRaw === "number" ? nanoRaw : Number(nanoRaw ?? 0);
  if (!Number.isFinite(units) || !Number.isFinite(nano)) {
    return 0;
  }
  return units + nano / 1_000_000_000;
}

function chunkArray<T>(source: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < source.length; i += size) {
    chunks.push(source.slice(i, i + size));
  }
  return chunks;
}

async function mapWithConcurrency<T, TResult>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<TResult>,
): Promise<TResult[]> {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<TResult>(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(workers);
  return results;
}

function normalizeFundamentalItem(item: AnyRecord, nowIso: string): TBankFundamental {
  const marketCapRaw = pickNumber(item, [
    "market_capitalization",
    "marketCap",
    "market_cap",
    "marketCapitalization",
  ]);
  const totalDebtRaw = pickNumber(item, ["total_debt", "totalDebtMrq", "totalDebtmrq"]);
  const dividendYieldRaw = pickNumber(item, ["dividend_yield_daily_ttm", "dividendYield", "dividend_yield", "fiveYearsAverageDividendYield"]);

  return {
    figi: pickString(item, ["figi", "instrumentFigi", "instrument_figi"]),
    peRatio: normalizeRatio(pickNumber(item, ["pe_ratio_ttm", "peRatio", "pe_ratio", "peRatioTtm"])),
    pbRatio: normalizeRatio(pickNumber(item, ["price_to_book_ttm", "pbRatio", "pb_ratio", "pb_ratio_ttm", "priceToBookTtm"])),
    psRatio: normalizeRatio(pickNumber(item, ["price_to_sales_ttm", "psRatio", "ps_ratio", "priceToSalesTtm"])),
    roe: normalizeRate(pickNumber(item, ["roe", "roe_ttm"])),
    roa: normalizeRate(pickNumber(item, ["roa", "roa_ttm"])),
    netMargin: normalizeRate(pickNumber(item, ["net_margin", "netMarginMrq"])),
    netDebtToEbitda: normalizeRatio(pickNumber(item, ["net_debt_to_ebitda", "netDebtToEbitda"])),
    evToEbitda: normalizeRatio(pickNumber(item, ["ev_to_ebitda", "evToEbitdaMrq"])),
    totalDebt: normalizeScaledBillions(totalDebtRaw),
    dividendYield: normalizeRate(dividendYieldRaw),
    marketCapBn: normalizeScaledBillions(marketCapRaw),
    beta: normalizeRatio(pickNumber(item, ["beta", "five_years_beta"])),
    updatedAt:
      pickTimestampIso(item, ["fiscal_period_end_date", "ex_dividend_date"]) ||
      pickString(item, ["updatedAt", "updated_at", "date", "time"]) ||
      nowIso,
  };
}

function normalizeClosePriceItem(item: AnyRecord, nowIso: string): TBankClosePrice {
  return {
    figi: pickString(item, ["figi", "instrumentFigi", "instrument_figi"]),
    instrumentUid: pickString(item, ["instrument_uid", "instrumentUid", "uid"]),
    ticker: pickString(item, ["ticker"]),
    classCode: pickString(item, ["class_code", "classCode"]),
    price: quotationToNumber(item.price),
    time: pickTimestampIso(item, ["time", "timestamp", "date"]) || nowIso,
  };
}

function normalizeIndicativeItem(item: AnyRecord): TBankIndicative | null {
  const figi = pickString(item, ["figi"]);
  const uid = pickString(item, ["uid", "instrumentUid", "instrument_uid"]);
  const ticker = pickString(item, ["ticker"]);
  if (!ticker || !uid) {
    return null;
  }

  return {
    figi,
    uid,
    ticker,
    name: pickString(item, ["name"]),
    exchange: pickString(item, ["exchange"]),
    classCode: pickString(item, ["classCode", "class_code"]),
    instrumentKind: pickString(item, ["instrumentKind", "instrument_kind"]),
    buyAvailableFlag: Boolean(item.buyAvailableFlag ?? item.buy_available_flag),
    sellAvailableFlag: Boolean(item.sellAvailableFlag ?? item.sell_available_flag),
  };
}

function normalizeBondItem(item: AnyRecord, nowIso: string): TBankBond | null {
  const figi = pickString(item, ["figi"]);
  const uid = pickString(item, ["uid", "instrumentUid", "instrument_uid"]);
  const ticker = pickString(item, ["ticker"]);
  const maturityDate = pickTimestampIso(item, ["maturityDate", "maturity_date"]) || nowIso;
  if (!figi || !uid || !ticker) {
    return null;
  }

  return {
    figi,
    uid,
    ticker,
    name: pickString(item, ["name"]),
    currency: pickString(item, ["currency"]),
    sector: pickString(item, ["sector"]),
    maturityDate,
    nominal: quotationToNumber(item.nominal ?? item.initialNominal ?? item.initial_nominal),
    aciValue: quotationToNumber(item.aciValue ?? item.aci_value),
    couponQuantityPerYear: pickNumber(item, ["couponQuantityPerYear", "coupon_quantity_per_year"]),
    floatingCouponFlag: Boolean(item.floatingCouponFlag ?? item.floating_coupon_flag),
    amortizationFlag: Boolean(item.amortizationFlag ?? item.amortization_flag),
    liquidityFlag: Boolean(item.liquidityFlag ?? item.liquidity_flag),
  };
}

function normalizeInstrumentReference(item: AnyRecord): TBankInstrumentReference | null {
  const uid = pickString(item, ["uid", "instrumentUid", "instrument_uid"]);
  const figi = pickString(item, ["figi"]);
  const ticker = pickString(item, ["ticker"]);
  const classCode = pickString(item, ["classCode", "class_code"]);

  if (!uid && !figi && !(ticker && classCode)) {
    return null;
  }

  return {
    uid,
    figi,
    positionUid: pickString(item, ["positionUid", "position_uid"]),
    ticker,
    classCode,
    name: pickString(item, ["name"]),
    instrumentType: pickString(item, ["instrumentType", "instrument_type", "instrumentKind", "instrument_kind"]),
  };
}

function buildInstrumentId(instrument: TBankInstrumentReference): string {
  return instrument.uid || instrument.figi || [instrument.ticker, instrument.classCode].filter(Boolean).join("_");
}

function scoreInstrumentReference(instrument: TBankInstrumentReference, query: string): number {
  const normalizedQuery = query.trim().toLowerCase();
  const ticker = instrument.ticker.trim().toLowerCase();
  const classCode = instrument.classCode.trim().toLowerCase();
  const uid = instrument.uid.trim().toLowerCase();
  const figi = instrument.figi.trim().toLowerCase();
  const name = instrument.name.trim().toLowerCase();
  const combinedTicker = ticker && classCode ? `${ticker}_${classCode}` : "";
  const instrumentType = instrument.instrumentType.trim().toLowerCase();

  let score = 0;

  if (uid && uid === normalizedQuery) {
    score += 140;
  }
  if (figi && figi === normalizedQuery) {
    score += 130;
  }
  if (combinedTicker && combinedTicker === normalizedQuery) {
    score += 120;
  }
  if (ticker && ticker === normalizedQuery) {
    score += 110;
  }
  if (name && name === normalizedQuery) {
    score += 70;
  }

  if (instrumentType.includes("share")) {
    score += 35;
  } else if (instrumentType.includes("future")) {
    score += 30;
  } else if (instrumentType.includes("index")) {
    score += 20;
  } else if (instrumentType.includes("etf")) {
    score += 15;
  } else if (instrumentType.includes("option")) {
    score -= 200;
  }

  if (instrument.classCode) {
    score += 2;
  }
  if (instrument.uid) {
    score += 2;
  }

  return score;
}

function getErrorStatusCode(error: unknown): number | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const match = error.message.match(/T-Bank API (\d{3})\b/);
  if (!match) {
    return null;
  }

  const status = Number(match[1]);
  return Number.isFinite(status) ? status : null;
}

function shouldSkipOptionsByError(error: unknown): boolean {
  const status = getErrorStatusCode(error);
  return status === 400 || status === 404;
}

function createOptionsLoadTarget(params: {
  basicAssetUid?: string;
  basicAssetPositionUid?: string;
  keyPrefix?: string;
}): TBankOptionsLoadTarget | null {
  const normalizedAssetUid = params.basicAssetUid?.trim() ?? "";
  const normalizedPositionUid = params.basicAssetPositionUid?.trim() ?? "";
  const keyPrefix = params.keyPrefix?.trim() || "asset";

  if (!normalizedAssetUid) {
    return null;
  }

  return {
    key: normalizedPositionUid
      ? `${keyPrefix}:${normalizedAssetUid}:${normalizedPositionUid}`
      : `${keyPrefix}:${normalizedAssetUid}`,
    payload: normalizedPositionUid
      ? {
          basicAssetUid: normalizedAssetUid,
          basicAssetPositionUid: normalizedPositionUid,
        }
      : {
          basicAssetUid: normalizedAssetUid,
        },
  };
}

function createBasicAssetUidLoadTarget(value: string): TBankOptionsLoadTarget | null {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  return createOptionsLoadTarget({
    basicAssetUid: normalized,
    keyPrefix: "asset",
  });
}

function dedupeOptionsLoadTargets(targets: Array<TBankOptionsLoadTarget | null>): TBankOptionsLoadTarget[] {
  const map = new Map<string, TBankOptionsLoadTarget>();

  for (const target of targets) {
    if (!target) {
      continue;
    }

    if (!map.has(target.key)) {
      map.set(target.key, target);
    }
  }

  return [...map.values()];
}

function buildKnownOptionsLoadTargets(items: TBankOption[]): TBankOptionsLoadTarget[] {
  return dedupeOptionsLoadTargets(
    items.map((item) =>
      createOptionsLoadTarget({
        basicAssetUid: item.basicAssetUid || item.assetUid,
        basicAssetPositionUid: item.basicAssetPositionUid,
        keyPrefix: "known",
      }),
    ),
  );
}

function createFutureLoadTarget(item: AnyRecord): TBankOptionsLoadTarget | null {
  return createOptionsLoadTarget({
    basicAssetUid: pickString(item, ["assetUid", "asset_uid"]),
    basicAssetPositionUid: pickString(item, ["positionUid", "position_uid"]),
    keyPrefix: "future",
  });
}

function dedupeOptions(items: TBankOption[]): TBankOption[] {
  const byUid = new Map<string, TBankOption>();

  for (const item of items) {
    if (!item.uid) {
      continue;
    }

    const current = byUid.get(item.uid);
    if (!current) {
      byUid.set(item.uid, item);
      continue;
    }

    const currentScore =
      Number(Boolean(current.apiTradeAvailableFlag)) +
      Number(Boolean(current.buyAvailableFlag)) +
      Number(Boolean(current.sellAvailableFlag));
    const nextScore =
      Number(Boolean(item.apiTradeAvailableFlag)) +
      Number(Boolean(item.buyAvailableFlag)) +
      Number(Boolean(item.sellAvailableFlag));

    if (nextScore >= currentScore) {
      byUid.set(item.uid, item);
    }
  }

  return [...byUid.values()].sort((left, right) => {
    const assetCompare = left.basicAsset.localeCompare(right.basicAsset, "ru");
    if (assetCompare !== 0) {
      return assetCompare;
    }

    const expirationCompare =
      (Date.parse(left.expirationDate || "") || Number.MAX_SAFE_INTEGER) -
      (Date.parse(right.expirationDate || "") || Number.MAX_SAFE_INTEGER);
    if (expirationCompare !== 0) {
      return expirationCompare;
    }

    if (left.strikePrice !== right.strikePrice) {
      return left.strikePrice - right.strikePrice;
    }

    return left.ticker.localeCompare(right.ticker, "ru");
  });
}

function normalizeOptionItem(item: AnyRecord, nowIso: string): TBankOption | null {
  const uid = pickString(item, ["uid", "instrumentUid", "instrument_uid"]);
  const ticker = pickString(item, ["ticker"]);
  if (!uid || !ticker) {
    return null;
  }

  return {
    figi: pickString(item, ["figi"]),
    uid,
    positionUid: pickString(item, ["positionUid", "position_uid"]),
    assetUid: pickString(item, ["assetUid", "asset_uid"]),
    basicAssetUid: pickString(item, ["basicAssetUid", "basic_asset_uid"]),
    basicAssetPositionUid: pickString(item, ["basicAssetPositionUid", "basic_asset_position_uid"]),
    ticker,
    classCode: pickString(item, ["classCode", "class_code"]),
    name: pickString(item, ["name"]),
    currency: pickString(item, ["currency", "settlementCurrency", "settlement_currency"]),
    settlementCurrency: pickString(item, ["settlementCurrency", "settlement_currency"]),
    assetType: pickString(item, ["assetType", "asset_type"]),
    basicAsset: pickString(item, ["basicAsset", "basic_asset"]),
    exchange: pickString(item, ["exchange"]),
    lot: pickNumber(item, ["lot"]),
    strikePrice: quotationToNumber(item.strikePrice ?? item.strike_price),
    expirationDate: pickTimestampIso(item, ["expirationDate", "expiration_date", "maturityDate", "maturity_date"]) || nowIso,
    firstTradeDate: pickTimestampIso(item, ["firstTradeDate", "first_trade_date"]),
    lastTradeDate: pickTimestampIso(item, ["lastTradeDate", "last_trade_date"]),
    direction: pickString(item, ["direction"]),
    paymentType: pickString(item, ["paymentType", "payment_type"]),
    style: pickString(item, ["style"]),
    settlementType: pickString(item, ["settlementType", "settlement_type"]),
    realExchange: pickString(item, ["realExchange", "real_exchange", "exchange"]),
    tradingStatus: pickString(item, ["tradingStatus", "trading_status"]),
    apiTradeAvailableFlag: Boolean(item.apiTradeAvailableFlag ?? item.api_trade_available_flag),
    buyAvailableFlag: Boolean(item.buyAvailableFlag ?? item.buy_available_flag),
    sellAvailableFlag: Boolean(item.sellAvailableFlag ?? item.sell_available_flag),
    shortEnabledFlag: Boolean(item.shortEnabledFlag ?? item.short_enabled_flag),
    forIisFlag: Boolean(item.forIisFlag ?? item.for_iis_flag),
    forQualInvestorFlag: Boolean(item.forQualInvestorFlag ?? item.for_qual_investor_flag),
    weekendFlag: Boolean(item.weekendFlag ?? item.weekend_flag),
    blockedTcaFlag: Boolean(item.blockedTcaFlag ?? item.blocked_tca_flag),
    otcFlag: Boolean(item.otcFlag ?? item.otc_flag),
    requiredTests: Array.isArray(item.requiredTests)
      ? item.requiredTests.filter((test): test is string => typeof test === "string" && Boolean(test.trim()))
      : Array.isArray(item.required_tests)
        ? item.required_tests.filter((test): test is string => typeof test === "string" && Boolean(test.trim()))
        : [],
  };
}

function normalizeBondCouponItem(item: AnyRecord, figi: string, nowIso: string): TBankBondCoupon {
  return {
    figi: pickString(item, ["figi"]) || figi,
    couponDate: pickTimestampIso(item, ["couponDate", "coupon_date"]) || nowIso,
    couponNumber: pickNumber(item, ["couponNumber", "coupon_number"]),
    payOneBond: quotationToNumber(item.payOneBond ?? item.pay_one_bond),
    couponType: pickString(item, ["couponType", "coupon_type"]),
    couponStartDate: pickTimestampIso(item, ["couponStartDate", "coupon_start_date"]) || nowIso,
    couponEndDate: pickTimestampIso(item, ["couponEndDate", "coupon_end_date"]) || nowIso,
    couponPeriod: pickNumber(item, ["couponPeriod", "coupon_period"]),
  };
}

function normalizeCandleItem(item: AnyRecord, figi: string, nowIso: string): TBankCandle {
  return {
    figi,
    time: pickTimestampIso(item, ["time", "timestamp", "date"]) || nowIso,
    close: quotationToNumber(item.close),
    open: quotationToNumber(item.open),
    high: quotationToNumber(item.high),
    low: quotationToNumber(item.low),
    volume: pickNumber(item, ["volume"]),
  };
}

async function requestJson<T>(
  endpoint: string,
  token: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let details = "";
    try {
      details = await response.text();
    } catch {
      details = "";
    }
    throw new Error(`T-Bank API ${response.status} ${response.statusText}${details ? `: ${details}` : ""}`);
  }

  const text = await response.text();
  if (!text.trim()) {
    throw new Error(`T-Bank API returned an empty response for ${endpoint}.`);
  }

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown JSON parse error";
    throw new Error(
      `T-Bank API returned malformed JSON for ${endpoint}. ${message}`,
    );
  }
}

function resolveRuntimeToken(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const fromStorage = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  if (fromStorage && fromStorage.trim()) {
    return fromStorage.trim();
  }

  return undefined;
}

function isOptionsCacheFresh(savedAtMs: number): boolean {
  return Date.now() - savedAtMs < OPTIONS_CACHE_TTL_MS;
}

function removeOptionsCacheFromStorage(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(OPTIONS_CACHE_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_OPTIONS_CACHE_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
}

function normalizeCachedOptionItem(item: unknown): TBankOption | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const raw = item as AnyRecord;
  const uid = pickString(raw, ["uid"]);
  const ticker = pickString(raw, ["ticker"]);
  if (!uid || !ticker) {
    return null;
  }

  return {
    figi: pickString(raw, ["figi"]),
    uid,
    positionUid: pickString(raw, ["positionUid"]),
    assetUid: pickString(raw, ["assetUid"]),
    basicAssetUid: pickString(raw, ["basicAssetUid"]),
    basicAssetPositionUid: pickString(raw, ["basicAssetPositionUid"]),
    ticker,
    classCode: pickString(raw, ["classCode"]),
    name: pickString(raw, ["name"]),
    currency: pickString(raw, ["currency"]),
    settlementCurrency: pickString(raw, ["settlementCurrency"]),
    assetType: pickString(raw, ["assetType"]),
    basicAsset: pickString(raw, ["basicAsset"]),
    exchange: pickString(raw, ["exchange"]),
    lot: pickNumber(raw, ["lot"]),
    strikePrice: pickNumber(raw, ["strikePrice"]),
    expirationDate: pickString(raw, ["expirationDate"]),
    firstTradeDate: "",
    lastTradeDate: "",
    direction: pickString(raw, ["direction"]),
    paymentType: "",
    style: pickString(raw, ["style"]),
    settlementType: "",
    realExchange: pickString(raw, ["realExchange"]),
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

function loadOptionsCacheFromStorage(): { savedAtMs: number; items: TBankOption[] } | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(OPTIONS_CACHE_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<TBankOptionsCachePayload>;
    const savedAtRaw = typeof parsed.savedAt === "string" ? parsed.savedAt : "";
    const savedAtMs = Date.parse(savedAtRaw);
    const items = Array.isArray(parsed.items)
      ? parsed.items
          .map((item) => normalizeCachedOptionItem(item))
          .filter((item): item is TBankOption => Boolean(item))
      : [];

    if (!Number.isFinite(savedAtMs)) {
      removeOptionsCacheFromStorage();
      return null;
    }

    return {
      savedAtMs,
      items,
    };
  } catch {
    removeOptionsCacheFromStorage();
    return null;
  }
}

function saveOptionsCacheToStorage(items: TBankOption[]): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const payload: TBankOptionsCachePayload = {
      savedAt: new Date().toISOString(),
      items: items.map((item) => ({
        figi: item.figi,
        uid: item.uid,
        positionUid: item.positionUid,
        assetUid: item.assetUid,
        basicAssetUid: item.basicAssetUid,
        basicAssetPositionUid: item.basicAssetPositionUid,
        ticker: item.ticker,
        classCode: item.classCode,
        name: item.name,
        currency: item.currency,
        settlementCurrency: item.settlementCurrency,
        assetType: item.assetType,
        basicAsset: item.basicAsset,
        exchange: item.exchange,
        lot: item.lot,
        strikePrice: item.strikePrice,
        expirationDate: item.expirationDate,
        direction: item.direction,
        style: item.style,
        realExchange: item.realExchange,
        apiTradeAvailableFlag: item.apiTradeAvailableFlag,
      })),
    };
    const serialized = JSON.stringify(payload);
    if (serialized.length > OPTIONS_CACHE_STORAGE_LIMIT_CHARS) {
      removeOptionsCacheFromStorage();
      return;
    }

    window.localStorage.setItem(OPTIONS_CACHE_STORAGE_KEY, serialized);
    window.localStorage.removeItem(LEGACY_OPTIONS_CACHE_STORAGE_KEY);
  } catch {
    // Ignore storage write failures so network requests continue to work.
  }
}

export function createTBankInstrumentsApi(token?: string) {
  function ensureToken(): string {
    const resolved = token?.trim() || resolveRuntimeToken() || TOKEN_FROM_CODE.trim();
    if (!resolved) {
      throw new Error(
        `T-Bank token is not set. Pass token to createTBankInstrumentsApi(token), set TOKEN_FROM_CODE, or set localStorage['${TOKEN_STORAGE_KEY}']`,
      );
    }
    return resolved;
  }

  async function fetchShares(): Promise<TBankShare[]> {
    const authToken = ensureToken();
    const payload = await requestJson<AnyRecord>(SHARES_ENDPOINT, authToken, {
      instrumentStatus: "INSTRUMENT_STATUS_BASE",
    });

    const instruments =
      (Array.isArray(payload.instruments) && payload.instruments) ||
      (Array.isArray(payload.shares) && payload.shares) ||
      [];

    return instruments
      .map((raw) => {
        const item = (raw ?? {}) as AnyRecord;
        const figi = pickString(item, ["figi"]);
        const assetUid = pickString(item, ["assetUid", "asset_uid"]);
        const ticker = pickString(item, ["ticker"]);
        if (!figi || !ticker || !assetUid) {
          return null;
        }

        return {
          figi,
          assetUid,
          ticker,
          name: pickString(item, ["name"]),
          lot: pickNumber(item, ["lot"]),
          currency: pickString(item, ["currency"]),
          exchange: pickString(item, ["exchange", "realExchange", "real_exchange"]),
        } satisfies TBankShare;
      })
      .filter((share): share is TBankShare => Boolean(share))
      .filter((share) => share.currency.toUpperCase() === "RUB");
  }

  async function fetchIndicatives(): Promise<TBankIndicative[]> {
    const authToken = ensureToken();
    const payload = await requestJson<AnyRecord>(INDICATIVES_ENDPOINT, authToken, {});
    const instruments =
      (Array.isArray(payload.instruments) && payload.instruments) ||
      (Array.isArray(payload.items) && payload.items) ||
      (Array.isArray(payload.data) && payload.data) ||
      [];

    return instruments
      .map((raw) => normalizeIndicativeItem((raw ?? {}) as AnyRecord))
      .filter((item): item is TBankIndicative => Boolean(item));
  }

  async function fetchBonds(): Promise<TBankBond[]> {
    const authToken = ensureToken();
    const payload = await requestJson<AnyRecord>(BONDS_ENDPOINT, authToken, {
      instrumentStatus: "INSTRUMENT_STATUS_BASE",
    });

    const instruments =
      (Array.isArray(payload.instruments) && payload.instruments) ||
      (Array.isArray(payload.bonds) && payload.bonds) ||
      (Array.isArray(payload.items) && payload.items) ||
      (Array.isArray(payload.data) && payload.data) ||
      [];

    const nowIso = new Date().toISOString();
    return instruments
      .map((raw) => normalizeBondItem((raw ?? {}) as AnyRecord, nowIso))
      .filter((bond): bond is TBankBond => Boolean(bond));
  }

  async function fetchOptions(params?: { force?: boolean }): Promise<TBankOption[]> {
    const force = Boolean(params?.force);
    const staleCache = loadOptionsCacheFromStorage();

    if (!force && optionsCacheMemory && isOptionsCacheFresh(optionsCacheMemory.savedAtMs)) {
      return optionsCacheMemory.items;
    }

    if (!force) {
      const cached = loadOptionsCacheFromStorage();
      if (cached && isOptionsCacheFresh(cached.savedAtMs)) {
        optionsCacheMemory = cached;
        return cached.items;
      }
    }

    if (!force && optionsCacheInFlight) {
      return optionsCacheInFlight;
    }

    const authToken = ensureToken();
    const loadOptionsFromApi = async (): Promise<TBankOption[]> => {
      const knownTargets = buildKnownOptionsLoadTargets(
        optionsCacheMemory?.items.length ? optionsCacheMemory.items : staleCache?.items ?? [],
      );
      const discoveredTargets = await (async () => {
        const assetResults = await Promise.allSettled(
          OPTIONS_DISCOVERY_ASSET_TYPES.map(async (instrumentType) => {
            const payload = await requestJson<AnyRecord>(ASSETS_ENDPOINT, authToken, {
              instrumentType,
              instrumentStatus: "INSTRUMENT_STATUS_BASE",
            });
            const assets =
              (Array.isArray(payload.assets) && payload.assets) ||
              (Array.isArray(payload.items) && payload.items) ||
              (Array.isArray(payload.data) && payload.data) ||
              [];

            return assets.map((raw) => {
              const item = (raw ?? {}) as AnyRecord;
              const assetUid = pickString(item, ["uid", "assetUid", "asset_uid"]);
              return createBasicAssetUidLoadTarget(assetUid);
            });
          }),
        );

        const futureResult = await Promise.allSettled([
          (async () => {
            const payload = await requestJson<AnyRecord>(FUTURES_ENDPOINT, authToken, {
              instrumentStatus: "INSTRUMENT_STATUS_BASE",
            });
            const instruments =
              (Array.isArray(payload.instruments) && payload.instruments) ||
              (Array.isArray(payload.futures) && payload.futures) ||
              (Array.isArray(payload.items) && payload.items) ||
              (Array.isArray(payload.data) && payload.data) ||
              [];

            return instruments.map((raw) => createFutureLoadTarget((raw ?? {}) as AnyRecord));
          })(),
        ]);

        const targets = dedupeOptionsLoadTargets([
          ...knownTargets,
          ...assetResults.flatMap((result) => (result.status === "fulfilled" ? result.value : [])),
          ...futureResult.flatMap((result) => (result.status === "fulfilled" ? result.value : [])),
        ]);

        if (targets.length > 0) {
          return targets;
        }

        const discoveryErrors = [
          ...assetResults.flatMap((result) =>
            result.status === "rejected"
              ? [result.reason instanceof Error ? result.reason.message : String(result.reason)]
              : [],
          ),
          ...futureResult.flatMap((result) =>
            result.status === "rejected"
              ? [result.reason instanceof Error ? result.reason.message : String(result.reason)]
              : [],
          ),
        ].filter(Boolean);

        throw new Error(
          discoveryErrors.slice(0, OPTIONS_DISCOVERY_ERROR_PREVIEW_LIMIT).join(" | ") ||
            "T-Bank did not return any option discovery targets.",
        );
      })();

      if (discoveredTargets.length === 0) {
        return [];
      }

      const optionBuckets = await mapWithConcurrency(
        discoveredTargets,
        OPTIONS_DISCOVERY_PARALLEL_LIMIT,
        async (target) => {
          try {
            const payload = await requestJson<AnyRecord>(OPTIONS_BY_ENDPOINT, authToken, target.payload);
            const instruments =
              (Array.isArray(payload.instruments) && payload.instruments) ||
              (Array.isArray(payload.options) && payload.options) ||
              (Array.isArray(payload.items) && payload.items) ||
              (Array.isArray(payload.data) && payload.data) ||
              [];

            const nowIso = new Date().toISOString();
            return {
              items: instruments
                .map((raw) => normalizeOptionItem((raw ?? {}) as AnyRecord, nowIso))
                .filter((option): option is TBankOption => Boolean(option)),
              errorMessage: "",
            };
          } catch (error) {
            if (shouldSkipOptionsByError(error)) {
              return { items: [], errorMessage: "" };
            }

            return {
              items: [],
              errorMessage:
                error instanceof Error
                  ? `${target.key}: ${error.message}`
                  : `${target.key}: ${String(error)}`,
            };
          }
        },
      );

      const items = dedupeOptions(optionBuckets.flatMap((bucket) => bucket.items));
      const optionErrors = optionBuckets
        .map((bucket) => bucket.errorMessage)
        .filter((message): message is string => Boolean(message));

      if (items.length === 0 && optionErrors.length > 0) {
        throw new Error(optionErrors.slice(0, OPTIONS_DISCOVERY_ERROR_PREVIEW_LIMIT).join(" | "));
      }

      if (items.length === 0 && staleCache?.items.length) {
        throw new Error("T-Bank chunked refresh returned an empty option list.");
      }

      optionsCacheMemory = {
        savedAtMs: Date.now(),
        items,
      };
      saveOptionsCacheToStorage(items);

      return items;
    };

    optionsCacheInFlight = (async () => {
      try {
        return await loadOptionsFromApi();
      } catch (firstError) {
        try {
          return await loadOptionsFromApi();
        } catch (secondError) {
          if (staleCache?.items.length) {
            optionsCacheMemory = staleCache;
            return staleCache.items;
          }

          const errors = [firstError, secondError]
            .map((error) => (error instanceof Error ? error.message : String(error)))
            .filter(Boolean);
          const preview = errors.slice(0, OPTIONS_DISCOVERY_ERROR_PREVIEW_LIMIT).join(" | ");
          throw new Error(preview || (secondError instanceof Error ? secondError.message : String(firstError)));
        }
      }
    })().finally(() => {
      optionsCacheInFlight = null;
    });

    return optionsCacheInFlight;
  }

  async function findInstrumentReferences(query: string): Promise<TBankInstrumentReference[]> {
    const authToken = ensureToken();
    const payload = await requestJson<AnyRecord>(FIND_INSTRUMENT_ENDPOINT, authToken, {
      query,
      apiTradeAvailableFlag: true,
    });

    const instruments =
      (Array.isArray(payload.instruments) && payload.instruments) ||
      (Array.isArray(payload.items) && payload.items) ||
      (Array.isArray(payload.data) && payload.data) ||
      [];

    return instruments
      .map((raw) => normalizeInstrumentReference((raw ?? {}) as AnyRecord))
      .filter((item): item is TBankInstrumentReference => Boolean(item));
  }

  async function fetchOptionsBy(params: {
    query: string;
  }): Promise<TBankOptionsByResult> {
    const authToken = ensureToken();
    const normalizedQuery = params.query.trim();
    if (!normalizedQuery) {
      throw new Error("Base instrument query is required for T-Bank options.");
    }

    let underlying: TBankInstrumentReference | null = null;
    const candidateIds: string[] = [];

    if (!normalizedQuery.includes("_")) {
      const references = await findInstrumentReferences(normalizedQuery);
      if (references.length > 0) {
        underlying = [...references].sort((left, right) => {
          const scoreDiff =
            scoreInstrumentReference(right, normalizedQuery) - scoreInstrumentReference(left, normalizedQuery);
          if (scoreDiff !== 0) {
            return scoreDiff;
          }

          return left.name.localeCompare(right.name, "ru");
        })[0] ?? null;
      }
    }

    const resolvedFromUnderlying = underlying ? buildInstrumentId(underlying) : "";
    if (resolvedFromUnderlying) {
      candidateIds.push(resolvedFromUnderlying);
    }
    if (!candidateIds.includes(normalizedQuery)) {
      candidateIds.push(normalizedQuery);
    }

    let lastError: Error | null = null;
    for (const basicInstrumentId of candidateIds) {
      try {
        const payload = await requestJson<AnyRecord>(OPTIONS_BY_ENDPOINT, authToken, {
          basicInstrumentId,
        });

        const instruments =
          (Array.isArray(payload.instruments) && payload.instruments) ||
          (Array.isArray(payload.options) && payload.options) ||
          (Array.isArray(payload.items) && payload.items) ||
          (Array.isArray(payload.data) && payload.data) ||
          [];

        const nowIso = new Date().toISOString();
        const options = instruments
          .map((raw) => normalizeOptionItem((raw ?? {}) as AnyRecord, nowIso))
          .filter((option): option is TBankOption => Boolean(option));

        return {
          options,
          underlying,
          resolvedInstrumentId: basicInstrumentId,
          requestQuery: normalizedQuery,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    if (!underlying && !normalizedQuery.includes("_")) {
      throw new Error(
        `T-Bank did not resolve a base instrument for "${normalizedQuery}". Try UID, FIGI, or ticker_classCode like SBER_TQBR.`,
      );
    }

    throw lastError ?? new Error("Failed to load options from T-Bank.");
  }

  async function fetchOptionBy(params: {
    id: string;
    idType?: "INSTRUMENT_ID_TYPE_FIGI" | "INSTRUMENT_ID_TYPE_TICKER" | "INSTRUMENT_ID_TYPE_UID" | "INSTRUMENT_ID_TYPE_POSITION_UID";
    classCode?: string;
  }): Promise<TBankOption> {
    const authToken = ensureToken();
    const payload = await requestJson<AnyRecord>(OPTION_BY_ENDPOINT, authToken, {
      idType: params.idType ?? "INSTRUMENT_ID_TYPE_UID",
      id: params.id,
      classCode: params.classCode,
    });

    const rawInstrument = payload.instrument ?? payload.option;
    if (!rawInstrument || typeof rawInstrument !== "object") {
      throw new Error("T-Bank API did not return option details.");
    }

    const normalized = normalizeOptionItem(rawInstrument as AnyRecord, new Date().toISOString());
    if (!normalized) {
      throw new Error("T-Bank API returned an invalid option payload.");
    }

    return normalized;
  }

  async function fetchAssetFundamentals(shares: TBankShare[]): Promise<Record<string, TBankFundamental>> {
    const authToken = ensureToken();
    const assetUidToFigi = shares.reduce<Record<string, string>>((acc, share) => {
      if (share.assetUid) {
        acc[share.assetUid] = share.figi;
      }
      return acc;
    }, {});

    const uniqueAssetUids = [...new Set(shares.map((share) => share.assetUid).filter(Boolean))];
    if (uniqueAssetUids.length === 0) {
      return {};
    }

    const result: Record<string, TBankFundamental> = {};
    const chunks = chunkArray(uniqueAssetUids, MAX_ASSETS_PER_REQUEST);

    for (const chunk of chunks) {
      const payload = await requestJson<AnyRecord>(ASSET_FUNDAMENTALS_ENDPOINT, authToken, {
        assets: chunk,
      });

      const rawItems =
        (Array.isArray(payload.fundamentals) && payload.fundamentals) ||
        (Array.isArray(payload.items) && payload.items) ||
        (Array.isArray(payload.assetFundamentals) && payload.assetFundamentals) ||
        (Array.isArray(payload.data) && payload.data) ||
        [];

      const nowIso = new Date().toISOString();
      for (const raw of rawItems) {
        const item = (raw ?? {}) as AnyRecord;
        const normalized = normalizeFundamentalItem(item, nowIso);
        const assetUid = pickString(item, ["assetUid", "asset_uid"]);
        const figi = normalized.figi || (assetUid ? assetUidToFigi[assetUid] : "");
        if (figi) {
          result[figi] = { ...normalized, figi };
        }
      }
    }

    return result;
  }

  async function fetchClosePricesByInstrumentIds(
    instrumentIds: string[],
  ): Promise<Record<string, TBankClosePrice[]>> {
    const authToken = ensureToken();
    const instruments = instrumentIds
      .filter((instrumentId) => Boolean(instrumentId))
      .map((instrumentId) => ({ instrumentId }));

    if (instruments.length === 0) {
      return {};
    }

    const result: Record<string, TBankClosePrice[]> = {};
    const chunks = chunkArray(instruments, MAX_ASSETS_PER_REQUEST);

    for (const chunk of chunks) {
      const payload = await requestJson<AnyRecord>(CLOSE_PRICES_ENDPOINT, authToken, {
        instruments: chunk,
      });

      const rawItems =
        (Array.isArray(payload.close_prices) && payload.close_prices) ||
        (Array.isArray(payload.closePrices) && payload.closePrices) ||
        (Array.isArray(payload.items) && payload.items) ||
        (Array.isArray(payload.data) && payload.data) ||
        [];

      const nowIso = new Date().toISOString();
      for (const raw of rawItems) {
        const item = (raw ?? {}) as AnyRecord;
        const normalized = normalizeClosePriceItem(item, nowIso);
        const figi = normalized.figi;
        if (!figi) {
          continue;
        }
        if (!result[figi]) {
          result[figi] = [];
        }
        result[figi].push({ ...normalized, figi });
      }
    }

    return result;
  }

  async function fetchClosePrices(shares: TBankShare[]): Promise<Record<string, TBankClosePrice[]>> {
    return fetchClosePricesByInstrumentIds(shares.map((share) => share.figi));
  }

  async function fetchBondCoupons(params: {
    instrumentId: string;
    from: string;
    to: string;
  }): Promise<TBankBondCoupon[]> {
    const authToken = ensureToken();
    const payload = await requestJson<AnyRecord>(BOND_COUPONS_ENDPOINT, authToken, {
      instrumentId: params.instrumentId,
      from: params.from,
      to: params.to,
    });

    const rawItems =
      (Array.isArray(payload.events) && payload.events) ||
      (Array.isArray(payload.items) && payload.items) ||
      (Array.isArray(payload.data) && payload.data) ||
      [];

    const nowIso = new Date().toISOString();
    return rawItems.map((raw) =>
      normalizeBondCouponItem((raw ?? {}) as AnyRecord, params.instrumentId, nowIso),
    );
  }

  async function fetchCandles(params: {
    figi: string;
    from: string;
    to: string;
    interval?: string;
    limit?: number;
  }): Promise<TBankCandle[]> {
    const authToken = ensureToken();
    const payload = await requestJson<AnyRecord>(CANDLES_ENDPOINT, authToken, {
      instrumentId: params.figi,
      from: params.from,
      to: params.to,
      interval: params.interval ?? "CANDLE_INTERVAL_DAY",
      limit: params.limit,
    });

    const rawItems =
      (Array.isArray(payload.candles) && payload.candles) ||
      (Array.isArray(payload.items) && payload.items) ||
      (Array.isArray(payload.data) && payload.data) ||
      [];

    const nowIso = new Date().toISOString();
    return rawItems.map((raw) => normalizeCandleItem((raw ?? {}) as AnyRecord, params.figi, nowIso));
  }

  return {
    fetchShares,
    fetchIndicatives,
    fetchBonds,
    fetchOptions,
    fetchOptionsBy,
    fetchOptionBy,
    fetchAssetFundamentals,
    fetchClosePrices,
    fetchClosePricesByInstrumentIds,
    fetchBondCoupons,
    fetchCandles,
    endpoints: {
      shares: SHARES_ENDPOINT,
      indicatives: INDICATIVES_ENDPOINT,
      bonds: BONDS_ENDPOINT,
      futures: FUTURES_ENDPOINT,
      options: OPTIONS_ENDPOINT,
      optionsBy: OPTIONS_BY_ENDPOINT,
      optionBy: OPTION_BY_ENDPOINT,
      findInstrument: FIND_INSTRUMENT_ENDPOINT,
      assets: ASSETS_ENDPOINT,
      bondCoupons: BOND_COUPONS_ENDPOINT,
      assetFundamentals: ASSET_FUNDAMENTALS_ENDPOINT,
      closePrices: CLOSE_PRICES_ENDPOINT,
      candles: CANDLES_ENDPOINT,
    },
  };
}
