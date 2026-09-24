import { useCallback, useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BriefcaseBusiness,
  Gem,
  Database,
  Info,
  Landmark,
  Layers,
  Maximize2,
  Menu,
  Minimize2,
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
  briefcase: BriefcaseBusiness,
  database: Database,
  gem: Gem,
  info: Info,
  landmark: Landmark,
  layers: Layers,
  settings: Settings,
  trendingUp: TrendingUp,
};

type FullscreenDesktopApi = {
  isDesktop?: boolean;
  toggleFullscreen?: () => Promise<{ isFullscreen?: boolean }>;
  getFullscreenState?: () => Promise<{ isFullscreen?: boolean }>;
  onFullscreenChange?: (listener: (payload: { isFullscreen?: boolean }) => void) => () => void;
};

function getFullscreenDesktopApi(): FullscreenDesktopApi | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return (window as Window & { electron?: FullscreenDesktopApi }).electron;
}

export function Root() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { t } = useAppSettings();

  const desktopLinkClass = (isActive: boolean) =>
    `inline-flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
      isActive
        ? "bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary"
        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
    }`;

  const mobileLinkClass = (isActive: boolean) =>
    `flex items-center gap-3 rounded-lg px-4 py-3 transition-all ${
      isActive
        ? "bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary"
        : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
    }`;

  useEffect(() => {
    const api = getFullscreenDesktopApi();
    let removeDesktopListener: (() => void) | undefined;

    void api?.getFullscreenState?.().then((state) => {
      setIsFullscreen(Boolean(state?.isFullscreen));
    });

    if (api?.onFullscreenChange) {
      removeDesktopListener = api.onFullscreenChange((state) => {
        setIsFullscreen(Boolean(state?.isFullscreen));
      });
    }

    const syncBrowserFullscreenState = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", syncBrowserFullscreenState);
    syncBrowserFullscreenState();

    return () => {
      removeDesktopListener?.();
      document.removeEventListener("fullscreenchange", syncBrowserFullscreenState);
    };
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    const api = getFullscreenDesktopApi();

    if (api?.toggleFullscreen) {
      const state = await api.toggleFullscreen();
      setIsFullscreen(Boolean(state?.isFullscreen));
      return;
    }

    if (document.fullscreenElement) {
      await document.exitFullscreen();
      setIsFullscreen(false);
      return;
    }

    await document.documentElement.requestFullscreen();
    setIsFullscreen(true);
  }, []);

  const fullscreenLabel = isFullscreen
    ? t({ ru: "Выйти из полноэкранного режима", en: "Exit fullscreen" })
    : t({ ru: "Полноэкранный режим", en: "Fullscreen" });
  const FullscreenIcon = isFullscreen ? Minimize2 : Maximize2;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur dark:bg-card/92">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex min-h-16 items-center justify-between gap-3 py-2">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-base font-semibold leading-5 text-slate-900 dark:text-slate-100">{t("header.title")}</h1>
              </div>
            </div>

            <nav className="hidden min-w-0 flex-1 items-center justify-end gap-1 xl:flex">
              {APP_NAVIGATION_ITEMS.map((item) => {
                const Icon = appNavigationIcons[item.icon];
                const isActive = isNavItemActive(location.pathname, item);

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={desktopLinkClass(isActive)}
                    aria-label={t(item.title)}
                    title={t(item.title)}
                  >
                    <Icon className="h-4 w-4" />
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleToggleFullscreen}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label={fullscreenLabel}
                title={fullscreenLabel}
              >
                <FullscreenIcon className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 xl:hidden"
                aria-label={mobileMenuOpen ? t({ ru: "Закрыть меню", en: "Close menu" }) : t({ ru: "Открыть меню", en: "Open menu" })}
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen ? (
          <div className="border-t border-border bg-card xl:hidden">
            <nav className="space-y-1 px-4 py-4">
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

      {location.pathname !== APP_ABSOLUTE_ROUTE_PATHS.settings && location.pathname !== APP_ABSOLUTE_ROUTE_PATHS.about ? <MarketIndicativesTicker /> : null}

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
