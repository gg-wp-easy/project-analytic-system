export type InlineLoaderProps = {
  label: string;
  className?: string;
  accentClassName?: string;
};

export type PageLoadingStateProps = {
  title: string;
  subtitle?: string;
  accentClassName?: string;
};

export type MetricSkeletonGridProps = {
  count?: number;
};

export type TableSkeletonProps = {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
};

export type CardGridSkeletonProps = {
  count?: number;
  columnsClassName?: string;
};

export type ChartSkeletonProps = {
  className?: string;
};
