import type { BondAnalysisBond } from "../../../features/bonds-analysis";

export type BondViewMode = "charts" | "list";

export type BondBubblePoint = BondAnalysisBond & {
  yieldPct: number;
  maturityYears: number;
  bubbleSize: number;
};

export type BondChartGroup = {
  key: string;
  label: string;
  description: string;
  bonds: BondAnalysisBond[];
};

export type BondsTranslationFn = (ru: string, en: string) => string;
