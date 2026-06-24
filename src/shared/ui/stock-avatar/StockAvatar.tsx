import type { CSSProperties } from "react";

type StockAvatarProps = {
  ticker: string;
  name?: string | null;
  logoUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClasses = {
  sm: "h-7 w-7 text-[0.62rem]",
  md: "h-9 w-9 text-xs",
  lg: "h-11 w-11 text-sm",
};

const palette = [
  ["#1d4ed8", "#06b6d4"],
  ["#047857", "#22c55e"],
  ["#7c2d12", "#f97316"],
  ["#6d28d9", "#a855f7"],
  ["#be123c", "#f43f5e"],
  ["#0f766e", "#14b8a6"],
  ["#92400e", "#f59e0b"],
  ["#334155", "#64748b"],
];

function colorIndex(value: string): number {
  const hash = value.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return Math.abs(hash) % palette.length;
}

export function StockAvatar({ ticker, name, logoUrl, size = "md", className = "" }: StockAvatarProps) {
  const label = (ticker || name || "?").trim().slice(0, 3).toUpperCase();
  const [from, to] = palette[colorIndex(ticker || name || label)];
  const style: CSSProperties = { backgroundImage: `linear-gradient(135deg, ${from}, ${to})` };

  if (logoUrl) {
    return (
      <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700 ${sizeClasses[size]} ${className}`} title={name || ticker}>
        <img src={logoUrl} alt={ticker} className="h-full w-full object-cover" loading="lazy" />
      </span>
    );
  }

  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-sm ring-1 ring-white/35 ${sizeClasses[size]} ${className}`} style={style} title={name || ticker}>
      {label || "?"}
    </span>
  );
}
