import { resolveApiBaseUrl } from "./lib/api.helpers";
import type { ApiConfig } from "./model/api.types";

export const API_BASE_URL = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

export const API_CONFIG: ApiConfig = {
  baseUrl: API_BASE_URL,
};
