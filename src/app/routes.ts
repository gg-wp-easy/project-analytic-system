import { createBrowserRouter } from "react-router";
import { Root } from "./components/Root";
import { Dashboard } from "./components/Dashboard";
import { ClusterAnalysis } from "./components/ClusterAnalysis";
import { DecisionTreeAnalysis } from "./components/DecisionTreeAnalysis";
import { NeuralNetworkAnalysis } from "./components/NeuralNetworkAnalysis";
import { HybridAnalysis } from "./components/HybridAnalysis";
import { FundamentalsData } from "./components/FundamentalsData";
import { NotFound } from "./components/NotFound";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Dashboard },
      { path: "cluster", Component: ClusterAnalysis },
      { path: "decision-tree", Component: DecisionTreeAnalysis },
      { path: "neural-network", Component: NeuralNetworkAnalysis },
      { path: "hybrid", Component: HybridAnalysis },
      { path: "fundamentals", Component: FundamentalsData },
      { path: "*", Component: NotFound },
    ],
  },
]);
