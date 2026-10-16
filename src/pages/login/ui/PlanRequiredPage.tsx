import { useState } from "react";
import { Gift, LogOut, RefreshCw } from "lucide-react";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import { formatTrialDate, PLAN_TITLES, useSession } from "../../../entities/session";
import { AuthScreen } from "./AuthScreen";

export function PlanRequiredPage() {
  const { t, locale } = useAppSettings();
  const { user, logout, reload, startTrial } = useSession();
  const [checking, setChecking] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const plan = user ? PLAN_TITLES[user.plan] : undefined;
  const trialEnded = user?.trial_ends_at ? new Date(user.trial_ends_at) : null;

  const handleCheck = async () => {
    setChecking(true);
    try {
      await reload();
    } finally {
      setChecking(false);
    }
  };

  const handleTrial = async () => {
    setStarting(true);
    setError(null);
    try {
      await startTrial();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : t({ ru: "Не удалось включить пробный период.", en: "Could not start the trial." }));
    } finally {
      setStarting(false);
    }
  };

  return (
    <AuthScreen>
      <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
        {t({ ru: "Нужен тариф «Про»", en: "Pro plan required" })}
      </h2>
      <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
        {t({
          ru: "Оценка акций, облигационный конструктор и оптимизация портфеля в desktop-приложении входят в тариф «Про».",
          en: "Stock valuation, the bond builder, and portfolio optimization in the desktop app are part of the Pro plan.",
        })}
      </p>
      {user?.trial_available ? (
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
          {t({
            ru: "Попробуйте месяц бесплатно: «Про» откроет инвестиционную аналитику и финансово-экономический анализ. Пробный период включается один раз, оплата не нужна.",
            en: "Try it free for a month: Pro unlocks investment analytics and financial analysis. The trial can be started once, no payment needed.",
          })}
        </p>
      ) : null}
      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-900/60">
        <div className="text-slate-500 dark:text-slate-400">{user?.email}</div>
        <div className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
          {t({ ru: "Тариф", en: "Plan" })}: {plan ? t(plan) : user?.plan}
        </div>
        {trialEnded && !user?.trial_available ? (
          <div className="mt-1 text-slate-500 dark:text-slate-400">
            {t({ ru: "Пробный период закончился", en: "Trial ended on" })} {formatTrialDate(trialEnded, locale)}
          </div>
        ) : null}
      </div>
      {error ? (
        <div
          role="alert"
          className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100"
        >
          {error}
        </div>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-2">
        {user?.trial_available ? (
          <button type="button" onClick={handleTrial} disabled={starting} className="ui-primary-button">
            {starting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
            {t({ ru: "Попробовать бесплатно 30 дней", en: "Try free for 30 days" })}
          </button>
        ) : null}
        <button
          type="button"
          onClick={handleCheck}
          disabled={checking}
          className={user?.trial_available ? "ui-secondary-button" : "ui-primary-button"}
        >
          <RefreshCw className={checking ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          {t({ ru: "Проверить снова", en: "Check again" })}
        </button>
        <button type="button" onClick={() => void logout()} className="ui-secondary-button">
          <LogOut className="h-4 w-4" />
          {t({ ru: "Выйти", en: "Sign out" })}
        </button>
      </div>
    </AuthScreen>
  );
}
