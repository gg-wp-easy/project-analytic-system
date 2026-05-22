import { PageLoadingState } from "../loading-state";

type AnalysisRunningIndicatorProps = {
  title: string;
  subtitle: string;
  accentClassName: string;
};

export function AnalysisRunningIndicator({ title, subtitle, accentClassName }: AnalysisRunningIndicatorProps) {
  return <PageLoadingState title={title} subtitle={subtitle} accentClassName={accentClassName} />;
}
