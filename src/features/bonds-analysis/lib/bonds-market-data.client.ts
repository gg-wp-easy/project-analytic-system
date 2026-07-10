import type { BondSourceRow, BondSourceSummary } from "../model/bonds-analysis.types";
import {
  DEFAULT_BONDS_LIMIT,
  SUPPORTED_BOND_CURRENCIES,
  TBANK_BOND_COUPONS_ENDPOINT,
  TBANK_BONDS_ENDPOINT,
  TBANK_BONDS_TOKEN_STORAGE_KEY,
} from "../model/bonds-analysis.consts";

type AnyRecord = Record<string, unknown>;

function pickString(source: AnyRecord, keys: string[]): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function normalizeCurrency(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === "rur") {
    return "rub";
  }
  return normalized;
}

function pickMoneyCurrency(value: unknown): string {
  if (!value || typeof value !== "object") {
    return "";
  }
  const source = value as AnyRecord;
  return normalizeCurrency(pickString(source, ["currency", "Currency"]));
}

function resolveBondCurrency(source: AnyRecord): string {
  const direct = normalizeCurrency(pickString(source, ["currency", "Currency", "settlementCurrency", "settlement_currency"]));
  if (direct) {
    return direct;
  }
  return (
    pickMoneyCurrency(source.nominal) ||
    pickMoneyCurrency(source.initialNominal) ||
    pickMoneyCurrency(source.initial_nominal) ||
    pickMoneyCurrency(source.placementPrice) ||
    pickMoneyCurrency(source.placement_price) ||
    pickMoneyCurrency(source.aciValue) ||
    pickMoneyCurrency(source.aci_value)
  );
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value === "string") {
    const normalized = value.trim().replace(/\s+/g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function pickNumber(source: AnyRecord, keys: string[], fallback = 0): number {
  for (const key of keys) {
    if (!(key in source)) {
      continue;
    }
    const parsed = toNumber(source[key], Number.NaN);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function pickBool(source: AnyRecord, keys: string[]): boolean {
  const truthy = new Set(["true", "1", "yes", "y"]);
  const falsy = new Set(["false", "0", "no", "n"]);

  for (const key of keys) {
    const value = source[key];
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "number") {
      return Boolean(value);
    }
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (truthy.has(normalized)) {
        return true;
      }
      if (falsy.has(normalized)) {
        return false;
      }
    }
  }
  return false;
}

function moneyValueToNumber(value: unknown): number {
  if (typeof value === "number" || typeof value === "string") {
    return toNumber(value, 0);
  }
  if (!value || typeof value !== "object") {
    return 0;
  }
  const quote = value as AnyRecord;
  const units = toNumber(quote.units, 0);
  const nano = toNumber(quote.nano ?? quote.nanos, 0);
  return units + nano / 1_000_000_000;
}

function parseTimestamp(value: unknown): Date | null {
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (value && typeof value === "object") {
    const ts = value as AnyRecord;
    const seconds = toNumber(ts.seconds, 0);
    const nanos = toNumber(ts.nano ?? ts.nanos, 0);
    if (seconds > 0) {
      return new Date(seconds * 1000 + nanos / 1_000_000);
    }
  }

  return null;
}

function isOfzBondIdentity(ticker: string, name: string): boolean {
  const tickerUpper = ticker.trim().toUpperCase();
  const nameLower = name.trim().toLowerCase();
  return (
    tickerUpper.startsWith("SU") ||
    tickerUpper.startsWith("OFZ") ||
    nameLower.includes("офз") ||
    nameLower.includes("ofz") ||
    nameLower.includes("федерального займа")
  );
}

function normalizeSector(rawSector: string, ticker: string, name: string): string {
  const sector = rawSector.trim().toLowerCase();
  const nameLower = name.toLowerCase();
  const isOfz = isOfzBondIdentity(ticker, name);

  if (!sector) {
    if (isOfz) {
      return "government";
    }
    if (nameLower.includes("муниц")) {
      return "municipal";
    }
    return "other";
  }

  if (isOfz) {
    return "government";
  }
  if (sector.includes("municipal") || nameLower.includes("муниц")) {
    return "municipal";
  }

  const mapping: Array<[string, string]> = [
    ["financial", "financial"],
    ["bank", "financial"],
    ["energy", "energy"],
    ["oil", "energy"],
    ["gas", "energy"],
    ["material", "materials"],
    ["metal", "materials"],
    ["industrial", "industrials"],
    ["transport", "industrials"],
    ["consumer", "consumer"],
    ["retail", "consumer"],
    ["telecom", "telecom"],
    ["communication", "telecom"],
    ["information technology", "it"],
    ["technology", "it"],
    ["utility", "utilities"],
    ["real estate", "real_estate"],
    ["health", "health_care"],
  ];

  const found = mapping.find(([needle]) => sector.includes(needle));
  return found?.[1] ?? "other";
}

function normalizeRiskLevel(source: AnyRecord, sector: string): number {
  const rawRisk = source.riskLevel ?? source.risk_level;
  if (typeof rawRisk === "number" || typeof rawRisk === "string") {
    const numeric = Math.trunc(toNumber(rawRisk, -1));
    if (numeric >= 0 && numeric <= 3) {
      return numeric;
    }

    const text = String(rawRisk).trim().toUpperCase();
    if (text.includes("LOW") || text.includes("MIN")) {
      return sector === "government" ? 0 : 1;
    }
    if (text.includes("MODERATE") || text.includes("MEDIUM")) {
      return 2;
    }
    if (text.includes("HIGH")) {
      return 3;
    }
  }

  if (sector === "government") {
    return 0;
  }
  if (pickBool(source, ["forQualInvestorFlag", "for_qual_investor_flag", "subordinatedFlag", "subordinated_flag"])) {
    return 3;
  }
  if (pickBool(source, ["floatingCouponFlag", "floating_coupon_flag", "amortizationFlag", "amortization_flag"])) {
    return 2;
  }
  if (sector === "financial") {
    return 1;
  }
  return 2;
}

async function requestJson<T>(endpoint: string, token: string, body: Record<string, unknown>): Promise<T> {
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
    throw new Error(`Не удалось загрузить облигации. Код ответа: ${response.status}.`);
  }

  return (await response.json()) as T;
}

function resolveRuntimeToken(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  const fromStorage = window.localStorage.getItem(TBANK_BONDS_TOKEN_STORAGE_KEY);
  if (fromStorage && fromStorage.trim()) {
    return fromStorage.trim();
  }
  return undefined;
}

function ensureToken(token?: string): string {
  const resolved = token?.trim() || resolveRuntimeToken();
  if (!resolved) {
    throw new Error(
      "Market data access token is not configured.",
    );
  }
  return resolved;
}

async function deriveCouponRate(
  token: string,
  bond: AnyRecord,
  nominal: number,
  paymentsPerYear: number,
): Promise<number> {
  const directRate = pickNumber(
    bond,
    ["couponRate", "coupon_rate", "couponInterestRate", "coupon_interest_rate"],
    Number.NaN,
  );
  if (Number.isFinite(directRate) && directRate > 0) {
    return Number(directRate.toFixed(4));
  }

  if (nominal <= 0 || paymentsPerYear <= 0) {
    return 0;
  }

  const instrumentId = pickString(bond, ["uid", "figi"]);
  if (!instrumentId) {
    return 0;
  }

  const from = new Date();
  const to = new Date(from);
  to.setDate(to.getDate() + 400);

  const payload = await requestJson<AnyRecord>(TBANK_BOND_COUPONS_ENDPOINT, token, {
    instrumentId,
    from: from.toISOString(),
    to: to.toISOString(),
  });

  const events = Array.isArray(payload.events) ? payload.events : [];
  for (const rawEvent of events) {
    if (!rawEvent || typeof rawEvent !== "object") {
      continue;
    }
    const event = rawEvent as AnyRecord;
    const couponAmount = moneyValueToNumber(event.payOneBond ?? event.pay_one_bond);
    if (couponAmount <= 0) {
      continue;
    }

    const couponPeriod = toNumber(event.couponPeriod ?? event.coupon_period, 0);
    const effectivePayments =
      paymentsPerYear > 0 ? paymentsPerYear : couponPeriod > 0 ? Math.max(Math.round(365 / couponPeriod), 1) : 1;
    const annualCouponRate = (couponAmount * effectivePayments / nominal) * 100;
    return Number(annualCouponRate.toFixed(4));
  }

  return 0;
}

async function mapWithConcurrency<TSource, TResult>(
  items: TSource[],
  concurrency: number,
  mapper: (item: TSource, index: number) => Promise<TResult>,
): Promise<TResult[]> {
  const results: TResult[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function buildSourceRow(token: string, rawBond: AnyRecord): Promise<BondSourceRow | null> {
  const ticker = pickString(rawBond, ["ticker", "Ticker"]);
  const name = pickString(rawBond, ["name", "Name"]) || ticker;
  const maturity = parseTimestamp(rawBond.maturityDate ?? rawBond.maturity_date);
  const currency = resolveBondCurrency(rawBond);

  if (!ticker || !maturity || !currency || !SUPPORTED_BOND_CURRENCIES.has(currency)) {
    return null;
  }
  if (maturity.getTime() <= Date.now()) {
    return null;
  }
  if (!pickBool(rawBond, ["apiTradeAvailableFlag", "api_trade_available_flag"])) {
    return null;
  }
  if (!pickBool(rawBond, ["buyAvailableFlag", "buy_available_flag"])) {
    return null;
  }

  const nominal = moneyValueToNumber(rawBond.nominal ?? rawBond.initialNominal ?? rawBond.initial_nominal) || 1000;
  const sector = normalizeSector(pickString(rawBond, ["sector", "Sector"]), ticker, name);
  const riskLevel = normalizeRiskLevel(rawBond, sector);
  const couponPaymentsPerYear = Math.trunc(toNumber(rawBond.couponQuantityPerYear ?? rawBond.coupon_quantity_per_year, 0));
  const isFloatingCoupon = pickBool(rawBond, ["floatingCouponFlag", "floating_coupon_flag"]);
  if (isFloatingCoupon) {
    return null;
  }
  const couponRate = await deriveCouponRate(token, rawBond, nominal, couponPaymentsPerYear);
  if (!Number.isFinite(couponRate) || couponRate <= 0) {
    return null;
  }

  return {
    ticker,
    name,
    sector,
    currency,
    maturity_date: maturity.toISOString().slice(0, 10),
    nominal: Number(nominal.toFixed(4)),
    risk_level: Math.min(Math.max(riskLevel, 0), 3),
    coupon_rate: couponRate,
    coupon_payments_per_year: couponPaymentsPerYear > 0 ? couponPaymentsPerYear : undefined,
    floating_coupon_flag: isFloatingCoupon,
    amortization_flag: pickBool(rawBond, ["amortizationFlag", "amortization_flag"]),
    perpetual_flag: pickBool(rawBond, ["perpetualFlag", "perpetual_flag"]),
    liquidity_flag: pickBool(rawBond, ["liquidityFlag", "liquidity_flag"]),
    issue_size: Math.trunc(toNumber(rawBond.issueSize ?? rawBond.issue_size, 0)),
    source: "market",
  };
}

export async function loadBondSourceFromClient(
  limit: number | null = DEFAULT_BONDS_LIMIT,
  token?: string,
): Promise<{ data: BondSourceRow[]; summary: BondSourceSummary }> {
  const authToken = ensureToken(token);
  const payload = await requestJson<AnyRecord>(TBANK_BONDS_ENDPOINT, authToken, {
    instrumentStatus: "INSTRUMENT_STATUS_BASE",
  });

  const instruments = Array.isArray(payload.instruments) ? payload.instruments : [];
  if (!instruments.length) {
    throw new Error("Список облигаций пуст.");
  }

  const filtered = instruments
    .filter((item): item is AnyRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    .filter((bond) => {
      const currency = resolveBondCurrency(bond);
      const maturity = parseTimestamp(bond.maturityDate ?? bond.maturity_date);
      return (
        SUPPORTED_BOND_CURRENCIES.has(currency) &&
        Boolean(maturity) &&
        (maturity?.getTime() ?? 0) > Date.now() &&
        pickBool(bond, ["apiTradeAvailableFlag", "api_trade_available_flag"]) &&
        pickBool(bond, ["buyAvailableFlag", "buy_available_flag"]) &&
        !pickBool(bond, ["floatingCouponFlag", "floating_coupon_flag"])
      );
    })
    .sort((left, right) => {
      const leftTuple = [
        Number(pickBool(left, ["liquidityFlag", "liquidity_flag"])),
        Number(!pickBool(left, ["forQualInvestorFlag", "for_qual_investor_flag"])),
        toNumber(left.issueSize ?? left.issue_size, 0),
      ];
      const rightTuple = [
        Number(pickBool(right, ["liquidityFlag", "liquidity_flag"])),
        Number(!pickBool(right, ["forQualInvestorFlag", "for_qual_investor_flag"])),
        toNumber(right.issueSize ?? right.issue_size, 0),
      ];

      if (rightTuple[0] !== leftTuple[0]) {
        return rightTuple[0] - leftTuple[0];
      }
      if (rightTuple[1] !== leftTuple[1]) {
        return rightTuple[1] - leftTuple[1];
      }
      return rightTuple[2] - leftTuple[2];
    });

  const selected =
    limit === null
      ? filtered
      : filtered.slice(0, Math.max(20, Math.min(limit, filtered.length)));
  const builtRows = await mapWithConcurrency(selected, 12, async (bond) => {
    try {
      return await buildSourceRow(authToken, bond);
    } catch {
      return null;
    }
  });

  const rows = builtRows
    .filter((row): row is BondSourceRow => Boolean(row))
    .sort((left, right) => {
      const leftTuple = [Number(Boolean(left.liquidity_flag)), left.issue_size ?? 0, left.ticker];
      const rightTuple = [Number(Boolean(right.liquidity_flag)), right.issue_size ?? 0, right.ticker];

      if (rightTuple[0] !== leftTuple[0]) {
        return rightTuple[0] - leftTuple[0];
      }
      if (rightTuple[1] !== leftTuple[1]) {
        return rightTuple[1] - leftTuple[1];
      }
      return String(rightTuple[2]).localeCompare(String(leftTuple[2]));
    });

  if (!rows.length) {
    throw new Error("Не удалось подготовить список облигаций для анализа.");
  }

  return {
    data: rows,
    summary: {
      provider: "market",
      requestedLimit: limit ?? filtered.length,
      rawBondsCount: instruments.length,
      eligibleBondsCount: filtered.length,
      loadedBondsCount: rows.length,
      couponRatesAvailableCount: rows.filter((row) => row.coupon_rate > 0).length,
    },
  };
}
