import { DEFAULT_NUMBER_FALLBACK } from "../model";

export function numberOr(value: unknown, fallback = DEFAULT_NUMBER_FALLBACK): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}
