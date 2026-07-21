export type AnalysisParameterRow = {
  key: string;
  label: string;
  value: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function extractModelParameters(parsed: Record<string, unknown>): Record<string, unknown> {
  const stats = asRecord(parsed.stats);
  const diagnostics = asRecord(stats?.model_diagnostics);
  const summary = asRecord(parsed.summary);
  return {
    ...(asRecord(parsed.requested_parameters) ?? {}),
    ...(asRecord(diagnostics?.model_parameters) ?? {}),
    ...(asRecord(summary?.model_parameters) ?? {}),
    ...(asRecord(parsed.model_parameters) ?? {}),
  };
}

export function formatModelParameterValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((item) => formatModelParameterValue(item)).join(", ");
  }
  if (typeof value === "boolean") {
    return value ? "\u0414\u0430" : "\u041d\u0435\u0442";
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return "-";
    }
    if (Math.abs(value) >= 1000) {
      return value.toFixed(0);
    }
    return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  }
  if (typeof value === "string") {
    return value || "-";
  }
  if (value == null) {
    return "-";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

export function buildParameterRows(
  parameters: Record<string, unknown>,
  labels: Record<string, string>,
  order: string[],
): AnalysisParameterRow[] {
  const rows: AnalysisParameterRow[] = [];
  const seen = new Set<string>();

  for (const key of order) {
    if (!(key in parameters)) {
      continue;
    }
    seen.add(key);
    rows.push({ key, label: labels[key] ?? key, value: formatModelParameterValue(parameters[key]) });
  }

  for (const [key, value] of Object.entries(parameters)) {
    if (seen.has(key)) {
      continue;
    }
    rows.push({ key, label: labels[key] ?? key, value: formatModelParameterValue(value) });
  }

  return rows.filter((row) => row.value !== "-");
}
