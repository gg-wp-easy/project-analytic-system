import { STOCK_AVATAR_PALETTE } from "../model/stock-avatar.consts";

export function getStockAvatarLabel(ticker: string, name?: string | null): string {
  return (ticker || name || "?").trim().slice(0, 3).toUpperCase() || "?";
}

export function getStockAvatarGradient(value: string): [string, string] {
  const hash = value.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const index = Math.abs(hash) % STOCK_AVATAR_PALETTE.length;
  return STOCK_AVATAR_PALETTE[index] as [string, string];
}
