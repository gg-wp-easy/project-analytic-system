import { useEffect, useMemo, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import { createTBankInstrumentsApi } from "../../../shared/api/tbank";
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
  const api = useMemo(() => createTBankInstrumentsApi(), []);
  const [groupFilter, setGroupFilter] = useState<UnderlyingCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [errorDialogMessage, setErrorDialogMessage] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<ReturnType<typeof buildUnderlyingSummaries>>([]);

  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);

    api.fetchOptions({ force: reloadKey > 0 })
      .then((payload) => {
        if (isCancelled) {
          return;
        }

        setSummaries(buildUnderlyingSummaries(payload));
        setLastUpdated(new Date().toISOString());
      })
      .catch((error) => {
        if (isCancelled) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : isEn
              ? "Failed to load T-Bank options."
              : "Не удалось загрузить список опционов T-Bank.";
        setSummaries([]);
        setErrorDialogMessage(message);
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [api, isEn, reloadKey]);

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

  return (
    <div className="space-y-6">
      <PageHero
        icon={Activity}
        title={t({ ru: "Опционы T-Bank", en: "T-Bank Options" })}
        description={t({
          ru: "Это общий список базовых тикеров. Выберите нужный актив и перейдите на его отдельную страницу с опционной цепочкой.",
          en: "This is the general list of underlying tickers. Pick an asset and open its dedicated page with the option chain.",
        })}
        accent="amber"
        aside={
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.18em] text-white/60">
              {t({ ru: "Источник", en: "Source" })}
            </div>
            <div className="text-lg font-semibold">T-Bank API</div>
            <div className="text-sm text-white/80">InstrumentsService/Options</div>
            <div className="text-sm text-white/80">
              {t({ ru: "Обновлено", en: "Updated" })}: {formatTimestamp(lastUpdated, locale)}
            </div>
          </div>
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
            <button
              type="button"
              onClick={() => setReloadKey((current) => current + 1)}
              disabled={isLoading}
              className="ui-secondary-button"
            >
              {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {t({ ru: "Обновить", en: "Refresh" })}
            </button>
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
              {t({ ru: "Загружаем общий список базовых тикеров...", en: "Loading the general underlying ticker list..." })}
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {t({
                ru: "После этого можно перейти на отдельную страницу выбранного актива.",
                en: "After that, you can open the dedicated page for the selected asset.",
              })}
            </div>
          </div>
        </SectionCard>
      ) : null}

      {!isLoading ? (
        <SectionCard
          title={t({ ru: "Общий список тикеров", en: "General Ticker List" })}
          description={t({
            ru: "Рядом с каждым тикером есть кнопка перехода на отдельную страницу актива и его опционов.",
            en: "Each ticker has a button that opens the dedicated page for that asset and its options.",
          })}
        >
          {filteredSummaries.length === 0 ? (
            <div className="ui-surface-muted text-center text-sm leading-7 text-slate-600 dark:text-slate-300">
              {summaries.length === 0
                ? t({ ru: "T-Bank не вернул ни одного опциона.", en: "T-Bank did not return any options." })
                : t({ ru: "По текущим фильтрам ничего не найдено.", en: "Nothing matched the current filters." })}
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
      ) : null}

      <AppErrorDialog
        message={errorDialogMessage}
        onClose={() => setErrorDialogMessage(null)}
        title={t({ ru: "Ошибка загрузки опционов", en: "Option Loading Error" })}
        description={t({
          ru: "Приложение не смогло получить общий список опционов из T-Bank API.",
          en: "The application could not fetch the general option list from the T-Bank API.",
        })}
        closeLabel={t({ ru: "Закрыть", en: "Close" })}
      />
    </div>
  );
}
