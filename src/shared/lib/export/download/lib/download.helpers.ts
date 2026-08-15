import type { jsPDF as JsPdf } from "jspdf";
import type { ColInfo } from "xlsx";
import {
  DEFAULT_XLSX_SHEET_NAME,
  EXCEL_HTML_MIME_TYPE,
  PDF_SIDE_PADDING,
  PDF_TOP_PADDING,
  PNG_MIME_TYPE,
  PORTFOLIO_SHEET_NAME,
  SUMMARY_SHEET_NAME,
  SVG_MIME_TYPE,
  type AnalysisExportOptions,
  type ExportColumn,
  type ExportMetric,
  type PortfolioHoldingLike,
} from "../model";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function toCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  return escapeHtml(String(value));
}

export function normalizeCellValue(value: string | number | null | undefined): string | number {
  if (value === null || value === undefined) {
    return "";
  }
  return value;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function getAoa<Row>(rows: Row[], columns: ExportColumn<Row>[]): Array<Array<string | number>> {
  return [
    columns.map((column) => column.header),
    ...rows.map((row) => columns.map((column) => normalizeCellValue(column.render(row)))),
  ];
}

export function estimateSheetWidths(table: Array<Array<string | number>>): ColInfo[] {
  if (!table.length) {
    return [];
  }

  const columnCount = Math.max(...table.map((row) => row.length));
  return Array.from({ length: columnCount }, (_, colIndex) => {
    const width = table.reduce((maxWidth, row) => {
      const value = row[colIndex];
      return Math.max(maxWidth, String(value ?? "").length);
    }, 10);
    return { wch: Math.min(Math.max(width + 2, 10), 42) };
  });
}

export async function renderSvgToCanvas(svg: SVGSVGElement): Promise<HTMLCanvasElement> {
  const xml = new XMLSerializer().serializeToString(svg);
  const svgBlob = new Blob([xml], { type: SVG_MIME_TYPE });
  const url = URL.createObjectURL(svgBlob);

  try {
    return await new Promise<HTMLCanvasElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const width = Math.max(svg.clientWidth, 600);
        const height = Math.max(svg.clientHeight, 400);
        const canvas = document.createElement("canvas");
        canvas.width = width * 2;
        canvas.height = height * 2;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Cannot create canvas context"));
          return;
        }

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas);
      };
      img.onerror = () => reject(new Error("Failed to render chart image"));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error(`Failed to create ${type} blob`));
        return;
      }
      resolve(blob);
    }, type);
  });
}

export function getPortfolioHoldingColumns<Row extends PortfolioHoldingLike>(
  labels?: Partial<{ ticker: string; name: string; weight: string }>,
): ExportColumn<Row>[] {
  return [
    { header: labels?.ticker ?? "Ticker", render: (row) => row.ticker },
    { header: labels?.name ?? "Company", render: (row) => row.name ?? "" },
    { header: labels?.weight ?? "Weight, %", render: (row) => row.weight.toFixed(4) },
  ];
}

export function downloadRowsAsExcel<Row>(rows: Row[], columns: ExportColumn<Row>[], filename: string): void {
  const headerHtml = columns.map((column) => `<th>${escapeHtml(column.header)}</th>`).join("");
  const bodyHtml = rows
    .map((row) => `<tr>${columns.map((column) => `<td>${toCell(column.render(row))}</td>`).join("")}</tr>`)
    .join("");

  const html =
    `\uFEFF<html><head><meta charset="utf-8"></head><body>` +
    `<table border="1"><tr>${headerHtml}</tr>${bodyHtml}</table>` +
    `</body></html>`;

  const blob = new Blob([html], { type: EXCEL_HTML_MIME_TYPE });
  downloadBlob(blob, filename);
}

export async function downloadRowsAsXlsx<Row>(
  rows: Row[],
  columns: ExportColumn<Row>[],
  filename: string,
  sheetName = DEFAULT_XLSX_SHEET_NAME,
): Promise<void> {
  const XLSX = await import("xlsx");
  const table = getAoa(rows, columns);
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(table);
  worksheet["!cols"] = estimateSheetWidths(table);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename, { compression: true });
}

export async function downloadAnalysisResultsAsXlsx<Row>({
  title,
  filename,
  rows,
  columns,
  metrics = [],
}: AnalysisExportOptions<Row>): Promise<void> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();

  const summaryRows: Array<Array<string | number>> = [
    ["Analysis", title],
    ["Exported At", new Date().toLocaleString()],
  ];

  if (metrics.length) {
    summaryRows.push([]);
    summaryRows.push(["Metric", "Value"]);
    summaryRows.push(
      ...metrics.map((metric: ExportMetric) => [
        metric.label,
        typeof metric.value === "number" ? metric.value : String(metric.value ?? ""),
      ]),
    );
  }

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet["!cols"] = estimateSheetWidths(summaryRows);
  XLSX.utils.book_append_sheet(workbook, summarySheet, SUMMARY_SHEET_NAME);

  const holdingsRows = getAoa(rows, columns);
  const holdingsSheet = XLSX.utils.aoa_to_sheet(holdingsRows);
  holdingsSheet["!cols"] = estimateSheetWidths(holdingsRows);
  XLSX.utils.book_append_sheet(workbook, holdingsSheet, PORTFOLIO_SHEET_NAME);

  XLSX.writeFile(workbook, filename, { compression: true });
}

export async function svgToPngDataUrl(svg: SVGSVGElement): Promise<string> {
  const canvas = await renderSvgToCanvas(svg);
  return canvas.toDataURL(PNG_MIME_TYPE);
}

export async function downloadSvgAsPng(svg: SVGSVGElement, filename: string): Promise<void> {
  const canvas = await renderSvgToCanvas(svg);
  const blob = await canvasToBlob(canvas, PNG_MIME_TYPE);
  downloadBlob(blob, filename);
}

export async function downloadAnalysisResultsAsPdf<Row>({
  title,
  filename,
  rows,
  columns,
  metrics = [],
  chartSvg,
}: AnalysisExportOptions<Row>): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let currentY = PDF_TOP_PADDING;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, PDF_SIDE_PADDING, currentY);
  currentY += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Exported: ${new Date().toLocaleString()}`, PDF_SIDE_PADDING, currentY);
  currentY += 18;
  doc.setTextColor(15, 23, 42);

  if (metrics.length) {
    autoTable(doc, {
      startY: currentY,
      head: [["Metric", "Value"]],
      body: metrics.map((metric) => [metric.label, String(metric.value ?? "")]),
      theme: "grid",
      margin: { left: PDF_SIDE_PADDING, right: PDF_SIDE_PADDING },
      styles: { fontSize: 9, cellPadding: 6, lineColor: [226, 232, 240] },
      headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42] },
    });
    currentY = ((doc as JsPdf & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? currentY) + 18;
  }

  if (chartSvg) {
    try {
      const chartDataUrl = await svgToPngDataUrl(chartSvg);
      const chartWidth = pageWidth - PDF_SIDE_PADDING * 2;
      const chartHeight = Math.min(chartWidth * 0.58, 260);
      if (currentY + chartHeight > pageHeight - 80) {
        doc.addPage();
        currentY = PDF_TOP_PADDING;
      }
      doc.addImage(chartDataUrl, "PNG", PDF_SIDE_PADDING, currentY, chartWidth, chartHeight);
      currentY += chartHeight + 18;
    } catch {
      // Keep PDF export working even if the chart image cannot be rendered.
    }
  }

  autoTable(doc, {
    startY: currentY,
    head: [columns.map((column) => column.header)],
    body: rows.map((row) => columns.map((column) => String(column.render(row) ?? ""))),
    theme: "grid",
    margin: { left: PDF_SIDE_PADDING, right: PDF_SIDE_PADDING },
    styles: { fontSize: 9, cellPadding: 6, lineColor: [226, 232, 240], overflow: "linebreak" },
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42] },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 80, halign: "right" },
    },
  });

  doc.save(filename);
}
