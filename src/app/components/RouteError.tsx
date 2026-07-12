import { AlertTriangle } from "lucide-react";
import { Link, useRouteError } from "react-router-dom";
import { useAppSettings } from "../context/AppSettingsContext";
import { formatRouteErrorDetails } from "../lib";
import { APP_ABSOLUTE_ROUTE_PATHS, APP_ROUTE_ERROR_TEXT, type RouteErrorShape } from "../model";

export function RouteError() {
  const error = useRouteError() as RouteErrorShape | null;
  const { t } = useAppSettings();
  const errorDetails = formatRouteErrorDetails(error, t(APP_ROUTE_ERROR_TEXT.unknownError));

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-rose-600 to-orange-500 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <AlertTriangle className="w-8 h-8" />
          <h1 className="text-3xl font-bold">{t(APP_ROUTE_ERROR_TEXT.title)}</h1>
        </div>
        <p className="text-orange-100">
          {t(APP_ROUTE_ERROR_TEXT.description)}
        </p>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 space-y-2">
        <div className="text-sm text-slate-500">{t(APP_ROUTE_ERROR_TEXT.detailsLabel)}</div>
        <div className="text-sm text-slate-700">
          {errorDetails}
        </div>
      </div>

      <Link
        to={APP_ABSOLUTE_ROUTE_PATHS.root}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
      >
        {t(APP_ROUTE_ERROR_TEXT.action)}
      </Link>
    </div>
  );
}
