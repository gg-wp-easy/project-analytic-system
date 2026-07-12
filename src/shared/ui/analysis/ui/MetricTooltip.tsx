import { CircleHelp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../../app/components/ui/tooltip";
import { METRIC_TOOLTIP_ARIA_LABEL, type MetricTooltipProps } from "../model";

export function MetricTooltip({ text }: MetricTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-700 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-slate-100"
          aria-label={METRIC_TOOLTIP_ARIA_LABEL}
        >
          <CircleHelp className="h-3.5 w-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8} className="max-w-80 px-3 py-2 text-[11px] leading-5">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
