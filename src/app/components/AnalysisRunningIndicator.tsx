import { Loader2 } from "lucide-react";

type AnalysisRunningIndicatorProps = {
  title: string;
  subtitle: string;
  accentClassName: string;
};

export function AnalysisRunningIndicator({ title, subtitle, accentClassName }: AnalysisRunningIndicatorProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80">
      <div className="flex items-center gap-3">
        <Loader2 className={`h-5 w-5 animate-spin ${accentClassName}`} />
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
          <p className="text-xs text-slate-600 dark:text-slate-400">{subtitle}</p>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div className={`h-full w-1/2 animate-pulse rounded-full ${accentClassName.replace("text-", "bg-")}`} />
        </div>
        <div className="h-1.5 w-4/5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div className={`h-full w-1/3 animate-pulse rounded-full ${accentClassName.replace("text-", "bg-")}`} />
        </div>
      </div>
    </div>
  );
}
