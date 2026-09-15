import { API_BASE_URL } from "../../../config";
import type { BondAnalysisBond, BondAnalysisPreferences, BondPortfolioConstructionResponse, BondRiskClassification } from "../model";

export class BondPortfolioConstructionError extends Error {
  constructor(
    message: string,
    readonly bonds: BondAnalysisBond[],
    readonly riskClassification: BondRiskClassification | null,
  ) {
    super(message);
    this.name = "BondPortfolioConstructionError";
  }
}

function errorMessage(status: number, payload: unknown): string {
  if (payload && typeof payload === "object" && "detail" in payload) {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }
    if (detail && typeof detail === "object" && "message" in detail) {
      const message = (detail as { message?: unknown }).message;
      if (typeof message === "string" && message.trim()) return message;
    }
  }
  return `Сервер не смог построить портфель облигаций (HTTP ${status}).`;
}

export async function runBondPortfolioConstruction(
  preferences: BondAnalysisPreferences,
  options: { refreshSource?: boolean } = {},
): Promise<BondPortfolioConstructionResponse> {
  const response = await fetch(`${API_BASE_URL}/analysis-bonds-portfolio`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      investment_amount: Number(preferences.investmentAmount),
      target_yield_percent: Number(preferences.targetYieldPercent),
      currency: preferences.currency,
      risk_profile: preferences.riskProfile,
      min_positions: Number(preferences.minPositions),
      max_positions: Number(preferences.maxPositions),
      payout_frequency: preferences.payoutFrequency,
      method: preferences.method,
      target_duration_years:
        preferences.method === "immunization" ? Number(preferences.targetDurationYears) : null,
      universe_limit: 160,
      refresh_source: options.refreshSource === true,
    }),
  });
  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = text;
    }
  }
  if (!response.ok) {
    const detail = payload && typeof payload === "object" && "detail" in payload
      ? (payload as { detail?: unknown }).detail : null;
    if (response.status === 422 && detail && typeof detail === "object" && "bonds" in detail) {
      const partial = detail as { bonds?: unknown; risk_classification?: unknown };
      if (Array.isArray(partial.bonds)) {
        throw new BondPortfolioConstructionError(
          errorMessage(response.status, payload),
          partial.bonds as BondAnalysisBond[],
          partial.risk_classification && typeof partial.risk_classification === "object"
            ? partial.risk_classification as BondRiskClassification : null,
        );
      }
    }
    throw new Error(errorMessage(response.status, payload));
  }
  return payload as BondPortfolioConstructionResponse;
}
