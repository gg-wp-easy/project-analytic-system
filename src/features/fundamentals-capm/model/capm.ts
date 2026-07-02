import {
  createTBankInstrumentsApi,
  type TBankBond,
  type TBankBondCoupon,
  type TBankCandle,
  type TBankIndicative,
} from "../../../shared/api/tbank";

const LOOKBACK_DAYS = 370;
const TARGET_OFZ_YEARS = 2;
const TRADING_DAYS_PER_YEAR = 252;
const IMOEX_TICKER = "IMOEX";
const FAMA_FRENCH_FACTORS = {
  largeCap: { query: "TMOS" },
  smallCap: { query: "RU000A109KS6" },
  value: { query: "TDIV" },
  growth: { query: "TITR" },
} as const;

type DailyReturnPoint = {
  date: string;
  close: number;
  value: number;
};

type AlignedReturnPoint = {
  date: string;
  stockReturn: number;
  marketReturn: number;
};

type FamaFrenchAlignedReturnPoint = AlignedReturnPoint & {
  smbReturn: number;
  hmlReturn: number;
};

export type CapmAdequacyLevel = "strong" | "moderate" | "weak" | "insufficient";

export type CapmRiskFreeRateSource = {
  bondTicker: string;
  bondName: string;
  bondFigi: string;
  maturityDate: string;
  annualRate: number;
  closePricePercent: number;
  pricingMethod: "ytm_solver" | "coupon_proxy";
};

export type CapmModelPoint = {
  date: string;
  marketExcessReturn: number;
  actualExcessReturn: number;
  predictedCapmReturn: number;
  predictedFamaFrenchReturn?: number;
};

export type FamaFrenchFactorSource = {
  query: string;
  ticker: string;
  name: string;
  figi: string;
};

export type FamaFrenchAnalysisResult = {
  sampleSize: number;
  marketBeta: number;
  smbBeta: number;
  hmlBeta: number;
  alphaDaily: number;
  alphaAnnual: number;
  expectedAnnualReturn: number;
  rSquared: number;
  periodStart: string;
  periodEnd: string;
  sources: {
    largeCap: FamaFrenchFactorSource;
    smallCap: FamaFrenchFactorSource;
    value: FamaFrenchFactorSource;
    growth: FamaFrenchFactorSource;
  };
};

export type CapmAnalysisResult = {
  stockFigi: string;
  marketFigi: string;
  marketTicker: string;
  marketName: string;
  sampleSize: number;
  beta: number;
  alphaDaily: number;
  alphaAnnual: number;
  expectedAnnualReturn: number;
  marketAnnualReturn: number;
  riskFreeAnnualRate: number;
  rSquared: number;
  correlation: number;
  adequacyLevel: CapmAdequacyLevel;
  periodStart: string;
  periodEnd: string;
  riskFreeSource: CapmRiskFreeRateSource;
  modelPoints: CapmModelPoint[];
  famaFrench?: FamaFrenchAnalysisResult;
  famaFrenchError?: string;
};

function toDateKey(value: string): string {
  return value.slice(0, 10);
}

function sortCandles(candles: TBankCandle[]): TBankCandle[] {
  return [...candles].sort((left, right) => new Date(left.time).getTime() - new Date(right.time).getTime());
}

function computeDailyReturns(candles: TBankCandle[]): DailyReturnPoint[] {
  const sorted = sortCandles(candles).filter((row) => Number.isFinite(row.close) && row.close > 0);
  const returns: DailyReturnPoint[] = [];

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (!Number.isFinite(previous.close) || previous.close <= 0 || !Number.isFinite(current.close) || current.close <= 0) {
      continue;
    }

    returns.push({
      date: toDateKey(current.time),
      close: current.close,
      value: current.close / previous.close - 1,
    });
  }

  return returns;
}

function alignReturnSeries(stock: DailyReturnPoint[], market: DailyReturnPoint[]): AlignedReturnPoint[] {
  const marketByDate = new Map(market.map((point) => [point.date, point.value]));
  return stock
    .map((point) => {
      const marketReturn = marketByDate.get(point.date);
      if (!Number.isFinite(marketReturn)) {
        return null;
      }
      return {
        date: point.date,
        stockReturn: point.value,
        marketReturn: marketReturn as number,
      } satisfies AlignedReturnPoint;
    })
    .filter((point): point is AlignedReturnPoint => Boolean(point));
}

function alignFamaFrenchSeries(
  stock: DailyReturnPoint[],
  market: DailyReturnPoint[],
  largeCap: DailyReturnPoint[],
  smallCap: DailyReturnPoint[],
  value: DailyReturnPoint[],
  growth: DailyReturnPoint[],
): FamaFrenchAlignedReturnPoint[] {
  const marketByDate = new Map(market.map((point) => [point.date, point.value]));
  const largeByDate = new Map(largeCap.map((point) => [point.date, point.value]));
  const smallByDate = new Map(smallCap.map((point) => [point.date, point.value]));
  const valueByDate = new Map(value.map((point) => [point.date, point.value]));
  const growthByDate = new Map(growth.map((point) => [point.date, point.value]));

  return stock
    .map((point) => {
      const marketReturn = marketByDate.get(point.date);
      const largeReturn = largeByDate.get(point.date);
      const smallReturn = smallByDate.get(point.date);
      const valueReturn = valueByDate.get(point.date);
      const growthReturn = growthByDate.get(point.date);

      if (
        !Number.isFinite(marketReturn) ||
        !Number.isFinite(largeReturn) ||
        !Number.isFinite(smallReturn) ||
        !Number.isFinite(valueReturn) ||
        !Number.isFinite(growthReturn)
      ) {
        return null;
      }

      return {
        date: point.date,
        stockReturn: point.value,
        marketReturn: marketReturn as number,
        smbReturn: (smallReturn as number) - (largeReturn as number),
        hmlReturn: (valueReturn as number) - (growthReturn as number),
      } satisfies FamaFrenchAlignedReturnPoint;
    })
    .filter((point): point is FamaFrenchAlignedReturnPoint => Boolean(point));
}

function mean(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function variance(values: number[], avg: number): number {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
}

function covariance(left: number[], right: number[], leftAvg: number, rightAvg: number): number {
  if (!left.length || left.length !== right.length) {
    return 0;
  }
  return left.reduce((sum, value, index) => sum + (value - leftAvg) * (right[index] - rightAvg), 0) / left.length;
}

function solveLinearSystem(matrix: number[][], vector: number[]): number[] | null {
  const size = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);

  for (let column = 0; column < size; column += 1) {
    let pivotRow = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivotRow][column])) {
        pivotRow = row;
      }
    }

    const pivot = augmented[pivotRow][column];
    if (!Number.isFinite(pivot) || Math.abs(pivot) < 1e-12) {
      return null;
    }

    if (pivotRow !== column) {
      [augmented[column], augmented[pivotRow]] = [augmented[pivotRow], augmented[column]];
    }

    for (let cell = column; cell <= size; cell += 1) {
      augmented[column][cell] /= pivot;
    }

    for (let row = 0; row < size; row += 1) {
      if (row === column) {
        continue;
      }
      const factor = augmented[row][column];
      for (let cell = column; cell <= size; cell += 1) {
        augmented[row][cell] -= factor * augmented[column][cell];
      }
    }
  }

  return augmented.map((row) => row[size]);
}

function ordinaryLeastSquares(y: number[], xRows: number[][]): { coefficients: number[]; predicted: number[]; rSquared: number } | null {
  if (!y.length || y.length !== xRows.length) {
    return null;
  }

  const columnsCount = (xRows[0]?.length ?? 0) + 1;
  const design = xRows.map((row) => [1, ...row]);
  const xtx = Array.from({ length: columnsCount }, () => Array.from({ length: columnsCount }, () => 0));
  const xty = Array.from({ length: columnsCount }, () => 0);

  for (let rowIndex = 0; rowIndex < design.length; rowIndex += 1) {
    const row = design[rowIndex];
    for (let left = 0; left < columnsCount; left += 1) {
      xty[left] += row[left] * y[rowIndex];
      for (let right = 0; right < columnsCount; right += 1) {
        xtx[left][right] += row[left] * row[right];
      }
    }
  }

  const coefficients = solveLinearSystem(xtx, xty);
  if (!coefficients) {
    return null;
  }

  const predicted = design.map((row) => row.reduce((sum, value, index) => sum + value * coefficients[index], 0));
  const avg = mean(y);
  const sse = y.reduce((sum, value, index) => sum + (value - predicted[index]) ** 2, 0);
  const sst = y.reduce((sum, value) => sum + (value - avg) ** 2, 0);
  const rSquared = Math.min(Math.max(sst > 0 ? 1 - sse / sst : 0, 0), 1);

  return { coefficients, predicted, rSquared };
}

function annualRateToDaily(rate: number): number {
  if (!Number.isFinite(rate) || rate <= -0.999) {
    return 0;
  }
  return (1 + rate) ** (1 / TRADING_DAYS_PER_YEAR) - 1;
}

function dailyRateToAnnual(rate: number): number {
  if (!Number.isFinite(rate) || rate <= -0.999) {
    return 0;
  }
  return (1 + rate) ** TRADING_DAYS_PER_YEAR - 1;
}

function resolveAdequacyLevel(rSquared: number, sampleSize: number): CapmAdequacyLevel {
  if (sampleSize < 60) {
    return "insufficient";
  }
  if (rSquared >= 0.5) {
    return "strong";
  }
  if (rSquared >= 0.25) {
    return "moderate";
  }
  return "weak";
}

function yearsBetween(from: Date, to: Date): number {
  return Math.max((to.getTime() - from.getTime()) / (365 * 24 * 60 * 60 * 1000), 0);
}

function pickClosestTwoYearOfz(bonds: TBankBond[], asOf: Date): TBankBond | null {
  const target = new Date(asOf);
  target.setFullYear(target.getFullYear() + TARGET_OFZ_YEARS);

  const candidates = bonds.filter((bond) => {
    const maturity = new Date(bond.maturityDate);
    return (
      bond.currency.toUpperCase() === "RUB" &&
      bond.sector.toLowerCase().includes("government") &&
      bond.liquidityFlag &&
      !bond.floatingCouponFlag &&
      !bond.amortizationFlag &&
      maturity.getTime() > asOf.getTime()
    );
  });

  if (!candidates.length) {
    return null;
  }

  return candidates
    .slice()
    .sort((left, right) => {
      const leftDistance = Math.abs(new Date(left.maturityDate).getTime() - target.getTime());
      const rightDistance = Math.abs(new Date(right.maturityDate).getTime() - target.getTime());
      return leftDistance - rightDistance;
    })[0];
}

function buildBondCashFlows(
  bond: TBankBond,
  coupons: TBankBondCoupon[],
  asOf: Date,
): Array<{ years: number; amount: number }> {
  const maturityDate = new Date(bond.maturityDate);
  const futureCoupons = coupons
    .filter((coupon) => new Date(coupon.couponDate).getTime() >= asOf.getTime())
    .sort((left, right) => new Date(left.couponDate).getTime() - new Date(right.couponDate).getTime());

  if (!futureCoupons.length) {
    return [
      {
        years: yearsBetween(asOf, maturityDate),
        amount: bond.nominal,
      },
    ];
  }

  return futureCoupons.map((coupon, index) => {
    const couponDate = new Date(coupon.couponDate);
    const isLast = index === futureCoupons.length - 1;
    return {
      years: yearsBetween(asOf, couponDate),
      amount: coupon.payOneBond + (isLast ? bond.nominal : 0),
    };
  });
}

function presentValue(cashFlows: Array<{ years: number; amount: number }>, annualRate: number): number {
  return cashFlows.reduce((sum, flow) => {
    if (flow.years <= 0) {
      return sum + flow.amount;
    }
    return sum + flow.amount / (1 + annualRate) ** flow.years;
  }, 0);
}

function solveBondYieldToMaturity(
  dirtyPrice: number,
  cashFlows: Array<{ years: number; amount: number }>,
): number | null {
  if (!Number.isFinite(dirtyPrice) || dirtyPrice <= 0 || !cashFlows.length) {
    return null;
  }

  let low = 0;
  let high = 0.2;
  let highPresentValue = presentValue(cashFlows, high);

  while (highPresentValue > dirtyPrice && high < 5) {
    high *= 1.8;
    highPresentValue = presentValue(cashFlows, high);
  }

  if (high >= 5 && highPresentValue > dirtyPrice) {
    return null;
  }

  for (let iteration = 0; iteration < 64; iteration += 1) {
    const mid = (low + high) / 2;
    const midPresentValue = presentValue(cashFlows, mid);
    if (midPresentValue > dirtyPrice) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return (low + high) / 2;
}

function estimateCouponProxyRate(
  bond: TBankBond,
  coupons: TBankBondCoupon[],
  cleanPrice: number,
): number {
  const nextYearCoupons = coupons
    .slice()
    .sort((left, right) => new Date(left.couponDate).getTime() - new Date(right.couponDate).getTime())
    .slice(0, Math.max(1, bond.couponQuantityPerYear || 1));
  const annualCoupon = nextYearCoupons.reduce((sum, coupon) => sum + coupon.payOneBond, 0);
  if (!Number.isFinite(cleanPrice) || cleanPrice <= 0) {
    return 0;
  }
  return annualCoupon / cleanPrice;
}

async function resolveRiskFreeRate(asOf: Date): Promise<CapmRiskFreeRateSource> {
  const api = createTBankInstrumentsApi();
  const bonds = await api.fetchBonds();
  const bond = pickClosestTwoYearOfz(bonds, asOf);

  if (!bond) {
    throw new Error("Failed to locate a liquid fixed-coupon OFZ near the 2-year horizon.");
  }

  const [closePricesByFigi, coupons] = await Promise.all([
    api.fetchClosePricesByInstrumentIds([bond.figi]),
    api.fetchBondCoupons({
      instrumentId: bond.figi,
      from: asOf.toISOString(),
      to: bond.maturityDate,
    }),
  ]);

  const closePricePercent = closePricesByFigi[bond.figi]?.[0]?.price ?? 0;
  const cleanPrice = bond.nominal * (closePricePercent / 100);
  const dirtyPrice = cleanPrice + bond.aciValue;
  const cashFlows = buildBondCashFlows(bond, coupons, asOf);
  const solvedRate = solveBondYieldToMaturity(dirtyPrice, cashFlows);

  if (Number.isFinite(solvedRate) && solvedRate !== null) {
    return {
      bondTicker: bond.ticker,
      bondName: bond.name,
      bondFigi: bond.figi,
      maturityDate: bond.maturityDate,
      annualRate: solvedRate,
      closePricePercent,
      pricingMethod: "ytm_solver",
    };
  }

  return {
    bondTicker: bond.ticker,
    bondName: bond.name,
    bondFigi: bond.figi,
    maturityDate: bond.maturityDate,
    annualRate: estimateCouponProxyRate(bond, coupons, cleanPrice),
    closePricePercent,
    pricingMethod: "coupon_proxy",
  };
}

async function resolveMoexIndex(): Promise<TBankIndicative> {
  const api = createTBankInstrumentsApi();
  const indicatives = await api.fetchIndicatives();
  const exact = indicatives.find((item) => item.ticker.toUpperCase() === IMOEX_TICKER);
  if (exact) {
    return exact;
  }

  const byName = indicatives.find((item) => item.name.toUpperCase().includes(IMOEX_TICKER));
  if (byName) {
    return byName;
  }

  throw new Error("Failed to find the MOEX index (IMOEX) in market data service indicatives.");
}

async function resolveFactorInstrument(query: string): Promise<FamaFrenchFactorSource> {
  const api = createTBankInstrumentsApi();
  const references = await api.findInstrumentReferences(query, { apiTradeAvailableFlag: true });
  const normalizedQuery = query.trim().toUpperCase();
  const candidates = references
    .sort((left, right) => {
      const leftTickerMatch = left.ticker.toUpperCase() === normalizedQuery ? 1 : 0;
      const rightTickerMatch = right.ticker.toUpperCase() === normalizedQuery ? 1 : 0;
      if (rightTickerMatch !== leftTickerMatch) {
        return rightTickerMatch - leftTickerMatch;
      }
      const leftFigiMatch = left.figi.toUpperCase() === normalizedQuery ? 1 : 0;
      const rightFigiMatch = right.figi.toUpperCase() === normalizedQuery ? 1 : 0;
      if (rightFigiMatch !== leftFigiMatch) {
        return rightFigiMatch - leftFigiMatch;
      }
      const leftIsEtf = left.instrumentType.toLowerCase().includes("etf") ? 1 : 0;
      const rightIsEtf = right.instrumentType.toLowerCase().includes("etf") ? 1 : 0;
      if (rightIsEtf !== leftIsEtf) {
        return rightIsEtf - leftIsEtf;
      }
      return left.name.localeCompare(right.name, "ru");
    });
  const selected = candidates[0] ?? references[0];

  if (!selected?.figi) {
    throw new Error(`Failed to resolve factor fund ${query}.`);
  }

  return {
    query,
    ticker: selected.ticker,
    name: selected.name,
    figi: selected.figi,
  };
}

async function buildFamaFrenchAnalysis(params: {
  api: ReturnType<typeof createTBankInstrumentsApi>;
  stockReturns: DailyReturnPoint[];
  marketReturns: DailyReturnPoint[];
  riskFreeDaily: number;
  from: Date;
  to: Date;
}): Promise<{ analysis: FamaFrenchAnalysisResult; predictedByDate: Map<string, number> }> {
  const { api, stockReturns, marketReturns, riskFreeDaily, from, to } = params;
  const [largeCap, smallCap, value, growth] = await Promise.all([
    resolveFactorInstrument(FAMA_FRENCH_FACTORS.largeCap.query),
    resolveFactorInstrument(FAMA_FRENCH_FACTORS.smallCap.query),
    resolveFactorInstrument(FAMA_FRENCH_FACTORS.value.query),
    resolveFactorInstrument(FAMA_FRENCH_FACTORS.growth.query),
  ]);

  const [largeCandles, smallCandles, valueCandles, growthCandles] = await Promise.all(
    [largeCap, smallCap, value, growth].map((source) =>
      api.fetchCandles({
        figi: source.figi,
        from: from.toISOString(),
        to: to.toISOString(),
        interval: "CANDLE_INTERVAL_DAY",
        limit: 420,
      }),
    ),
  );

  const aligned = alignFamaFrenchSeries(
    stockReturns,
    marketReturns,
    computeDailyReturns(largeCandles),
    computeDailyReturns(smallCandles),
    computeDailyReturns(valueCandles),
    computeDailyReturns(growthCandles),
  );

  if (aligned.length < 30) {
    throw new Error("Not enough overlapping fund observations to build the Fama-French model.");
  }

  const stockExcess = aligned.map((point) => point.stockReturn - riskFreeDaily);
  const xRows = aligned.map((point) => [
    point.marketReturn - riskFreeDaily,
    point.smbReturn,
    point.hmlReturn,
  ]);
  const regression = ordinaryLeastSquares(stockExcess, xRows);
  if (!regression) {
    throw new Error("Failed to solve the Fama-French regression.");
  }

  const [alphaDaily, marketBeta, smbBeta, hmlBeta] = regression.coefficients;
  const marketFactorMean = mean(xRows.map((row) => row[0]));
  const smbMean = mean(xRows.map((row) => row[1]));
  const hmlMean = mean(xRows.map((row) => row[2]));
  const expectedAnnualReturn = dailyRateToAnnual(
    riskFreeDaily + alphaDaily + marketBeta * marketFactorMean + smbBeta * smbMean + hmlBeta * hmlMean,
  );
  const predictedByDate = new Map(aligned.map((point, index) => [point.date, regression.predicted[index]]));

  return {
    analysis: {
      sampleSize: aligned.length,
      marketBeta,
      smbBeta,
      hmlBeta,
      alphaDaily,
      alphaAnnual: dailyRateToAnnual(alphaDaily),
      expectedAnnualReturn,
      rSquared: regression.rSquared,
      periodStart: aligned[0]?.date ?? "",
      periodEnd: aligned[aligned.length - 1]?.date ?? "",
      sources: {
        largeCap,
        smallCap,
        value,
        growth,
      },
    },
    predictedByDate,
  };
}

export async function loadCapmAnalysis(stockFigi: string): Promise<CapmAnalysisResult> {
  if (!stockFigi) {
    throw new Error("Stock FIGI is required for CAPM analysis.");
  }

  const api = createTBankInstrumentsApi();
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - LOOKBACK_DAYS);

  const [marketIndex, riskFreeSource] = await Promise.all([
    resolveMoexIndex(),
    resolveRiskFreeRate(now),
  ]);

  const [stockCandles, marketCandles] = await Promise.all([
    api.fetchCandles({
      figi: stockFigi,
      from: from.toISOString(),
      to: now.toISOString(),
      interval: "CANDLE_INTERVAL_DAY",
      limit: 420,
    }),
    api.fetchCandles({
      figi: marketIndex.figi,
      from: from.toISOString(),
      to: now.toISOString(),
      interval: "CANDLE_INTERVAL_DAY",
      limit: 420,
    }),
  ]);

  const stockReturns = computeDailyReturns(stockCandles);
  const marketReturns = computeDailyReturns(marketCandles);
  const aligned = alignReturnSeries(stockReturns, marketReturns);

  if (aligned.length < 30) {
    throw new Error("Not enough overlapping daily observations to build the CAPM model.");
  }

  const riskFreeDaily = annualRateToDaily(riskFreeSource.annualRate);
  const stockExcess = aligned.map((point) => point.stockReturn - riskFreeDaily);
  const marketExcess = aligned.map((point) => point.marketReturn - riskFreeDaily);
  const stockMean = mean(stockExcess);
  const marketMean = mean(marketExcess);
  const marketVariance = variance(marketExcess, marketMean);

  if (!Number.isFinite(marketVariance) || marketVariance <= 0) {
    throw new Error("Failed to compute CAPM because the market return variance is zero.");
  }

  const beta = covariance(marketExcess, stockExcess, marketMean, stockMean) / marketVariance;
  const alphaDaily = stockMean - beta * marketMean;
  const predicted = marketExcess.map((value) => alphaDaily + beta * value);
  const sse = stockExcess.reduce((sum, value, index) => sum + (value - predicted[index]) ** 2, 0);
  const sst = stockExcess.reduce((sum, value) => sum + (value - stockMean) ** 2, 0);
  const rawRSquared = sst > 0 ? 1 - sse / sst : 0;
  const rSquared = Math.min(Math.max(rawRSquared, 0), 1);
  const correlationDenominator = Math.sqrt(
    variance(marketExcess, marketMean) * variance(stockExcess, stockMean),
  );
  const correlation =
    correlationDenominator > 0
      ? covariance(marketExcess, stockExcess, marketMean, stockMean) / correlationDenominator
      : 0;

  const marketAverageDailyReturn = mean(aligned.map((point) => point.marketReturn));
  const expectedAnnualReturn = dailyRateToAnnual(
    riskFreeDaily + beta * (marketAverageDailyReturn - riskFreeDaily),
  );
  let famaFrench: FamaFrenchAnalysisResult | undefined;
  let famaFrenchError: string | undefined;
  let famaFrenchPredictedByDate = new Map<string, number>();

  try {
    const result = await buildFamaFrenchAnalysis({
      api,
      stockReturns,
      marketReturns,
      riskFreeDaily,
      from,
      to: now,
    });
    famaFrench = result.analysis;
    famaFrenchPredictedByDate = result.predictedByDate;
  } catch (err) {
    famaFrenchError = err instanceof Error ? err.message : "Failed to build the Fama-French model.";
  }

  const modelPoints = aligned.map((point, index) => ({
    date: point.date,
    marketExcessReturn: marketExcess[index],
    actualExcessReturn: stockExcess[index],
    predictedCapmReturn: predicted[index],
    predictedFamaFrenchReturn: famaFrenchPredictedByDate.get(point.date),
  }));

  return {
    stockFigi,
    marketFigi: marketIndex.figi,
    marketTicker: marketIndex.ticker,
    marketName: marketIndex.name,
    sampleSize: aligned.length,
    beta,
    alphaDaily,
    alphaAnnual: dailyRateToAnnual(alphaDaily),
    expectedAnnualReturn,
    marketAnnualReturn: dailyRateToAnnual(marketAverageDailyReturn),
    riskFreeAnnualRate: riskFreeSource.annualRate,
    rSquared,
    correlation,
    adequacyLevel: resolveAdequacyLevel(rSquared, aligned.length),
    periodStart: aligned[0]?.date ?? "",
    periodEnd: aligned[aligned.length - 1]?.date ?? "",
    riskFreeSource,
    modelPoints,
    famaFrench,
    famaFrenchError,
  };
}
