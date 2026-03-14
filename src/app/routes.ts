import { createElement } from "react";
import { createBrowserRouter } from "react-router-dom";
import { Root } from "./components/Root";
import { Dashboard } from "./components/Dashboard";
import { ClusterAnalysis } from "./components/ClusterAnalysis";
import { DecisionTreeAnalysis } from "./components/DecisionTreeAnalysis";
import { NeuralNetworkAnalysis } from "./components/NeuralNetworkAnalysis";
import { HybridAnalysis } from "./components/HybridAnalysis";
import { FundamentalsDetailsPage, FundamentalsPage } from "../pages/fundamentals";
import { NotFound } from "./components/NotFound";
import { RouteError } from "./components/RouteError";

export const router = createBrowserRouter([
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
      { path: "fundamentals", Component: FundamentalsPage },
      { path: "fundamentals/:figi", Component: FundamentalsDetailsPage },
      { path: "*", Component: NotFound },
    ],
  },
]);

