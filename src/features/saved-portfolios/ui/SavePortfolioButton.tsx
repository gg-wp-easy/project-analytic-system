import { useMemo, useState } from "react";
import { Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../../app/components/ui/dialog";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import {
  createSavedPortfolioId,
  enrichPortfolioHoldings,
  normalizeSavedMetrics,
  saveSavedPortfolio,
  toDateInputValue,
} from "../lib";
import type { SavePortfolioButtonProps } from "../model";

export function SavePortfolioButton({
  holdings,
  metrics,
  sourceKey,
  sourceLabel,
  assetClass,
  defaultName,
  shares,
  fundamentalsByFigi,
  disabled,
  className,
}: SavePortfolioButtonProps) {
  const { t } = useAppSettings();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [createdAt, setCreatedAt] = useState(toDateInputValue());
  const [saved, setSaved] = useState(false);

  const enrichedHoldings = useMemo(
    () => enrichPortfolioHoldings(holdings, shares, fundamentalsByFigi),
    [fundamentalsByFigi, holdings, shares],
  );
  const normalizedMetrics = useMemo(() => normalizeSavedMetrics(metrics), [metrics]);
  const canSave = !disabled && enrichedHoldings.length > 0 && name.trim().length > 0 && createdAt.trim().length > 0;

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setSaved(false);
      setName((current) => current.trim() || defaultName);
    }
  };

  const handleSave = () => {
    if (!canSave) {
      return;
    }

    saveSavedPortfolio({
      id: createSavedPortfolioId(),
      name: name.trim(),
      sourceKey,
      sourceLabel,
      assetClass,
      createdAt,
      savedAt: new Date().toISOString(),
      holdings: enrichedHoldings,
      metrics: normalizedMetrics,
    });
    setSaved(true);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button type="button" disabled={disabled || !holdings.length} className={className ?? "ui-secondary-button px-3 py-2 text-xs"}>
          <Save className="h-4 w-4" />
          {t("Сохранить", "Save")}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("Сохранить портфель", "Save portfolio")}</DialogTitle>
          <DialogDescription>
            {t(
              "Задайте название и дату создания. Состав, веса и ожидаемые метрики сохранятся в анализ портфелей.",
              "Set a name and creation date. Holdings, weights, and expected metrics will be saved to portfolio analysis.",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label className="block text-sm text-slate-700 dark:text-slate-200">
            <span className="font-medium">{t("Название портфеля", "Portfolio name")}</span>
            <input className="ui-input mt-1" value={name} onChange={(event) => setName(event.target.value)} />
          </label>

          <label className="block text-sm text-slate-700 dark:text-slate-200">
            <span className="font-medium">{t("Дата создания", "Creation date")}</span>
            <input type="date" className="ui-input mt-1" value={createdAt} onChange={(event) => setCreatedAt(event.target.value)} />
          </label>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
            <div className="font-semibold text-slate-900 dark:text-slate-100">{sourceLabel}</div>
            <div className="mt-1">
              {t("Позиций", "Positions")}: {enrichedHoldings.length}
            </div>
            {!!normalizedMetrics.length && (
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {normalizedMetrics.slice(0, 4).map((metric) => (
                  <div key={metric.label} className="rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950/40">
                    <div className="text-xs text-slate-500 dark:text-slate-400">{metric.label}</div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{metric.value}</div>
                  </div>
                ))}
              </div>
            )}
            {saved ? <div className="mt-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300">{t("Портфель сохранён", "Portfolio saved")}</div> : null}
          </div>
        </div>

        <DialogFooter>
          <button type="button" onClick={() => setOpen(false)} className="ui-secondary-button px-4 py-2">
            {t("Отмена", "Cancel")}
          </button>
          <button type="button" onClick={handleSave} disabled={!canSave} className="ui-primary-button px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50">
            <Save className="h-4 w-4" />
            {t("Сохранить", "Save")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
