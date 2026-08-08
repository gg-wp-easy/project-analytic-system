import { Link } from "react-router-dom";
import { Activity, ArrowRight, BriefcaseBusiness, Database, Gem, Landmark, Layers, TrendingUp } from "lucide-react";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
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

export function Dashboard() {
  const { t } = useAppSettings();

  return (
    <div className="space-y-7">
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
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
          <TrendingUp className="hidden h-20 w-20 shrink-0 text-primary/20 sm:block" />
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
                className="group rounded-lg border border-border bg-card p-5 shadow-sm transition hover:border-primary/40 dark:bg-card"
              >
                <div className="space-y-4">
                  <div className="inline-flex rounded-lg bg-primary/10 p-3 text-primary">
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
