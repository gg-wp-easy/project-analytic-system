import { FINANCE_EMPTY_VALUE } from "../model";

export function formatPercentOrNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return FINANCE_EMPTY_VALUE;
  }
  if (value >= 0 && value <= 1) {
    return `${(value * 100).toFixed(2)}%`;
  }
  return value.toFixed(4);
}

export function formatVarPercent(value: number): string {
  if (!Number.isFinite(value)) {
    return FINANCE_EMPTY_VALUE;
  }
  const normalized = Math.abs(value) <= 1 ? value * 100 : value;
  return `${normalized.toFixed(2)}%`;
}
