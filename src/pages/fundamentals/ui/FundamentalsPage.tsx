import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Database, Download, RefreshCw, Trash2 } from "lucide-react";
import { useRef } from "react";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import { useFundamentals } from "../../../entities/fundamentals";
import { Link } from "react-router-dom";
import { MetricCard, MetricGrid, PageHero, SectionCard } from "../../../shared/ui/analysis-shell";
import { MetricSkeletonGrid, PageLoadingState, TableSkeleton } from "../../../shared/ui/loading-state";
import { formatFundamentalMetricValue, type FundamentalMetricKey } from "../../../shared/lib/format/fundamentals";
import { AppErrorDialog } from "../../../shared/ui/app-error-dialog";
import { FundamentalMetricLabel } from "../../../shared/ui/fundamentals/FundamentalMetricLabel";
import { StockAvatar } from "../../../shared/ui/stock-avatar";
import { FundamentalsTabs } from "./FundamentalsTabs";

function formatSectorRu(rawSector: string | null | undefined): string {
  const sector = (rawSector ?? "").trim();
  if (!sector) {
    return "-";
  }

  const normalized = sector.toLowerCase().replace(/[_-]+/g, " ");
  const exact: Record<string, string> = {
    energy: "Энергетика",
    financial: "Финансы",
    financials: "Финансы",
    industrials: "Промышленность",
    materials: "Материалы",
    "consumer discretionary": "Потребительский сектор",
    "consumer staples": "Товары первой необходимости",
    "information technology": "Информационные технологии",
    technology: "Информационные технологии",
    it: "Информационные технологии",
    "communication services": "Связь и коммуникации",
    telecom: "Связь и коммуникации",
    utilities: "Коммунальные услуги",
    "real estate": "Недвижимость",
    healthcare: "Здравоохранение",
    "health care": "Здравоохранение",
    "health care services": "Здравоохранение",
    government: "Государственный сектор",
    other: "Другое",
  };

  if (exact[normalized]) {
    return exact[normalized];
  }

  const partial: Array<[string, string]> = [
    ["oil", "Нефть и газ"],
    ["gas", "Нефть и газ"],
    ["bank", "Финансы"],
    ["finance", "Финансы"],
    ["metal", "Металлы и добыча"],
    ["mining", "Металлы и добыча"],
    ["transport", "Транспорт"],
    ["retail", "Ритейл"],
    ["consumer", "Потребительский сектор"],
    ["tele", "Связь и коммуникации"],
    ["media", "Связь и коммуникации"],
    ["software", "Информационные технологии"],
    ["internet", "Информационные технологии"],
    ["tech", "Информационные технологии"],
    ["pharma", "Здравоохранение"],
    ["health", "Здравоохранение"],
    ["real estate", "Недвижимость"],
    ["utility", "Коммунальные услуги"],
  ];
  const found = partial.find(([needle]) => normalized.includes(needle));
  return found?.[1] ?? sector;
}

export function FundamentalsPage() {
  const { cache, isLoading, hasData, error, loadFundamentals, clearCache } = useFundamentals();
  const { t, locale } = useAppSettings();
  const isEn = locale === "en";
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortState, setSortState] = useState<{ metric: FundamentalMetricKey; direction: "asc" | "desc" } | null>({
    metric: "marketCapBn",
    direction: "desc",
  });
  const [errorDialogMessage, setErrorDialogMessage] = useState<string | null>(null);
  const prevErrorRef = useRef<string | null>(null);
  const pageSize = 20;
  const metricColumns: Array<{ metric: FundamentalMetricKey; label: string }> = [
    { metric: "marketCapBn", label: t("fund.table.marketCap") },
    { metric: "peRatio", label: t("fund.table.pe") },
    { metric: "pbRatio", label: t("fund.table.pb") },
    { metric: "psRatio", label: t("fund.table.ps") },
    { metric: "evToEbitda", label: t("fund.table.ebitda") },
    { metric: "roe", label: t("fund.table.roe") },
    { metric: "dividendYield", label: t("fund.table.divYield") },
    { metric: "beta", label: t("fund.table.beta") },
    { metric: "roa", label: t("fund.table.roa") },
    { metric: "netMargin", label: t("fund.table.netMargin") },
    { metric: "netDebtToEbitda", label: t("fund.table.netDebtToEbitda") },
    { metric: "totalDebt", label: t("fund.table.totalDebt") },
  ];

  const filteredShares = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return cache.shares;
    }
    return cache.shares.filter((share) => {
      const sector = share.sector ?? "";
      const sectorRu = formatSectorRu(sector);
      const haystack = `${share.ticker} ${share.name} ${sector} ${sectorRu}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [cache.shares, searchQuery]);

  const sortedShares = useMemo(() => {
    if (!sortState) {
      return filteredShares;
    }

    return [...filteredShares].sort((left, right) => {
      const leftValue = cache.fundamentalsByFigi[left.figi]?.[sortState.metric];
      const rightValue = cache.fundamentalsByFigi[right.figi]?.[sortState.metric];
      const leftIsValid = typeof leftValue === "number" && Number.isFinite(leftValue);
      const rightIsValid = typeof rightValue === "number" && Number.isFinite(rightValue);

      if (!leftIsValid && !rightIsValid) return left.ticker.localeCompare(right.ticker);
      if (!leftIsValid) return 1;
      if (!rightIsValid) return -1;

      const diff = leftValue - rightValue;
      if (diff === 0) return left.ticker.localeCompare(right.ticker);
      return sortState.direction === "asc" ? diff : -diff;
    });
  }, [cache.fundamentalsByFigi, filteredShares, sortState]);

  const pageCount = Math.max(1, Math.ceil(sortedShares.length / pageSize));
  const visibleShares = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedShares.slice(start, start + pageSize);
  }, [sortedShares, page]);

  const toggleMetricSort = (metric: FundamentalMetricKey) => {
    setSortState((current) => {
      if (current?.metric !== metric) {
        return { metric, direction: "desc" };
      }
      if (current.direction === "desc") {
        return { metric, direction: "asc" };
      }
      return null;
    });
  };

  const renderSortIcon = (metric: FundamentalMetricKey) => {
    if (sortState?.metric !== metric) {
      return <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />;
    }
    return sortState.direction === "asc"
      ? <ArrowUp className="h-3.5 w-3.5 text-slate-700 dark:text-slate-200" />
      : <ArrowDown className="h-3.5 w-3.5 text-slate-700 dark:text-slate-200" />;
  };

  useEffect(() => {
    setPage((prev) => Math.min(prev, pageCount));
  }, [pageCount]);

  useEffect(() => {
    setPage(1);
  }, [cache.lastUpdated]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, sortState]);

  useEffect(() => {
    if (error && error !== prevErrorRef.current) {
      setErrorDialogMessage(error);
    }
    prevErrorRef.current = error;
  }, [error]);

  return (
    <div className="space-y-6">
      <PageHero
        icon={Database}
        title={t("fund.title")}
        description={t("fund.description")}
        accent="slate"
      />

      <FundamentalsTabs />

      {isLoading && (
        <SectionCard>
          <PageLoadingState
            title={t("fund.loading")}
            subtitle={isEn ? "Loading shares, close prices, and asset fundamentals." : "Загружаем акции, цены закрытия и фундаментальные показатели."}
            accentClassName="text-slate-700"
          />
        </SectionCard>
      )}

      <SectionCard>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <button
            type="button"
            onClick={loadFundamentals}
            disabled={isLoading}
            className="ui-primary-button bg-slate-900 hover:bg-slate-950"
          >
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {isLoading ? t("fund.loading") : t("fund.loadCache")}
          </button>
          <button
            type="button"
            onClick={clearCache}
            disabled={isLoading}
            className="ui-secondary-button"
          >
            <Trash2 className="w-4 h-4" />
            {t("fund.clearCache")}
          </button>
          <div className="text-sm text-slate-600 dark:text-slate-300">
            {hasData ? `${t("fund.cacheLoaded")}: ${cache.shares.length}` : t("fund.cacheEmpty")}
          </div>
        </div>

        {isLoading && !hasData ? (
          <MetricSkeletonGrid count={2} />
        ) : (
          <MetricGrid className="xl:grid-cols-2">
            <MetricCard label={t("fund.countShares")} value={cache.shares.length} />
            <MetricCard
              label={t("fund.lastUpdated")}
              value={cache.lastUpdated ? new Date(cache.lastUpdated).toLocaleString() : t("fund.never")}
            />
          </MetricGrid>
        )}
      </SectionCard>

      {(hasData || isLoading) && (
        <SectionCard
          title={t("fund.sampleTitle")}
          description={
            isEn
              ? "Hover the help icon in the metric headers to see a quick explanation."
              : "Наведите на значок подсказки в заголовке метрики, чтобы увидеть краткое объяснение."
          }
        >
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={isEn ? "Search by ticker, name, or sector" : "Поиск по тикеру, названию или сектору"}
              className="ui-input md:w-80"
            />
          </div>
          {isLoading && !hasData ? (
            <TableSkeleton rows={10} columns={metricColumns.length + 4} />
          ) : (
          <div className="ui-table-shell overflow-x-auto">
            <table className="ui-data-table">
              <thead>
                <tr>
                  <th>{t("fund.table.ticker")}</th>
                  <th>{t("fund.table.name")}</th>
                  <th>{t({ ru: "Сектор", en: "Sector" })}</th>
                  <th>{isEn ? "Details" : "Подробно"}</th>
                  {metricColumns.map((column) => (
                    <th key={column.metric}>
                      <button
                        type="button"
                        onClick={() => toggleMetricSort(column.metric)}
                        className="inline-flex w-full items-center justify-end gap-1 text-right"
                        title={isEn ? "Sort by this metric" : "Сортировать по этой метрике"}
                      >
                        <FundamentalMetricLabel label={column.label} metric={column.metric} locale={locale} />
                        {renderSortIcon(column.metric)}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleShares.length === 0 ? (
                  <tr>
                    <td colSpan={metricColumns.length + 4} className="py-4 text-center text-slate-500 dark:text-slate-400">
                      {isEn ? "No stocks found by this query" : "Акции по такому запросу не найдены"}
                    </td>
                  </tr>
                ) : (
                  visibleShares.map((share) => {
                    const f = cache.fundamentalsByFigi[share.figi];
                    return (
                      <tr key={share.figi}>
                        <td>
                          <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                            <StockAvatar ticker={share.ticker} name={share.name} size="sm" />
                            <span>{share.ticker}</span>
                          </div>
                        </td>
                        <td className="ui-cell-name">{share.name}</td>
                        <td className="whitespace-nowrap text-slate-600 dark:text-slate-300">
                          {formatSectorRu(share.sector)}
                        </td>
                        <td className="ui-cell-action">
                          <Link
                            to={`/fundamentals/${share.figi}`}
                            className="ui-secondary-button px-2.5 py-1.5 text-xs"
                          >
                            {isEn ? "View" : "Смотреть"}
                          </Link>
                        </td>
                        {metricColumns.map((column) => (
                          <td key={column.metric} className="ui-cell-number">
                            {formatFundamentalMetricValue(column.metric, f?.[column.metric], locale)}
                          </td>
                        ))}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          )}
          {isLoading && !hasData ? null : (
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              Page {page} / {pageCount}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
                className="ui-secondary-button px-3 py-1.5 text-sm"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
                disabled={page >= pageCount}
                className="ui-secondary-button px-3 py-1.5 text-sm"
              >
                Next
              </button>
            </div>
          </div>
          )}
        </SectionCard>
      )}

      <AppErrorDialog
        message={errorDialogMessage}
        onClose={() => setErrorDialogMessage(null)}
        title={isEn ? "Data Loading Error" : "Ошибка загрузки данных"}
        description={
          isEn
            ? "The application could not load data from the API."
            : "Приложение не смогло загрузить данные из API."
        }
        closeLabel={isEn ? "Close" : "Закрыть"}
      />
    </div>
  );
}
