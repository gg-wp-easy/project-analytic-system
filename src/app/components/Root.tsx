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
import { MarketIndicativesTicker } from "../../features/market-indicatives";

type NavItem = {
  name: string;
  path: string;
  icon: LucideIcon;
  activePaths?: string[];
};

function isActivePath(currentPath: string, targetPath: string): boolean {
  if (targetPath === "/") {
    return currentPath === "/";
  }

  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
}

function isNavItemActive(currentPath: string, item: NavItem): boolean {
  return isActivePath(currentPath, item.path) || Boolean(item.activePaths?.some((path) => isActivePath(currentPath, path)));
}

export function Root() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { t } = useAppSettings();

  const primaryNavigation: NavItem[] = [
    { name: t({ ru: "Обзор", en: "Overview" }), path: "/", icon: TrendingUp },
    { name: t({ ru: "Фундаментальные данные акций", en: "Stock Fundamentals" }), path: "/fundamentals", icon: Database },
    {
      name: t({ ru: "Анализ акций", en: "Stock Analysis" }),
      path: "/stock-analysis",
      icon: Layers,
      activePaths: ["/cluster", "/decision-tree", "/neural-network", "/hybrid"],
    },
    { name: t({ ru: "Анализ облигаций", en: "Bond Analysis" }), path: "/bonds", icon: Landmark },
    { name: t({ ru: "Анализ опционов", en: "Options Analysis" }), path: "/options", icon: Activity },
    { name: t({ ru: "Настройки", en: "Settings" }), path: "/settings", icon: Settings },
  ];

  const desktopLinkClass = (isActive: boolean) =>
    `inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors ${
      isActive
        ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
    }`;

  const mobileLinkClass = (isActive: boolean) =>
    `flex items-center gap-3 rounded-xl px-4 py-3 transition-all ${
      isActive
        ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
    }`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex min-h-[4.5rem] items-center justify-between gap-3 py-3">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="rounded-lg bg-gradient-to-br from-blue-600 to-cyan-600 p-2">
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
              className="rounded-md p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

          <nav className="hidden flex-wrap items-center gap-2 pb-4 pt-1 lg:flex">
            {primaryNavigation.map((item) => {
              const Icon = item.icon;
              const isActive = isNavItemActive(location.pathname, item);

              return (
                <Link key={item.path} to={item.path} className={desktopLinkClass(isActive)}>
                  <Icon className="h-4 w-4" />
                  <span className="whitespace-nowrap font-medium">{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {mobileMenuOpen ? (
          <div className="border-t border-slate-200 bg-white/95 dark:border-slate-800 dark:bg-slate-900/95 lg:hidden">
            <nav className="space-y-1 px-4 py-5">
              {primaryNavigation.map((item) => {
                const Icon = item.icon;
                const isActive = isNavItemActive(location.pathname, item);

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={mobileLinkClass(isActive)}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        ) : null}
      </header>

      {location.pathname !== "/settings" ? <MarketIndicativesTicker /> : null}

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
