/**
 * Адрес платформы NK-Tech Finance (api.<домен>): вход — /auth, расчёты — /analytics,
 * данные T-Invest — /market/tinvest. Задаётся при сборке (VITE_PLATFORM_URL); без него
 * запросы идут на тот же адрес, что и интерфейс, — в разработке их проксирует Vite
 * на шлюз `make dev` платформы (vite.config.ts).
 */
export const PLATFORM_URL = (import.meta.env.VITE_PLATFORM_URL ?? "").trim().replace(/\/+$/, "");

export function platformUrl(path: string): string {
  return `${PLATFORM_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
