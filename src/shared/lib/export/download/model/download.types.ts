export type ExportColumn<Row> = {
  header: string;
  render: (row: Row) => string | number | null | undefined;
};

export type ExportMetric = {
  label: string;
  value: string | number | null | undefined;
};

export type PortfolioHoldingLike = {
  ticker: string;
  name?: string | null;
  weight: number;
};

export type AnalysisExportOptions<Row> = {
  title: string;
  filename: string;
  rows: Row[];
  columns: ExportColumn<Row>[];
  metrics?: ExportMetric[];
  chartSvg?: SVGSVGElement | null;
};
