export type DashboardLocalizedText = {
  ru: string;
  en: string;
};

export type DashboardIconKey = "activity" | "briefcase" | "database" | "gem" | "landmark" | "layers" | "trendingUp";

export type DashboardSectionConfig = {
  title: DashboardLocalizedText;
  description: DashboardLocalizedText;
  path: string;
  icon: DashboardIconKey;
  color: string;
};

export type DashboardHeroConfig = {
  badge: DashboardLocalizedText;
  title: DashboardLocalizedText;
  description: DashboardLocalizedText;
};
