import type { InlineTranslation } from "./app-settings.types";

export type AppNavigationIconKey = "activity" | "briefcase" | "database" | "gem" | "info" | "landmark" | "layers" | "settings" | "trendingUp";

export type AppNavigationItem = {
  title: InlineTranslation;
  path: string;
  icon: AppNavigationIconKey;
  activePaths?: string[];
};
