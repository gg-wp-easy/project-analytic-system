import type { OptionContractsTableProps } from "../model";
import {
  formatDate,
  formatNumber,
  getOptionTypeLabel,
} from "../lib/options-helpers";

export function OptionContractsTable({ items, locale, framed = true }: OptionContractsTableProps) {
  const table = (
      <table className="ui-data-table">
        <thead>
          <tr>
            <th>{locale === "en" ? "Ticker" : "Тикер"}</th>
            <th>{locale === "en" ? "Name" : "Название"}</th>
            <th>{locale === "en" ? "Type" : "Тип"}</th>
            <th>{locale === "en" ? "Class" : "Класс"}</th>
            <th>{locale === "en" ? "Strike" : "Страйк"}</th>
            <th>{locale === "en" ? "Expiration" : "Экспирация"}</th>
            <th>{locale === "en" ? "Lot" : "Лот"}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((option) => (
            <tr key={option.uid}>
              <td className="ui-cell-number font-medium text-slate-900 dark:text-slate-100">{option.ticker}</td>
              <td className="ui-cell-name">
                <div>{option.name || "-"}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {option.realExchange || option.exchange || "-"}
                </div>
              </td>
              <td className="ui-cell-number">{getOptionTypeLabel(option, locale) || "-"}</td>
              <td className="ui-cell-number">{option.classCode || "-"}</td>
              <td className="ui-cell-number">{formatNumber(option.strikePrice, locale)}</td>
              <td className="ui-cell-number">{formatDate(option.expirationDate, locale)}</td>
              <td className="ui-cell-number">{formatNumber(option.lot, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
  );

  if (!framed) {
    return table;
  }

  return (
    <div className="ui-table-shell overflow-x-auto">
      {table}
    </div>
  );
}
