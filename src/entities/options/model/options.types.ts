import type { TBankCandle, TBankOption } from "../../../shared/api/tbank";

export type StoredOptionRecord = {
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
  direction: string;
  style: string;
  realExchange: string;
  apiTradeAvailableFlag: boolean;
};

export type OptionsCache = {
  options: TBankOption[];
  optionClosePricesByInstrumentId: Record<string, number>;
  optionClosePricesMetaByUnderlyingKey: Record<string, { lastUpdated: string }>;
  underlyingLastPricesByKey: Record<string, { price: number; instrumentId: string; time: string; lastUpdated: string }>;
  underlyingHistoryByKey: Record<
    string,
    {
      instrumentId: string;
      candles: TBankCandle[];
      from: string;
      to: string;
      interval: string;
      lastUpdated: string;
    }
  >;
  lastUpdated: string | null;
  source: {
    options: string;
    closePrices: string;
    lastPrices: string;
    candles: string;
  };
};

export type LoadClosePricesParams = {
  underlyingKey: string;
  options: TBankOption[];
  force?: boolean;
  preferredInstrumentIds?: string[];
};

export type OptionsContextValue = {
  cache: OptionsCache;
  isLoading: boolean;
  isLoadingClosePrices: boolean;
  isLoadingUnderlyingPrice: boolean;
  isLoadingUnderlyingHistory: boolean;
  hasData: boolean;
  error: string | null;
  loadOptions: (force?: boolean) => Promise<void>;
  loadClosePricesForUnderlying: (params: LoadClosePricesParams) => Promise<void>;
  loadUnderlyingPriceForUnderlying: (params: LoadClosePricesParams) => Promise<void>;
  loadUnderlyingHistoryForUnderlying: (params: LoadClosePricesParams) => Promise<void>;
  clearCache: () => void;
  clearError: () => void;
};
