import { useMemo, useState } from "react";
import { Activity, ArrowLeft, RefreshCw } from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import { useOptionsData } from "../../../entities/options";
import { AppErrorDialog } from "../../../shared/ui/app-error-dialog";
import { MetricCard, MetricGrid, PageHero, SectionCard } from "../../../shared/ui/analysis-shell";
import {
  buildUnderlyingSummaries,
  decodeRoutePart,
  formatDate,
  formatTimestamp,
  getCategoryLabel,
  getOptionExpirationDateKey,
  getOptionSide,
  getOptionSideLabel,
  sortOptionContracts,
  type OptionSideFilter,
  type OptionSortDirection,
  type UnderlyingCategory,
  type UnderlyingSummary,
} from "../lib/options-helpers";
import { OptionContractsTable } from "./OptionContractsTable";
import { OptionStrategyBuilder } from "./OptionStrategyBuilder";

type UnderlyingLocationState = {
  summaryLabel?: string;
  category?: Exclude<UnderlyingCategory, "all">;
};

export function UnderlyingOptionsPage() {
  const { locale, t } = useAppSettings();
  const isEn = locale === "en";
  const {
    cache,
    hasData,
    isLoading,
    loadOptions,
  } = useOptionsData();
  const location = useLocation();
  const { underlyingKey: underlyingKeyParam = "" } = useParams();
  const underlyingKey = decodeRoutePart(underlyingKeyParam).trim();
  const locationState = location.state as UnderlyingLocationState | null;

  const [sideFilter, setSideFilter] = useState<OptionSideFilter>("all");
  const [expirationFilter, setExpirationFilter] = useState("all");
  const [sortDirection, setSortDirection] = useState<OptionSortDirection>("asc");
  const [errorDialogMessage, setErrorDialogMessage] = useState<string | null>(null);

  const summaries = useMemo(() => buildUnderlyingSummaries(cache.options), [cache.options]);
  const summary = useMemo<UnderlyingSummary | null>(
    () => summaries.find((item) => item.key === underlyingKey) ?? null,
    [summaries, underlyingKey],
  );

  const expirationChoices = useMemo(() => {
    if (!summary) {
      return [];
    }

    return [...new Set(summary.options.map((option) => getOptionExpirationDateKey(option)).filter(Boolean))]
      .sort((left, right) => {
        const leftTime = Date.parse(left);
        const rightTime = Date.parse(right);
        const leftValid = Number.isFinite(leftTime);
        const rightValid = Number.isFinite(rightTime);

        if (leftValid && rightValid && leftTime !== rightTime) {
          return leftTime - rightTime;
        }

        if (leftValid !== rightValid) {
          return leftValid ? -1 : 1;
        }

        return left.localeCompare(right, "ru");
      });
  }, [summary]);

  const filteredOptions = useMemo(() => {
    if (!summary) {
      return [];
    }

    return summary.options.filter((option) => {
      const matchesSide = sideFilter === "all" || getOptionSide(option) === sideFilter;
      const matchesExpiration =
        expirationFilter === "all" || getOptionExpirationDateKey(option) === expirationFilter;
      return matchesSide && matchesExpiration;
    });
  }, [expirationFilter, sideFilter, summary]);

  const sortedFilteredOptions = useMemo(
    () => sortOptionContracts(filteredOptions, "strikePrice", sortDirection),
    [filteredOptions, sortDirection],
  );

  const displayLabel = summary?.label || locationState?.summaryLabel || underlyingKey || "-";
  const displayCategory = summary?.category || locationState?.category || "other";
  const selectedExpirationLabel =
    expirationFilter === "all"
      ? t({ ru: "Все даты", en: "All dates" })
      : formatDate(expirationFilter, locale);

  const handleLoadOptions = async () => {
    try {
      await loadOptions(true);
    } catch (error) {
      setErrorDialogMessage(
        error instanceof Error
          ? error.message
          : isEn
            ? "Failed to load the asset option chain."
            : "Не удалось загрузить опционную цепочку актива.",
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHero
        icon={Activity}
        title={displayLabel}
        description={t({
          ru: "Страница использует сохранённую опционную цепочку, а загрузка и обновление выполняются только по кнопке.",
          en: "This page uses the saved option chain, and loading or updating only happens on button click.",
        })}
        accent="amber"
        aside={
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.18em] text-white/60">
              {t({ ru: "Группа актива", en: "Asset group" })}
            </div>
            <div className="text-lg font-semibold">{getCategoryLabel(displayCategory, locale)}</div>
            <div className="text-sm text-white/80">
              {t({ ru: "Обновлено", en: "Updated" })}: {formatTimestamp(cache.lastUpdated, locale)}
            </div>
          </div>
        }
        footer={
          <>
            <Link
              to="/options"
              className="ui-secondary-button border-white/20 bg-white/10 text-white hover:bg-white/16 dark:border-white/20 dark:bg-white/10 dark:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              {t({ ru: "Назад к списку", en: "Back to list" })}
            </Link>
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
          </>
        }
      />

      {!hasData ? (
        <SectionCard>
          <div className="ui-surface-muted text-center text-sm leading-7 text-slate-600 dark:text-slate-300">
            {t({
              ru: "Опционы ещё не загружены. Нажмите кнопку «Загрузить данные», чтобы получить и сохранить их.",
              en: "Options have not been loaded yet. Click “Load data” to fetch and save them.",
            })}
          </div>
        </SectionCard>
      ) : !summary ? (
        <SectionCard>
          <div className="ui-surface-muted text-center text-sm leading-7 text-slate-600 dark:text-slate-300">
            {t({
              ru: "Этот актив не найден в текущем сохранённом списке опционов. Обновите данные или вернитесь к списку и выберите тикер снова.",
              en: "This asset was not found in the currently saved option list. Update the data or go back and choose the ticker again.",
            })}
          </div>
        </SectionCard>
      ) : (
        <>
          <MetricGrid className="xl:grid-cols-5">
            <MetricCard
              label={t({ ru: "Всего контрактов", en: "Total contracts" })}
              value={summary.options.length}
            />
            <MetricCard
              label={t({ ru: "Коллы", en: "Calls" })}
              value={summary.calls}
            />
            <MetricCard
              label={t({ ru: "Путы", en: "Puts" })}
              value={summary.puts}
            />
            <MetricCard
              label={t({ ru: "Дата экспирации", en: "Expiration date" })}
              value={selectedExpirationLabel}
            />
            <MetricCard
              label={t({ ru: "В текущем фильтре", en: "In current filter" })}
              value={sortedFilteredOptions.length}
            />
          </MetricGrid>

          <SectionCard
            title={t({ ru: "Фильтры и сортировка", en: "Filters and Sorting" })}
            description={t({
              ru: "Сначала выберите тип опциона и дату экспирации, а затем отсортируйте выбранную серию по цене страйка.",
              en: "First choose the option type and expiration date, then sort the selected series by strike price.",
            })}
          >
            <div className="space-y-4">
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  {t({ ru: "Тип опциона", en: "Option type" })}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["all", "call", "put"] as OptionSideFilter[]).map((side) => {
                    const isActive = sideFilter === side;
                    return (
                      <button
                        key={side}
                        type="button"
                        onClick={() => setSideFilter(side)}
                        className={
                          isActive
                            ? "inline-flex items-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm"
                            : "inline-flex items-center rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950/70"
                        }
                      >
                        {getOptionSideLabel(side, locale)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  {t({ ru: "Дата экспирации", en: "Expiration date" })}
                </div>
                <select
                  value={expirationFilter}
                  onChange={(event) => setExpirationFilter(event.target.value)}
                  className="ui-input w-full md:w-96"
                >
                  <option value="all">{t({ ru: "Все даты", en: "All dates" })}</option>
                  {expirationChoices.map((value) => (
                    <option key={value} value={value}>
                      {formatDate(value, locale)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  {t({ ru: "Сортировка по страйку", en: "Strike sorting" })}
                </div>
                <div className="flex flex-wrap gap-2">
                  {([
                    { value: "asc", label: t({ ru: "По возрастанию", en: "Ascending" }) },
                    { value: "desc", label: t({ ru: "По убыванию", en: "Descending" }) },
                  ] as Array<{ value: OptionSortDirection; label: string }>).map((item) => {
                    const isActive = sortDirection === item.value;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setSortDirection(item.value)}
                        className={
                          isActive
                            ? "inline-flex items-center rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm"
                            : "inline-flex items-center rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/70"
                        }
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </SectionCard>

          <OptionStrategyBuilder
            options={summary.options}
            activeExpirationKey={expirationFilter === "all" ? "" : expirationFilter}
            expirationChoices={expirationChoices}
          />

          <SectionCard
            title={t({ ru: "Опционная цепочка", en: "Option Chain" })}
            description={t({
              ru: "Таблица ниже содержит опционы выбранного базового актива только для выбранной даты экспирации и текущего фильтра.",
              en: "The table below contains options for the selected underlying asset only for the selected expiration date and current filter.",
            })}
          >
            {sortedFilteredOptions.length === 0 ? (
              <div className="ui-surface-muted text-center text-sm leading-7 text-slate-600 dark:text-slate-300">
                {t({
                  ru: "Для выбранных фильтров по типу и дате экспирации контракты не найдены.",
                  en: "No contracts were found for the selected type and expiration date filters.",
                })}
              </div>
            ) : (
              <OptionContractsTable items={sortedFilteredOptions} locale={locale} />
            )}
          </SectionCard>
        </>
      )}

      <AppErrorDialog
        message={errorDialogMessage}
        onClose={() => setErrorDialogMessage(null)}
        title={t({ ru: "Ошибка загрузки цепочки", en: "Chain Loading Error" })}
        description={t({
          ru: "Приложение не смогло загрузить или обновить данные по опционам для выбранного актива.",
          en: "The application could not load or update option data for the selected asset.",
        })}
        closeLabel={t({ ru: "Закрыть", en: "Close" })}
      />
    </div>
  );
}
