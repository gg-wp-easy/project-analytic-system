import { useMemo, useState } from "react";
import { Activity, RefreshCw, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import { useOptionsData } from "../../../entities/options";
import { AppErrorDialog } from "../../../shared/ui/app-error-dialog";
import { MetricCard, MetricGrid, PageHero, SectionCard } from "../../../shared/ui/analysis-shell";
import {
  buildUnderlyingSummaries,
  formatTimestamp,
  getCategoryLabel,
  type UnderlyingCategory,
} from "../lib/options-helpers";

type UnderlyingRouteState = {
  summaryLabel?: string;
  category?: Exclude<UnderlyingCategory, "all">;
};

export function OptionsPage() {
  const { locale, t } = useAppSettings();
  const isEn = locale === "en";
  const { cache, hasData, isLoading, loadOptions, clearCache } = useOptionsData();
  const [groupFilter, setGroupFilter] = useState<UnderlyingCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [errorDialogMessage, setErrorDialogMessage] = useState<string | null>(null);

  const summaries = useMemo(() => buildUnderlyingSummaries(cache.options), [cache.options]);

  const filteredSummaries = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return summaries.filter((summary) => {
      const matchesGroup = groupFilter === "all" || summary.category === groupFilter;
      const matchesSearch = !normalizedQuery || summary.searchText.includes(normalizedQuery);
      return matchesGroup && matchesSearch;
    });
  }, [groupFilter, searchQuery, summaries]);

  const totalOptions = useMemo(
    () => filteredSummaries.reduce((sum, summary) => sum + summary.options.length, 0),
    [filteredSummaries],
  );
  const totalCalls = useMemo(
    () => filteredSummaries.reduce((sum, summary) => sum + summary.calls, 0),
    [filteredSummaries],
  );
  const totalPuts = useMemo(
    () => filteredSummaries.reduce((sum, summary) => sum + summary.puts, 0),
    [filteredSummaries],
  );

  const handleLoadOptions = async () => {
    try {
      await loadOptions(true);
    } catch (error) {
      setErrorDialogMessage(
        error instanceof Error
          ? error.message
          : isEn
            ? "Failed to load T-Bank options."
            : "Не удалось загрузить список опционов T-Bank.",
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHero
        icon={Activity}
        title={t({ ru: "Опционы T-Bank", en: "T-Bank Options" })}
        description={t({
          ru: "Страница читает список опционов из localStorage, а загрузка и обновление из T-Bank API происходят только по кнопке.",
          en: "This page reads the option list from localStorage, and loading or updating from T-Bank API happens only on button click.",
        })}
        accent="amber"
        aside={
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.18em] text-white/60">
              {t({ ru: "Источник данных", en: "Data source" })}
            </div>
            <div className="text-lg font-semibold">
              {hasData ? t({ ru: "localStorage + T-Bank", en: "localStorage + T-Bank" }) : "localStorage"}
            </div>
            <div className="text-sm text-white/80">
              {t({ ru: "Обновлено", en: "Updated" })}: {formatTimestamp(cache.lastUpdated, locale)}
            </div>
          </div>
        }
        footer={
          <>
            <button
              type="button"
              onClick={handleLoadOptions}
              disabled={isLoading}
              className="ui-secondary-button border-white/20 bg-white/10 text-white hover:bg-white/16 dark:border-white/20 dark:bg-white/10 dark:text-white"
            >
              {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {hasData
                ? t({ ru: "Обновить данные", en: "Update data" })
                : t({ ru: "Загрузить данные", en: "Load data" })}
            </button>
            <button
              type="button"
              onClick={clearCache}
              disabled={isLoading || !hasData}
              className="ui-secondary-button border-white/20 bg-white/10 text-white hover:bg-white/16 dark:border-white/20 dark:bg-white/10 dark:text-white"
            >
              <Trash2 className="h-4 w-4" />
              {t({ ru: "Очистить кэш", en: "Clear cache" })}
            </button>
          </>
        }
      />

      <SectionCard
        title={t({ ru: "Фильтры списка", en: "List Filters" })}
        description={t({
          ru: "Сначала можно отобрать группу базовых активов, а затем найти нужный тикер через поиск.",
          en: "First narrow the underlying asset group, then find the needed ticker through search.",
        })}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {(["all", "security", "commodity", "currency"] as UnderlyingCategory[]).map((category) => {
              const isActive = groupFilter === category;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setGroupFilter(category)}
                  className={
                    isActive
                      ? "inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm dark:bg-slate-100 dark:text-slate-950"
                      : "inline-flex items-center rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  }
                >
                  {getCategoryLabel(category, locale)}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={isEn ? "Filter underlying tickers" : "Фильтр по базовым тикерам"}
              className="ui-input md:w-80"
            />
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {hasData
                ? t({ ru: "Страница использует сохранённый локально список.", en: "The page uses the locally saved list." })
                : t({ ru: "Данных пока нет. Загрузите их кнопкой выше.", en: "There is no data yet. Load it using the button above." })}
            </div>
          </div>
        </div>
      </SectionCard>

      <MetricGrid className="xl:grid-cols-5">
        <MetricCard
          label={t({ ru: "Тикеров в списке", en: "Tickers in list" })}
          value={filteredSummaries.length}
        />
        <MetricCard
          label={t({ ru: "Всего опционов", en: "Total options" })}
          value={totalOptions}
        />
        <MetricCard
          label={t({ ru: "Коллы", en: "Calls" })}
          value={totalCalls}
        />
        <MetricCard
          label={t({ ru: "Путы", en: "Puts" })}
          value={totalPuts}
        />
        <MetricCard
          label={t({ ru: "Активная группа", en: "Active group" })}
          value={getCategoryLabel(groupFilter, locale)}
        />
      </MetricGrid>

      {isLoading ? (
        <SectionCard>
          <div className="flex flex-col items-center justify-center gap-3 text-center" role="status" aria-live="polite">
            <RefreshCw className="h-8 w-8 animate-spin text-slate-700 dark:text-slate-200" />
            <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {t({ ru: "Загружаем список опционов из T-Bank API...", en: "Loading the option list from T-Bank API..." })}
            </div>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard
        title={t({ ru: "Общий список тикеров", en: "General Ticker List" })}
        description={t({
          ru: "Рядом с каждым тикером есть кнопка перехода на отдельную страницу актива и его опционов.",
          en: "Each ticker has a button that opens the dedicated page for that asset and its options.",
        })}
      >
        {!hasData ? (
          <div className="ui-surface-muted text-center text-sm leading-7 text-slate-600 dark:text-slate-300">
            {t({
              ru: "Список опционов пока пуст. Нажмите кнопку «Загрузить данные», чтобы получить его из T-Bank и сохранить в localStorage.",
              en: "The option list is empty. Click “Load data” to fetch it from T-Bank and save it to localStorage.",
            })}
          </div>
        ) : filteredSummaries.length === 0 ? (
          <div className="ui-surface-muted text-center text-sm leading-7 text-slate-600 dark:text-slate-300">
            {t({ ru: "По текущим фильтрам ничего не найдено.", en: "Nothing matched the current filters." })}
          </div>
        ) : (
          <div className="ui-table-shell overflow-x-auto">
            <table className="ui-data-table">
              <thead>
                <tr>
                  <th>{t({ ru: "Тикер", en: "Ticker" })}</th>
                  <th>{t({ ru: "Группа", en: "Group" })}</th>
                  <th>{t({ ru: "Всего", en: "Total" })}</th>
                  <th>{t({ ru: "Коллы", en: "Calls" })}</th>
                  <th>{t({ ru: "Путы", en: "Puts" })}</th>
                  <th>{t({ ru: "API-доступно", en: "API tradable" })}</th>
                </tr>
              </thead>
              <tbody>
                {filteredSummaries.map((summary) => {
                  const state: UnderlyingRouteState = {
                    summaryLabel: summary.label,
                    category: summary.category,
                  };

                  return (
                    <tr key={summary.key}>
                      <td className="ui-cell-name">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {summary.label}
                          </span>
                          <Link
                            to={`/options/asset/${encodeURIComponent(summary.key)}`}
                            state={state}
                            className="ui-secondary-button px-2.5 py-1.5 text-xs"
                          >
                            {t({ ru: "Открыть", en: "Open" })}
                          </Link>
                        </div>
                      </td>
                      <td className="ui-cell-number">{getCategoryLabel(summary.category, locale)}</td>
                      <td className="ui-cell-number">{summary.options.length}</td>
                      <td className="ui-cell-number">{summary.calls}</td>
                      <td className="ui-cell-number">{summary.puts}</td>
                      <td className="ui-cell-number">{summary.tradableCount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <AppErrorDialog
        message={errorDialogMessage}
        onClose={() => setErrorDialogMessage(null)}
        title={t({ ru: "Ошибка загрузки опционов", en: "Option Loading Error" })}
        description={t({
          ru: "Приложение не смогло получить или обновить список опционов из T-Bank API.",
          en: "The application could not fetch or update the option list from the T-Bank API.",
        })}
        closeLabel={t({ ru: "Закрыть", en: "Close" })}
      />
    </div>
  );
}
