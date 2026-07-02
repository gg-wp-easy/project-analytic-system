import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Accent = "violet" | "emerald" | "orange" | "cyan" | "slate" | "blue" | "amber";

type PageHeroProps = {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  aside?: ReactNode;
  footer?: ReactNode;
  accent?: Accent;
  className?: string;
};

type AnalysisPageFrameProps = {
  hero: ReactNode;
  sidebar: ReactNode;
  children: ReactNode;
  sidebarClassName?: string;
  contentClassName?: string;
};

type AnalysisSidebarCardProps = {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  accent?: Accent;
  className?: string;
  children: ReactNode;
};

type SectionCardProps = {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
};

type MetricCardProps = {
  label: ReactNode;
  value: ReactNode;
  helper?: ReactNode;
  className?: string;
};

function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

const heroAccentClasses: Record<Accent, string> = {
  violet: "bg-gradient-to-br from-indigo-700 via-violet-600 to-purple-500",
  emerald: "bg-gradient-to-br from-teal-700 via-emerald-600 to-green-500",
  orange: "bg-gradient-to-br from-amber-600 via-orange-500 to-rose-500",
  cyan: "bg-gradient-to-br from-teal-700 via-cyan-600 to-sky-600",
  slate: "bg-gradient-to-br from-slate-800 via-slate-700 to-slate-600",
  blue: "bg-gradient-to-br from-sky-700 via-blue-600 to-teal-500",
  amber: "bg-gradient-to-br from-amber-600 via-yellow-500 to-orange-500",
};

const iconAccentClasses: Record<Accent, string> = {
  violet: "bg-violet-500/15 text-violet-200 ring-violet-300/25",
  emerald: "bg-emerald-500/15 text-emerald-200 ring-emerald-300/25",
  orange: "bg-orange-500/15 text-orange-100 ring-orange-300/25",
  cyan: "bg-cyan-400/15 text-cyan-100 ring-cyan-200/25",
  slate: "bg-white/10 text-white ring-white/20",
  blue: "bg-blue-400/15 text-blue-100 ring-blue-200/25",
  amber: "bg-amber-400/15 text-amber-100 ring-amber-200/25",
};

const sidebarAccentClasses: Record<Accent, string> = {
  violet: "bg-violet-500/10 text-violet-700 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/20",
  emerald: "bg-emerald-500/10 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/20",
  orange: "bg-orange-500/10 text-orange-700 ring-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-500/20",
  cyan: "bg-cyan-500/10 text-cyan-700 ring-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-300 dark:ring-cyan-500/20",
  slate: "bg-slate-500/10 text-slate-700 ring-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-500/20",
  blue: "bg-sky-500/10 text-sky-700 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/20",
  amber: "bg-amber-500/10 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/20",
};

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
    <section className={cn("ui-page-hero", heroAccentClasses[accent], className)}>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-4">
          {badge ? <div className="ui-page-hero-badge">{badge}</div> : null}
          <div className="flex items-start gap-4">
            <span
              className={cn(
                "inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ring-1 backdrop-blur-sm",
                iconAccentClasses[accent],
              )}
            >
              <Icon className="h-7 w-7" />
            </span>
            <div className="space-y-2">
              <div className="text-3xl font-semibold text-white sm:text-4xl">{title}</div>
              {description ? <div className="max-w-3xl text-[15px] leading-7 text-white/82">{description}</div> : null}
            </div>
          </div>
        </div>

        {aside ? (
          <div className="rounded-3xl border border-white/15 bg-white/10 px-5 py-4 text-sm text-white/85 shadow-lg backdrop-blur-md">
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
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <aside className={cn("xl:sticky xl:top-24 xl:self-start", sidebarClassName)}>{sidebar}</aside>
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
            "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1",
            sidebarAccentClasses[accent],
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

export function MetricGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4", className)}>{children}</div>;
}

export function MetricCard({ label, value, helper, className }: MetricCardProps) {
  return (
    <div className={cn("ui-metric-card", className)}>
      <div className="mb-1 flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{value}</div>
      {helper ? <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{helper}</div> : null}
    </div>
  );
}
