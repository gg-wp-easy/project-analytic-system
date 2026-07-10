export const BASE_BOND_RISK_FREE_RATE = 0.155;
export const BOND_INFLATION_RATE = 0.075;
export const BOND_TAX_RATE = 0.13;
export const MIN_BONDS_IN_PORTFOLIO = 20;
export const MAX_BONDS_IN_PORTFOLIO = 50;
export const MAX_WEIGHT_PER_BOND = 0.15;
export const DEFAULT_TARGET_DURATION = 3.5;
export const DEFAULT_TARGET_YIELD = 0.12;

export const BOND_CURRENCY_PARAMS = {
  rub: { riskFreeRate: 0.155, minYield: 0.12 },
  cny: { riskFreeRate: 0.03, minYield: 0.04 },
  usd: { riskFreeRate: 0.045, minYield: 0.05 },
  eur: { riskFreeRate: 0.03, minYield: 0.035 },
} as const;

export const BOND_SECTOR_MAX_WEIGHTS: Record<string, number> = {
  government: 0.4,
  municipal: 0.25,
  financial: 0.3,
  energy: 0.25,
  materials: 0.25,
  industrials: 0.2,
  consumer: 0.2,
  telecom: 0.15,
  it: 0.1,
  utilities: 0.15,
  real_estate: 0.15,
  health_care: 0.1,
  other: 0.1,
};

export const TBANK_BONDS_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.InstrumentsService/Bonds";
export const TBANK_BOND_COUPONS_ENDPOINT =
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.InstrumentsService/GetBondCoupons";
export const TBANK_BONDS_TOKEN_STORAGE_KEY = "tbank_api_token";
export const DEFAULT_BONDS_LIMIT: number | null = null;
export const SUPPORTED_BOND_CURRENCIES = new Set(["rub", "cny", "usd", "eur"]);
