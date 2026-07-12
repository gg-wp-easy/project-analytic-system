import { DEFAULT_API_BASE_URL } from "../model/api.consts";

export function resolveApiBaseUrl(envBaseUrl?: string): string {
  const normalizedBaseUrl = envBaseUrl?.trim();
  return normalizedBaseUrl || DEFAULT_API_BASE_URL;
}
