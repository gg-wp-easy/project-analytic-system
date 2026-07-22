import { useAppSettings } from "../../../app/context/AppSettingsContext";
import type { OptimizerSettingsFieldsProps } from "../model";

export function OptimizerSettingsFields({ settings, onChange, autoFitWeights = false }: OptimizerSettingsFieldsProps) {
  const { t } = useAppSettings();

  return (
    <div className="ui-surface-muted space-y-3">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {t("Настройки оптимизатора портфеля", "Portfolio Optimizer Settings")}
      </p>

      <label className="block text-xs text-slate-600 dark:text-slate-400">
        {t("Безрисковая ставка, %", "Risk-free rate, %")}
        <input
          type="number"
          step="0.1"
          className="ui-input mt-1"
          value={settings.riskFreeRate}
          onChange={(e) => onChange({ ...settings, riskFreeRate: e.target.value })}
        />
      </label>

      {!autoFitWeights && (
        <>
          <label className="block text-xs text-slate-600 dark:text-slate-400">
            {t("\u041c\u0438\u043d\u0438\u043c\u0430\u043b\u044c\u043d\u044b\u0439 \u0432\u0435\u0441 \u0430\u043a\u0442\u0438\u0432\u0430, %", "Min weight, %")}
            <input
              type="number"
              min="0"
              step="0.1"
              className="ui-input mt-1"
              value={settings.minWeight}
              onChange={(e) => onChange({ ...settings, minWeight: e.target.value })}
            />
          </label>

          <label className="block text-xs text-slate-600 dark:text-slate-400">
            {t("\u041c\u0430\u043a\u0441\u0438\u043c\u0430\u043b\u044c\u043d\u044b\u0439 \u0432\u0435\u0441 \u0430\u043a\u0442\u0438\u0432\u0430, %", "Max weight, %")}
            <input
              type="number"
              min="0"
              step="0.1"
              className="ui-input mt-1"
              value={settings.maxWeight}
              onChange={(e) => onChange({ ...settings, maxWeight: e.target.value })}
            />
          </label>
        </>
      )}

      <label className="block text-xs text-slate-600 dark:text-slate-400">
        {t("Цель построения портфеля", "Portfolio objective")}
        <select
          className="ui-input mt-1"
          value={settings.optimizationObjective}
          onChange={(e) =>
            onChange({
              ...settings,
              optimizationObjective: e.target.value === "min_risk" ? "min_risk" : "max_sharpe",
            })
          }
        >
          <option value="max_sharpe">{t("Максимальный коэффициент Шарпа", "Maximum Sharpe ratio")}</option>
          <option value="min_risk">{t("Минимизация риска", "Risk minimization")}</option>
        </select>
      </label>

      <label className="block text-xs text-slate-600 dark:text-slate-400">
        {t("Количество активов в портфеле", "Portfolio assets count")}
        <input
          type="number"
          min="0"
          step="1"
          className="ui-input mt-1"
          value={settings.portfolioAssetsCount}
          onChange={(e) => onChange({ ...settings, portfolioAssetsCount: e.target.value })}
        />
      </label>
    </div>
  );
}
