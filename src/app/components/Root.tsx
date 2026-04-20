import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Brain,
  ChevronDown,
  Database,
  GitBranch,
  Landmark,
  Layers,
  Menu,
  Moon,
  Network,
  Newspaper,
  Sun,
  TrendingUp,
  X,
} from "lucide-react";
import { useAppSettings } from "../context/AppSettingsContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

type NavItem = {
  name: string;
  path: string;
  icon: LucideIcon;
};

function isActivePath(currentPath: string, targetPath: string): boolean {
  if (targetPath === "/") {
    return currentPath === "/";
  }

  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
}

export function Root() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { locale, setLocale, theme, toggleTheme, t } = useAppSettings();

  const primaryNavigation: NavItem[] = [
    { name: t("nav.overview"), path: "/", icon: TrendingUp },
    { name: t({ ru: "Анализ облигаций", en: "Bond Analysis" }), path: "/bonds", icon: Landmark },
    { name: t({ ru: "Новости + ИИ", en: "News + AI" }), path: "/news-assistant", icon: Newspaper },
    { name: t("nav.fundamentals"), path: "/fundamentals", icon: Database },
    { name: t({ ru: "Опционы", en: "Options" }), path: "/options", icon: Activity },
  ];

  const modelNavigation: NavItem[] = [
    { name: t("nav.cluster"), path: "/cluster", icon: Network },
    { name: t("nav.decisionTree"), path: "/decision-tree", icon: GitBranch },
    { name: t("nav.neuralNetwork"), path: "/neural-network", icon: Brain },
    { name: t("nav.hybrid"), path: "/hybrid", icon: Layers },
  ];

  const activeModel = modelNavigation.find((item) => isActivePath(location.pathname, item.path));
  const isModelsActive = Boolean(activeModel);

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

            <div className="hidden lg:flex items-center gap-3">
              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                <span>{theme === "dark" ? t("switch.themeLight") : t("switch.themeDark")}</span>
              </button>
              <div className="inline-flex overflow-hidden rounded-lg border border-slate-300 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setLocale("ru")}
                  className={`px-3 py-2 text-sm ${
                    locale === "ru"
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                      : "bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  }`}
                >
                  {t("switch.langRu")}
                </button>
                <button
                  type="button"
                  onClick={() => setLocale("en")}
                  className={`px-3 py-2 text-sm ${
                    locale === "en"
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                      : "bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  }`}
                >
                  {t("switch.langEn")}
                </button>
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

          <nav className="hidden items-center justify-between gap-4 pb-4 pt-1 lg:flex">
            <div className="flex flex-wrap items-center gap-2">
              {primaryNavigation.map((item) => {
                const Icon = item.icon;
                const isActive = isActivePath(location.pathname, item.path);

                return (
                  <Link key={item.path} to={item.path} className={desktopLinkClass(isActive)}>
                    <Icon className="h-4 w-4" />
                    <span className="font-medium whitespace-nowrap">{item.name}</span>
                  </Link>
                );
              })}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={`${desktopLinkClass(isModelsActive)} border border-transparent ${
                      isModelsActive ? "shadow-sm" : ""
                    }`}
                  >
                    <Layers className="h-4 w-4" />
                    <span className="font-medium whitespace-nowrap">
                      {activeModel?.name ?? t({ ru: "Модели", en: "Models" })}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-70" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-72 rounded-2xl border-slate-200/80 bg-white/95 p-2 dark:border-slate-700 dark:bg-slate-900/95"
                >
                  <DropdownMenuLabel className="px-3 pt-2 pb-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                    {t({ ru: "Аналитические модели", en: "Analytics models" })}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-slate-200 dark:bg-slate-700" />
                  {modelNavigation.map((item) => {
                    const Icon = item.icon;
                    const isActive = isActivePath(location.pathname, item.path);

                    return (
                      <DropdownMenuItem
                        key={item.path}
                        asChild
                        className={isActive ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : ""}
                      >
                        <Link to={item.path} className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5">
                          <Icon className="h-4 w-4" />
                          <span className="font-medium">{item.name}</span>
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </nav>
        </div>

        {mobileMenuOpen ? (
          <div className="border-t border-slate-200 bg-white/95 dark:border-slate-800 dark:bg-slate-900/95 lg:hidden">
            <div className="flex items-center gap-2 px-4 py-4">
              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                <span>{theme === "dark" ? t("switch.themeLight") : t("switch.themeDark")}</span>
              </button>
              <select
                value={locale}
                onChange={(event) => setLocale(event.target.value as "ru" | "en")}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <option value="ru">{t("switch.langRu")}</option>
                <option value="en">{t("switch.langEn")}</option>
              </select>
            </div>

            <nav className="space-y-4 px-4 pb-5">
              <div className="space-y-1">
                {primaryNavigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = isActivePath(location.pathname, item.path);

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
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-2 dark:border-slate-700 dark:bg-slate-900/60">
                <div className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {t({ ru: "Аналитические модели", en: "Analytics models" })}
                </div>
                <div className="space-y-1">
                  {modelNavigation.map((item) => {
                    const Icon = item.icon;
                    const isActive = isActivePath(location.pathname, item.path);

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
                </div>
              </div>
            </nav>
          </div>
        ) : null}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
