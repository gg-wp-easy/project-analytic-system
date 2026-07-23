import { ChartSkeleton, MetricSkeletonGrid, TableSkeleton } from "../../loading-state";
import { SectionCard } from "../../analysis-shell";
import type { AnalysisLoadingPreviewProps } from "../model";

export function AnalysisLoadingPreview({
  accentClassName = "text-blue-600",
  metricCount = 4,
  metricsTitle,
  metricsDescription,
  chartsTitle,
  chartsDescription,
  charts,
  chartColumnsClassName = "lg:grid-cols-2",
  tableTitle,
  tableDescription,
  tableRows = 8,
  tableColumns = 6,
}: AnalysisLoadingPreviewProps) {
  return (
    <>
      <SectionCard title={metricsTitle} description={metricsDescription}>
        <MetricSkeletonGrid count={metricCount} />
      </SectionCard>

      {charts.length ? (
        <SectionCard title={chartsTitle} description={chartsDescription}>
          <div className={`grid grid-cols-1 gap-4 ${chartColumnsClassName}`}>
            {charts.map((chart) => (
              <ChartSkeleton
                key={`${chart.title}-${chart.variant ?? "bars"}`}
                title={chart.title}
                subtitle={chart.subtitle}
                variant={chart.variant}
                accentClassName={accentClassName}
              />
            ))}
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title={tableTitle} description={tableDescription}>
        <TableSkeleton rows={tableRows} columns={tableColumns} />
      </SectionCard>
    </>
  );
}