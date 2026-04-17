import { Link } from "react-router-dom";
import { Network, GitBranch, Brain, Layers, Database, Landmark, Newspaper, ArrowRight, TrendingUp, Activity } from "lucide-react";
import { useAppSettings } from "../../../app/context/AppSettingsContext";

export function Dashboard() {
  const { t } = useAppSettings();

  const analysisTools = [
    {
      title: t("tool.cluster.title"),
      description: t("tool.cluster.description"),
      path: "/cluster",
      icon: Network,
      color: "from-purple-500 to-pink-500",
    },
    {
      title: t("tool.tree.title"),
      description: t("tool.tree.description"),
      path: "/decision-tree",
      icon: GitBranch,
      color: "from-green-500 to-emerald-500",
    },
    {
      title: t("tool.neural.title"),
      description: t("tool.neural.description"),
      path: "/neural-network",
      icon: Brain,
      color: "from-orange-500 to-red-500",
    },
    {
      title: t("tool.hybrid.title"),
      description: t("tool.hybrid.description"),
      path: "/hybrid",
      icon: Layers,
      color: "from-cyan-500 to-blue-500",
    },
    {
      title: t("Анализ облигаций", "Bond Analysis"),
      description: t(
        "Загрузка облигаций из T-Bank API на клиенте, локальный расчёт метрик и портфеля, полный список с пагинацией.",
        "Client-side bond loading from the T-Bank API, local portfolio calculations, and the full universe with pagination.",
      ),
      path: "/bonds",
      icon: Landmark,
      color: "from-amber-500 to-orange-600",
    },
    {
      title: t("Новостной ИИ-ассистент", "News AI Assistant"),
      description: t(
        "Обзор новостного фона, идеи по тикерам, отчёты по инструментам и запуск refresh новостного пайплайна.",
        "Market-news overview, ticker ideas, instrument reports, and one-click refresh of the news pipeline.",
      ),
      path: "/news-assistant",
      icon: Newspaper,
      color: "from-sky-500 to-blue-600",
    },
    {
      title: t("tool.fundamentals.title"),
      description: t("tool.fundamentals.description"),
      path: "/fundamentals",
      icon: Database,
      color: "from-slate-600 to-slate-800",
    },
  ];
  const activeAnalysesCount = analysisTools.filter((tool) => tool.path !== "/fundamentals").length;

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-blue-600 to-cyan-700 rounded-2xl p-8 text-white shadow-xl">
        <div className="flex items-start justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full">
              <Activity className="w-4 h-4" />
              <span className="text-sm font-medium">{t("dashboard.badge")}</span>
            </div>
            <h1 className="text-4xl font-bold text-white">{t("dashboard.title")}</h1>
            <p className="text-lg text-blue-50 max-w-2xl">{t("dashboard.description")}</p>
          </div>
          <TrendingUp className="w-24 h-24 opacity-20" />
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-6">{t("dashboard.toolsTitle")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {analysisTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.path}
                to={tool.path}
                className="group bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
              >
                <div className="space-y-4">
                  <div className={`inline-flex p-3 rounded-lg bg-gradient-to-br ${tool.color}`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 transition-colors">
                      {tool.title}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{tool.description}</p>
                  </div>
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium text-sm pt-2">
                    {t("dashboard.open")}
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
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
