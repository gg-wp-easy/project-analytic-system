import { Link } from "react-router-dom";
import { ArrowRight, Brain, GitBranch, Layers, Network } from "lucide-react";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import { trackSpotlight } from "../../../shared/lib/motion/spotlight";
import { PageHero, SectionCard } from "../../../shared/ui/analysis-shell";

const tools = [
  {
    titleRu: "Кластерный анализ",
    titleEn: "Cluster Analysis",
    descriptionRu: "Группировка акций по похожим мультипликаторам, доходности, риску и секторной структуре.",
    descriptionEn: "Groups stocks by similar valuation, profitability, risk, and sector structure.",
    path: "/cluster",
    icon: Network,
    color: "from-violet-600 to-fuchsia-600",
  },
  {
    titleRu: "Дерево решений",
    titleEn: "Decision Tree",
    descriptionRu: "Интерпретируемые правила отбора и важность факторов для инвестиционного решения.",
    descriptionEn: "Interpretable selection rules and factor importance for investment decisions.",
    path: "/decision-tree",
    icon: GitBranch,
    color: "from-emerald-600 to-green-600",
  },
  {
    titleRu: "Нейросетевой анализ",
    titleEn: "Neural Network",
    descriptionRu: "Поиск нелинейных зависимостей между фундаментальными показателями и итоговым сигналом.",
    descriptionEn: "Finds nonlinear relationships between fundamentals and the final signal.",
    path: "/neural-network",
    icon: Brain,
    color: "from-orange-600 to-red-600",
  },
  {
    titleRu: "Гибридный анализ",
    titleEn: "Hybrid Analysis",
    descriptionRu: "Сводит несколько моделей в единый взвешенный результат и портфельный отбор.",
    descriptionEn: "Combines several models into one weighted result and portfolio selection.",
    path: "/hybrid",
    icon: Layers,
    color: "from-cyan-600 to-blue-700",
  },
];

export function StockAnalysisPage() {
  const { t } = useAppSettings();

  return (
    <div className="space-y-6">
      <PageHero
        icon={Layers}
        title={t({ ru: "Анализ акций", en: "Stock Analysis" })}
        description={t({
          ru: "Выберите модель анализа акций: кластеризацию, дерево решений, нейросеть или гибридный подход.",
          en: "Choose a stock analysis model: clustering, decision tree, neural network, or hybrid approach.",
        })}
        accent="cyan"
      />

      <SectionCard
        title={t({ ru: "Выбор анализа", en: "Analysis Selection" })}
        description={t({
          ru: "Все модели используют единый набор фундаментальных данных и результаты первичной обработки.",
          en: "All models use the same fundamentals dataset and preprocessing results.",
        })}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                      {t({ ru: tool.titleRu, en: tool.titleEn })}
                    </div>
                    <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {t({ ru: tool.descriptionRu, en: tool.descriptionEn })}
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
