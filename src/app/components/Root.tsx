import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Database,
  Landmark,
  Layers,
  Menu,
  Settings,
  TrendingUp,
  X,
} from "lucide-react";
import { useAppSettings } from "../context/AppSettingsContext";
import { isNavItemActive } from "../lib";
import { APP_ABSOLUTE_ROUTE_PATHS, APP_NAVIGATION_ITEMS, type AppNavigationIconKey } from "../model";
import { MarketIndicativesTicker } from "../../features/market-indicatives";

const appNavigationIcons: Record<AppNavigationIconKey, LucideIcon> = {
  activity: Activity,
  database: Database,
  landmark: Landmark,
  layers: Layers,
  settings: Settings,
  trendingUp: TrendingUp,
};

export function Root() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { t } = useAppSettings();

  const desktopLinkClass = (isActive: boolean) =>
    `inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors ${
      isActive
        ? "bg-teal-50 text-teal-800 dark:bg-teal-500/10 dark:text-teal-200"
        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/70"
    }`;

  const mobileLinkClass = (isActive: boolean) =>
    `flex items-center gap-3 rounded-xl px-4 py-3 transition-all ${
      isActive
        ? "bg-teal-50 text-teal-800 dark:bg-teal-500/10 dark:text-teal-200"
        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/70"
    }`;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/85">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex min-h-[4.5rem] items-center justify-between gap-3 py-3">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="rounded-lg bg-gradient-to-br from-teal-600 to-sky-600 p-2 shadow-sm">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-slate-900 dark:text-slate-100">{t("header.title")}</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t("header.subtitle")}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded-md p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/70 lg:hidden"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

          <nav className="hidden flex-wrap items-center gap-2 pb-4 pt-1 lg:flex">
            {APP_NAVIGATION_ITEMS.map((item) => {
              const Icon = appNavigationIcons[item.icon];
              const isActive = isNavItemActive(location.pathname, item);

              return (
                <Link key={item.path} to={item.path} className={desktopLinkClass(isActive)}>
                  <Icon className="h-4 w-4" />
                  <span className="whitespace-nowrap font-medium">{t(item.title)}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {mobileMenuOpen ? (
          <div className="border-t border-slate-200/80 bg-white/90 dark:border-slate-800/80 dark:bg-slate-950/90 lg:hidden">
            <nav className="space-y-1 px-4 py-5">
              {APP_NAVIGATION_ITEMS.map((item) => {
                const Icon = appNavigationIcons[item.icon];
                const isActive = isNavItemActive(location.pathname, item);

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={mobileLinkClass(isActive)}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{t(item.title)}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        ) : null}
      </header>

      {location.pathname !== APP_ABSOLUTE_ROUTE_PATHS.settings ? <MarketIndicativesTicker /> : null}

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
