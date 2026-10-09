import { API_BASE_URL } from "../../../config";
import { platformErrorText, platformFetch } from "../../../shared/api/platform";
import type { OptimizerSettings } from "../model";
import { buildOptimizerSettingsPayload } from "./optimizer-settings.helpers";

export async function submitOptimizerSettings(settings: OptimizerSettings): Promise<void> {
  const response = await platformFetch(`${API_BASE_URL}/optimizer-settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildOptimizerSettingsPayload(settings)),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      platformErrorText(response.status, text, `HTTP ${response.status}${text ? `: ${text}` : ""}`),
    );
  }
}
