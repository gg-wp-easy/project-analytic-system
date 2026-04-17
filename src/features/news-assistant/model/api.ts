import { NEWS_API_BASE_URL } from "../../../config/api";
import type {
  NewsAssistantResponse,
  NewsOverviewResponse,
  NewsRefreshResponse,
  SupportedTickersResponse,
} from "./types";

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `HTTP ${response.status}`;

    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) {
        message = payload.error;
      }
    } catch {
      const text = await response.text();
      if (text) {
        message = `${message}: ${text}`;
      }
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export async function fetchNewsOverview(limit = 6): Promise<NewsOverviewResponse> {
  const response = await fetch(`${NEWS_API_BASE_URL}/assistant/overview?limit=${limit}`);
  return parseJsonResponse<NewsOverviewResponse>(response);
}

export async function fetchSupportedTickers(limit = 24): Promise<SupportedTickersResponse> {
  const response = await fetch(`${NEWS_API_BASE_URL}/assistant/supported-tickers?limit=${limit}`);
  return parseJsonResponse<SupportedTickersResponse>(response);
}

export async function fetchTickerReport(ticker: string, limit = 5): Promise<NewsAssistantResponse> {
  const response = await fetch(
    `${NEWS_API_BASE_URL}/assistant/ticker?ticker=${encodeURIComponent(ticker.trim().toUpperCase())}&limit=${limit}`,
  );
  return parseJsonResponse<NewsAssistantResponse>(response);
}

export async function queryNewsAssistant(message: string, limit = 5): Promise<NewsAssistantResponse> {
  const response = await fetch(`${NEWS_API_BASE_URL}/assistant/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      limit,
    }),
  });

  return parseJsonResponse<NewsAssistantResponse>(response);
}

export async function refreshNewsAnalysis(options: {
  useFinbert: boolean;
  fetchFullText: boolean;
}): Promise<NewsRefreshResponse> {
  const response = await fetch(`${NEWS_API_BASE_URL}/assistant/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      use_finbert: options.useFinbert,
      fetch_full_text: options.fetchFullText,
    }),
  });

  return parseJsonResponse<NewsRefreshResponse>(response);
}
