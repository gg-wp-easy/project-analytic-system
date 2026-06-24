import { Link } from "react-router-dom";
import { Activity, ArrowRight, Database, Landmark, Layers, TrendingUp } from "lucide-react";
import { useAppSettings } from "../../../app/context/AppSettingsContext";

export function Dashboard() {
  const { t } = useAppSettings();

  const sections = [
    {
      title: t({ ru: "Фундаментальные данные акций", en: "Stock Fundamentals" }),
      description: t({
        ru: "Список акций, фундаментальные показатели, детали по эмитентам и первичная обработка данных.",
        en: "Stock list, fundamentals, issuer details, and data preprocessing.",
      }),
      path: "/fundamentals",
      icon: Database,
      color: "from-slate-600 to-slate-800",
    },
    {
      title: t({ ru: "Анализ акций", en: "Stock Analysis" }),
      description: t({
        ru: "Единая точка выбора: кластерный анализ, дерево решений, нейросеть и гибридный анализ.",
        en: "One entry point for clustering, decision tree, neural network, and hybrid analysis.",
      }),
      path: "/stock-analysis",
      icon: Layers,
      color: "from-cyan-600 to-blue-700",
    },
    {
      title: t({ ru: "Анализ облигаций", en: "Bond Analysis" }),
      description: t({
        ru: "Загрузка облигаций, расчёт локальных метрик, подбор и выгрузка портфеля.",
        en: "Bond loading, local metrics, portfolio selection, and export.",
      }),
      path: "/bonds",
      icon: Landmark,
      color: "from-amber-500 to-orange-600",
    },
    {
      title: t({ ru: "Анализ опционов", en: "Options Analysis" }),
      description: t({
        ru: "Общий список базовых активов, контракты, детали и конструктор опционных стратегий.",
        en: "Underlying assets, contracts, details, and option strategy builder.",
      }),
      path: "/options",
      icon: Activity,
      color: "from-blue-500 to-cyan-600",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-700 p-8 text-white shadow-xl">
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 backdrop-blur-sm">
              <Activity className="h-4 w-4" />
              <span className="text-sm font-medium">{t({ ru: "Платформа аналитики", en: "Analytics Platform" })}</span>
            </div>
            <h1 className="text-4xl font-bold text-white">{t({ ru: "Анализ фондового рынка", en: "Market Analysis" })}</h1>
            <p className="max-w-2xl text-lg text-blue-50">
              {t({
                ru: "Разделы сгруппированы по рабочему процессу: данные акций, модели анализа, облигации и опционы.",
                en: "Sections are grouped by workflow: stock data, analysis models, bonds, and options.",
              })}
            </p>
          </div>
          <TrendingUp className="h-24 w-24 shrink-0 opacity-20" />
        </div>
      </div>

      <div>
        <h2 className="mb-6 text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {t({ ru: "Разделы", en: "Sections" })}
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <Link
                key={section.path}
                to={section.path}
                className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:border-slate-300 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
              >
                <div className="space-y-4">
                  <div className={`inline-flex rounded-lg bg-gradient-to-br p-3 ${section.color}`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold text-slate-900 transition-colors group-hover:text-blue-600 dark:text-slate-100">
                      {section.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{section.description}</p>
                  </div>
                  <div className="flex items-center gap-2 pt-2 text-sm font-medium text-blue-600 dark:text-blue-400">
                    {t({ ru: "Перейти", en: "Open" })}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}