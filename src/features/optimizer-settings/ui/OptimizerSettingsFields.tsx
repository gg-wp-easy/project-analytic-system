import { useAppSettings } from "../../../app/context/AppSettingsContext";
import type { OptimizerSettings } from "../model/optimizerSettings";

type OptimizerSettingsFieldsProps = {
  settings: OptimizerSettings;
  onChange: (next: OptimizerSettings) => void;
};

export function OptimizerSettingsFields({ settings, onChange }: OptimizerSettingsFieldsProps) {
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

      <label className="block text-xs text-slate-600 dark:text-slate-400">
        {t("Минимальный вес актива, %", "Min weight, %")}
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
        {t("Максимальный вес актива, %", "Max weight, %")}
        <input
          type="number"
          min="0"
          step="0.1"
          className="ui-input mt-1"
          value={settings.maxWeight}
          onChange={(e) => onChange({ ...settings, maxWeight: e.target.value })}
        />
      </label>

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

      <p className="rounded-md border border-slate-200 bg-white/70 px-3 py-2 text-[11px] leading-5 text-slate-500 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-400">
        {t(
          "Риск автоматически корректируется по капитализации: топ-50 крупнейших компаний получают меньший риск, малые компании — надбавку к риску перед отбором в портфель.",
          "Risk is automatically adjusted by market cap: the top 50 largest companies receive lower risk, while smaller companies get a risk premium before portfolio selection.",
        )}
      </p>
    </div>
  );
}
