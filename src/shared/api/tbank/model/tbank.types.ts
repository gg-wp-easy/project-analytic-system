export type AnyRecord = Record<string, unknown>;

export type TBankShare = {
  figi: string;
  assetUid: string;
  ticker: string;
  name: string;
  lot: number;
  currency: string;
  exchange: string;
  sector?: string;
  liquidityFlag?: boolean;
  apiTradeAvailableFlag?: boolean;
  buyAvailableFlag?: boolean;
  sellAvailableFlag?: boolean;
  otcFlag?: boolean;
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

export type TBankCurrency = {
  figi: string;
  uid: string;
  ticker: string;
  name: string;
  currency: string;
  isoCurrencyName: string;
  exchange: string;
  classCode: string;
  lot: number;
  nominal: number;
  buyAvailableFlag: boolean;
  sellAvailableFlag: boolean;
  apiTradeAvailableFlag?: boolean;
  otcFlag?: boolean;
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

export type TBankAssetInstrumentReference = TBankInstrumentReference & {
  assetUid: string;
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

export type TBankLastPrice = {
  figi: string;
  instrumentUid: string;
  instrumentId: string;
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

export type TBankOptionsCachePayload = {
  savedAt: string;
  items: CachedTBankOption[];
};

export type TBankOptionsLoadTarget = {
  key: string;
  payload: Record<string, string>;
};

export type CachedTBankOption = Pick<
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
