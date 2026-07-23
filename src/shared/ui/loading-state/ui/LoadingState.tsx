import { Loader2 } from "lucide-react";
import { Skeleton } from "../../../../app/components/ui/skeleton";
import { cn, getLoadingBarClassName } from "../lib";
import type {
  CardGridSkeletonProps,
  ChartSkeletonProps,
  InlineLoaderProps,
  MetricSkeletonGridProps,
  PageLoadingStateProps,
  TableSkeletonProps,
} from "../model";

export function InlineLoader({ label, className, accentClassName = "text-blue-600" }: InlineLoaderProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className={cn("h-4 w-4 animate-spin", accentClassName)} />
      {label}
    </div>
  );
}

export function PageLoadingState({
  title,
  subtitle,
  accentClassName = "text-blue-600",
}: PageLoadingStateProps) {
  const barClassName = getLoadingBarClassName(accentClassName);

  return (
    <div
      className="rounded-lg border border-slate-200 bg-white/85 p-5 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/60"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-900">
          <Loader2 className={cn("h-5 w-5 animate-spin", accentClassName)} />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</div>
          {subtitle ? <div className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{subtitle}</div> : null}
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div className={cn("h-full w-1/2 animate-pulse rounded-full", barClassName)} />
        </div>
        <div className="h-1.5 w-4/5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div className={cn("h-full w-1/3 animate-pulse rounded-full", barClassName)} />
        </div>
      </div>
    </div>
  );
}

export function MetricSkeletonGrid({ count = 4 }: MetricSkeletonGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="ui-metric-card">
          <Skeleton className="mb-3 h-4 w-24 bg-slate-200 dark:bg-slate-800" />
          <Skeleton className="h-8 w-28 bg-slate-200 dark:bg-slate-800" />
          <Skeleton className="mt-3 h-3 w-32 bg-slate-200 dark:bg-slate-800" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 8, columns = 6, showHeader = true }: TableSkeletonProps) {
  return (
    <div className="ui-table-shell overflow-hidden">
      <table className="ui-data-table">
        {showHeader ? (
          <thead>
            <tr>
              {Array.from({ length: columns }).map((_, index) => (
                <th key={index}>
                  <Skeleton className="h-3 w-20 bg-slate-300/80 dark:bg-slate-700" />
                </th>
              ))}
            </tr>
          </thead>
        ) : null}
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: columns }).map((_, columnIndex) => (
                <td key={columnIndex}>
                  <Skeleton
                    className={cn(
                      "h-4 bg-slate-200 dark:bg-slate-800",
                      columnIndex === 0 ? "w-20" : columnIndex === 1 ? "w-40" : "w-24",
                    )}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CardGridSkeleton({ count = 6, columnsClassName = "md:grid-cols-2 xl:grid-cols-3" }: CardGridSkeletonProps) {
  return (
    <div className={cn("grid grid-cols-1 gap-4", columnsClassName)}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
          <Skeleton className="h-5 w-36 bg-slate-200 dark:bg-slate-800" />
          <Skeleton className="mt-3 h-4 w-full bg-slate-200 dark:bg-slate-800" />
          <Skeleton className="mt-2 h-4 w-4/5 bg-slate-200 dark:bg-slate-800" />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Skeleton className="h-14 bg-slate-200 dark:bg-slate-800" />
            <Skeleton className="h-14 bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ChartSkeletonBody({ variant }: { variant: NonNullable<ChartSkeletonProps["variant"]> }) {
  if (variant === "scatter") {
    const points = [
      [18, 68],
      [28, 48],
      [38, 62],
      [51, 35],
      [63, 52],
      [74, 28],
      [84, 44],
    ];

    return (
      <div className="relative h-48 overflow-hidden rounded-md border border-slate-200/80 bg-white/55 dark:border-slate-800 dark:bg-slate-950/50">
        <div className="absolute inset-x-6 bottom-8 top-5 grid grid-cols-4 border-b border-l border-slate-200 dark:border-slate-800">
          {Array.from({ length: 4 }).map((_, index) => (
            <span key={`v-${index}`} className="border-r border-slate-100 dark:border-slate-900" />
          ))}
        </div>
        <div className="absolute inset-x-6 bottom-8 top-5 grid grid-rows-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <span key={`h-${index}`} className="border-t border-slate-100 dark:border-slate-900" />
          ))}
        </div>
        {points.map(([left, top], index) => (
          <Skeleton
            key={index}
            className="absolute h-4 w-4 rounded-full bg-slate-300 dark:bg-slate-700"
            style={{ left: `${left}%`, top: `${top}%` }}
          />
        ))}
        <Skeleton className="absolute bottom-2 left-1/2 h-3 w-28 -translate-x-1/2 bg-slate-200 dark:bg-slate-800" />
        <Skeleton className="absolute left-2 top-1/2 h-24 w-3 -translate-y-1/2 bg-slate-200 dark:bg-slate-800" />
      </div>
    );
  }

  if (variant === "line") {
    return (
      <div className="relative h-48 overflow-hidden rounded-md border border-slate-200/80 bg-white/55 p-5 dark:border-slate-800 dark:bg-slate-950/50">
        <div className="absolute inset-x-5 bottom-8 top-5 grid grid-rows-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <span key={index} className="border-t border-slate-100 dark:border-slate-900" />
          ))}
        </div>
        <div className="relative mt-9 space-y-6">
          {[64, 82, 56].map((width, index) => (
            <Skeleton key={index} className="h-2 rounded-full bg-slate-300 dark:bg-slate-700" style={{ width: `${width}%` }} />
          ))}
          <Skeleton className="ml-auto h-2 w-3/4 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>
      </div>
    );
  }

  if (variant === "network") {
    const layers = [4, 5, 5, 3, 1];

    return (
      <div className="flex h-48 items-center justify-between rounded-md border border-slate-200/80 bg-white/55 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/50">
        {layers.map((count, layerIndex) => (
          <div key={layerIndex} className="relative flex h-full flex-col items-center justify-center gap-2">
            {Array.from({ length: count }).map((_, nodeIndex) => (
              <Skeleton key={nodeIndex} className="h-5 w-5 rounded-full bg-slate-300 dark:bg-slate-700" />
            ))}
            {layerIndex < layers.length - 1 ? (
              <Skeleton className="absolute left-[calc(100%+0.6rem)] top-1/2 h-1 w-10 -translate-y-1/2 bg-slate-200 dark:bg-slate-800" />
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  if (variant === "tree") {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-5 rounded-md border border-slate-200/80 bg-white/55 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/50">
        <Skeleton className="h-9 w-40 rounded-md bg-slate-300 dark:bg-slate-700" />
        <div className="grid w-full max-w-lg grid-cols-2 gap-8">
          <Skeleton className="h-8 rounded-md bg-slate-200 dark:bg-slate-800" />
          <Skeleton className="h-8 rounded-md bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="grid w-full max-w-xl grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-7 rounded-md bg-slate-200 dark:bg-slate-800" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {[72, 48, 64, 36, 58].map((width, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="h-3 w-10 bg-slate-200 dark:bg-slate-800" />
          <Skeleton className="h-3 bg-slate-200 dark:bg-slate-800" style={{ width: `${width}%` }} />
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton({
  className,
  title = "Preparing visualization",
  subtitle,
  variant = "bars",
  accentClassName = "text-blue-600",
}: ChartSkeletonProps) {
  const barClassName = getLoadingBarClassName(accentClassName);

  return (
    <div
      className={cn("rounded-lg border border-slate-200 bg-slate-50/75 p-4 dark:border-slate-800 dark:bg-slate-950/40", className)}
      role="status"
      aria-live="polite"
    >
      <div className="flex h-full min-h-[18rem] flex-col justify-between gap-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <Loader2 className={cn("h-4 w-4 animate-spin", accentClassName)} />
              <span className="truncate">{title}</span>
            </div>
            {subtitle ? <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{subtitle}</div> : null}
          </div>
          <Skeleton className="h-4 w-20 shrink-0 bg-slate-200 dark:bg-slate-800" />
        </div>
        <ChartSkeletonBody variant={variant} />
        <div className="grid grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-3 bg-slate-200 dark:bg-slate-800" />
          ))}
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div className={cn("h-full w-2/5 animate-pulse rounded-full", barClassName)} />
        </div>
      </div>
    </div>
  );
}
