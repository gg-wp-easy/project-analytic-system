const SHARES_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.InstrumentsService/Shares";
const ASSET_FUNDAMENTALS_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.InstrumentsService/GetAssetFundamentals";
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
    peRatio: pickNumber(item, ["pe_ratio_ttm", "peRatio", "pe_ratio", "peRatioTtm"]),
    pbRatio: pickNumber(item, ["price_to_book_ttm", "pbRatio", "pb_ratio", "pb_ratio_ttm", "priceToBookTtm"]),
    psRatio: pickNumber(item, ["price_to_sales_ttm", "psRatio", "ps_ratio", "priceToSalesTtm"]),
    roe: pickNumber(item, ["roe", "roe_ttm"]),
    roa: pickNumber(item, ["roa", "roa_ttm"]),
    netMargin: pickNumber(item, ["net_margin", "netMarginMrq"]),
    netDebtToEbitda: pickNumber(item, ["net_debt_to_ebitda", "netDebtToEbitda"]),
    evToEbitda: pickNumber(item, ["ev_to_ebitda", "evToEbitdaMrq"]),
    totalDebt: totalDebtRaw > 0 ? Number((totalDebtRaw / 1_000_000_000).toFixed(2)) : 0,
    dividendYield: dividendYieldRaw > 0 ? Number(dividendYieldRaw.toFixed(2)) : 0,
    marketCapBn: marketCapRaw > 0 ? Number((marketCapRaw / 1_000_000_000).toFixed(2)) : 0,
    beta: pickNumber(item, ["beta", "five_years_beta"]).toFixed(2) as unknown as number,
    updatedAt:
      pickTimestampIso(item, ["fiscal_period_end_date", "ex_dividend_date"]) ||
      pickString(item, ["updatedAt", "updated_at", "date", "time"]) ||
      nowIso,
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

  return {
    fetchShares,
    fetchAssetFundamentals,
    endpoints: {
      shares: SHARES_ENDPOINT,
      assetFundamentals: ASSET_FUNDAMENTALS_ENDPOINT,
    },
  };
}
