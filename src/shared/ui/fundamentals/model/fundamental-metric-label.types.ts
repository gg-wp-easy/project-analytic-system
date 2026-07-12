import type { ReactNode } from "react";
import type { FundamentalMetricKey } from "../../../lib/format/fundamentals";

export type FundamentalMetricLabelProps = {
  label: ReactNode;
  metric: FundamentalMetricKey;
  locale: "ru" | "en";
  className?: string;
};
