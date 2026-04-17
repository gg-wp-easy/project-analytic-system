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
        {t("Вес портфеля с оптимизацией на коэффициент Шарпа, %", "Sharpe blend weight, %")}
        <input
          type="number"
          step="0.1"
          className="ui-input mt-1"
          value={settings.sharpeBlendWeight}
          onChange={(e) => onChange({ ...settings, sharpeBlendWeight: e.target.value })}
        />
      </label>

      <label className="block text-xs text-slate-600 dark:text-slate-400">
        {t("Вес портфеля с оптимизацией на минимизацию риска, %", "Min risk blend weight, %")}
        <input
          type="number"
          step="0.1"
          className="ui-input mt-1"
          value={settings.minRiskBlendWeight}
          onChange={(e) => onChange({ ...settings, minRiskBlendWeight: e.target.value })}
        />
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
