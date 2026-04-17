import { type FormEvent, useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  Bot,
  ExternalLink,
  LayoutDashboard,
  Newspaper,
  RefreshCw,
  Search,
  Send,
  Sparkles,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import {
  fetchNewsOverview,
  fetchSupportedTickers,
  fetchTickerReport,
  queryNewsAssistant,
  refreshNewsAnalysis,
} from "../../../features/news-assistant/model/api";
import type {
  NewsAssistantResponse,
  NewsHotTopic,
  NewsItem,
  NewsOverviewResponse,
  NewsRecommendation,
} from "../../../features/news-assistant/model/types";
import {
  AnalysisPageFrame,
  AnalysisSidebarCard,
  MetricCard,
  MetricGrid,
  PageHero,
  SectionCard,
} from "../../../shared/ui/analysis-shell";

type NewsAssistantSection = "overview" | "assistant" | "feed";

function resolveSection(value: string | null): NewsAssistantSection {
  switch (value) {
    case "assistant":
    case "feed":
      return value;
    default:
      return "overview";
  }
}

function sentimentClasses(sentiment: string | undefined): string {
  switch ((sentiment ?? "").toLowerCase()) {
    case "positive":
      return "bg-emerald-500/10 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/20";
    case "negative":
      return "bg-rose-500/10 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/20";
    default:
      return "bg-slate-500/10 text-slate-700 ring-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-500/20";
  }
}

function actionClasses(action: string | undefined): string {
  switch ((action ?? "").toLowerCase()) {
    case "buy":
      return "bg-emerald-500/10 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/20";
    case "accumulate":
      return "bg-sky-500/10 text-sky-700 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/20";
    case "sell":
      return "bg-rose-500/10 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/20";
    case "reduce":
      return "bg-amber-500/10 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/20";
    default:
      return "bg-slate-500/10 text-slate-700 ring-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-500/20";
  }
}

function formatTimestamp(value: string | undefined, locale: "ru" | "en"): string {
  if (!value) {
    return locale === "en" ? "Not available yet" : "Пока нет данных";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString(locale === "en" ? "en-US" : "ru-RU");
}

function formatScore(value: number | undefined): string {
  return Number.isFinite(value) ? Number(value).toFixed(2) : "0.00";
}

function normalizeAssistantRecommendations(result: NewsAssistantResponse | null): NewsRecommendation[] {
  if (!result) {
    return [];
  }

  if (result.recommendations?.length) {
    return result.recommendations;
  }

  return result.recommendation ? [result.recommendation] : [];
}

function normalizeAssistantNews(result: NewsAssistantResponse | null): NewsItem[] {
  return result?.top_news ?? [];
}

function RecommendationList({
  items,
  locale,
}: {
  items: NewsRecommendation[];
  locale: "ru" | "en";
}) {
  if (!items.length) {
    return (
      <div className="ui-surface-muted text-sm">
        {locale === "en" ? "Signals will appear here after a refresh or assistant query." : "Сигналы появятся здесь после refresh или запроса к ассистенту."}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {items.map((item) => (
        <article key={`${item.ticker}-${item.action}-${item.score}`} className="ui-metric-card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{item.ticker}</div>
              <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{item.action_label}</div>
            </div>
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${actionClasses(item.action)}`}>
              {item.risk_label}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="ui-surface-muted">
              <div className="text-slate-500 dark:text-slate-400">{locale === "en" ? "Score" : "Оценка"}</div>
              <div className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">{formatScore(item.score)}</div>
            </div>
            <div className="ui-surface-muted">
              <div className="text-slate-500 dark:text-slate-400">{locale === "en" ? "Confidence" : "Уверенность"}</div>
              <div className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">{formatScore(item.confidence)}</div>
            </div>
          </div>
          <div className="text-sm leading-6 text-slate-600 dark:text-slate-300">{item.thesis}</div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="ui-pill">{locale === "en" ? "Mentions" : "Упоминания"}: {item.mentions}</span>
            <span className="ui-pill">+{item.positive_mentions} / -{item.negative_mentions}</span>
          </div>
        </article>
      ))}
    </div>
  );
}

function NewsList({
  items,
  locale,
}: {
  items: NewsItem[];
  locale: "ru" | "en";
}) {
  if (!items.length) {
    return (
      <div className="ui-surface-muted text-sm">
        {locale === "en" ? "News cards will appear here after the overview or assistant response loads." : "Карточки новостей появятся здесь после загрузки обзора или ответа ассистента."}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {items.map((item, index) => (
        <article key={`${item.link ?? item.title ?? "news"}-${index}`} className="ui-surface space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{item.title ?? (locale === "en" ? "Untitled news item" : "Новость без заголовка")}</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {(item.source ?? (locale === "en" ? "Unknown source" : "Неизвестный источник"))} • {formatTimestamp(item.published, locale)}
              </div>
            </div>
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${sentimentClasses(item.sentiment)}`}>
              {item.sentiment ?? "neutral"}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(item.tickers?.length ? item.tickers : [locale === "en" ? "No tickers" : "Без тикеров"]).map((ticker) => (
              <span key={ticker} className="ui-pill">{ticker}</span>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3 text-sm text-slate-500 dark:text-slate-400">
            <span>{locale === "en" ? "Sentiment score" : "Оценка тональности"}: {formatScore(item.sentiment_score)}</span>
            {item.link ? (
              <a
                href={item.link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {locale === "en" ? "Open source" : "Открыть источник"}
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function TopicList({
  items,
  locale,
}: {
  items: NewsHotTopic[];
  locale: "ru" | "en";
}) {
  if (!items.length) {
    return (
      <div className="ui-surface-muted text-sm">
        {locale === "en" ? "Hot topics will appear after the latest news snapshot is loaded." : "Горячие темы появятся после загрузки свежего новостного снимка."}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {items.map((item, index) => (
        <article key={`${item.topic ?? "topic"}-${index}`} className="ui-metric-card space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{item.topic ?? (locale === "en" ? "Unnamed topic" : "Тема без названия")}</div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {locale === "en" ? "Momentum" : "Динамика"}: {item.momentum ?? "stable"}
              </div>
            </div>
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${sentimentClasses(item.sentiment_trend)}`}>
              {item.sentiment_trend ?? "neutral"}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(item.main_tickers?.length ? item.main_tickers : [locale === "en" ? "No tickers" : "Без тикеров"]).map((ticker) => (
              <span key={ticker} className="ui-pill">{ticker}</span>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="ui-surface-muted">
              <div className="text-slate-500 dark:text-slate-400">{locale === "en" ? "News" : "Новости"}</div>
              <div className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">{item.total_news ?? 0}</div>
            </div>
            <div className="ui-surface-muted">
              <div className="text-slate-500 dark:text-slate-400">{locale === "en" ? "Sources" : "Источники"}</div>
              <div className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">{item.source_count ?? item.cluster_count ?? 0}</div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function SectionSwitcher({
  items,
  activeSection,
  onChange,
}: {
  items: Array<{
    key: NewsAssistantSection;
    title: string;
    description: string;
    icon: LucideIcon;
  }>;
  activeSection: NewsAssistantSection;
  onChange: (section: NewsAssistantSection) => void;
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = item.key === activeSection;

        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={`w-full rounded-2xl border px-4 py-4 text-left transition-all ${
              isActive
                ? "border-blue-200 bg-blue-50/90 shadow-sm dark:border-blue-500/30 dark:bg-blue-500/10"
                : "border-slate-200/80 bg-white/70 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700/80 dark:bg-slate-900/50 dark:hover:border-slate-600 dark:hover:bg-slate-800/70"
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1 ${
                  isActive
                    ? "bg-blue-500/10 text-blue-700 ring-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/20"
                    : "bg-slate-500/10 text-slate-700 ring-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-500/20"
                }`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <div className="space-y-1">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.title}</div>
                <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">{item.description}</div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function NewsAssistantPage() {
  const { locale, t } = useAppSettings();

  const [searchParams, setSearchParams] = useSearchParams();
  const [overview, setOverview] = useState<NewsOverviewResponse | null>(null);
  const [assistantResult, setAssistantResult] = useState<NewsAssistantResponse | null>(null);
  const [supportedTickers, setSupportedTickers] = useState<string[]>([]);
  const [pageError, setPageError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [refreshSummary, setRefreshSummary] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [ticker, setTicker] = useState("");
  const [useFinbert, setUseFinbert] = useState(false);
  const [fetchFullText, setFetchFullText] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmittingQuery, setIsSubmittingQuery] = useState(false);
  const [isSubmittingTicker, setIsSubmittingTicker] = useState(false);

  const section = resolveSection(searchParams.get("section"));
  const sectionItems = [
    {
      key: "overview" as const,
      title: t("Обзор", "Overview"),
      description: t("Сводка рынка, идеи и горячие темы.", "Market summary, ideas, and hot topics."),
      icon: LayoutDashboard,
    },
    {
      key: "assistant" as const,
      title: t("Ассистент", "Assistant"),
      description: t("Запросы к ИИ и отчёты по тикерам.", "AI prompts and ticker reports."),
      icon: Bot,
    },
    {
      key: "feed" as const,
      title: t("Лента", "Feed"),
      description: t("Обновление новостей и свежая лента.", "Refresh controls and the latest news feed."),
      icon: Newspaper,
    },
  ];
  const activeSectionMeta = sectionItems.find((item) => item.key === section) ?? sectionItems[0];

  function setSection(nextSection: NewsAssistantSection) {
    const nextSearchParams = new URLSearchParams(searchParams);

    if (nextSection === "overview") {
      nextSearchParams.delete("section");
    } else {
      nextSearchParams.set("section", nextSection);
    }

    setSearchParams(nextSearchParams, { replace: true });
  }

  async function loadPageData() {
    try {
      const [nextOverview, tickersResponse] = await Promise.all([
        fetchNewsOverview(),
        fetchSupportedTickers(),
      ]);

      setOverview(nextOverview);
      setSupportedTickers(tickersResponse.tickers);
      setPageError(null);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : t("Не удалось загрузить данные news-assistant.", "Failed to load news assistant data."));
    } finally {
      setIsInitialLoading(false);
    }
  }

  useEffect(() => {
    void loadPageData();
  }, []);

  async function handleRefresh() {
    setActionError(null);
    setRefreshSummary(null);
    setIsRefreshing(true);

    try {
      const response = await refreshNewsAnalysis({
        useFinbert,
        fetchFullText,
      });

      await loadPageData();
      setRefreshSummary(
        t(
          `Обновление завершено. Статус: ${response.status}. ${response.report?.statistics?.total_news ? `Новостей обработано: ${response.report.statistics.total_news}.` : ""}`,
          `Refresh completed. Status: ${response.status}. ${response.report?.statistics?.total_news ? `Processed news: ${response.report.statistics.total_news}.` : ""}`,
        ),
      );
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t("Не удалось обновить новости.", "Failed to refresh the news pipeline."));
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleAssistantSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }

    setActionError(null);
    setIsSubmittingQuery(true);

    try {
      const response = await queryNewsAssistant(trimmed);
      setAssistantResult(response);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t("Не удалось выполнить запрос к ассистенту.", "Failed to query the assistant."));
    } finally {
      setIsSubmittingQuery(false);
    }
  }

  async function handleTickerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = ticker.trim().toUpperCase();
    if (!trimmed) {
      return;
    }

    setActionError(null);
    setIsSubmittingTicker(true);

    try {
      const response = await fetchTickerReport(trimmed);
      setAssistantResult(response);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t("Не удалось получить отчёт по тикеру.", "Failed to load the ticker report."));
    } finally {
      setIsSubmittingTicker(false);
    }
  }

  const assistantRecommendations = normalizeAssistantRecommendations(assistantResult);
  const assistantNews = normalizeAssistantNews(assistantResult);
  const marketSummary = overview?.market_summary;
  const ActiveSectionIcon = activeSectionMeta.icon;

  return (
    <AnalysisPageFrame
      hero={(
        <PageHero
          icon={Newspaper}
          title={t("Новости и ИИ-ассистент", "News and AI Assistant")}
          description={t(
            "Разделены обзор, запросы к ассистенту и новостная лента, чтобы страница читалась спокойнее и без лишнего визуального шума.",
            "Overview, assistant workflows, and the live news feed are split into separate modes so the page feels cleaner and easier to scan.",
          )}
          badge={t("server-news-analytic", "server-news-analytic")}
          accent="blue"
          aside={(
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.18em] text-white/72">{t("Статус сервиса", "Service status")}</div>
              <div className="text-2xl font-semibold text-white">
                {pageError ? t("Недоступен", "Unavailable") : t("Готов", "Ready")}
              </div>
              <div className="text-sm leading-6 text-white/80">
                {t("Снимок данных", "Data snapshot")}: {formatTimestamp(overview?.data_timestamp, locale)}
              </div>
            </div>
          )}
          footer={(
            <>
              <span className="ui-page-hero-badge">
                <Activity className="h-4 w-4" />
                {t("Тикеров в справочнике", "Supported tickers")}: {supportedTickers.length}
              </span>
              <span className="ui-page-hero-badge">
                <Sparkles className="h-4 w-4" />
                {t("Источников", "Sources")}: {marketSummary?.sources.length ?? 0}
              </span>
              <span className="ui-page-hero-badge">
                <ActiveSectionIcon className="h-4 w-4" />
                {t("Режим", "Mode")}: {activeSectionMeta.title}
              </span>
            </>
          )}
        />
      )}
      sidebar={(
        <div className="space-y-6">
          <AnalysisSidebarCard
            icon={activeSectionMeta.icon}
            title={t("Разделы страницы", "Page sections")}
            description={t(
              "Переключай режимы страницы, чтобы не держать обзор, рабочие запросы и ленту новостей в одном длинном полотне.",
              "Switch between focused page modes so the overview, assistant tools, and news feed do not compete on one screen.",
            )}
            accent="slate"
          >
            <SectionSwitcher items={sectionItems} activeSection={section} onChange={setSection} />
          </AnalysisSidebarCard>

          {section === "overview" ? (
            <AnalysisSidebarCard
              className="hidden"
              icon={Activity}
              title={t("Снимок рынка", "Market snapshot")}
              description={t(
                "Короткий статус по текущему новостному снимку без лишних действий и форм.",
                "A concise status card for the current news snapshot without extra actions.",
              )}
              accent="blue"
            >
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="ui-surface-muted">
                  <div className="text-slate-500 dark:text-slate-400">{t("Новости", "News")}</div>
                  <div className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">{marketSummary?.total_news ?? 0}</div>
                </div>
                <div className="ui-surface-muted">
                  <div className="text-slate-500 dark:text-slate-400">{t("Источники", "Sources")}</div>
                  <div className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">{marketSummary?.sources.length ?? 0}</div>
                </div>
                <div className="ui-surface-muted col-span-2">
                  <div className="text-slate-500 dark:text-slate-400">{t("Последнее обновление", "Last update")}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{formatTimestamp(overview?.data_timestamp, locale)}</div>
                </div>
              </div>
              <button type="button" onClick={() => setSection("feed")} className="ui-secondary-button w-full">
                <Newspaper className="h-4 w-4" />
                {t("Открыть ленту", "Open feed")}
              </button>
            </AnalysisSidebarCard>
          ) : null}

          {section === "feed" ? (
            <AnalysisSidebarCard
            className="hidden"
            icon={RefreshCw}
            title={t("Обновление новостей", "Refresh pipeline")}
            description={t(
              "Запускает сбор и пересчёт новостного анализа прямо из desktop-приложения.",
              "Runs a fresh news fetch and analysis directly from the desktop application.",
            )}
            accent="blue"
          >
            <label className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={useFinbert}
                onChange={(event) => setUseFinbert(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>{t("Использовать FinBERT для тональности", "Use FinBERT for sentiment analysis")}</span>
            </label>
            <label className="mt-3 flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={fetchFullText}
                onChange={(event) => setFetchFullText(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>{t("Загружать полные тексты новостей", "Fetch full article texts")}</span>
            </label>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="ui-primary-button mt-5 w-full bg-gradient-to-r from-blue-700 to-cyan-600 hover:from-blue-800 hover:to-cyan-700"
            >
              {isRefreshing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {isRefreshing ? t("Обновляем...", "Refreshing...") : t("Обновить и пересчитать", "Refresh and analyze")}
            </button>
            {refreshSummary ? <div className="mt-4 ui-surface-muted text-sm">{refreshSummary}</div> : null}
            </AnalysisSidebarCard>
          ) : null}

          {section === "assistant" ? (
            <>
              <AnalysisSidebarCard
            className="hidden"
            icon={Bot}
            title={t("Запрос к ассистенту", "Assistant query")}
            description={t(
              "Свободный вопрос по рынку, идеям, рискам или отдельным тикерам.",
              "Ask a free-form question about the market, ideas, risks, or a specific ticker.",
            )}
            accent="cyan"
          >
            <form onSubmit={handleAssistantSubmit} className="space-y-3">
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={t("Например: что сегодня по SBER и GAZP?", "For example: what is happening with SBER and GAZP today?")}
                className="ui-input min-h-28 resize-y"
              />
              <button
                type="submit"
                disabled={isSubmittingQuery || !message.trim()}
                className="ui-primary-button w-full bg-gradient-to-r from-cyan-700 to-sky-600 hover:from-cyan-800 hover:to-sky-700"
              >
                {isSubmittingQuery ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {isSubmittingQuery ? t("Отправляем...", "Sending...") : t("Спросить", "Ask assistant")}
              </button>
            </form>
              </AnalysisSidebarCard>

              <AnalysisSidebarCard
            className="hidden"
            icon={Search}
            title={t("Отчёт по тикеру", "Ticker report")}
            description={t(
              "Быстрый способ получить новостный контекст и сигнал по конкретному инструменту.",
              "A quick way to load the news context and signal for a specific instrument.",
            )}
            accent="emerald"
          >
            <form onSubmit={handleTickerSubmit} className="space-y-3">
              <input
                value={ticker}
                onChange={(event) => setTicker(event.target.value.toUpperCase())}
                placeholder="SBER"
                className="ui-input"
              />
              <button
                type="submit"
                disabled={isSubmittingTicker || !ticker.trim()}
                className="ui-primary-button w-full bg-gradient-to-r from-emerald-700 to-teal-600 hover:from-emerald-800 hover:to-teal-700"
              >
                {isSubmittingTicker ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {isSubmittingTicker ? t("Загружаем...", "Loading...") : t("Показать отчёт", "Show report")}
              </button>
            </form>
            <div className="mt-4 flex flex-wrap gap-2">
              {supportedTickers.slice(0, 12).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setTicker(item)}
                  className="ui-secondary-button px-3 py-1.5 text-xs"
                >
                  {item}
                </button>
              ))}
            </div>
              </AnalysisSidebarCard>
            </>
          ) : null}
        </div>
      )}
    >
      {pageError ? (
        <SectionCard title={t("Проблема подключения", "Connection issue")}>
          <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <div className="font-semibold">{t("News-assistant пока недоступен", "The news assistant is currently unavailable")}</div>
              <div className="mt-1 leading-6">{pageError}</div>
            </div>
          </div>
        </SectionCard>
      ) : null}

      {actionError ? (
        <SectionCard>
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>{actionError}</div>
          </div>
        </SectionCard>
      ) : null}

      {isInitialLoading ? (
        <SectionCard>
          <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-slate-700 dark:text-slate-200" />
            <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {t("Загружаем обзор новостей", "Loading the news overview")}
            </div>
          </div>
        </SectionCard>
      ) : null}

      {overview && section === "overview" ? (
        <>
          <SectionCard
            title={t("Снимок рынка", "Market snapshot")}
            description={t(
              "Короткий статус по текущему новостному снимку без лишних переходов в боковую панель.",
              "A concise status block for the current news snapshot without jumping back to the sidebar.",
            )}
            action={(
              <button type="button" onClick={() => setSection("feed")} className="ui-secondary-button">
                <Newspaper className="h-4 w-4" />
                {t("Открыть ленту", "Open feed")}
              </button>
            )}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="ui-surface-muted">
                <div className="text-sm text-slate-500 dark:text-slate-400">{t("Новости", "News")}</div>
                <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{marketSummary?.total_news ?? 0}</div>
              </div>
              <div className="ui-surface-muted">
                <div className="text-sm text-slate-500 dark:text-slate-400">{t("Источники", "Sources")}</div>
                <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{marketSummary?.sources.length ?? 0}</div>
              </div>
              <div className="ui-surface-muted">
                <div className="text-sm text-slate-500 dark:text-slate-400">{t("Последнее обновление", "Last update")}</div>
                <div className="mt-2 text-sm font-semibold leading-6 text-slate-900 dark:text-slate-100">
                  {formatTimestamp(overview?.data_timestamp, locale)}
                </div>
              </div>
            </div>
          </SectionCard>

          <MetricGrid>
            <MetricCard label={t("Обработано новостей", "Processed news")} value={marketSummary?.total_news ?? 0} />
            <MetricCard label={t("Источников", "Sources")} value={marketSummary?.sources.length ?? 0} />
            <MetricCard label={t("Общий фон", "Overall sentiment")} value={marketSummary?.overall_sentiment ?? "neutral"} />
            <MetricCard label={t("Средний sentiment", "Average sentiment")} value={formatScore(marketSummary?.average_sentiment_score)} />
          </MetricGrid>

          <SectionCard
            title={t("Обзор от ассистента", "Assistant overview")}
            description={t(
              "Сводка формируется из последнего snapshot новостного анализа.",
              "This summary is built from the latest news-analysis snapshot.",
            )}
          >
            <div className="ui-surface-muted text-sm leading-7">{overview.answer}</div>
          </SectionCard>

          <SectionCard
            title={t("Рекомендации по новостному фону", "News-driven recommendations")}
            description={t(
              "Положительные идеи и риск-алерты по свежему новостному контексту.",
              "Positive ideas and risk alerts based on the latest news context.",
            )}
          >
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <div className="space-y-4">
                <div className="ui-section-title">{t("Топ идеи", "Top ideas")}</div>
                <RecommendationList items={overview.recommendations} locale={locale} />
              </div>
              <div className="space-y-4">
                <div className="ui-section-title">{t("Риск-алерты", "Risk alerts")}</div>
                <RecommendationList items={overview.risk_alerts} locale={locale} />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title={t("Горячие темы", "Hot topics")}
            description={t(
              "Самые обсуждаемые тикеры и темы из текущего новостного снимка.",
              "The most discussed tickers and themes from the current news snapshot.",
            )}
          >
            <TopicList items={overview.hot_topics} locale={locale} />
          </SectionCard>

        </>
      ) : null}

      {overview && section === "feed" ? (
        <>
          <SectionCard
            title={t("Обновление новостей", "Refresh pipeline")}
            description={t(
              "Запускает сбор и пересчёт новостного анализа прямо из основной области страницы, без прокрутки к боковой панели.",
              "Runs a fresh news fetch and analysis from the main content area, without scrolling back to the sidebar.",
            )}
          >
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="ui-surface-muted flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={useFinbert}
                    onChange={(event) => setUseFinbert(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>{t("Использовать FinBERT для тональности", "Use FinBERT for sentiment analysis")}</span>
                </label>
                <label className="ui-surface-muted flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={fetchFullText}
                    onChange={(event) => setFetchFullText(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>{t("Загружать полные тексты новостей", "Fetch full article texts")}</span>
                </label>
              </div>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="ui-primary-button w-full bg-gradient-to-r from-blue-700 to-cyan-600 hover:from-blue-800 hover:to-cyan-700"
                >
                  {isRefreshing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {isRefreshing ? t("Обновляем...", "Refreshing...") : t("Обновить и пересчитать", "Refresh and analyze")}
                </button>
                {refreshSummary ? <div className="ui-surface-muted text-sm">{refreshSummary}</div> : null}
              </div>
            </div>
          </SectionCard>

          <MetricGrid>
            <MetricCard label={t("Обработано новостей", "Processed news")} value={marketSummary?.total_news ?? 0} />
            <MetricCard label={t("Источников", "Sources")} value={marketSummary?.sources.length ?? 0} />
            <MetricCard label={t("Общий фон", "Overall sentiment")} value={marketSummary?.overall_sentiment ?? "neutral"} />
            <MetricCard label={t("Средний sentiment", "Average sentiment")} value={formatScore(marketSummary?.average_sentiment_score)} />
          </MetricGrid>

          <SectionCard
            title={t("Ключевые новости", "Top news")}
            description={t(
              "Отдельная лента без смешивания с overview и ответами ассистента.",
              "A dedicated news feed without mixing it with the overview or assistant responses.",
            )}
          >
            <NewsList items={overview.top_news} locale={locale} />
          </SectionCard>

          <SectionCard
            title={t("Горячие темы", "Hot topics")}
            description={t(
              "Темы и тикеры, которые чаще всего всплывают в текущей ленте.",
              "Themes and tickers that appear most often in the current feed.",
            )}
          >
            <TopicList items={overview.hot_topics} locale={locale} />
          </SectionCard>
        </>
      ) : null}

      {section === "assistant" ? (
        <SectionCard
          title={t("Запросы ассистента", "Assistant tools")}
          description={t(
            "Формы вынесены наверх основной области, чтобы можно было быстро задавать запросы и не листать к боковой панели.",
            "The assistant forms are placed at the top of the main area so you can work without scrolling back to the sidebar.",
          )}
        >
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="ui-surface-muted space-y-4">
              <div className="space-y-1">
                <div className="ui-section-title text-base">{t("Запрос к ассистенту", "Assistant query")}</div>
                <div className="ui-section-copy">
                  {t(
                    "Свободный вопрос по рынку, идеям, рискам или отдельным тикерам.",
                    "Ask a free-form question about the market, ideas, risks, or a specific ticker.",
                  )}
                </div>
              </div>
              <form onSubmit={handleAssistantSubmit} className="space-y-3">
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder={t("Например: что сегодня по SBER и GAZP?", "For example: what is happening with SBER and GAZP today?")}
                  className="ui-input min-h-32 resize-y"
                />
                <button
                  type="submit"
                  disabled={isSubmittingQuery || !message.trim()}
                  className="ui-primary-button w-full bg-gradient-to-r from-cyan-700 to-sky-600 hover:from-cyan-800 hover:to-sky-700"
                >
                  {isSubmittingQuery ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {isSubmittingQuery ? t("Отправляем...", "Sending...") : t("Спросить", "Ask assistant")}
                </button>
              </form>
            </div>

            <div className="ui-surface-muted space-y-4">
              <div className="space-y-1">
                <div className="ui-section-title text-base">{t("Отчёт по тикеру", "Ticker report")}</div>
                <div className="ui-section-copy">
                  {t(
                    "Быстрый способ получить новостный контекст и сигнал по конкретному инструменту.",
                    "A quick way to load the news context and signal for a specific instrument.",
                  )}
                </div>
              </div>
              <form onSubmit={handleTickerSubmit} className="space-y-3">
                <input
                  value={ticker}
                  onChange={(event) => setTicker(event.target.value.toUpperCase())}
                  placeholder="SBER"
                  className="ui-input"
                />
                <button
                  type="submit"
                  disabled={isSubmittingTicker || !ticker.trim()}
                  className="ui-primary-button w-full bg-gradient-to-r from-emerald-700 to-teal-600 hover:from-emerald-800 hover:to-teal-700"
                >
                  {isSubmittingTicker ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  {isSubmittingTicker ? t("Загружаем...", "Loading...") : t("Показать отчёт", "Show report")}
                </button>
              </form>
              <div className="flex flex-wrap gap-2">
                {supportedTickers.slice(0, 12).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setTicker(item)}
                    className="ui-secondary-button px-3 py-1.5 text-xs"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>
      ) : null}

      {section === "assistant" ? (
        <SectionCard
        title={t("Ответ ассистента", "Assistant response")}
        description={t(
          "Здесь отображаются результаты свободного запроса или отчёта по тикеру.",
          "This section shows results from the free-form assistant query or the ticker report.",
        )}
      >
        {assistantResult ? (
          <div className="space-y-6">
            <div className="ui-surface-muted text-sm leading-7">{assistantResult.answer}</div>
            {assistantRecommendations.length ? (
              <div className="space-y-4">
                <div className="ui-section-title">{t("Сигналы", "Signals")}</div>
                <RecommendationList items={assistantRecommendations} locale={locale} />
              </div>
            ) : null}
            {assistantNews.length ? (
              <div className="space-y-4">
                <div className="ui-section-title">{t("Связанные новости", "Related news")}</div>
                <NewsList items={assistantNews} locale={locale} />
              </div>
            ) : null}
          </div>
        ) : (
          <div className="ui-surface-muted text-sm">
            {t(
              "Сначала задайте вопрос ассистенту или запросите отчёт по тикеру.",
              "Ask the assistant a question or request a ticker report first.",
            )}
          </div>
        )}
        </SectionCard>
      ) : null}
    </AnalysisPageFrame>
  );
}
