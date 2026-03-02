import { useEffect, useMemo, useState } from "react";
import { Database, Download, RefreshCw, Trash2 } from "lucide-react";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import { useFundamentals } from "../../../entities/fundamentals";

export function FundamentalsPage() {
  const { cache, isLoading, hasData, error, loadFundamentals, clearCache } = useFundamentals();
  const { t } = useAppSettings();
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const pageCount = Math.max(1, Math.ceil(cache.shares.length / pageSize));
  const visibleShares = useMemo(() => {
    const start = (page - 1) * pageSize;
    return cache.shares.slice(start, start + pageSize);
  }, [cache.shares, page]);

  useEffect(() => {
    setPage((prev) => Math.min(prev, pageCount));
  }, [pageCount]);

  useEffect(() => {
    setPage(1);
  }, [cache.lastUpdated]);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-slate-800 to-slate-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <Database className="w-8 h-8" />
          <h1 className="text-3xl font-bold">{t("fund.title")}</h1>
        </div>
        <p className="text-slate-200">{t("fund.description")}</p>
      </div>

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
        <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="flex flex-col items-center justify-center gap-3 text-center" role="status" aria-live="polite">
            <RefreshCw className="w-8 h-8 animate-spin text-slate-700 dark:text-slate-200" />
            <div className="text-base font-semibold text-slate-900 dark:text-slate-100">{t("fund.loading")}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Fetching shares and asset fundamentals from T-Bank API
            </div>
          </div>
        </div>
      )}

      {!!error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <button
            type="button"
            onClick={loadFundamentals}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {isLoading ? t("fund.loading") : t("fund.loadCache")}
          </button>
          <button
            type="button"
            onClick={clearCache}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {t("fund.clearCache")}
          </button>
          <div className="text-sm text-slate-600 dark:text-slate-300">
            {hasData ? `${t("fund.cacheLoaded")}: ${cache.shares.length}` : t("fund.cacheEmpty")}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
            <div className="text-sm text-slate-500 dark:text-slate-400">{t("fund.countShares")}</div>
            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{cache.shares.length}</div>
          </div>
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
            <div className="text-sm text-slate-500 dark:text-slate-400">{t("fund.countFundamentals")}</div>
            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {Object.keys(cache.fundamentalsByFigi).length}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
            <div className="text-sm text-slate-500 dark:text-slate-400">{t("fund.lastUpdated")}</div>
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {cache.lastUpdated ? new Date(cache.lastUpdated).toLocaleString() : t("fund.never")}
            </div>
          </div>
        </div>
      </div>

      {hasData && !isLoading && (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 overflow-x-auto">
          <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">{t("fund.sampleTitle")}</h2>
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="text-left border-b border-slate-200 dark:border-slate-800">
                <th className="py-2 pr-4">{t("fund.table.ticker")}</th>
                <th className="py-2 pr-4">{t("fund.table.name")}</th>
                <th className="py-2 pr-4">{t("fund.table.marketCap")}</th>
                <th className="py-2 pr-4">{t("fund.table.pe")}</th>
                <th className="py-2 pr-4">{t("fund.table.pb")}</th>
                <th className="py-2 pr-4">{t("fund.table.roe")}</th>
                <th className="py-2 pr-4">{t("fund.table.divYield")}</th>
                <th className="py-2 pr-4">{t("fund.table.beta")}</th>
                <th className="py-2 pr-4">{t("fund.table.roa")}</th>
                <th className="py-2 pr-4">{t("fund.table.netMargin")}</th>
                <th className="py-2 pr-4">{t("fund.table.netDebtToEbitda")}</th>
                <th className="py-2 pr-4">{t("fund.table.totalDebt")}</th>
              </tr>
            </thead>
            <tbody>
              {visibleShares.map((share) => {
                const f = cache.fundamentalsByFigi[share.figi];
                return (
                  <tr key={share.figi} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 pr-4 font-medium text-slate-900 dark:text-slate-100">{share.ticker}</td>
                    <td className="py-2 pr-4 text-slate-700 dark:text-slate-300">{share.name}</td>
                    <td className="py-2 pr-4 text-slate-700 dark:text-slate-300">{f?.marketCapBn ?? "-"}</td>
                    <td className="py-2 pr-4 text-slate-700 dark:text-slate-300">{f?.peRatio ?? "-"}</td>
                    <td className="py-2 pr-4 text-slate-700 dark:text-slate-300">{f?.pbRatio ?? "-"}</td>
                    <td className="py-2 pr-4 text-slate-700 dark:text-slate-300">{f?.roe ?? "-"}</td>
                    <td className="py-2 pr-4 text-slate-700 dark:text-slate-300">{f?.dividendYield ?? "-"}%</td>
                    <td className="py-2 pr-4 text-slate-700 dark:text-slate-300">{f?.beta ?? "-"}</td>
                    <td className="py-2 pr-4 text-slate-700 dark:text-slate-300">{f?.roa ?? "-"}</td>
                    <td className="py-2 pr-4 text-slate-700 dark:text-slate-300">{f?.netMargin ?? "-"}%</td>
                    <td className="py-2 pr-4 text-slate-700 dark:text-slate-300">{f?.netDebtToEbitda ?? "-"}</td>
                    <td className="py-2 pr-4 text-slate-700 dark:text-slate-300">{f?.totalDebt ?? "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              Page {page} / {pageCount}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
                disabled={page >= pageCount}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
