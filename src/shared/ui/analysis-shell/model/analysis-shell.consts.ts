import type { AnalysisShellAccent } from "./analysis-shell.types";

export const ANALYSIS_SHELL_HERO_ACCENT_CLASSES: Record<AnalysisShellAccent, string> = {
  violet: "bg-gradient-to-br from-indigo-700 via-violet-600 to-purple-500",
  emerald: "bg-gradient-to-br from-teal-700 via-emerald-600 to-green-500",
  orange: "bg-gradient-to-br from-amber-600 via-orange-500 to-rose-500",
  cyan: "bg-gradient-to-br from-teal-700 via-cyan-600 to-sky-600",
  slate: "bg-gradient-to-br from-slate-800 via-slate-700 to-slate-600",
  blue: "bg-gradient-to-br from-sky-700 via-blue-600 to-teal-500",
  amber: "bg-gradient-to-br from-amber-600 via-yellow-500 to-orange-500",
};

export const ANALYSIS_SHELL_ICON_ACCENT_CLASSES: Record<AnalysisShellAccent, string> = {
  violet: "bg-violet-500/15 text-violet-200 ring-violet-300/25",
  emerald: "bg-emerald-500/15 text-emerald-200 ring-emerald-300/25",
  orange: "bg-orange-500/15 text-orange-100 ring-orange-300/25",
  cyan: "bg-cyan-400/15 text-cyan-100 ring-cyan-200/25",
  slate: "bg-white/10 text-white ring-white/20",
  blue: "bg-blue-400/15 text-blue-100 ring-blue-200/25",
  amber: "bg-amber-400/15 text-amber-100 ring-amber-200/25",
};

export const ANALYSIS_SHELL_SIDEBAR_ACCENT_CLASSES: Record<AnalysisShellAccent, string> = {
  violet: "bg-violet-500/10 text-violet-700 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/20",
  emerald: "bg-emerald-500/10 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/20",
  orange: "bg-orange-500/10 text-orange-700 ring-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-500/20",
  cyan: "bg-cyan-500/10 text-cyan-700 ring-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-300 dark:ring-cyan-500/20",
  slate: "bg-slate-500/10 text-slate-700 ring-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-500/20",
  blue: "bg-sky-500/10 text-sky-700 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/20",
  amber: "bg-amber-500/10 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/20",
};
