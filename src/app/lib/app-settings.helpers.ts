import { APP_LOCALE_STORAGE_KEY, APP_THEME_STORAGE_KEY, APP_TRANSLATIONS } from "../model";
import type { InlineTranslation, Locale, Theme, TranslationKey } from "../model";

export function getInitialTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }
  const saved = window.localStorage.getItem(APP_THEME_STORAGE_KEY);
  return saved === "dark" ? "dark" : "light";
}

export function getInitialLocale(): Locale {
  if (typeof window === "undefined") {
    return "ru";
  }
  const saved = window.localStorage.getItem(APP_LOCALE_STORAGE_KEY);
  return saved === "en" ? "en" : "ru";
}

export function applyAppTheme(theme: Theme): void {
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }
}

export function persistAppTheme(theme: Theme): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(APP_THEME_STORAGE_KEY, theme);
  }
}

export function persistAppLocale(locale: Locale): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(APP_LOCALE_STORAGE_KEY, locale);
  }
}

export function translateAppText(
  locale: Locale,
  key: TranslationKey | InlineTranslation | string,
  en?: string,
): string {
  if (typeof en === "string") {
    return locale === "en" ? en : String(key);
  }

  if (typeof key === "string") {
    return key in APP_TRANSLATIONS[locale]
      ? APP_TRANSLATIONS[locale][key as TranslationKey]
      : key;
  }

  return key[locale];
}
