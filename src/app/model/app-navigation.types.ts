import type { InlineTranslation } from "./app-settings.types";

export type AppNavigationIconKey = "activity" | "briefcase" | "database" | "landmark" | "layers" | "settings" | "trendingUp";

export type AppNavigationItem = {
  title: InlineTranslation;
  path: string;
  icon: AppNavigationIconKey;
  activePaths?: string[];
};
