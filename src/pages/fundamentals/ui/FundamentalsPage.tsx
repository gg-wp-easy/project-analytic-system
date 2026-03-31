import { useEffect, useMemo, useState } from "react";
import { Database, Download, RefreshCw, Trash2 } from "lucide-react";
import { useRef } from "react";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import { useFundamentals } from "../../../entities/fundamentals";
import { Link } from "react-router-dom";
import { MetricCard, MetricGrid, PageHero, SectionCard } from "../../../shared/ui/analysis-shell";
import { formatFundamentalMetricValue } from "../../../shared/lib/format/fundamentals";
import { AppErrorDialog } from "../../../shared/ui/app-error-dialog";

export function FundamentalsPage() {
  const { cache, isLoading, hasData, error, loadFundamentals, clearCache } = useFundamentals();
  const { t, locale } = useAppSettings();
  const isEn = locale === "en";
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [errorDialogMessage, setErrorDialogMessage] = useState<string | null>(null);
  const prevErrorRef = useRef<string | null>(null);
  const pageSize = 20;

  const filteredShares = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return cache.shares;
    }
    return cache.shares.filter((share) => share.name.toLowerCase().includes(query));
  }, [cache.shares, searchQuery]);

  const pageCount = Math.max(1, Math.ceil(filteredShares.length / pageSize));
  const visibleShares = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredShares.slice(start, start + pageSize);
  }, [filteredShares, page]);

  useEffect(() => {
    setPage((prev) => Math.min(prev, pageCount));
  }, [pageCount]);

  useEffect(() => {
    setPage(1);
  }, [cache.lastUpdated]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

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
        badge={isEn ? "Fundamentals cache" : "Кэш фундаментала"}
        accent="slate"
      />

      {/*<div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
        <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">{t("fund.sourcesTitle")}</h2>
        <div className="space-y-2 text-sm">
          <div>
            <div className="text-slate-500 dark:text-slate-400">{t("fund.sharesEndpoint")}</div>
            <div className="font-mono text-slate-800 dark:text-slate-200 break-all">{cache.source.shares}</div>
          </div>
          <div>
            <div className="text-slate-500 dark:text-slate-400">{t("fund.assetEndpoint")}</div>
            <div className="font-mono text-slate-800 dark:text-slate-200 break-all">{cache.source.assetFundamentals}</div>
          </div>
        </div>
      </div>*/}

      {isLoading && (
        <SectionCard>
          <div className="flex flex-col items-center justify-center gap-3 text-center" role="status" aria-live="polite">
            <RefreshCw className="w-8 h-8 animate-spin text-slate-700 dark:text-slate-200" />
            <div className="text-base font-semibold text-slate-900 dark:text-slate-100">{t("fund.loading")}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Fetching shares and asset fundamentals from T-Bank API
            </div>
          </div>
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

        <MetricGrid className="xl:grid-cols-2">
          <MetricCard label={t("fund.countShares")} value={cache.shares.length} />
          <MetricCard
            label={t("fund.lastUpdated")}
            value={cache.lastUpdated ? new Date(cache.lastUpdated).toLocaleString() : t("fund.never")}
          />
        </MetricGrid>
      </SectionCard>

      {hasData && !isLoading && (
        <SectionCard title={t("fund.sampleTitle")}>
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={isEn ? "Search stocks by name" : "Поиск акций по названию"}
              className="ui-input md:w-80"
            />
          </div>
          <div className="ui-table-shell overflow-x-auto">
            <table className="ui-data-table">
              <thead>
                <tr>
                  <th>{t("fund.table.ticker")}</th>
                  <th>{t("fund.table.name")}</th>
                  <th>{isEn ? "Details" : "Подробно"}</th>
                  <th>{t("fund.table.marketCap")}</th>
                  <th>{t("fund.table.pe")}</th>
                  <th>{t("fund.table.pb")}</th>
                  <th>{t("fund.table.roe")}</th>
                  <th>{t("fund.table.divYield")}</th>
                  <th>{t("fund.table.beta")}</th>
                  <th>{t("fund.table.roa")}</th>
                  <th>{t("fund.table.netMargin")}</th>
                  <th>{t("fund.table.netDebtToEbitda")}</th>
                  <th>{t("fund.table.totalDebt")}</th>
                </tr>
              </thead>
              <tbody>
                {visibleShares.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-4 text-center text-slate-500 dark:text-slate-400">
                      {isEn ? "No stocks found by this name" : "Акции по такому названию не найдены"}
                    </td>
                  </tr>
                ) : (
                  visibleShares.map((share) => {
                    const f = cache.fundamentalsByFigi[share.figi];
                    return (
                      <tr key={share.figi}>
                        <td className="ui-cell-number font-medium text-slate-900 dark:text-slate-100">{share.ticker}</td>
                        <td className="ui-cell-name">{share.name}</td>
                        <td className="ui-cell-action">
                          <Link
                            to={`/fundamentals/${share.figi}`}
                            className="ui-secondary-button px-2.5 py-1.5 text-xs"
                          >
                            {isEn ? "View" : "Смотреть"}
                          </Link>
                        </td>
                        <td className="ui-cell-number">{formatFundamentalMetricValue("marketCapBn", f?.marketCapBn, locale)}</td>
                        <td className="ui-cell-number">{formatFundamentalMetricValue("peRatio", f?.peRatio, locale)}</td>
                        <td className="ui-cell-number">{formatFundamentalMetricValue("pbRatio", f?.pbRatio, locale)}</td>
                        <td className="ui-cell-number">{formatFundamentalMetricValue("roe", f?.roe, locale)}</td>
                        <td className="ui-cell-number">{formatFundamentalMetricValue("dividendYield", f?.dividendYield, locale)}</td>
                        <td className="ui-cell-number">{formatFundamentalMetricValue("beta", f?.beta, locale)}</td>
                        <td className="ui-cell-number">{formatFundamentalMetricValue("roa", f?.roa, locale)}</td>
                        <td className="ui-cell-number">{formatFundamentalMetricValue("netMargin", f?.netMargin, locale)}</td>
                        <td className="ui-cell-number">{formatFundamentalMetricValue("netDebtToEbitda", f?.netDebtToEbitda, locale)}</td>
                        <td className="ui-cell-number">{formatFundamentalMetricValue("totalDebt", f?.totalDebt, locale)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
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
