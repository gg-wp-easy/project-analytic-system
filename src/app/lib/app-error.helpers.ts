import type { RouteErrorShape } from "../model";

export function formatRouteErrorDetails(error: RouteErrorShape | null, unknownErrorText: string): string {
  const details = [
    error?.status ? `HTTP ${error.status}` : unknownErrorText,
    error?.statusText,
    error?.message,
  ].filter(Boolean);

  return details.join(" • ");
}
