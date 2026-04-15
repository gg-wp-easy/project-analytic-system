import type { ReactNode } from "react";
import type { FundamentalMetricKey } from "../../lib/format/fundamentals";
import { getFundamentalMetricTooltip } from "../../lib/fundamentals/metric-tooltips";
import { MetricTooltip } from "../analysis/MetricTooltip";

type FundamentalMetricLabelProps = {
  label: ReactNode;
  metric: FundamentalMetricKey;
  locale: "ru" | "en";
  className?: string;
};

function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function FundamentalMetricLabel({
  label,
  metric,
  locale,
  className,
}: FundamentalMetricLabelProps) {
  const tooltip = getFundamentalMetricTooltip(metric, locale);

  return (
    <span className={cn("inline-flex items-center gap-1.5 align-middle", className)}>
      <span>{label}</span>
      {tooltip ? <MetricTooltip text={tooltip} /> : null}
    </span>
  );
}
