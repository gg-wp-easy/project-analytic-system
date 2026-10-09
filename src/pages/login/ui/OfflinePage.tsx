import { useState } from "react";
import { LogOut, RefreshCw } from "lucide-react";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import { useSession } from "../../../entities/session";
import { AuthScreen } from "./AuthScreen";

export function OfflinePage() {
  const { t } = useAppSettings();
  const { reload, logout } = useSession();
  const [checking, setChecking] = useState(false);

  const handleRetry = async () => {
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
        {t({ ru: "Нет связи с сервером", en: "Server unavailable" })}
      </h2>
      <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
        {t({
          ru: "Расчёты и рыночные данные приходят с сервера NK-Tech Finance. Проверьте подключение к интернету и повторите.",
          en: "Calculations and market data come from the NK-Tech Finance server. Check your internet connection and try again.",
        })}
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <button type="button" onClick={handleRetry} disabled={checking} className="ui-primary-button">
          <RefreshCw className={checking ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          {t({ ru: "Повторить", en: "Retry" })}
        </button>
        <button type="button" onClick={() => void logout()} className="ui-secondary-button">
          <LogOut className="h-4 w-4" />
          {t({ ru: "Выйти", en: "Sign out" })}
        </button>
      </div>
    </AuthScreen>
  );
}
