import { Link } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { useAppSettings } from "../context/AppSettingsContext";
import { APP_ABSOLUTE_ROUTE_PATHS, APP_NOT_FOUND_TEXT } from "../model";

export function NotFound() {
  const { t } = useAppSettings();

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="bg-red-100 p-4 rounded-full">
            <AlertCircle className="w-16 h-16 text-red-600" />
          </div>
        </div>
        <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100">{t(APP_NOT_FOUND_TEXT.title)}</h1>
        <p className="text-lg text-slate-600 dark:text-slate-300">{t(APP_NOT_FOUND_TEXT.description)}</p>
        <Link
          to={APP_ABSOLUTE_ROUTE_PATHS.root}
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          {t(APP_NOT_FOUND_TEXT.action)}
        </Link>
      </div>
    </div>
  );
}
