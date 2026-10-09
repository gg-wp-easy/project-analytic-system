import type { ReactNode } from "react";
import appIcon from "../../../assets/app-icon.png";
import { useAppSettings } from "../../../app/context/AppSettingsContext";

/** Каркас экранов до входа: логотип, название и карточка по центру. */
export function AuthScreen({ children }: { children: ReactNode }) {
  const { t } = useAppSettings();

  return (
    <div className="relative isolate flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="ui-ambient" aria-hidden="true">
        <span />
        <span />
      </div>
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <img src={appIcon} alt="" className="h-12 w-12 shrink-0 rounded-xl" />
          <div className="text-base font-semibold leading-5 text-slate-900 dark:text-slate-100">
            {t("header.title")}
          </div>
        </div>
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">{children}</div>
      </div>
    </div>
  );
}
