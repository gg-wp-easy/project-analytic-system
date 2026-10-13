import { useEffect, useMemo, useState } from "react";
import { Play, Settings } from "lucide-react";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import { buildStockAnalysisRecords, useFundamentals } from "../../../entities/fundamentals";
import { numberOr } from "../../../shared/lib/number/numberOr";
import { AnalysisPageFrame, AnalysisSidebarCard, PageHero } from "../../../shared/ui/analysis-shell";
import { AnalysisRunningIndicator } from "../../../shared/ui/analysis/AnalysisRunningIndicator";
import { AppErrorDialog } from "../../../shared/ui/app-error-dialog";
import { OptimizerSettingsFields, submitOptimizerSettings, useOptimizerSettings } from "../../optimizer-settings";
import { requestStockValuation } from "../lib/stock-valuation.api";
import {
  DEFAULT_HYBRID_WEIGHTS,
  STOCK_ANALYSES,
  STOCK_VALUATION_STATE_VERSION,
} from "../model/stock-valuation.consts";
import type { HybridWeights, StockAnalysisKey, StockValuationResult } from "../model/stock-valuation.types";
import { AnalysisDetails } from "./AnalysisDetails";
import { CompaniesTable } from "./CompaniesTable";
import { PortfoliosPanel } from "./PortfoliosPanel";
import { ValuationSummary } from "./ValuationSummary";

type StoredState = { version: number; result: StockValuationResult | null; weights?: HybridWeights };

function readState(key: string): StoredState | null {
  try {
    const raw = window.localStorage.getItem(key);
    const state = raw ? (JSON.parse(raw) as StoredState) : null;
    return state?.version === STOCK_VALUATION_STATE_VERSION ? state : null;
  } catch {
    return null;
  }
}

const WEIGHT_FIELDS: Array<{ key: keyof HybridWeights; analysis: StockAnalysisKey }> = [
  { key: "regression", analysis: "regression" },
  { key: "cluster", analysis: "cluster" },
  { key: "tree", analysis: "tree" },
  { key: "neural", analysis: "neural" },
];

/** Страница анализа акций по P/E: настройки слева, справа — итог, особенности анализа, компании и портфели. */
export function StockValuationPage({ analysis }: { analysis: StockAnalysisKey }) {
  const config = STOCK_ANALYSES[analysis];
  const { t } = useAppSettings();
  const { hasData, cache } = useFundamentals();
  const { settings, setSettings } = useOptimizerSettings();
  const stored = useMemo(() => readState(config.storageKey), [config.storageKey]);
  const [result, setResult] = useState<StockValuationResult | null>(stored?.result ?? null);
  const [weights, setWeights] = useState<HybridWeights>(stored?.weights ?? DEFAULT_HYBRID_WEIGHTS);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const records = useMemo(() => buildStockAnalysisRecords(cache), [cache]);

  useEffect(() => {
    try {
      const state: StoredState = { version: STOCK_VALUATION_STATE_VERSION, result, weights };
      window.localStorage.setItem(config.storageKey, JSON.stringify(state));
    } catch {
      // Хранилище переполнено или недоступно: результат остаётся в памяти.
    }
  }, [config.storageKey, result, weights]);

  const weightTotal = WEIGHT_FIELDS.reduce((sum, field) => sum + Math.max(numberOr(weights[field.key], 0), 0), 0);

  const run = async () => {
    setIsRunning(true);
    setError(null);
    try {
      if (!settings.autoPortfolioOptimization) {
        await submitOptimizerSettings(settings);
      }
      const next = await requestStockValuation(config, {
        data: records,
        portfolioAssetsCount: settings.autoPortfolioOptimization
          ? 20
          : Math.max(1, Math.trunc(numberOr(settings.portfolioAssetsCount, 20))),
        autoPortfolio: settings.autoPortfolioOptimization,
        weights:
          analysis === "hybrid"
            ? Object.fromEntries(WEIGHT_FIELDS.map((field) => [field.key, Math.max(numberOr(weights[field.key], 0), 0)]))
            : undefined,
      });
      setResult(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Не удалось выполнить анализ", "Analysis failed"));
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <>
      <AnalysisPageFrame
        hero={<PageHero icon={config.icon} title={t(config.title)} description={t(config.description)} accent={config.accent} />}
        sidebar={(
          <AnalysisSidebarCard
            icon={Settings}
            title={t("Параметры", "Parameters")}
            description={t(
              "Показатели и параметры моделей подбираются автоматически; здесь — портфель.",
              "Indicators and model parameters are chosen automatically; set up the portfolio here.",
            )}
            accent={config.accent}
          >
            <div className="space-y-4">
              <div className="ui-surface-muted">
                <p className="text-sm text-slate-700 dark:text-slate-300">{t("Данные: загруженные фундаментальные показатели", "Data: loaded fundamentals")}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("Компаний", "Companies")}: {records.length}</p>
              </div>
              {analysis === "hybrid" && (
                <div className="ui-surface-muted space-y-3">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("Веса анализов", "Analysis weights")}</p>
                  {WEIGHT_FIELDS.map((field) => {
                    const share = weightTotal > 0 ? (Math.max(numberOr(weights[field.key], 0), 0) / weightTotal) * 100 : 0;
                    return (
                      <label key={field.key} className="block text-xs text-slate-600 dark:text-slate-400">
                        <span className="flex items-center justify-between gap-3">
                          <span>{t(STOCK_ANALYSES[field.analysis].title)}</span>
                          <span className="font-semibold text-cyan-700 dark:text-cyan-300">{share.toFixed(0)}%</span>
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          className="ui-input mt-1"
                          value={weights[field.key]}
                          onChange={(event) => setWeights((current) => ({ ...current, [field.key]: event.target.value }))}
                        />
                      </label>
                    );
                  })}
                </div>
              )}
              <OptimizerSettingsFields settings={settings} onChange={setSettings} />
              <button
                type="button"
                onClick={run}
                disabled={!hasData || !records.length || isRunning || (analysis === "hybrid" && weightTotal <= 0)}
                className="ui-primary-button w-full"
              >
                <Play className="h-4 w-4" />
                {isRunning ? t("Выполняется...", "Running...") : t("Запустить анализ", "Run analysis")}
              </button>
              {!hasData && (
                <p className="text-xs text-amber-700 dark:text-amber-300">{t("Сначала загрузите фундаментальные данные.", "Load fundamentals first.")}</p>
              )}
            </div>
          </AnalysisSidebarCard>
        )}
      >
        {isRunning ? (
          <AnalysisRunningIndicator
            title={t("Оцениваем P/E", "Valuing P/E")}
            subtitle={t(
              "Первый запуск — около минуты: модели проверяются вне выборки. Другие анализы тех же данных потом откроются сразу.",
              "The first run takes about a minute: models are checked out of sample. Other analyses of the same data then open at once.",
            )}
            accentClassName="text-blue-700"
          />
        ) : result ? (
          <>
            <ValuationSummary result={result} />
            <AnalysisDetails result={result} />
            <PortfoliosPanel result={result} config={config} shares={cache.shares} fundamentalsByFigi={cache.fundamentalsByFigi} />
            <CompaniesTable result={result} />
          </>
        ) : null}
      </AnalysisPageFrame>

      <AppErrorDialog
        message={error}
        onClose={() => setError(null)}
        title={t("Ошибка анализа", "Analysis Error")}
        description={t("Не удалось выполнить анализ. Проверьте данные и попробуйте ещё раз.", "The analysis failed. Check the data and try again.")}
        closeLabel={t("Закрыть", "Close")}
      />
    </>
  );
}
