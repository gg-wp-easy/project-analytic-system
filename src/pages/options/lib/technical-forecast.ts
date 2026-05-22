import type { TBankCandle } from "../../../shared/api/tbank";
import type { StrategyTemplateId } from "./strategy-builder";

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

const FORECAST_HORIZON_DAYS = 20;

function isValidPrice(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function normalizeCandles(candles: TBankCandle[]): TBankCandle[] {
  return [...candles]
    .filter((candle) => isValidPrice(candle.close))
    .sort((left, right) => new Date(left.time).getTime() - new Date(right.time).getTime());
}

function average(values: number[]): number | null {
  const valid = values.filter(Number.isFinite);
  if (valid.length === 0) {
    return null;
  }
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function standardDeviation(values: number[]): number | null {
  const mean = average(values);
  if (mean === null || values.length < 2) {
    return null;
  }

  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function simpleMovingAverage(values: number[], period: number): number | null {
  if (values.length < period) {
    return null;
  }
  return average(values.slice(-period));
}

function exponentialMovingAverage(values: number[], period: number): number | null {
  if (values.length < period) {
    return null;
  }

  const multiplier = 2 / (period + 1);
  let ema = average(values.slice(0, period));
  if (ema === null) {
    return null;
  }

  for (let index = period; index < values.length; index += 1) {
    ema = values[index]! * multiplier + ema * (1 - multiplier);
  }

  return ema;
}

function buildEmaSeries(values: number[], period: number): number[] {
  if (values.length < period) {
    return [];
  }

  const result: number[] = [];
  const multiplier = 2 / (period + 1);
  let ema = average(values.slice(0, period));
  if (ema === null) {
    return result;
  }

  result.push(ema);
  for (let index = period; index < values.length; index += 1) {
    ema = values[index]! * multiplier + ema * (1 - multiplier);
    result.push(ema);
  }

  return result;
}

function computeRsi(values: number[], period: number): number | null {
  if (values.length <= period) {
    return null;
  }

  const changes = values.slice(1).map((value, index) => value - values[index]!);
  const recentChanges = changes.slice(-period);
  const gains = recentChanges.map((change) => Math.max(change, 0));
  const losses = recentChanges.map((change) => Math.max(-change, 0));
  const averageGain = average(gains);
  const averageLoss = average(losses);

  if (averageGain === null || averageLoss === null) {
    return null;
  }
  if (averageLoss === 0) {
    return 100;
  }

  const relativeStrength = averageGain / averageLoss;
  return 100 - 100 / (1 + relativeStrength);
}

function computeMacd(values: number[]): { macd: number | null; signal: number | null } {
  const ema12 = buildEmaSeries(values, 12);
  const ema26 = buildEmaSeries(values, 26);
  if (ema12.length === 0 || ema26.length === 0) {
    return { macd: null, signal: null };
  }

  const alignedEma12 = ema12.slice(ema12.length - ema26.length);
  const macdSeries = ema26.map((value, index) => alignedEma12[index]! - value);
  const signal = exponentialMovingAverage(macdSeries, 9);

  return {
    macd: macdSeries[macdSeries.length - 1] ?? null,
    signal,
  };
}

function computeAtr(candles: TBankCandle[], period: number): number | null {
  if (candles.length <= period) {
    return null;
  }

  const trueRanges = candles.slice(1).map((candle, index) => {
    const previousClose = candles[index]!.close;
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose),
    );
  });

  return average(trueRanges.slice(-period));
}

function computeRealizedVolatility(values: number[], period: number): number | null {
  if (values.length <= period) {
    return null;
  }

  const returns = values
    .slice(1)
    .map((value, index) => Math.log(value / values[index]!))
    .filter(Number.isFinite)
    .slice(-period);
  const volatility = standardDeviation(returns);

  return volatility === null ? null : volatility * Math.sqrt(252) * 100;
}

function computeTrendSlopePct(values: number[], period: number): number | null {
  if (values.length < period) {
    return null;
  }

  const segment = values.slice(-period);
  const first = segment[0]!;
  const last = segment[segment.length - 1]!;
  return isValidPrice(first) ? ((last - first) / first) * 100 : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function pushReason(reasons: string[], condition: boolean, text: string): void {
  if (condition) {
    reasons.push(text);
  }
}

export function buildAssetMovementForecast(candles: TBankCandle[]): AssetMovementForecast | null {
  const rows = normalizeCandles(candles);
  if (rows.length < 10) {
    return null;
  }

  const closes = rows.map((row) => row.close);
  const volumes = rows.map((row) => row.volume).filter((value) => Number.isFinite(value) && value > 0);
  const currentPrice = closes[closes.length - 1]!;
  const previousClose = closes[closes.length - 2] ?? null;
  const sma20 = simpleMovingAverage(closes, 20);
  const sma50 = simpleMovingAverage(closes, 50);
  const ema12 = exponentialMovingAverage(closes, 12);
  const ema26 = exponentialMovingAverage(closes, 26);
  const rsi14 = computeRsi(closes, 14);
  const { macd, signal: macdSignal } = computeMacd(closes);
  const atr14 = computeAtr(rows, 14);
  const recent20 = closes.slice(-20);
  const middle = average(recent20);
  const deviation = standardDeviation(recent20);
  const bollingerUpper = middle !== null && deviation !== null ? middle + 2 * deviation : null;
  const bollingerLower = middle !== null && deviation !== null ? middle - 2 * deviation : null;
  const bollingerPosition =
    bollingerUpper !== null && bollingerLower !== null && bollingerUpper !== bollingerLower
      ? (currentPrice - bollingerLower) / (bollingerUpper - bollingerLower)
      : null;
  const momentum20Pct =
    closes.length > 20 && isValidPrice(closes[closes.length - 21]!)
      ? ((currentPrice - closes[closes.length - 21]!) / closes[closes.length - 21]!) * 100
      : null;
  const realizedVolatility20Pct = computeRealizedVolatility(closes, 20);
  const volumeAverage20 = average(volumes.slice(-20));
  const latestVolume = volumes[volumes.length - 1] ?? null;
  const volumeRatio20 =
    latestVolume !== null && volumeAverage20 !== null && volumeAverage20 > 0 ? latestVolume / volumeAverage20 : null;
  const trendSlope20Pct = computeTrendSlopePct(closes, 20);

  let score = 0;
  if (ema12 !== null && ema26 !== null) {
    score += ema12 > ema26 ? 1 : -1;
  }
  if (sma20 !== null && sma50 !== null) {
    score += sma20 > sma50 ? 1 : -1;
  }
  if (macd !== null && macdSignal !== null) {
    score += macd > macdSignal ? 0.9 : -0.9;
  }
  if (momentum20Pct !== null) {
    score += clamp(momentum20Pct / 4, -1.2, 1.2);
  }
  if (trendSlope20Pct !== null) {
    score += clamp(trendSlope20Pct / 5, -1, 1);
  }
  if (rsi14 !== null) {
    if (rsi14 > 70) {
      score -= 0.7;
    } else if (rsi14 < 30) {
      score += 0.7;
    } else if (rsi14 > 55) {
      score += 0.35;
    } else if (rsi14 < 45) {
      score -= 0.35;
    }
  }
  if (bollingerPosition !== null) {
    if (bollingerPosition > 0.92) {
      score -= 0.35;
    } else if (bollingerPosition < 0.08) {
      score += 0.35;
    }
  }

  const direction: ForecastDirection = score > 1.1 ? "bullish" : score < -1.1 ? "bearish" : "neutral";
  const atrPct = atr14 !== null ? (atr14 / currentPrice) * 100 : null;
  const volatilityAnchor = atrPct ?? (realizedVolatility20Pct !== null ? realizedVolatility20Pct / Math.sqrt(252) : 2);
  const expectedMovePct =
    direction === "neutral"
      ? 0
      : clamp(score * 1.15 + (momentum20Pct ?? 0) * 0.12, -Math.max(3, volatilityAnchor * 4), Math.max(3, volatilityAnchor * 4));
  const targetPrice = currentPrice * (1 + expectedMovePct / 100);
  const confidence = Math.round(clamp(32 + Math.abs(score) * 11 + Math.min(rows.length, 80) * 0.25, 25, 88));
  const reasons: string[] = [];
  const warnings: string[] = [];

  pushReason(reasons, ema12 !== null && ema26 !== null && ema12 > ema26, "EMA 12 выше EMA 26: краткосрочный импульс сильнее среднего.");
  pushReason(reasons, ema12 !== null && ema26 !== null && ema12 < ema26, "EMA 12 ниже EMA 26: краткосрочный импульс слабее среднего.");
  pushReason(reasons, sma20 !== null && sma50 !== null && sma20 > sma50, "SMA 20 выше SMA 50: средний тренд остаётся восходящим.");
  pushReason(reasons, sma20 !== null && sma50 !== null && sma20 < sma50, "SMA 20 ниже SMA 50: средний тренд остаётся нисходящим.");
  pushReason(reasons, rsi14 !== null && rsi14 > 70, "RSI выше 70: рост может быть перегрет.");
  pushReason(reasons, rsi14 !== null && rsi14 < 30, "RSI ниже 30: снижение может быть перепродано.");
  pushReason(reasons, macd !== null && macdSignal !== null && macd > macdSignal, "MACD выше сигнальной линии: моментум поддерживает рост.");
  pushReason(reasons, macd !== null && macdSignal !== null && macd < macdSignal, "MACD ниже сигнальной линии: моментум поддерживает снижение.");

  if (rows.length < 50) {
    warnings.push("Истории меньше 50 свечей, поэтому долгие средние и уверенность ограничены.");
  }
  if (atrPct !== null && atrPct > 4) {
    warnings.push("ATR высокий относительно цены: размер позиции и риск гэпа стоит уменьшить.");
  }

  return {
    direction,
    score: Number(score.toFixed(2)),
    confidence,
    horizonDays: FORECAST_HORIZON_DAYS,
    expectedMovePct: Number(expectedMovePct.toFixed(2)),
    targetPrice: Number(targetPrice.toFixed(2)),
    indicators: {
      currentPrice,
      previousClose,
      priceChangePct:
        previousClose !== null && isValidPrice(previousClose)
          ? ((currentPrice - previousClose) / previousClose) * 100
          : null,
      sma20,
      sma50,
      ema12,
      ema26,
      rsi14,
      macd,
      macdSignal,
      atr14,
      atrPct,
      bollingerUpper,
      bollingerMiddle: middle,
      bollingerLower,
      bollingerPosition,
      momentum20Pct,
      realizedVolatility20Pct,
      volumeRatio20,
      trendSlope20Pct,
    },
    reasons: reasons.slice(0, 4),
    warnings,
  };
}

export function pickRecommendedExpiration(expirationChoices: string[], horizonDays: number): string {
  const now = new Date();
  const targetMs = now.getTime() + horizonDays * 24 * 60 * 60 * 1000;
  const future = expirationChoices
    .map((value) => ({ value, time: Date.parse(value) }))
    .filter((item) => Number.isFinite(item.time) && item.time > now.getTime())
    .sort((left, right) => left.time - right.time);

  return future.find((item) => item.time >= targetMs)?.value ?? future[0]?.value ?? expirationChoices[0] ?? "";
}

export function buildOptionTradeRecommendation(
  forecast: AssetMovementForecast,
  expirationChoices: string[],
): OptionTradeRecommendation | null {
  const expirationKey = pickRecommendedExpiration(expirationChoices, forecast.horizonDays);
  if (!expirationKey) {
    return null;
  }

  const expirationDays = Math.max(
    0,
    Math.round((Date.parse(expirationKey) - Date.now()) / (24 * 60 * 60 * 1000)),
  );
  const atrPct = forecast.indicators.atrPct ?? 0;
  const highVolatility = atrPct > 3.2 || Math.abs(forecast.expectedMovePct) > 5;
  const strongSignal = forecast.confidence >= 62 && Math.abs(forecast.score) >= 2.2;

  if (forecast.direction === "bullish") {
    return {
      templateId: strongSignal && highVolatility ? "long-call" : "bull-call-spread",
      outlook: "bullish",
      expirationKey,
      expirationDays,
      thesis: strongSignal
        ? "Прогноз за рост: можно рассмотреть покупку call, либо bull call spread для ограничения риска."
        : "Прогноз умеренно бычий: предпочтительнее bull call spread, где покупка call частично финансируется продажей call выше.",
      riskNote: "Если цена не пойдёт вверх достаточно быстро, временной распад будет работать против купленных опционов.",
    };
  }

  if (forecast.direction === "bearish") {
    return {
      templateId: strongSignal && highVolatility ? "long-put" : "bear-put-spread",
      outlook: "bearish",
      expirationKey,
      expirationDays,
      thesis: strongSignal
        ? "Прогноз за снижение: можно рассмотреть покупку put, либо bear put spread для более дешёвой направленной ставки."
        : "Прогноз умеренно медвежий: предпочтительнее bear put spread с ограниченным риском и ограниченной целью.",
      riskNote: "Главный риск - боковое движение: купленная опционная премия может постепенно терять стоимость.",
    };
  }

  return {
    templateId: highVolatility ? "long-strangle" : "iron-condor",
    outlook: "neutral",
    expirationKey,
    expirationDays,
    thesis: highVolatility
      ? "Направленного преимущества нет, но волатильность заметная: можно рассмотреть long strangle как ставку на выход из диапазона."
      : "Прогноз ближе к боковику: можно рассмотреть iron condor как продажу диапазона с защитными крыльями.",
    riskNote: highVolatility
      ? "Long strangle требует движения больше суммарной премии."
      : "Для кредитных конструкций критичны маржа, ликвидность и контроль выхода за диапазон.",
  };
}
