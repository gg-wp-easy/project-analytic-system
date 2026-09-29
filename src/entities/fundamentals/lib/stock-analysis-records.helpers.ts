import type { AssetFundamentalRecord, FundamentalsCache, ShareRecord } from "../model/fundamentals.types";

/**
 * One share in the format of the stock analysis endpoints. Only raw observations are
 * sent: the server derives growth g from ROE and the payout ratio, treats the zeros the
 * data source uses for unknown values as missing and decides who pays dividends.
 */
export function buildStockAnalysisRecord(share: ShareRecord, fundamentals: AssetFundamentalRecord) {
  return {
    figi: share.figi,
    ticker: share.ticker,
    name: share.name,
    exchange: share.exchange,
    currency: share.currency,
    lot: share.lot,
    sector: share.sector,
    liquidity_flag: share.liquidityFlag,
    api_trade_available_flag: share.apiTradeAvailableFlag,
    buy_available_flag: share.buyAvailableFlag,
    sell_available_flag: share.sellAvailableFlag,
    otc_flag: share.otcFlag,
    market_cap_bn: fundamentals.marketCapBn,
    revenue_bn: fundamentals.revenueBn,
    pe_ratio: fundamentals.peRatio,
    pb_ratio: fundamentals.pbRatio,
    ps_ratio: fundamentals.psRatio,
    pfcf: fundamentals.pfcfRatio,
    ev_to_ebitda: fundamentals.evToEbitda,
    roe: fundamentals.roe,
    roa: fundamentals.roa,
    net_margin: fundamentals.netMargin,
    net_debt_to_ebitda: fundamentals.netDebtToEbitda,
    total_debt: fundamentals.totalDebt,
    debt_to_equity: fundamentals.debtToEquity,
    beta: fundamentals.beta,
    dividend_yield: fundamentals.dividendYield,
    five_year_avg_dividend_yield: fundamentals.fiveYearAverageDividendYield,
    five_year_dividend_growth_rate: fundamentals.fiveYearDividendGrowthRate,
    payout_ratio: fundamentals.dividendPayoutRatio,
    dividend_years_count: fundamentals.dividendYearsCount,
    consecutive_dividend_years: fundamentals.consecutiveDividendYears,
    dividend_consistency: fundamentals.dividendConsistency,
    last_dividend_year: fundamentals.lastDividendYear,
  };
}

export type StockAnalysisRecord = ReturnType<typeof buildStockAnalysisRecord>;

export function buildStockAnalysisRecords(cache: FundamentalsCache): StockAnalysisRecord[] {
  return cache.shares.flatMap((share) => {
    const fundamentals = cache.fundamentalsByFigi[share.figi];
    return fundamentals ? [buildStockAnalysisRecord(share, fundamentals)] : [];
  });
}
