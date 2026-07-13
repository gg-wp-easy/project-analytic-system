import type { TBankOption } from "../../../shared/api/tbank";
import { DAYS_IN_YEAR, MAX_OPTION_VOLATILITY, MIN_OPTION_VOLATILITY } from "../model";
import type { OptionGreeks, StrategyGreeks, StrategyLeg } from "../model";
import { getOptionSide } from "./options-helpers";

export type { OptionGreeks, StrategyGreeks } from "../model";

function erf(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value);
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x));
  return sign * y;
}

function normalCdf(value: number): number {
  return 0.5 * (1 + erf(value / Math.SQRT2));
}

function normalPdf(value: number): number {
  return Math.exp(-0.5 * value * value) / Math.sqrt(2 * Math.PI);
}

function getYearsToExpiration(option: TBankOption, valuationDate = new Date()): number {
  const expirationMs = Date.parse(option.expirationDate);
  if (!Number.isFinite(expirationMs)) {
    return 0;
  }

  const diffMs = expirationMs - valuationDate.getTime();
  return Math.max(diffMs / (DAYS_IN_YEAR * 24 * 60 * 60 * 1000), 1 / DAYS_IN_YEAR);
}

function getD1(params: {
  underlyingPrice: number;
  strikePrice: number;
  riskFreeRate: number;
  timeToExpiration: number;
  volatility: number;
}): number {
  const { underlyingPrice, strikePrice, riskFreeRate, timeToExpiration, volatility } = params;
  return (
    (Math.log(underlyingPrice / strikePrice) + (riskFreeRate + 0.5 * volatility * volatility) * timeToExpiration) /
    (volatility * Math.sqrt(timeToExpiration))
  );
}

function getBlackScholesPrice(params: {
  side: "call" | "put";
  underlyingPrice: number;
  strikePrice: number;
  riskFreeRate: number;
  timeToExpiration: number;
  volatility: number;
}): number {
  const { side, underlyingPrice, strikePrice, riskFreeRate, timeToExpiration, volatility } = params;
  const d1 = getD1({ underlyingPrice, strikePrice, riskFreeRate, timeToExpiration, volatility });
  const d2 = d1 - volatility * Math.sqrt(timeToExpiration);
  const discountedStrike = strikePrice * Math.exp(-riskFreeRate * timeToExpiration);

  if (side === "call") {
    return underlyingPrice * normalCdf(d1) - discountedStrike * normalCdf(d2);
  }

  return discountedStrike * normalCdf(-d2) - underlyingPrice * normalCdf(-d1);
}

function getIntrinsicValue(side: "call" | "put", underlyingPrice: number, strikePrice: number): number {
  return side === "call"
    ? Math.max(underlyingPrice - strikePrice, 0)
    : Math.max(strikePrice - underlyingPrice, 0);
}

function solveImpliedVolatility(params: {
  side: "call" | "put";
  optionPremium: number;
  underlyingPrice: number;
  strikePrice: number;
  riskFreeRate: number;
  timeToExpiration: number;
}): number | null {
  const { side, optionPremium, underlyingPrice, strikePrice, riskFreeRate, timeToExpiration } = params;
  if (
    optionPremium <= 0 ||
    underlyingPrice <= 0 ||
    strikePrice <= 0 ||
    timeToExpiration <= 0 ||
    optionPremium < getIntrinsicValue(side, underlyingPrice, strikePrice) - 1e-8
  ) {
    return null;
  }

  let low = MIN_OPTION_VOLATILITY;
  let high = MAX_OPTION_VOLATILITY;
  let lowPrice = getBlackScholesPrice({
    side,
    underlyingPrice,
    strikePrice,
    riskFreeRate,
    timeToExpiration,
    volatility: low,
  });
  const highPrice = getBlackScholesPrice({
    side,
    underlyingPrice,
    strikePrice,
    riskFreeRate,
    timeToExpiration,
    volatility: high,
  });

  if (optionPremium <= lowPrice) {
    return low;
  }
  if (optionPremium > highPrice) {
    return null;
  }

  for (let index = 0; index < 80; index += 1) {
    const mid = (low + high) / 2;
    const price = getBlackScholesPrice({
      side,
      underlyingPrice,
      strikePrice,
      riskFreeRate,
      timeToExpiration,
      volatility: mid,
    });

    if (Math.abs(price - optionPremium) < 1e-6) {
      return mid;
    }

    if (price > optionPremium) {
      high = mid;
    } else {
      low = mid;
      lowPrice = price;
    }
  }

  return Number.isFinite(lowPrice) ? (low + high) / 2 : null;
}

export function calculateOptionGreeks(params: {
  option: TBankOption;
  optionPremium: number | null;
  underlyingPrice: number | null;
  riskFreeRate: number;
  valuationDate?: Date;
}): OptionGreeks | null {
  const side = getOptionSide(params.option);
  if (side !== "call" && side !== "put") {
    return null;
  }

  const underlyingPrice = params.underlyingPrice ?? 0;
  const optionPremium = params.optionPremium ?? 0;
  const strikePrice = params.option.strikePrice;
  const timeToExpiration = getYearsToExpiration(params.option, params.valuationDate);

  if (underlyingPrice <= 0 || optionPremium <= 0 || strikePrice <= 0 || timeToExpiration <= 0) {
    return null;
  }

  const impliedVolatility = solveImpliedVolatility({
    side,
    optionPremium,
    underlyingPrice,
    strikePrice,
    riskFreeRate: params.riskFreeRate,
    timeToExpiration,
  });
  if (!impliedVolatility) {
    return null;
  }

  const sqrtTime = Math.sqrt(timeToExpiration);
  const d1 = getD1({
    underlyingPrice,
    strikePrice,
    riskFreeRate: params.riskFreeRate,
    timeToExpiration,
    volatility: impliedVolatility,
  });
  const d2 = d1 - impliedVolatility * sqrtTime;
  const pdfD1 = normalPdf(d1);
  const discountedStrike = strikePrice * Math.exp(-params.riskFreeRate * timeToExpiration);

  const delta = side === "call" ? normalCdf(d1) : normalCdf(d1) - 1;
  const gamma = pdfD1 / (underlyingPrice * impliedVolatility * sqrtTime);
  const vega = (underlyingPrice * pdfD1 * sqrtTime) / 100;
  const thetaAnnual =
    side === "call"
      ? -(underlyingPrice * pdfD1 * impliedVolatility) / (2 * sqrtTime) -
        params.riskFreeRate * discountedStrike * normalCdf(d2)
      : -(underlyingPrice * pdfD1 * impliedVolatility) / (2 * sqrtTime) +
        params.riskFreeRate * discountedStrike * normalCdf(-d2);
  const rho =
    side === "call"
      ? (discountedStrike * timeToExpiration * normalCdf(d2)) / 100
      : (-discountedStrike * timeToExpiration * normalCdf(-d2)) / 100;

  return {
    impliedVolatility,
    delta,
    gamma,
    theta: thetaAnnual / DAYS_IN_YEAR,
    vega,
    rho,
  };
}

export function calculateStrategyGreeks(params: {
  legs: StrategyLeg[];
  underlyingPrice: number | null;
  riskFreeRate: number;
}): StrategyGreeks | null {
  if (!params.legs.length || !params.underlyingPrice) {
    return null;
  }

  let pricedLegs = 0;
  let pricedQuantity = 0;
  const total = params.legs.reduce<OptionGreeks>(
    (sum, leg) => {
      const greeks = calculateOptionGreeks({
        option: leg.option,
        optionPremium: leg.premium,
        underlyingPrice: params.underlyingPrice,
        riskFreeRate: params.riskFreeRate,
      });
      if (!greeks) {
        return sum;
      }

      const direction = leg.action === "buy" ? 1 : -1;
      const multiplier = direction * leg.quantity * (Number.isFinite(leg.option.lot) && leg.option.lot > 0 ? leg.option.lot : 1);
      pricedLegs += 1;
      pricedQuantity += leg.quantity;

      return {
        impliedVolatility: sum.impliedVolatility + greeks.impliedVolatility * leg.quantity,
        delta: sum.delta + greeks.delta * multiplier,
        gamma: sum.gamma + greeks.gamma * multiplier,
        theta: sum.theta + greeks.theta * multiplier,
        vega: sum.vega + greeks.vega * multiplier,
        rho: sum.rho + greeks.rho * multiplier,
      };
    },
    {
      impliedVolatility: 0,
      delta: 0,
      gamma: 0,
      theta: 0,
      vega: 0,
      rho: 0,
    },
  );

  if (pricedLegs === 0) {
    return null;
  }

  return {
    ...total,
    impliedVolatility: total.impliedVolatility / pricedQuantity,
    pricedLegs,
    totalLegs: params.legs.length,
  };
}
