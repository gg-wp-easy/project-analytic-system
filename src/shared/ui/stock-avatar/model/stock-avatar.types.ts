export type StockAvatarSize = "sm" | "md" | "lg";

export type StockAvatarProps = {
  ticker: string;
  name?: string | null;
  logoUrl?: string | null;
  size?: StockAvatarSize;
  className?: string;
};
