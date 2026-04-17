import { AlertTriangle } from "lucide-react";
import { Link, useRouteError } from "react-router-dom";
import { useAppSettings } from "../context/AppSettingsContext";

type RouteErrorShape = {
  status?: number;
  statusText?: string;
  message?: string;
};

export function RouteError() {
  const error = useRouteError() as RouteErrorShape | null;
  const { locale, t } = useAppSettings();

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-rose-600 to-orange-500 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <AlertTriangle className="w-8 h-8" />
          <h1 className="text-3xl font-bold">{t("Произошла ошибка", "Something went wrong")}</h1>
        </div>
        <p className="text-orange-100">
          {t("Во время загрузки страницы произошла непредвиденная ошибка.", "An unexpected error occurred while loading this page.")}
        </p>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 space-y-2">
        <div className="text-sm text-slate-500">{t("Детали", "Details")}</div>
        <div className="text-sm text-slate-700">
          {error?.status ? `HTTP ${error.status}` : t("Неизвестная ошибка", "Unknown error")}
          {error?.statusText ? ` • ${error.statusText}` : ""}
          {error?.message ? ` • ${error.message}` : ""}
        </div>
      </div>

      <Link
        to="/"
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
      >
        {t("Перейти на главную", "Go to dashboard")}
      </Link>
    </div>
  );
}
