import { Link } from "react-router-dom";
import { Activity, ArrowRight, Database, Landmark, Layers, TrendingUp } from "lucide-react";
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
  database: Database,
  landmark: Landmark,
  layers: Layers,
};

export function Dashboard() {
  const { t } = useAppSettings();

  return (
    <div className="space-y-8">
      <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-700 p-8 text-white shadow-xl">
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 backdrop-blur-sm">
              <Activity className="h-4 w-4" />
              <span className="text-sm font-medium">{t(DASHBOARD_HERO.badge)}</span>
            </div>
            <h1 className="text-4xl font-bold text-white">{t(DASHBOARD_HERO.title)}</h1>
            <p className="max-w-2xl text-lg text-blue-50">{t(DASHBOARD_HERO.description)}</p>
          </div>
          <TrendingUp className="h-24 w-24 shrink-0 opacity-20" />
        </div>
      </div>

      <div>
        <h2 className="mb-6 text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {t(DASHBOARD_SECTIONS_TITLE)}
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {DASHBOARD_SECTIONS.map((section) => {
            const Icon = dashboardIcons[section.icon];
            return (
              <Link
                key={section.path}
                to={section.path}
                className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:border-slate-300 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
              >
                <div className="space-y-4">
                  <div className={`inline-flex rounded-lg bg-gradient-to-br p-3 ${section.color}`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold text-slate-900 transition-colors group-hover:text-blue-600 dark:text-slate-100">
                      {t(section.title)}
                    </h3>
                    <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{t(section.description)}</p>
                  </div>
                  <div className="flex items-center gap-2 pt-2 text-sm font-medium text-blue-600 dark:text-blue-400">
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
