import type { AppAbsoluteRoutePathMap, AppRoutePathMap } from "./app-routes.types";

export const APP_ROUTE_PATHS: AppRoutePathMap = {
  root: "/",
  fundamentals: "fundamentals",
  fundamentalsPreprocessing: "fundamentals/preprocessing",
  fundamentalsDetails: "fundamentals/:figi",
  stockAnalysis: "stock-analysis",
  legacyPreprocessing: "preprocessing",
  cluster: "cluster",
  decisionTree: "decision-tree",
  neuralNetwork: "neural-network",
  hybrid: "hybrid",
  bonds: "bonds",
  options: "options",
  optionAssetDetails: "options/asset/:underlyingKey",
  settings: "settings",
  wildcard: "*",
};

export const APP_ABSOLUTE_ROUTE_PATHS: AppAbsoluteRoutePathMap = {
  root: "/",
  fundamentals: "/fundamentals",
  fundamentalsPreprocessing: "/fundamentals/preprocessing",
  stockAnalysis: "/stock-analysis",
  cluster: "/cluster",
  decisionTree: "/decision-tree",
  neuralNetwork: "/neural-network",
  hybrid: "/hybrid",
  bonds: "/bonds",
  options: "/options",
  settings: "/settings",
};
