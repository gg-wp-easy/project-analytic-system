import type { StockAvatarSize } from "./stock-avatar.types";

export const STOCK_AVATAR_SIZE_CLASSES: Record<StockAvatarSize, string> = {
  sm: "h-7 w-7 text-[0.62rem]",
  md: "h-9 w-9 text-xs",
  lg: "h-11 w-11 text-sm",
};

export const STOCK_AVATAR_PALETTE = [
  ["#1d4ed8", "#06b6d4"],
  ["#047857", "#22c55e"],
  ["#7c2d12", "#f97316"],
  ["#6d28d9", "#a855f7"],
  ["#be123c", "#f43f5e"],
  ["#0f766e", "#14b8a6"],
  ["#92400e", "#f59e0b"],
  ["#334155", "#64748b"],
];
