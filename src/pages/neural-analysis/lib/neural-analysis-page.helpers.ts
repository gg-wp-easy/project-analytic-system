import type {
  NeuralFeatureImportanceItem as FeatureImportanceItem,
  NeuralMetricItem as MetricItem,
  NeuralAnalysisResultRow as AnalysisResultRow,
  NeuralModelStatItem as ModelStatItem,
  NeuralPortfolioPosition as PortfolioPosition,
  NeuralPortfolioStrategy as PortfolioStrategy,
  NeuralTrainingPoint as TrainingPoint,
} from "../../../features/neural-analysis";
import { formatPercentOrNumber } from "../../../shared/lib/format/finance";
import { numberOr } from "../../../shared/lib/number/numberOr";

function formatMetricPercentOrNumber(value: number): string {
  return formatPercentOrNumber(value);
}

function formatMetricValue(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (Math.abs(value) >= 1000) {
      return value.toFixed(0);
    }
    return formatMetricPercentOrNumber(value);
  }
  if (typeof value === "string") {
    return value;
  }
  return "-";
}

function isMinRiskObjective(parsed: Record<string, unknown>): boolean {
  const summary = (parsed.summary as Record<string, unknown> | undefined) ?? {};
  const stats = (parsed.stats as Record<string, unknown> | undefined) ?? {};
  const objective = String(summary.optimization_objective ?? stats.optimization_objective ?? "").toLowerCase();
  return objective === "min_risk" || objective === "min_volatility" || objective === "minimum_risk";
}

export function formatOptionalNumber(value: unknown, digits = 2): string {
  const parsed = numberOr(value, NaN);
  return Number.isFinite(parsed) ? parsed.toFixed(digits) : "-";
}

export function formatPercentValue(value: unknown, digits = 2): string {
  const parsed = numberOr(value, NaN);
  return Number.isFinite(parsed) ? parsed.toFixed(digits) + "%" : "-";
}

function normalizePercentLike(value: unknown): number {
  const parsed = numberOr(value, NaN);
  if (!Number.isFinite(parsed)) {
    return NaN;
  }
  return Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
}

function normalizeScoreLike(value: unknown): number {
  const parsed = numberOr(value, NaN);
  if (!Number.isFinite(parsed)) {
    return NaN;
  }
  return Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
}

export function extractAnalysisRows(parsed: Record<string, unknown>): AnalysisResultRow[] {
  const raw =
    parsed.undervalued_stocks ??
    parsed.undervaluedStocks ??
    parsed.analysis_rows ??
    parsed.analysisRows ??
    parsed.results ??
    [];

  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item, index) => {
      const row = item as Record<string, unknown>;
      const ticker = String(row.ticker ?? row.Ticker ?? row.symbol ?? "Asset " + (index + 1));
      const name = String(row.name ?? row.Name ?? row.company ?? row.Company ?? ticker);
      return {
        figi: String(row.figi ?? row.FIGI ?? row.instrumentFigi ?? ""),
        ticker,
        name,
        pe: numberOr(row.pe, numberOr(row.pe_ratio, numberOr(row.PE, numberOr(row["P/E"], NaN)))),
        predictedPE: numberOr(row.predicted_pe, numberOr(row.predictedPE, numberOr(row.forecast_pe, NaN))),
        residual: numberOr(row.residual, numberOr(row.pe_residual, NaN)),
        undervaluationGap: normalizePercentLike(
          row.undervaluation_gap ?? row.undervalued_score ?? row.undervaluationGap ?? row.gap,
        ),
        expectedReturn: normalizePercentLike(row.expected_return ?? row.expectedReturn),
        portfolioSignal: normalizeScoreLike(row.portfolio_signal ?? row.portfolioSignal ?? row.signal),
        valueScore: normalizeScoreLike(row.value_score ?? row.valueScore),
        qualityScore: normalizeScoreLike(row.quality_score ?? row.qualityScore),
        growthScore: normalizeScoreLike(row.growth_score ?? row.growthScore),
        riskScore: normalizeScoreLike(row.risk_score ?? row.riskScore),
        roe: normalizePercentLike(row.roe ?? row.ROE),
        dividendYield: normalizePercentLike(row.dividend_yield ?? row.dividendYield),
        beta: numberOr(row.beta, NaN),
        marketCap: numberOr(row.market_cap, numberOr(row.market_cap_bn, numberOr(row.marketCap, NaN))),
      } satisfies AnalysisResultRow;
    })
    .filter((row) => row.ticker && (Number.isFinite(row.portfolioSignal) || Number.isFinite(row.undervaluationGap)))
    .sort((left, right) => {
      const signalDiff = numberOr(right.portfolioSignal, -Infinity) - numberOr(left.portfolioSignal, -Infinity);
      if (signalDiff !== 0) {
        return signalDiff;
      }
      return numberOr(right.undervaluationGap, -Infinity) - numberOr(left.undervaluationGap, -Infinity);
    });
}

export function extractFeatureImportance(parsed: Record<string, unknown>): FeatureImportanceItem[] {
  const raw =
    parsed.feature_importance ??
    parsed.featureImportance ??
    parsed.importances ??
    parsed.feature_weights ??
    parsed.feature_scores ??
    null;

  if (Array.isArray(raw)) {
    const rows = raw
      .map((item, idx) => {
        const row = item as Record<string, unknown>;
        return {
          feature: String(row.feature ?? row.name ?? row.column ?? `Feature ${idx + 1}`),
          importance: numberOr(row.importance, numberOr(row.score, numberOr(row.weight, 0))),
        };
      })
      .filter((r) => Number.isFinite(r.importance));

    const max = rows.length ? Math.max(...rows.map((r) => r.importance)) : 0;
    const normalized = max <= 1 ? rows.map((r) => ({ ...r, importance: r.importance * 100 })) : rows;
    return normalized.sort((a, b) => b.importance - a.importance);
  }

  if (raw && typeof raw === "object") {
    const entries = Object.entries(raw as Record<string, unknown>)
      .map(([feature, value]) => ({ feature, importance: numberOr(value, 0) }))
      .filter((r) => Number.isFinite(r.importance));
    const max = entries.length ? Math.max(...entries.map((r) => r.importance)) : 0;
    const normalized = max <= 1 ? entries.map((r) => ({ ...r, importance: r.importance * 100 })) : entries;
    return normalized.sort((a, b) => b.importance - a.importance);
  }

  return [];
}

export function extractPortfolioStrategies(parsed: Record<string, unknown>): PortfolioStrategy[] {
  const portfolios = parsed.portfolios;
  if (!portfolios || typeof portfolios !== "object" || Array.isArray(portfolios)) {
    return [];
  }

  const undervaluedStocks = Array.isArray(parsed.undervalued_stocks) ? parsed.undervalued_stocks : [];
  const tickerToName = new Map<string, string>();
  const tickerToExpectedReturn = new Map<string, number>();
  for (const item of undervaluedStocks) {
    const row = item as Record<string, unknown>;
    const ticker = String(row.ticker ?? row.Ticker ?? "");
    if (!ticker) {
      continue;
    }
    tickerToName.set(ticker, String(row.name ?? row.Company ?? ticker));
    tickerToExpectedReturn.set(ticker, numberOr(row.expected_return, numberOr(row.g, numberOr(row.roe, NaN))));
  }

  const labelByKey: Record<string, string> = {
    max_sharpe: "Max Sharpe",
    min_volatility: "Min Volatility",
    selected_portfolio: "Selected",
  };

  const strategies: PortfolioStrategy[] = [];
  for (const [key, raw] of Object.entries(portfolios as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") {
      continue;
    }
    const entry = raw as Record<string, unknown>;
    const metrics = (entry.metrics as Record<string, unknown> | undefined) ?? {};
    const rawPositions = Array.isArray(entry.positions) ? entry.positions : [];

    const rows = rawPositions.map((item, idx) => {
      const row = item as Record<string, unknown>;
      const ticker = String(row.ticker ?? row.Ticker ?? `Asset ${idx + 1}`);
      return {
        figi: String(row.figi ?? row.FIGI ?? row.instrumentFigi ?? ""),
        ticker,
        name: tickerToName.get(ticker) ?? ticker,
        weight: numberOr(row.weight, numberOr(row.weights, 0)),
        expectedReturn: numberOr(
          row.expected_return,
          numberOr(metrics.expected_return, numberOr(tickerToExpectedReturn.get(ticker), NaN)),
        ),
        risk: numberOr(row.risk, numberOr(metrics.volatility, numberOr(metrics.risk, NaN))),
        sharpe: numberOr(row.sharpe, numberOr(metrics.sharpe_ratio, NaN)),
        sortino: numberOr(row.sortino, numberOr(metrics.sortino, numberOr(metrics.sortino_ratio, NaN))),
        value_at_risk: numberOr(
          row.value_at_risk,
          numberOr(row.var, numberOr(metrics.value_at_risk, numberOr(metrics.var, NaN))),
        ),
      } satisfies PortfolioPosition;
    });

    const maxWeight = rows.length ? Math.max(...rows.map((r) => r.weight)) : 0;
    const normalized = maxWeight <= 1 ? rows.map((r) => ({ ...r, weight: r.weight * 100 })) : rows;

    strategies.push({
      key,
      name: labelByKey[key] ?? key,
      expectedReturn: numberOr(metrics.expected_return, NaN),
      risk: numberOr(metrics.volatility, numberOr(metrics.risk, NaN)),
      sharpe: numberOr(metrics.sharpe_ratio, NaN),
      diversification: numberOr(metrics.diversification_score, NaN),
      assetsCount: numberOr(entry.assets_count, normalized.length),
      positions: normalized.sort((a, b) => b.weight - a.weight),
    });
  }

  return strategies.sort((a, b) =>
    isMinRiskObjective(parsed)
      ? numberOr(a.risk, Infinity) - numberOr(b.risk, Infinity)
      : numberOr(b.sharpe, -Infinity) - numberOr(a.sharpe, -Infinity),
  );
}

export function extractPortfolioPositions(parsed: Record<string, unknown>): PortfolioPosition[] {
  const strategies = extractPortfolioStrategies(parsed);
  const selected = strategies.find((s) => s.key === "selected_portfolio");
  if (selected?.positions.length) {
    return selected.positions;
  }
  const maxSharpe = strategies.find((s) => s.key === "max_sharpe");
  if (maxSharpe?.positions.length) return maxSharpe.positions;
  return strategies[0]?.positions ?? [];
}

export function extractTrainingHistory(parsed: Record<string, unknown>): TrainingPoint[] {
  const history = (parsed.training_history as Record<string, unknown> | undefined) ?? {};
  const train = Array.isArray(history.train_loss) ? history.train_loss : [];
  const val = Array.isArray(history.val_loss) ? history.val_loss : [];
  const count = Math.max(train.length, val.length);

  return Array.from({ length: count }, (_, idx) => ({
    epoch: idx + 1,
    trainLoss: numberOr(train[idx], NaN),
    valLoss: numberOr(val[idx], NaN),
  })).filter((row) => Number.isFinite(row.trainLoss) || Number.isFinite(row.valLoss));
}

export function extractMetrics(parsed: Record<string, unknown>): MetricItem[] {
  const stats = (parsed.stats as Record<string, unknown> | undefined) ?? {};
  const summary = (parsed.summary as Record<string, unknown> | undefined) ?? {};
  const finalLosses =
    (parsed.final_losses as Record<string, unknown> | undefined) ??
    ((summary.final_losses as Record<string, unknown> | undefined) ?? {});
  const portfolios = (parsed.portfolios as Record<string, unknown> | undefined) ?? {};
  const selectedPortfolio =
    (portfolios.selected_portfolio as Record<string, unknown> | undefined) ??
    (portfolios.max_sharpe as Record<string, unknown> | undefined) ??
    {};
  const maxSharpeMetrics = (selectedPortfolio.metrics as Record<string, unknown> | undefined) ?? {};

  const rows: MetricItem[] = [];

  if ("best_model" in summary || "best_model" in parsed || "best_model" in stats) {
    rows.push({
      label: "Best Model",
      value: formatMetricValue(summary.best_model ?? parsed.best_model ?? stats.best_model),
    });
  }
  if ("undervalued_count" in stats || "undervalued_count" in summary) {
    rows.push({
      label: "Undervalued",
      value: formatMetricValue(stats.undervalued_count ?? summary.undervalued_count),
    });
  }
  if ("models_count" in stats) {
    rows.push({ label: "Models", value: formatMetricValue(stats.models_count) });
  }
  if ("train_loss" in finalLosses) {
    rows.push({ label: "Train Loss", value: formatMetricValue(finalLosses.train_loss) });
  }
  if ("val_loss" in finalLosses) {
    rows.push({ label: "Val Loss", value: formatMetricValue(finalLosses.val_loss) });
  }

  const portfolioMapping: Array<{ key: string; label: string }> = [
    { key: "expected_return", label: "Expected Return" },
    { key: "volatility", label: "Volatility" },
    { key: "sharpe_ratio", label: "Sharpe Ratio" },
    { key: "diversification_score", label: "Diversification" },
  ];

  for (const item of portfolioMapping) {
    if (item.key in maxSharpeMetrics) {
      rows.push({
        label: item.label,
        value: formatMetricValue(maxSharpeMetrics[item.key]),
      });
    }
  }

  return rows;
}

export function extractPortfolioAssetsCount(parsed: Record<string, unknown>): number {
  const summary = (parsed.summary as Record<string, unknown> | undefined) ?? {};
  const stats = (parsed.stats as Record<string, unknown> | undefined) ?? {};
  const portfolios = (parsed.portfolios as Record<string, unknown> | undefined) ?? {};
  const maxSharpe =
    (portfolios.selected_portfolio as Record<string, unknown> | undefined) ??
    (portfolios.max_sharpe as Record<string, unknown> | undefined) ??
    {};
  const minVolatility = (portfolios.min_volatility as Record<string, unknown> | undefined) ?? {};

  return numberOr(
    maxSharpe.assets_count,
    numberOr(
      minVolatility.assets_count,
      numberOr(stats.portfolio_assets_count, numberOr(summary.portfolio_assets_count, 0)),
    ),
  );
}

export function extractModelStats(parsed: Record<string, unknown>): ModelStatItem[] {
  const raw = parsed.model_stats ?? parsed.modelStats ?? [];
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((item, index) => {
      const row = item as Record<string, unknown>;
      return {
        modelName: String(row.model_name ?? row.modelName ?? `Model ${index + 1}`),
        hiddenLayers: String(row.hidden_layers ?? row.hiddenLayers ?? "-"),
        activation: String(row.activation ?? "-"),
        solver: String(row.solver ?? row.optimizer ?? "-"),
        bestEpoch: numberOr(row.best_epoch, NaN),
        bestValMse: numberOr(row.best_val_mse, NaN),
        finalValMse: numberOr(row.final_val_mse, NaN),
        valR2Final: numberOr(row.val_r2_final, NaN),
      } satisfies ModelStatItem;
    })
    .filter((row) => Number.isFinite(row.bestValMse))
    .sort((a, b) => a.bestValMse - b.bestValMse);
}
