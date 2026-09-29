import {
  ANALYSIS_SHELL_HERO_ACCENT_CLASSES,
  ANALYSIS_SHELL_ICON_ACCENT_CLASSES,
  ANALYSIS_SHELL_SIDEBAR_ACCENT_CLASSES,
  type AnalysisPageFrameProps,
  type AnalysisSidebarCardProps,
  type MetricCardProps,
  type MetricGridProps,
  type PageHeroProps,
  type SectionCardProps,
} from "../model";
import { cn } from "../lib";

export function PageHero({
  icon: Icon,
  title,
  description,
  badge,
  aside,
  footer,
  accent = "blue",
  className,
}: PageHeroProps) {
  return (
    <section className={cn("ui-page-hero", ANALYSIS_SHELL_HERO_ACCENT_CLASSES[accent], className)}>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-4">
          {badge ? <div className="ui-page-hero-badge">{badge}</div> : null}
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "ui-float inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ring-1 backdrop-blur-sm",
                ANALYSIS_SHELL_ICON_ACCENT_CLASSES[accent],
              )}
            >
              <Icon className="h-6 w-6" />
            </span>
            <div className="space-y-2">
              <div className="text-2xl font-semibold text-slate-950 dark:text-white sm:text-3xl">{title}</div>
              {description ? <div className="max-w-3xl text-[15px] leading-7 text-slate-600 dark:text-white/82">{description}</div> : null}
            </div>
          </div>
        </div>

        {aside ? (
          <div className="rounded-lg border border-slate-200 bg-white/75 px-4 py-3 text-sm text-slate-700 backdrop-blur-md dark:border-white/15 dark:bg-white/10 dark:text-white/85">
            {aside}
          </div>
        ) : null}
      </div>

      {footer ? <div className="mt-6 flex flex-wrap items-center gap-3">{footer}</div> : null}
    </section>
  );
}

export function AnalysisPageFrame({
  hero,
  sidebar,
  children,
  sidebarClassName,
  contentClassName,
}: AnalysisPageFrameProps) {
  return (
    <div className="space-y-8">
      {hero}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)] xl:items-start">
        <aside
          className={cn(
            "xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)] xl:self-start xl:overflow-y-auto xl:pr-1",
            sidebarClassName,
          )}
        >
          {sidebar}
        </aside>
        <div className={cn("space-y-6", contentClassName)}>{children}</div>
      </div>
    </div>
  );
}

export function AnalysisSidebarCard({
  icon: Icon,
  title,
  description,
  accent = "blue",
  className,
  children,
}: AnalysisSidebarCardProps) {
  return (
    <section className={cn("ui-surface space-y-5", className)}>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1",
            ANALYSIS_SHELL_SIDEBAR_ACCENT_CLASSES[accent],
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="space-y-1.5">
          <div className="ui-section-title">{title}</div>
          {description ? <div className="ui-section-copy">{description}</div> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export function SectionCard({
  title,
  description,
  action,
  className,
  contentClassName,
  children,
}: SectionCardProps) {
  return (
    <section className={cn("ui-surface", className)}>
      {title || description || action ? (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            {title ? <div className="ui-section-title">{title}</div> : null}
            {description ? <div className="ui-section-copy">{description}</div> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className={contentClassName}>{children}</div>
    </section>
  );
}

export function MetricGrid({ children, className }: MetricGridProps) {
  return <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4", className)}>{children}</div>;
}

export function MetricCard({ label, value, helper, className }: MetricCardProps) {
  return (
    <div className={cn("ui-metric-card min-w-0", className)}>
      <div className="mb-1 flex min-w-0 items-center gap-1 text-sm text-slate-500 dark:text-slate-400">{label}</div>
      <div className="min-w-0 break-words text-2xl font-semibold leading-tight tracking-tight text-slate-900 dark:text-slate-100">{value}</div>
      {helper ? <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{helper}</div> : null}
    </div>
  );
}
