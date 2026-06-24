import { Link, useLocation } from "react-router-dom";
import { Database, Filter } from "lucide-react";
import { useAppSettings } from "../../../app/context/AppSettingsContext";

const tabs = [
  {
    path: "/fundamentals",
    labelRu: "Список акций и данные",
    labelEn: "Stocks and Data",
    icon: Database,
  },
  {
    path: "/fundamentals/preprocessing",
    labelRu: "Первичная обработка",
    labelEn: "Preprocessing",
    icon: Filter,
  },
];

export function FundamentalsTabs() {
  const location = useLocation();
  const { t } = useAppSettings();

  return (
    <nav className="ui-surface flex flex-col gap-2 p-2 sm:flex-row" aria-label={t({ ru: "Раздел фундаментальных данных", en: "Fundamentals section" })}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = location.pathname === tab.path;
        return (
          <Link
            key={tab.path}
            to={tab.path}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
              isActive
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            <Icon className="h-4 w-4" />
            <span>{t({ ru: tab.labelRu, en: tab.labelEn })}</span>
          </Link>
        );
      })}
    </nav>
  );
}