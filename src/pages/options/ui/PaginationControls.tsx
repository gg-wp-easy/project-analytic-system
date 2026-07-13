import type { PaginationControlsProps } from "../model";

export function PaginationControls({
  page,
  pageSize,
  totalItems,
  pageSizeOptions = [10, 25, 50, 100],
  locale,
  onPageChange,
  onPageSizeChange,
}: PaginationControlsProps) {
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(page, 1), pageCount);
  const from = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(totalItems, safePage * pageSize);
  const isEn = locale === "en";

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300 md:flex-row md:items-center md:justify-between">
      <div>
        {isEn
          ? `${from}-${to} of ${totalItems}`
          : `${from}-${to} из ${totalItems}`}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2">
          <span>{isEn ? "Rows" : "Строк"}</span>
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="ui-input h-9 w-24 py-1"
          >
            {pageSizeOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          className="ui-secondary-button px-3 py-1.5 text-xs"
        >
          {isEn ? "Prev" : "Назад"}
        </button>
        <span className="min-w-20 text-center font-semibold text-slate-800 dark:text-slate-100">
          {safePage} / {pageCount}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= pageCount}
          className="ui-secondary-button px-3 py-1.5 text-xs"
        >
          {isEn ? "Next" : "Вперёд"}
        </button>
      </div>
    </div>
  );
}
