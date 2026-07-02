import { CircleHelp } from "lucide-react";
import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../app/components/ui/tooltip";

type InfoTooltipProps = {
  label: string;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
};

export function InfoTooltip({ label, children, side = "top" }: InfoTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full border border-slate-300 text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-slate-100 dark:focus:ring-slate-700"
          aria-label={label}
        >
          <CircleHelp className="h-3.5 w-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent side={side} sideOffset={8} className="max-w-96 px-3 py-2 text-[11px] leading-5">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}
