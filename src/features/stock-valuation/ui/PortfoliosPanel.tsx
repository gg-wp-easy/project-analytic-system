import { useEffect, useMemo, useRef, useState } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import type { AssetFundamentalRecord, ShareRecord } from "../../../entities/fundamentals";
import {
  downloadAnalysisResultsAsPdf,
  downloadAnalysisResultsAsXlsx,
  type ExportColumn,
} from "../../../shared/lib/export/download";
import { MetricCard, MetricGrid, SectionCard } from "../../../shared/ui/analysis-shell";
import { SavePortfolioButton } from "../../saved-portfolios";
import { formatNumber, formatPercent } from "../lib/stock-valuation.format";
import type { StockAnalysisConfig } from "../model/stock-valuation.consts";
import type { PortfolioKey, StockValuationResult, ValuationPosition } from "../model/stock-valuation.types";

type Props = {
  result: StockValuationResult;
  config: StockAnalysisConfig;
  shares: ShareRecord[];
  fundamentalsByFigi: Record<string, AssetFundamentalRecord>;
};

/** Портфели Марковица анализа: вкладка на каждую цель, выбранная в настройках — первой открытой. */
export function PortfoliosPanel({ result, config, shares, fundamentalsByFigi }: Props) {
  const { t } = useAppSettings();
  const [active, setActive] = useState<PortfolioKey>(result.selected_portfolio);
  const chartRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => setActive(result.selected_portfolio), [result]);

  const portfolio = result.portfolios.find((item) => item.key === active) ?? result.portfolios[0];
  const metrics = useMemo(
    () =>
      portfolio
        ? [
            { label: t("Ожидаемая доходность", "Expected return"), value: formatPercent(portfolio.metrics.expected_return) },
            { label: t("Риск (волатильность)", "Risk (volatility)"), value: formatPercent(portfolio.metrics.risk) },
            { label: t("Коэффициент Шарпа", "Sharpe ratio"), value: formatNumber(portfolio.metrics.sharpe_ratio, 2) },
            { label: t("Бумаг", "Positions"), value: String(portfolio.metrics.assets) },
          ]
        : [],
    [portfolio, t],
  );
  if (!portfolio) {
    return null;
  }

  const columns: ExportColumn<ValuationPosition>[] = [
    { header: "Ticker", render: (row) => row.ticker },
    { header: t("Компания", "Company"), render: (row) => row.name ?? "" },
    { header: t("Вес, %", "Weight, %"), render: (row) => Number((row.weight * 100).toFixed(2)) },
    { header: t("Ожидаемая доходность, %", "Expected return, %"), render: (row) => (row.expected_return === null ? null : Number((row.expected_return * 100).toFixed(1))) },
    { header: "P/E", render: (row) => row.pe },
    { header: t("Справедливый P/E", "Fair P/E"), render: (row) => row.fair_pe },
  ];
  const title = `${t(config.title)} — ${portfolio.label}`;
  const filename = `${config.key}-${portfolio.key}`;
  const chartRows = portfolio.positions.map((row) => ({ ticker: row.ticker, weight: row.weight * 100 }));

  return (
    <SectionCard
      title={t("Портфели", "Portfolios")}
      description={t(
        "Кандидаты — недооценённые и справедливо оценённые компании, сначала плательщики дивидендов. Доходность — дивиденды + рост g.",
        "Candidates are undervalued and fairly valued companies, dividend payers first. Return is dividends + growth g.",
      )}
      action={(
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="ui-secondary-button px-3 py-2 text-xs"
            onClick={() => downloadAnalysisResultsAsXlsx({ title, filename: `${filename}.xlsx`, rows: portfolio.positions, columns, metrics })}
          >
            <FileSpreadsheet className="h-4 w-4" />
            XLSX
          </button>
          <button
            type="button"
            className="ui-secondary-button px-3 py-2 text-xs"
            onClick={() =>
              downloadAnalysisResultsAsPdf({
                title, filename: `${filename}.pdf`, rows: portfolio.positions, columns, metrics,
                chartSvg: chartRef.current?.querySelector("svg"),
              })
            }
          >
            <FileText className="h-4 w-4" />
            PDF
          </button>
          <SavePortfolioButton
            holdings={portfolio.positions.map((row) => ({
              figi: row.figi ?? undefined, ticker: row.ticker, name: row.name, weight: row.weight,
              dividendYield: row.dividend_yield, expectedReturn: row.expected_return, risk: row.risk,
            }))}
            metrics={metrics.map((item) => ({ label: item.label, value: item.value, rawValue: item.value }))}
            sourceKey={config.sourceKey}
            sourceLabel={t(config.title)}
            assetClass="stock"
            defaultName={title}
            shares={shares}
            fundamentalsByFigi={fundamentalsByFigi}
          />
        </div>
      )}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {result.portfolios.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActive(item.key)}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                item.key === portfolio.key
                  ? "bg-slate-900 font-semibold text-white dark:bg-white dark:text-slate-900"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        {portfolio.message && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">{portfolio.message}</p>
        )}
        <MetricGrid>
          {metrics.map((item) => (
            <MetricCard key={item.label} label={item.label} value={item.value} />
          ))}
        </MetricGrid>
        <div className="grid gap-5 2xl:grid-cols-[16rem_1fr]">
          <div className="mx-auto h-64 w-full max-w-sm" ref={chartRef}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartRows} dataKey="weight" nameKey="ticker" outerRadius={88} labelLine={false} isAnimationActive={false}
                  label={({ ticker, weight }) => (Number(weight) >= 7 ? ticker : "")}>
                  {chartRows.map((row, index) => (
                    <Cell key={row.ticker} fill={config.palette[index % config.palette.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `${Number(value).toFixed(1)}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="ui-table-shell overflow-x-auto">
            <table className="ui-data-table min-w-[34rem]">
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>{t("Компания", "Company")}</th>
                  <th>{t("Вес", "Weight")}</th>
                  <th>{t("Доходность", "Return")}</th>
                  <th>{t("P/E → справедливый", "P/E → fair")}</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.positions.map((row) => (
                  <tr key={row.ticker}>
                    <td className="font-medium">{row.ticker}</td>
                    <td className="ui-cell-name whitespace-normal">{row.name ?? "—"}</td>
                    <td className="ui-cell-number">{formatPercent(row.weight)}</td>
                    <td className="ui-cell-number">{formatPercent(row.expected_return)}</td>
                    <td className="ui-cell-number">{formatNumber(row.pe)} → {formatNumber(row.fair_pe)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
