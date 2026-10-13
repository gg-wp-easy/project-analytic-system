import { useMemo, useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import { downloadRowsAsXlsx } from "../../../shared/lib/export/download";
import { SectionCard } from "../../../shared/ui/analysis-shell";
import { formatNumber, formatPercent } from "../lib/stock-valuation.format";
import { CLASS_STYLES, CLASS_TITLES } from "../model/stock-valuation.consts";
import type { StockValuationResult, ValuationClass, ValuationCompany } from "../model/stock-valuation.types";

const FILTERS: ValuationClass[] = ["undervalued", "fair", "overvalued", "not_rated"];

/** Компании выбранного класса: P/E, справедливый P/E и потенциал цены. */
export function CompaniesTable({ result }: { result: StockValuationResult }) {
  const { t } = useAppSettings();
  const [filter, setFilter] = useState<ValuationClass>("undervalued");
  const showGroup = result.analysis === "cluster";
  const rows = useMemo(
    () => result.companies.filter((row) => row.valuation_class === filter),
    [filter, result.companies],
  );

  const exportRows = async () => {
    await downloadRowsAsXlsx(
      result.companies,
      [
        { header: "Ticker", render: (row: ValuationCompany) => row.ticker },
        { header: t("Компания", "Company"), render: (row) => row.name ?? "" },
        { header: t("Отрасль", "Sector"), render: (row) => row.sector ?? "" },
        { header: "P/E", render: (row) => row.pe },
        { header: t("Справедливый P/E", "Fair P/E"), render: (row) => row.fair_pe },
        { header: t("Потенциал, %", "Upside, %"), render: (row) => (row.upside === null ? null : row.upside * 100) },
        { header: t("Оценка", "Valuation"), render: (row) => row.valuation_class_text ?? "" },
      ],
      `${result.analysis}-pe-valuation.xlsx`,
    );
  };

  return (
    <SectionCard
      title={t("Компании", "Companies")}
      description={t(
        "Потенциал — насколько цена должна измениться, чтобы P/E стал справедливым.",
        "Upside — how much the price would have to change for P/E to reach its fair value.",
      )}
      action={(
        <button type="button" onClick={exportRows} className="ui-secondary-button px-3 py-2 text-xs">
          <FileSpreadsheet className="h-4 w-4" />
          XLSX
        </button>
      )}
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              filter === key ? CLASS_STYLES[key] + " font-semibold ring-1 ring-current/30" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
            }`}
          >
            {t(CLASS_TITLES[key])} · {result.summary.counts[key]}
          </button>
        ))}
      </div>
      {rows.length ? (
        <div className="ui-table-shell max-h-[32rem] overflow-auto">
          <table className="ui-data-table min-w-[44rem]">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>{t("Компания", "Company")}</th>
                <th>{t("Отрасль", "Sector")}</th>
                {showGroup && <th>{t("Группа", "Group")}</th>}
                <th>P/E</th>
                {filter === "not_rated" ? (
                  <th>{t("Причина", "Reason")}</th>
                ) : (
                  <>
                    <th>{t("Справедливый P/E", "Fair P/E")}</th>
                    <th>{t("Потенциал", "Upside")}</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.ticker}>
                  <td className="font-medium">{row.ticker}</td>
                  <td className="ui-cell-name whitespace-normal">{row.name ?? "—"}</td>
                  <td className="text-xs text-slate-600 dark:text-slate-300">{row.sector ?? "—"}</td>
                  {showGroup && <td className="ui-cell-number">{row.group ?? "—"}</td>}
                  <td className="ui-cell-number">{formatNumber(row.pe)}</td>
                  {filter === "not_rated" ? (
                    <td className="whitespace-normal text-xs">
                      {row.valuation_class_text ?? "—"}
                      {row.report && !row.report.startsWith("smart-lab") && (
                        <span className="block text-slate-500 dark:text-slate-400">{row.report}</span>
                      )}
                    </td>
                  ) : (
                    <>
                      <td className="ui-cell-number">{formatNumber(row.fair_pe)}</td>
                      <td className="ui-cell-number">{formatPercent(row.upside, 0, true)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("Нет компаний в этом классе.", "No companies in this class.")}</p>
      )}
    </SectionCard>
  );
}
