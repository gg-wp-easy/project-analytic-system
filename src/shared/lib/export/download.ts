type ExcelColumn<Row> = {
  header: string;
  render: (row: Row) => string | number | null | undefined;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  return escapeHtml(String(value));
}

export function downloadRowsAsExcel<Row>(rows: Row[], columns: ExcelColumn<Row>[], filename: string): void {
  const headerHtml = columns.map((column) => `<th>${escapeHtml(column.header)}</th>`).join("");
  const bodyHtml = rows
    .map((row) => `<tr>${columns.map((column) => `<td>${toCell(column.render(row))}</td>`).join("")}</tr>`)
    .join("");

  const html =
    `\uFEFF<html><head><meta charset="utf-8"></head><body>` +
    `<table border="1"><tr>${headerHtml}</tr>${bodyHtml}</table>` +
    `</body></html>`;

  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function downloadSvgAsPng(svg: SVGSVGElement, filename: string): Promise<void> {
  const xml = new XMLSerializer().serializeToString(svg);
  const svgBlob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  await new Promise<void>((resolve, reject) => {
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
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Failed to create PNG blob"));
          return;
        }
        const pngUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = pngUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(pngUrl);
        resolve();
      }, "image/png");
    };
    img.onerror = () => reject(new Error("Failed to render chart image"));
    img.src = url;
  });

  URL.revokeObjectURL(url);
}

