import { getFundamentalMetricTooltip } from "../../../lib/fundamentals/metric-tooltips";
import { MetricTooltip } from "../../analysis/MetricTooltip";
import { cn } from "../lib";
import type { FundamentalMetricLabelProps } from "../model";

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
