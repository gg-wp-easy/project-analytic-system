import { Link } from "react-router-dom";
import { ArrowRight, Layers } from "lucide-react";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import { APP_ABSOLUTE_ROUTE_PATHS } from "../../../app/model";
import { STOCK_ANALYSES, STOCK_ANALYSIS_ORDER, type StockAnalysisKey } from "../../../features/stock-valuation";
import { trackSpotlight } from "../../../shared/lib/motion/spotlight";
import { PageHero, SectionCard } from "../../../shared/ui/analysis-shell";

const COLORS: Record<StockAnalysisKey, string> = {
  regression: "from-blue-600 to-sky-600",
  cluster: "from-violet-600 to-fuchsia-600",
  tree: "from-emerald-600 to-green-600",
  neural: "from-orange-600 to-red-600",
  hybrid: "from-cyan-600 to-blue-700",
};
const PATHS: Record<StockAnalysisKey, string> = {
  regression: APP_ABSOLUTE_ROUTE_PATHS.regression,
  cluster: APP_ABSOLUTE_ROUTE_PATHS.cluster,
  tree: APP_ABSOLUTE_ROUTE_PATHS.decisionTree,
  neural: APP_ABSOLUTE_ROUTE_PATHS.neuralNetwork,
  hybrid: APP_ABSOLUTE_ROUTE_PATHS.hybrid,
};
const tools = STOCK_ANALYSIS_ORDER.map((key) => ({
  key,
  title: STOCK_ANALYSES[key].title,
  description: STOCK_ANALYSES[key].description,
  icon: STOCK_ANALYSES[key].icon,
  path: PATHS[key],
  color: COLORS[key],
}));

export function StockAnalysisPage() {
  const { t } = useAppSettings();

  return (
    <div className="space-y-6">
      <PageHero
        icon={Layers}
        title={t({ ru: "Анализ акций", en: "Stock Analysis" })}
        description={t({
          ru: "Справедливый P/E акций пятью способами: регрессия, кластеры, дерево решений, нейросеть и их гибрид.",
          en: "Fair P/E of stocks in five ways: regression, clusters, decision tree, neural network and their hybrid.",
        })}
        accent="cyan"
      />

      <SectionCard
        title={t({ ru: "Выбор анализа", en: "Analysis Selection" })}
        description={t({
          ru: "Все анализы считаются одним расчётом по загруженным фундаментальным данным: после первого остальные открываются сразу.",
          en: "All analyses come from one run on the loaded fundamentals: after the first, the others open at once.",
        })}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.path}
                to={tool.path}
                onPointerMove={trackSpotlight}
                className="ui-link-card group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="space-y-4">
                  <span className={`ui-link-card-icon inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${tool.color}`}>
                    <Icon className="h-6 w-6 text-white" />
                  </span>
                  <div className="space-y-2">
                    <div className="font-semibold text-slate-900 transition-colors group-hover:text-blue-600 dark:text-slate-100">
                      {t(tool.title)}
                    </div>
                    <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {t(tool.description)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400">
                    {t({ ru: "Открыть", en: "Open" })}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
