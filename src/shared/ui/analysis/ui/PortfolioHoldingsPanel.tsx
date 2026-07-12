import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { StockAvatar } from "../../stock-avatar";
import type { PortfolioHoldingRow, PortfolioHoldingsPanelProps } from "../model";

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

      <div className="ui-table-shell overflow-x-auto">
        <table className="ui-data-table ui-portfolio-table min-w-[48rem]">
          <thead>
            <tr>
              <th className="w-44 min-w-44 whitespace-nowrap">Ticker</th>
              <th className="min-w-[22rem]">{companyLabel}</th>
              <th className="w-32 min-w-32 whitespace-nowrap">{weightLabel}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.ticker}-${row.name ?? ""}`}>
                <td className="w-44 min-w-44 whitespace-nowrap align-top">
                  <div className="flex min-w-0 items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                    <StockAvatar ticker={row.ticker} name={row.name} logoUrl={row.logoUrl} size="sm" />
                    <span className="inline-block max-w-[7.5rem] truncate" title={row.ticker}>{row.ticker}</span>
                  </div>
                </td>
                <td className="ui-cell-name min-w-[22rem] whitespace-normal break-words pr-6 leading-5">{row.name || "-"}</td>
                <td className="ui-cell-number w-32 min-w-32">{row.weight.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
