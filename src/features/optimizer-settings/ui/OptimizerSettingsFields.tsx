import { useAppSettings } from "../../../app/context/AppSettingsContext";
import { Checkbox } from "../../../app/components/ui/checkbox";
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
              optimizationObjective:
                e.target.value === "max_return_target_risk"
                  ? "max_return_target_risk"
                  : "min_risk_target_return",
            })
          }
        >
          <option value="min_risk_target_return">
            {t("Минимальный риск при заданной доходности", "Minimum risk at a target return")}
          </option>
          <option value="max_return_target_risk">
            {t("Максимальная доходность при заданном риске", "Maximum return at a target risk")}
          </option>
        </select>
      </label>

      {settings.optimizationObjective === "min_risk_target_return" ? (
        <label className="block text-xs text-slate-600 dark:text-slate-400">
          {t("Минимальная ожидаемая доходность, %", "Minimum expected return, %")}
          <input
            type="number"
            min="0"
            step="0.1"
            className="ui-input mt-1"
            value={settings.targetReturn}
            onChange={(e) => onChange({ ...settings, targetReturn: e.target.value })}
          />
        </label>
      ) : (
        <label className="block text-xs text-slate-600 dark:text-slate-400">
          {t("Максимальный допустимый риск, %", "Maximum allowed risk, %")}
          <input
            type="number"
            min="0.1"
            step="0.1"
            className="ui-input mt-1"
            value={settings.targetRisk}
            onChange={(e) => onChange({ ...settings, targetRisk: e.target.value })}
          />
        </label>
      )}

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

      <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
        <Checkbox
          checked={settings.hideAnalysisDetails}
          onCheckedChange={(checked) => onChange({ ...settings, hideAnalysisDetails: checked === true })}
        />
        <span>{t("Скрыть подробности анализа и показать только портфель", "Hide analysis details and show only the portfolio")}</span>
      </label>
    </div>
  );
}
