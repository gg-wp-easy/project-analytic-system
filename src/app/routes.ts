import { createElement } from "react";
import { createBrowserRouter, createHashRouter, Navigate } from "react-router-dom";
import { Root } from "./components/Root";
import { Dashboard } from "../pages/dashboard";
import { ClusterAnalysis } from "../pages/cluster-analysis";
import { DataPreprocessingPage } from "../pages/data-preprocessing";
import { DecisionTreeAnalysis } from "../pages/decision-tree-analysis";
import { NeuralNetworkAnalysis } from "../pages/neural-analysis";
import { HybridAnalysis } from "../pages/hybrid-analysis";
import { StockAnalysisPage } from "../pages/stock-analysis";
import { BondsAnalysis } from "../pages/bonds-analysis";
import { FundamentalsDetailsPage, FundamentalsPage } from "../pages/fundamentals";
import { OptionsPage, UnderlyingOptionsPage } from "../pages/options";
import { SettingsPage } from "../pages/settings";
import { NotFound } from "./components/NotFound";
import { RouteError } from "./components/RouteError";

const routes = [
  {
    path: "/",
    Component: Root,
    errorElement: createElement(RouteError),
    children: [
      { index: true, Component: Dashboard },
      { path: "fundamentals", Component: FundamentalsPage },
      { path: "fundamentals/preprocessing", Component: DataPreprocessingPage },
      { path: "fundamentals/:figi", Component: FundamentalsDetailsPage },
      { path: "stock-analysis", Component: StockAnalysisPage },
      { path: "preprocessing", element: createElement(Navigate, { to: "/fundamentals/preprocessing", replace: true }) },
      { path: "cluster", Component: ClusterAnalysis },
      { path: "decision-tree", Component: DecisionTreeAnalysis },
      { path: "neural-network", Component: NeuralNetworkAnalysis },
      { path: "hybrid", Component: HybridAnalysis },
      { path: "bonds", Component: BondsAnalysis },
      { path: "options", Component: OptionsPage },
      { path: "options/asset/:underlyingKey", Component: UnderlyingOptionsPage },
      { path: "settings", Component: SettingsPage },
      { path: "*", Component: NotFound },
    ],
  },
];

const useHashRouter =
  typeof window !== "undefined" && window.location.protocol === "file:";

export const router = useHashRouter
  ? createHashRouter(routes)
  : createBrowserRouter(routes);