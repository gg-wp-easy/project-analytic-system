import { PageLoadingState } from "../../loading-state";
import type { AnalysisRunningIndicatorProps } from "../model";

export function AnalysisRunningIndicator({ title, subtitle, accentClassName }: AnalysisRunningIndicatorProps) {
  return <PageLoadingState title={title} subtitle={subtitle} accentClassName={accentClassName} />;
}
