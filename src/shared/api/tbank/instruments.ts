const SHARES_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.InstrumentsService/Shares";
const INDICATIVES_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.InstrumentsService/Indicatives";
const BONDS_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.InstrumentsService/Bonds";
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

type AnyRecord = Record<string, unknown>;

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

  return (await response.json()) as T;
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

export function createTBankInstrumentsApi(token?: string) {
  function ensureToken(): string {
    const resolved = token?.trim() || TOKEN_FROM_CODE.trim() || resolveRuntimeToken();
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
    fetchAssetFundamentals,
    fetchClosePrices,
    fetchClosePricesByInstrumentIds,
    fetchBondCoupons,
    fetchCandles,
    endpoints: {
      shares: SHARES_ENDPOINT,
      indicatives: INDICATIVES_ENDPOINT,
      bonds: BONDS_ENDPOINT,
      bondCoupons: BOND_COUPONS_ENDPOINT,
      assetFundamentals: ASSET_FUNDAMENTALS_ENDPOINT,
      closePrices: CLOSE_PRICES_ENDPOINT,
      candles: CANDLES_ENDPOINT,
    },
  };
}
