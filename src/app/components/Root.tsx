import { Outlet, Link, useLocation } from "react-router-dom";
import { TrendingUp, Network, GitBranch, Brain, Layers, Database, Menu, X, Sun, Moon } from "lucide-react";
import { useState } from "react";
import { useAppSettings } from "../context/AppSettingsContext";

export function Root() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { locale, setLocale, theme, toggleTheme, t } = useAppSettings();

  const navigation = [
    { name: t("nav.overview"), path: "/", icon: TrendingUp },
    { name: t("nav.cluster"), path: "/cluster", icon: Network },
    { name: t("nav.decisionTree"), path: "/decision-tree", icon: GitBranch },
    { name: t("nav.neuralNetwork"), path: "/neural-network", icon: Brain },
    { name: t("nav.hybrid"), path: "/hybrid", icon: Layers },
    { name: t("nav.fundamentals"), path: "/fundamentals", icon: Database },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 gap-2">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-600 to-cyan-600 p-2 rounded-lg">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-slate-900 dark:text-slate-100">{t("header.title")}</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t("header.subtitle")}</p>
              </div>
            </div>

            <div className="hidden lg:flex items-center gap-2">
              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                <span>{theme === "dark" ? t("switch.themeLight") : t("switch.themeDark")}</span>
              </button>
              <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setLocale("ru")}
                  className={`px-3 py-2 text-sm ${locale === "ru" ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"}`}
                >
                  {t("switch.langRu")}
                </button>
                <button
                  type="button"
                  onClick={() => setLocale("en")}
                  className={`px-3 py-2 text-sm ${locale === "en" ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"}`}
                >
                  {t("switch.langEn")}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          <nav className="hidden lg:flex items-center gap-1 pb-3 overflow-x-auto">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-medium whitespace-nowrap">{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="px-4 py-3 flex items-center gap-2">
              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200"
              >
                {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                <span>{theme === "dark" ? t("switch.themeLight") : t("switch.themeDark")}</span>
              </button>
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value as "ru" | "en")}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200"
              >
                <option value="ru">{t("switch.langRu")}</option>
                <option value="en">{t("switch.langEn")}</option>
              </select>
            </div>
            <nav className="px-4 pb-4 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                      isActive
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
