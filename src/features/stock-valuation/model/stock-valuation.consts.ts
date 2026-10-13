import { Brain, GitBranch, Layers, Network, TrendingUp, type LucideIcon } from "lucide-react";
import type { AnalysisShellAccent } from "../../../shared/ui/analysis-shell";
import type { SavedPortfolioSourceKey } from "../../saved-portfolios";
import type { HybridWeights, StockAnalysisKey, ValuationClass } from "./stock-valuation.types";

export type StockAnalysisConfig = {
  key: StockAnalysisKey;
  endpoint: string;
  title: { ru: string; en: string };
  description: { ru: string; en: string };
  icon: LucideIcon;
  accent: AnalysisShellAccent;
  palette: string[];
  sourceKey: SavedPortfolioSourceKey;
  storageKey: string;
};

// Версия сохранённого результата: при смене формата ответа старый результат отбрасывается.
export const STOCK_VALUATION_STATE_VERSION = 1;

export const STOCK_ANALYSES: Record<StockAnalysisKey, StockAnalysisConfig> = {
  regression: {
    key: "regression",
    endpoint: "regression-analysis",
    title: { ru: "Регрессионный анализ", en: "Regression Analysis" },
    description: {
      ru: "Справедливый P/E из показателей компании: база отрасли и линейная регрессия по отобранным факторам.",
      en: "Fair P/E from company fundamentals: the sector base and a linear regression on the selected factors.",
    },
    icon: TrendingUp,
    accent: "blue",
    palette: ["#1d4ed8", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#0ea5e9", "#0284c7", "#38bdf8"],
    sourceKey: "regression",
    storageKey: "stock-valuation:regression",
  },
  cluster: {
    key: "cluster",
    endpoint: "cluster-analysis",
    title: { ru: "Кластерный анализ", en: "Cluster Analysis" },
    description: {
      ru: "Группы компаний по P/E и устойчивому росту g: дешёвые для своего роста группы — недооценены.",
      en: "Groups of companies by P/E and sustainable growth g: groups cheap for their growth are undervalued.",
    },
    icon: Network,
    accent: "violet",
    palette: ["#7c3aed", "#8b5cf6", "#a78bfa", "#c084fc", "#d946ef", "#e879f9", "#6d28d9", "#a855f7"],
    sourceKey: "cluster",
    storageKey: "stock-valuation:cluster",
  },
  tree: {
    key: "tree",
    endpoint: "tree-solver-analysis",
    title: { ru: "Дерево решений", en: "Decision Tree" },
    description: {
      ru: "Правила «показатель ≤ порог», которые делят компании на группы с разным справедливым P/E.",
      en: "\"Indicator ≤ threshold\" rules that split companies into groups with different fair P/E.",
    },
    icon: GitBranch,
    accent: "emerald",
    palette: ["#059669", "#10b981", "#34d399", "#6ee7b7", "#14b8a6", "#2dd4bf", "#047857", "#22c55e"],
    sourceKey: "decision-tree",
    storageKey: "stock-valuation:tree",
  },
  neural: {
    key: "neural",
    endpoint: "ai-analysis",
    title: { ru: "Нейросетевой анализ", en: "Neural Network" },
    description: {
      ru: "Ансамбль нейросетей находит нелинейную связь P/E с показателями компании.",
      en: "An ensemble of neural networks finds non-linear links between P/E and company fundamentals.",
    },
    icon: Brain,
    accent: "orange",
    palette: ["#ea580c", "#f97316", "#fb923c", "#fdba74", "#ef4444", "#f87171", "#c2410c", "#f59e0b"],
    sourceKey: "neural-network",
    storageKey: "stock-valuation:neural",
  },
  hybrid: {
    key: "hybrid",
    endpoint: "hybrid-analysis",
    title: { ru: "Гибридный анализ", en: "Hybrid Analysis" },
    description: {
      ru: "Средневзвешенный справедливый P/E регрессии, кластеров, дерева и нейросети.",
      en: "Weighted fair P/E of the regression, clusters, tree and neural network.",
    },
    icon: Layers,
    accent: "cyan",
    palette: ["#0891b2", "#06b6d4", "#22d3ee", "#67e8f9", "#0e7490", "#3b82f6", "#155e75", "#38bdf8"],
    sourceKey: "hybrid",
    storageKey: "stock-valuation:hybrid",
  },
};

export const STOCK_ANALYSIS_ORDER: StockAnalysisKey[] = ["regression", "cluster", "tree", "neural", "hybrid"];

export const DEFAULT_HYBRID_WEIGHTS: HybridWeights = { regression: "1", cluster: "1", tree: "1", neural: "1" };

export const CLASS_STYLES: Record<ValuationClass, string> = {
  undervalued: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200",
  fair: "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200",
  overvalued: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200",
  not_rated: "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200",
};

export const CLASS_TITLES: Record<ValuationClass, { ru: string; en: string }> = {
  undervalued: { ru: "Недооценены", en: "Undervalued" },
  fair: { ru: "Справедливо", en: "Fair" },
  overvalued: { ru: "Переоценены", en: "Overvalued" },
  not_rated: { ru: "Без оценки", en: "Not rated" },
};
