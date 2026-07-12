import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type AnalysisShellAccent = "violet" | "emerald" | "orange" | "cyan" | "slate" | "blue" | "amber";

export type PageHeroProps = {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  aside?: ReactNode;
  footer?: ReactNode;
  accent?: AnalysisShellAccent;
  className?: string;
};

export type AnalysisPageFrameProps = {
  hero: ReactNode;
  sidebar: ReactNode;
  children: ReactNode;
  sidebarClassName?: string;
  contentClassName?: string;
};

export type AnalysisSidebarCardProps = {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  accent?: AnalysisShellAccent;
  className?: string;
  children: ReactNode;
};

export type SectionCardProps = {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
};

export type MetricGridProps = {
  children: ReactNode;
  className?: string;
};

export type MetricCardProps = {
  label: ReactNode;
  value: ReactNode;
  helper?: ReactNode;
  className?: string;
};
