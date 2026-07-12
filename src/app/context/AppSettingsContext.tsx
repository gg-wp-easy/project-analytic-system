import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  applyAppTheme,
  getInitialLocale,
  getInitialTheme,
  persistAppLocale,
  persistAppTheme,
  translateAppText,
} from "../lib";
import type {
  AppSettingsContextValue,
  InlineTranslation,
  Locale,
  Theme,
  TranslationKey,
} from "../model";

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => getInitialTheme());
  const [locale, setLocaleState] = useState<Locale>(() => getInitialLocale());

  useEffect(() => {
    applyAppTheme(theme);
    persistAppTheme(theme);
  }, [theme]);

  useEffect(() => {
    persistAppLocale(locale);
  }, [locale]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);
  const setLocale = useCallback((next: Locale) => setLocaleState(next), []);
  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === "light" ? "dark" : "light"));
  }, []);
  const t = useCallback(
    (key: TranslationKey | InlineTranslation | string, en?: string) => translateAppText(locale, key, en),
    [locale],
  );

  const value = useMemo<AppSettingsContextValue>(
    () => ({
      theme,
      locale,
      setTheme,
      setLocale,
      toggleTheme,
      t,
    }),
    [theme, locale, setTheme, setLocale, toggleTheme, t],
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings(): AppSettingsContextValue {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) {
    throw new Error("useAppSettings must be used inside AppSettingsProvider");
  }
  return ctx;
}
