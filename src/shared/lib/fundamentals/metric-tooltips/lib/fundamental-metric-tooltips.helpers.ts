import type { FundamentalMetricKey } from "../../../format/fundamentals";
import { FUNDAMENTAL_METRIC_TOOLTIPS, type AppLocaleCode } from "../model";

export function getFundamentalMetricTooltip(
  metric: FundamentalMetricKey,
  locale: AppLocaleCode,
): string | null {
  const mapped = FUNDAMENTAL_METRIC_TOOLTIPS[metric];
  if (!mapped) {
    return null;
  }
  return locale === "en" ? mapped.en : mapped.ru;
}
