import type { ReactNode, RefObject } from "react";
import type { ChartSkeletonVariant } from "../../loading-state";

export type TooltipSide = "top" | "right" | "bottom" | "left";

export type AnalysisRunningIndicatorProps = {
  title: string;
  subtitle: string;
  accentClassName: string;
};

export type AnalysisLoadingChartItem = {
  title: string;
  subtitle?: string;
  variant?: ChartSkeletonVariant;
};

export type AnalysisLoadingPreviewProps = {
  accentClassName?: string;
  metricCount?: number;
  metricsTitle: string;
  metricsDescription?: string;
  chartsTitle: string;
  chartsDescription?: string;
  charts: AnalysisLoadingChartItem[];
  chartColumnsClassName?: string;
  tableTitle: string;
  tableDescription?: string;
  tableRows?: number;
  tableColumns?: number;
};

export type InfoTooltipProps = {
  label: string;
  children: ReactNode;
  side?: TooltipSide;
};

export type MetricTooltipProps = {
  text: string;
};

export type PortfolioHoldingRow = {
  ticker: string;
  name?: string | null;
  weight: number;
  logoUrl?: string | null;
};

export type PortfolioHoldingsPanelProps<Row extends PortfolioHoldingRow> = {
  rows: Row[];
  palette: string[];
  chartRef?: RefObject<HTMLDivElement | null>;
  companyLabel: string;
  weightLabel: string;
};
