import { createElement } from "react";
import { Navigate } from "react-router-dom";
import { Root } from "./components/Root";
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
      {
        index: true,
        lazy: () => import("../pages/dashboard").then(({ Dashboard }) => ({ Component: Dashboard })),
      },
      {
        path: APP_ROUTE_PATHS.fundamentals,
        lazy: () => import("../pages/fundamentals").then(({ FundamentalsPage }) => ({ Component: FundamentalsPage })),
      },
      {
        path: APP_ROUTE_PATHS.fundamentalsPreprocessing,
        lazy: () => import("../pages/data-preprocessing").then(({ DataPreprocessingPage }) => ({ Component: DataPreprocessingPage })),
      },
      {
        path: APP_ROUTE_PATHS.fundamentalsDetails,
        lazy: () => import("../pages/fundamentals").then(({ FundamentalsDetailsPage }) => ({ Component: FundamentalsDetailsPage })),
      },
      {
        path: APP_ROUTE_PATHS.stockAnalysis,
        lazy: () => import("../pages/stock-analysis").then(({ StockAnalysisPage }) => ({ Component: StockAnalysisPage })),
      },
      {
        path: APP_ROUTE_PATHS.portfolioAnalysis,
        lazy: () => import("../pages/portfolio-analysis").then(({ PortfolioAnalysisPage }) => ({ Component: PortfolioAnalysisPage })),
      },
      {
        path: APP_ROUTE_PATHS.legacyPreprocessing,
        element: createElement(Navigate, { to: APP_ABSOLUTE_ROUTE_PATHS.fundamentalsPreprocessing, replace: true }),
      },
      {
        path: APP_ROUTE_PATHS.regression,
        lazy: () => import("../pages/stock-valuation").then(({ RegressionAnalysis }) => ({ Component: RegressionAnalysis })),
      },
      {
        path: APP_ROUTE_PATHS.cluster,
        lazy: () => import("../pages/stock-valuation").then(({ ClusterAnalysis }) => ({ Component: ClusterAnalysis })),
      },
      {
        path: APP_ROUTE_PATHS.decisionTree,
        lazy: () => import("../pages/stock-valuation").then(({ DecisionTreeAnalysis }) => ({ Component: DecisionTreeAnalysis })),
      },
      {
        path: APP_ROUTE_PATHS.neuralNetwork,
        lazy: () => import("../pages/stock-valuation").then(({ NeuralNetworkAnalysis }) => ({ Component: NeuralNetworkAnalysis })),
      },
      {
        path: APP_ROUTE_PATHS.hybrid,
        lazy: () => import("../pages/stock-valuation").then(({ HybridAnalysis }) => ({ Component: HybridAnalysis })),
      },
      {
        path: APP_ROUTE_PATHS.indexes,
        lazy: () => import("../pages/market-yfinance-analysis").then(({ IndexesAnalysisPage }) => ({ Component: IndexesAnalysisPage })),
      },
      {
        path: APP_ROUTE_PATHS.commodities,
        lazy: () => import("../pages/market-yfinance-analysis").then(({ CommoditiesAnalysisPage }) => ({ Component: CommoditiesAnalysisPage })),
      },
      {
        path: APP_ROUTE_PATHS.bonds,
        lazy: () => import("../pages/bonds-analysis").then(({ BondsAnalysis }) => ({ Component: BondsAnalysis })),
      },
      {
        path: APP_ROUTE_PATHS.options,
        lazy: () => import("../pages/options").then(({ OptionsPage }) => ({ Component: OptionsPage })),
      },
      {
        path: APP_ROUTE_PATHS.optionAssetDetails,
        lazy: () => import("../pages/options").then(({ UnderlyingOptionsPage }) => ({ Component: UnderlyingOptionsPage })),
      },
      {
        path: APP_ROUTE_PATHS.settings,
        lazy: () => import("../pages/settings").then(({ SettingsPage }) => ({ Component: SettingsPage })),
      },
      {
        path: APP_ROUTE_PATHS.about,
        lazy: () => import("../pages/about").then(({ AboutPage }) => ({ Component: AboutPage })),
      },
      { path: APP_ROUTE_PATHS.wildcard, Component: NotFound },
    ],
  },
];

export const router = createAppRouter(routes);
