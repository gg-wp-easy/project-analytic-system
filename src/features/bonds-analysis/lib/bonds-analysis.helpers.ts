import { API_BASE_URL } from "../../../config";
import type { BondAnalysisPreferences, BondCashFlowAnalysisResponse } from "../model";

function errorMessage(status: number, payload: unknown): string {
  if (payload && typeof payload === "object" && "detail" in payload) {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }
  }
  return `Сервер не смог построить желаемый денежный поток (HTTP ${status}).`;
}

export async function runBondCashFlowMatching(
  preferences: BondAnalysisPreferences,
): Promise<BondCashFlowAnalysisResponse> {
  const response = await fetch(`${API_BASE_URL}/analysis-bonds-cash-flow`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      desired_cash_flows: preferences.desiredCashFlows,
      currency: preferences.currency,
      max_risk_level: Number(preferences.targetRiskLevel),
      max_positions: Number(preferences.maxPositions),
      universe_limit: 160,
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
    throw new Error(errorMessage(response.status, payload));
  }
  return payload as BondCashFlowAnalysisResponse;
}