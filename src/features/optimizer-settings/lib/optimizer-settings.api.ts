import { API_BASE_URL } from "../../../config/api";
import type { OptimizerSettings } from "../model/optimizer-settings.types";
import { buildOptimizerSettingsPayload } from "./optimizer-settings.helpers";

export async function submitOptimizerSettings(settings: OptimizerSettings): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/optimizer-settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildOptimizerSettingsPayload(settings)),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}${text ? `: ${text}` : ""}`);
  }
}
