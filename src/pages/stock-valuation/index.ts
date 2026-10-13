import { createElement } from "react";
import { StockValuationPage } from "../../features/stock-valuation";

// Пять анализов акций по P/E — одна страница с разной частью общего расчёта платформы.
export const RegressionAnalysis = () => createElement(StockValuationPage, { analysis: "regression" });
export const ClusterAnalysis = () => createElement(StockValuationPage, { analysis: "cluster" });
export const DecisionTreeAnalysis = () => createElement(StockValuationPage, { analysis: "tree" });
export const NeuralNetworkAnalysis = () => createElement(StockValuationPage, { analysis: "neural" });
export const HybridAnalysis = () => createElement(StockValuationPage, { analysis: "hybrid" });
