import { Link } from "react-router-dom";
import { Activity, ArrowRight, BriefcaseBusiness, Database, Gem, Landmark, Layers, TrendingUp } from "lucide-react";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import { trackSpotlight } from "../../../shared/lib/motion/spotlight";
import {
  DASHBOARD_HERO,
  DASHBOARD_OPEN_LABEL,
  DASHBOARD_SECTIONS,
  DASHBOARD_SECTIONS_TITLE,
} from "../model/dashboard.consts";
import type { DashboardIconKey } from "../model/dashboard.types";

const dashboardIcons: Record<DashboardIconKey, typeof Activity> = {
  activity: Activity,
  briefcase: BriefcaseBusiness,
  database: Database,
  gem: Gem,
  landmark: Landmark,
  layers: Layers,
  trendingUp: TrendingUp,
};

const SPARKLINE_PATH = "M4 66 L26 54 L46 60 L70 38 L92 45 L116 24 L136 30 L156 10";

function HeroSparkline() {
  return (
    <svg
      viewBox="0 0 160 80"
      className="hidden h-24 w-48 shrink-0 overflow-visible text-primary sm:block"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="dashboard-sparkline-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path className="ui-sparkline-area" d={`${SPARKLINE_PATH} L156 78 L4 78 Z`} fill="url(#dashboard-sparkline-fill)" />
      <path
        className="ui-sparkline-line"
        d={SPARKLINE_PATH}
        pathLength={1}
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle className="ui-sparkline-pulse" cx="156" cy="10" r="5" fill="currentColor" />
      <circle className="ui-sparkline-dot" cx="156" cy="10" r="4.5" fill="currentColor" />
    </svg>
  );
}

export function Dashboard() {
  const { t } = useAppSettings();

  return (
    <div className="space-y-7">
      <div className="ui-aurora ui-rise-in rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-md bg-primary/10 px-3 py-1.5 text-primary">
              <Activity className="h-4 w-4" />
              <span className="text-sm font-medium">{t(DASHBOARD_HERO.badge)}</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{t(DASHBOARD_HERO.title)}</h1>
            <p className="max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
              {t(DASHBOARD_HERO.description)}
            </p>
          </div>
          <HeroSparkline />
        </div>
      </div>

      <div>
        <h2 className="mb-5 text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {t(DASHBOARD_SECTIONS_TITLE)}
        </h2>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          {DASHBOARD_SECTIONS.map((section) => {
            const Icon = dashboardIcons[section.icon];
            return (
              <Link
                key={section.path}
                to={section.path}
                onPointerMove={trackSpotlight}
                className="ui-link-card group rounded-lg border border-border bg-card p-5 shadow-sm dark:bg-card"
              >
                <div className="space-y-4">
                  <div className="ui-link-card-icon inline-flex rounded-lg bg-primary/10 p-3 text-primary">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold text-slate-900 transition-colors group-hover:text-primary dark:text-slate-100">
                      {t(section.title)}
                    </h3>
                    <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{t(section.description)}</p>
                  </div>
                  <div className="flex items-center gap-2 pt-2 text-sm font-medium text-primary">
                    {t(DASHBOARD_OPEN_LABEL)}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
