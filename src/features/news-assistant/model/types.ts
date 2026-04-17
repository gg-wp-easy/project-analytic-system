export type NewsRecommendation = {
  ticker: string;
  action: string;
  action_label: string;
  score: number;
  confidence: number;
  mentions: number;
  positive_mentions: number;
  neutral_mentions: number;
  negative_mentions: number;
  avg_sentiment: number;
  risk_level: string;
  risk_label: string;
  thesis: string;
};

export type NewsHotTopic = {
  topic?: string;
  total_news?: number;
  source_count?: number;
  cluster_count?: number;
  momentum?: string;
  sentiment_trend?: string;
  main_tickers?: string[];
};

export type NewsItem = {
  title?: string;
  source?: string;
  published?: string;
  link?: string;
  tickers?: string[];
  sentiment?: string;
  sentiment_score?: number;
};

export type NewsMarketSummary = {
  total_news: number;
  sources: string[];
  overall_sentiment: string;
  average_sentiment_score: number;
  data_timestamp?: string;
};

export type NewsOverviewResponse = {
  type: "overview";
  generated_at: string;
  data_timestamp?: string;
  market_summary: NewsMarketSummary;
  recommendations: NewsRecommendation[];
  risk_alerts: NewsRecommendation[];
  hot_topics: NewsHotTopic[];
  top_news: NewsItem[];
  answer: string;
};

export type NewsAssistantResponse = {
  type: string;
  generated_at?: string;
  data_timestamp?: string;
  ticker?: string;
  requested_tickers?: string[];
  answer: string;
  recommendation?: NewsRecommendation | null;
  recommendations?: NewsRecommendation[];
  top_news?: NewsItem[];
};

export type SupportedTickersResponse = {
  type: "supported_tickers";
  total: number;
  tickers: string[];
};

export type NewsRefreshResponse = {
  status: string;
  data_root?: string;
  report?: {
    timestamp?: string;
    statistics?: {
      total_news?: number;
    };
  };
};
