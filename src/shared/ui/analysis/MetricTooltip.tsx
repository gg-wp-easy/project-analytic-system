type MetricTooltipProps = {
  text: string;
};

export function MetricTooltip({ text }: MetricTooltipProps) {
  return (
    <span className="relative inline-flex items-center group">
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 dark:border-slate-600 text-[10px] text-slate-500 dark:text-slate-300">
        ?
      </span>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 rounded-md bg-slate-900 px-2 py-1 text-[11px] text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
        {text}
      </span>
    </span>
  );
}
