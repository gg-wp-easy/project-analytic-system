import { API_BASE_URL } from "../../../config";
import { platformErrorText, platformFetch } from "../../../shared/api/platform";
import type { StockAnalysisConfig } from "../model/stock-valuation.consts";
import type { StockValuationResult } from "../model/stock-valuation.types";

export type StockValuationRequest = {
  data: Record<string, unknown>[];
  portfolioAssetsCount: number;
  autoPortfolio: boolean;
  weights?: Record<string, number>;
};

/** Запуск анализа на платформе; настройки оптимизатора сервер берёт сохранённые у пользователя. */
export async function requestStockValuation(
  config: StockAnalysisConfig,
  request: StockValuationRequest,
): Promise<StockValuationResult> {
  const response = await platformFetch(`${API_BASE_URL}/${config.endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: request.data,
      portfolio_assets_count: request.portfolioAssetsCount,
      auto_portfolio_optimization: request.autoPortfolio,
      weights: request.weights,
    }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(platformErrorText(response.status, text, `HTTP ${response.status}`));
  }
  const body = JSON.parse(text) as StockValuationResult;
  if (!body || !Array.isArray(body.companies) || !Array.isArray(body.portfolios)) {
    throw new Error("Сервер вернул ответ в неизвестном формате");
  }
  return body;
}
