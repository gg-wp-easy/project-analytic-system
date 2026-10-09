import { useState } from "react";
import { LogOut, RefreshCw } from "lucide-react";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import { PLAN_TITLES, useSession } from "../../../entities/session";
import { AuthScreen } from "./AuthScreen";

export function PlanRequiredPage() {
  const { t } = useAppSettings();
  const { user, logout, reload } = useSession();
  const [checking, setChecking] = useState(false);
  const plan = user ? PLAN_TITLES[user.plan] : undefined;

  const handleCheck = async () => {
    setChecking(true);
    try {
      await reload();
    } finally {
      setChecking(false);
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
      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-900/60">
        <div className="text-slate-500 dark:text-slate-400">{user?.email}</div>
        <div className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
          {t({ ru: "Тариф", en: "Plan" })}: {plan ? t(plan) : user?.plan}
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <button type="button" onClick={handleCheck} disabled={checking} className="ui-primary-button">
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
