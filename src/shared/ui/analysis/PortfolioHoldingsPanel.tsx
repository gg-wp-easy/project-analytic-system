import type { RefObject } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type PortfolioHoldingRow = {
  ticker: string;
  name?: string | null;
  weight: number;
};

type PortfolioHoldingsPanelProps<Row extends PortfolioHoldingRow> = {
  rows: Row[];
  palette: string[];
  chartRef?: RefObject<HTMLDivElement | null>;
  companyLabel: string;
  weightLabel: string;
};

export function PortfolioHoldingsPanel<Row extends PortfolioHoldingRow>({
  rows,
  palette,
  chartRef,
  companyLabel,
  weightLabel,
}: PortfolioHoldingsPanelProps<Row>) {
  if (!rows.length) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="ui-portfolio-chart" ref={chartRef}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="weight"
              nameKey="ticker"
              cx="50%"
              cy="50%"
              outerRadius={105}
              labelLine={false}
              label={({ ticker, weight }) => (Number(weight) >= 6 ? `${ticker}: ${Number(weight).toFixed(1)}%` : "")}
            >
              {rows.map((row, idx) => (
                <Cell key={row.ticker} fill={palette[idx % palette.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => `${Number(value).toFixed(2)}%`} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="ui-table-shell ui-table-shell-static">
        <table className="ui-data-table ui-portfolio-table">
          <thead>
            <tr>
              <th>Ticker</th>
              <th>{companyLabel}</th>
              <th>{weightLabel}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.ticker}-${row.name ?? ""}`}>
                <td className="font-medium text-slate-900 dark:text-slate-100">{row.ticker}</td>
                <td className="ui-cell-name">{row.name || "-"}</td>
                <td className="ui-cell-number">{row.weight.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
