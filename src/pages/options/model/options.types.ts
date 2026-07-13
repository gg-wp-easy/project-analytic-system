import type { TBankCandle, TBankOption } from "../../../shared/api/tbank";

export type UnderlyingCategory = "all" | "security" | "commodity" | "currency" | "other";
export type OptionSideFilter = "all" | "call" | "put";
export type OptionSortField = "expirationDate" | "strikePrice";
export type OptionSortDirection = "asc" | "desc";

export type UnderlyingSummary = {
  key: string;
  label: string;
  category: Exclude<UnderlyingCategory, "all">;
  calls: number;
  puts: number;
  otherCount: number;
  tradableCount: number;
  options: TBankOption[];
  searchText: string;
};

export type StrategyOutlook = "all" | "bullish" | "bearish" | "neutral";
export type StrategyTemplateId =
  | "custom"
  | "long-call"
  | "short-call"
  | "long-put"
  | "short-put"
  | "synthetic-long"
  | "synthetic-short"
  | "bull-call-spread"
  | "bear-put-spread"
  | "bear-call-spread"
  | "bull-put-spread"
  | "long-straddle"
  | "short-straddle"
  | "long-strangle"
  | "short-strangle"
  | "long-call-butterfly"
  | "long-put-butterfly"
  | "iron-condor"
  | "iron-butterfly"
  | "call-ratio-backspread"
  | "put-ratio-backspread";

export type StrategyTemplate = {
  id: StrategyTemplateId;
  name: {
    ru: string;
    en: string;
  };
  description: {
    ru: string;
    en: string;
  };
  outlook: Exclude<StrategyOutlook, "all">;
  legs: number;
};

export type StrategyHelp = {
  thesis: {
    ru: string;
    en: string;
  };
  bestFor: {
    ru: string;
    en: string;
  };
  maxProfit: {
    ru: string;
    en: string;
  };
  maxLoss: {
    ru: string;
    en: string;
  };
  breakEven: {
    ru: string;
    en: string;
  };
  note: {
    ru: string;
    en: string;
  };
};

export type StrategyLegAction = "buy" | "sell";

export type StrategyLeg = {
  option: TBankOption;
  action: StrategyLegAction;
  quantity: number;
  premium: number | null;
};

export type StrategyDraftLeg = {
  optionUid: string;
  action: StrategyLegAction;
  quantity: number;
};

export type StrategyPayoffPoint = {
  price: number;
  pnl: number;
};

export type StrategyBuildResult = {
  template: StrategyTemplate;
  expirationKey: string;
  referenceStrike: number;
  legs: StrategyLeg[];
  payoff: StrategyPayoffPoint[];
  breakEvenPrices: number[];
  maxProfit: number | null;
  maxLoss: number | null;
  netPremium: number | null;
  warnings: string[];
};

export type ForecastDirection = "bullish" | "bearish" | "neutral";

export type TechnicalIndicatorSnapshot = {
  currentPrice: number;
  previousClose: number | null;
  priceChangePct: number | null;
  sma20: number | null;
  sma50: number | null;
  ema12: number | null;
  ema26: number | null;
  rsi14: number | null;
  macd: number | null;
  macdSignal: number | null;
  atr14: number | null;
  atrPct: number | null;
  bollingerUpper: number | null;
  bollingerMiddle: number | null;
  bollingerLower: number | null;
  bollingerPosition: number | null;
  momentum20Pct: number | null;
  realizedVolatility20Pct: number | null;
  volumeRatio20: number | null;
  trendSlope20Pct: number | null;
};

export type AssetMovementForecast = {
  direction: ForecastDirection;
  score: number;
  confidence: number;
  horizonDays: number;
  expectedMovePct: number;
  targetPrice: number;
  indicators: TechnicalIndicatorSnapshot;
  reasons: string[];
  warnings: string[];
};

export type OptionTradeRecommendation = {
  templateId: Exclude<StrategyTemplateId, "custom">;
  outlook: ForecastDirection;
  expirationKey: string;
  expirationDays: number;
  thesis: string;
  riskNote: string;
};

export type OptionGreeks = {
  impliedVolatility: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
};

export type StrategyGreeks = OptionGreeks & {
  pricedLegs: number;
  totalLegs: number;
};

export type CandleSeries = TBankCandle[];
