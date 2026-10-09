import type { DesktopApi, StatusState } from "../model";

export function getDesktopApi(): DesktopApi | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return (window as Window & { electron?: DesktopApi }).electron;
}

export function getStatusClassName(status: StatusState): string {
  if (status?.tone === "success") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100";
  }
  if (status?.tone === "error") {
    return "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100";
  }
  return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200";
}
