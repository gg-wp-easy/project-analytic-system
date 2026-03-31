import type { OptimizerSettings } from "../model/optimizerSettings";

type OptimizerSettingsFieldsProps = {
  isEn: boolean;
  settings: OptimizerSettings;
  onChange: (next: OptimizerSettings) => void;
};

export function OptimizerSettingsFields({ isEn, settings, onChange }: OptimizerSettingsFieldsProps) {
  return (
    <div className="ui-surface-muted space-y-3">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {isEn ? "Portfolio Optimizer Settings" : "Настройки оптимизатора портфеля"}
      </p>

      <label className="block text-xs text-slate-600 dark:text-slate-400">
        {isEn ? "Risk-free rate, %" : "Безрисковая ставка, %"}
        <input
          type="number"
          step="0.1"
          className="ui-input mt-1"
          value={settings.riskFreeRate}
          onChange={(e) => onChange({ ...settings, riskFreeRate: e.target.value })}
        />
      </label>

      <label className="block text-xs text-slate-600 dark:text-slate-400">
        {isEn ? "Min weight, %" : "Минимальный вес актива, %"}
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
        {isEn ? "Max weight, %" : "Максимальный вес актива, %"}
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
        {isEn ? "Sharpe blend weight, %" : "Вес портфеля с оптимизацией на коэффициент Шарпа, %"}
        <input
          type="number"
          step="0.1"
          className="ui-input mt-1"
          value={settings.sharpeBlendWeight}
          onChange={(e) => onChange({ ...settings, sharpeBlendWeight: e.target.value })}
        />
      </label>

      <label className="block text-xs text-slate-600 dark:text-slate-400">
        {isEn ? "Min risk blend weight, %" : "Вес портфеля с оптимизацией на минимизацию риска, %"}
        <input
          type="number"
          step="0.1"
          className="ui-input mt-1"
          value={settings.minRiskBlendWeight}
          onChange={(e) => onChange({ ...settings, minRiskBlendWeight: e.target.value })}
        />
      </label>

      <label className="block text-xs text-slate-600 dark:text-slate-400">
        {isEn ? "Portfolio assets count" : "Количество активов в портфеле"}
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
