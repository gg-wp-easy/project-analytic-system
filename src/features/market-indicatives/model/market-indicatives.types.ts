export type IndicatorGroup = "market" | "currency" | "metal";

export type MarketIndicator = {
  id: string;
  ticker: string;
  label: string;
  name: string;
  group: IndicatorGroup;
  price: number;
};

export type MarketIndicativesCachePayload = {
  savedAt: string;
  items: MarketIndicator[];
};

export type CurrencyTarget = {
  key: string;
  label: string;
  group: Exclude<IndicatorGroup, "market">;
  aliases: string[];
};
