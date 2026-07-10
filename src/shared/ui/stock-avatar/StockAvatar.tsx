import type { CSSProperties } from "react";
import { getStockAvatarGradient, getStockAvatarLabel } from "./lib/stock-avatar.helpers";
import { STOCK_AVATAR_SIZE_CLASSES } from "./model/stock-avatar.consts";
import type { StockAvatarProps } from "./model/stock-avatar.types";

export function StockAvatar({ ticker, name, logoUrl, size = "md", className = "" }: StockAvatarProps) {
  const label = getStockAvatarLabel(ticker, name);
  const [from, to] = getStockAvatarGradient(ticker || name || label);
  const style: CSSProperties = { backgroundImage: `linear-gradient(135deg, ${from}, ${to})` };

  if (logoUrl) {
    return (
      <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700 ${STOCK_AVATAR_SIZE_CLASSES[size]} ${className}`} title={name || ticker}>
        <img src={logoUrl} alt={ticker} className="h-full w-full object-cover" loading="lazy" />
      </span>
    );
  }

  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-sm ring-1 ring-white/35 ${STOCK_AVATAR_SIZE_CLASSES[size]} ${className}`} style={style} title={name || ticker}>
      {label || "?"}
    </span>
  );
}
