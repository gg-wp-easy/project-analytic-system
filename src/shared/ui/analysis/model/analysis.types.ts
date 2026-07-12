import type { ReactNode, RefObject } from "react";

export type TooltipSide = "top" | "right" | "bottom" | "left";

export type AnalysisRunningIndicatorProps = {
  title: string;
  subtitle: string;
  accentClassName: string;
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
