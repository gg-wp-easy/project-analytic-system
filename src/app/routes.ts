import { createElement } from "react";
import { createBrowserRouter, createHashRouter } from "react-router-dom";
import { Root } from "./components/Root";
import { Dashboard } from "../pages/dashboard";
import { ClusterAnalysis } from "../pages/cluster-analysis";
import { DecisionTreeAnalysis } from "../pages/decision-tree-analysis";
import { NeuralNetworkAnalysis } from "../pages/neural-analysis";
import { HybridAnalysis } from "../pages/hybrid-analysis";
import { BondsAnalysis } from "../pages/bonds-analysis";
import { FundamentalsDetailsPage, FundamentalsPage } from "../pages/fundamentals";
import { NewsAssistantPage } from "../pages/news-assistant";
import { NotFound } from "./components/NotFound";
import { RouteError } from "./components/RouteError";

const routes = [
  {
    path: "/",
    Component: Root,
    errorElement: createElement(RouteError),
    children: [
      { index: true, Component: Dashboard },
      { path: "cluster", Component: ClusterAnalysis },
      { path: "decision-tree", Component: DecisionTreeAnalysis },
      { path: "neural-network", Component: NeuralNetworkAnalysis },
      { path: "hybrid", Component: HybridAnalysis },
      { path: "bonds", Component: BondsAnalysis },
      { path: "news-assistant", Component: NewsAssistantPage },
      { path: "fundamentals", Component: FundamentalsPage },
      { path: "fundamentals/:figi", Component: FundamentalsDetailsPage },
      { path: "*", Component: NotFound },
    ],
  },
];

const useHashRouter =
  typeof window !== "undefined" && window.location.protocol === "file:";

export const router = useHashRouter
  ? createHashRouter(routes)
  : createBrowserRouter(routes);

