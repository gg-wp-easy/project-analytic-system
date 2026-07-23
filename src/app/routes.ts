import { createElement } from "react";
import { Navigate } from "react-router-dom";
import { Root } from "./components/Root";
import { Dashboard } from "../pages/dashboard";
import { ClusterAnalysis } from "../pages/cluster-analysis";
import { DataPreprocessingPage } from "../pages/data-preprocessing";
import { DecisionTreeAnalysis } from "../pages/decision-tree-analysis";
import { NeuralNetworkAnalysis } from "../pages/neural-analysis";
import { HybridAnalysis } from "../pages/hybrid-analysis";
import { StockAnalysisPage } from "../pages/stock-analysis";
import { PortfolioAnalysisPage } from "../pages/portfolio-analysis";
import { BondsAnalysis } from "../pages/bonds-analysis";
import { FundamentalsDetailsPage, FundamentalsPage } from "../pages/fundamentals";
import { OptionsPage, UnderlyingOptionsPage } from "../pages/options";
import { SettingsPage } from "../pages/settings";
import { NotFound } from "./components/NotFound";
import { RouteError } from "./components/RouteError";
import { createAppRouter } from "./lib";
import { APP_ABSOLUTE_ROUTE_PATHS, APP_ROUTE_PATHS } from "./model";

const routes = [
  {
    path: APP_ROUTE_PATHS.root,
    Component: Root,
    errorElement: createElement(RouteError),
    children: [
      { index: true, Component: Dashboard },
      { path: APP_ROUTE_PATHS.fundamentals, Component: FundamentalsPage },
      { path: APP_ROUTE_PATHS.fundamentalsPreprocessing, Component: DataPreprocessingPage },
      { path: APP_ROUTE_PATHS.fundamentalsDetails, Component: FundamentalsDetailsPage },
      { path: APP_ROUTE_PATHS.stockAnalysis, Component: StockAnalysisPage },
      { path: APP_ROUTE_PATHS.portfolioAnalysis, Component: PortfolioAnalysisPage },
      {
        path: APP_ROUTE_PATHS.legacyPreprocessing,
        element: createElement(Navigate, { to: APP_ABSOLUTE_ROUTE_PATHS.fundamentalsPreprocessing, replace: true }),
      },
      { path: APP_ROUTE_PATHS.cluster, Component: ClusterAnalysis },
      { path: APP_ROUTE_PATHS.decisionTree, Component: DecisionTreeAnalysis },
      { path: APP_ROUTE_PATHS.neuralNetwork, Component: NeuralNetworkAnalysis },
      { path: APP_ROUTE_PATHS.hybrid, Component: HybridAnalysis },
      { path: APP_ROUTE_PATHS.bonds, Component: BondsAnalysis },
      { path: APP_ROUTE_PATHS.options, Component: OptionsPage },
      { path: APP_ROUTE_PATHS.optionAssetDetails, Component: UnderlyingOptionsPage },
      { path: APP_ROUTE_PATHS.settings, Component: SettingsPage },
      { path: APP_ROUTE_PATHS.wildcard, Component: NotFound },
    ],
  },
];

export const router = createAppRouter(routes);
