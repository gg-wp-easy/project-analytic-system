/**
 * Запросы к платформе с access-токеном аккаунта.
 *
 * Обработчики сессии регистрирует слой entities/session при старте — так shared не зависит
 * от вышележащих слоёв. Истекающий токен обновляется заранее; на 401 токен обновляется
 * и запрос повторяется один раз (тела запросов — строки, их можно отправить заново).
 */

export interface PlatformAuthHandlers {
  getAccessToken: () => string | null;
  /** Обновляет пару токенов; возвращает новый access-токен или null. */
  refresh: () => Promise<string | null>;
  /** Сессия больше недействительна — нужен вход. */
  onUnauthorized: () => void;
  /** 403: тариф пользователя изменился — перечитать профиль. */
  onForbidden?: () => void;
}

let handlers: PlatformAuthHandlers | null = null;
let refreshing: Promise<string | null> | null = null;

export function configurePlatformAuth(next: PlatformAuthHandlers | null): void {
  handlers = next;
}

/** Одновременные запросы ждут одно и то же обновление токена. */
function refreshOnce(): Promise<string | null> {
  if (!handlers) {
    return Promise.resolve(null);
  }
  refreshing ??= handlers.refresh().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

const REFRESH_SKEW_MS = 30_000;

/** Время истечения JWT в миллисекундах или null (подпись проверяет сервер). */
export function jwtExpiresAt(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) {
      return null;
    }
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const exp = (JSON.parse(json) as { exp?: unknown }).exp;
    return typeof exp === "number" ? exp * 1000 : null;
  } catch {
    return null;
  }
}

async function currentToken(): Promise<string | null> {
  if (!handlers) {
    return null;
  }
  const token = handlers.getAccessToken();
  if (!token) {
    return refreshOnce();
  }
  const expiresAt = jwtExpiresAt(token);
  if (expiresAt !== null && expiresAt - Date.now() < REFRESH_SKEW_MS) {
    return refreshOnce();
  }
  return token;
}

function withToken(init: RequestInit | undefined, token: string | null): RequestInit {
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return { ...init, headers };
}

/** fetch к платформе с токеном аккаунта; `url` — полный адрес (platformUrl). */
export async function platformFetch(url: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(url, withToken(init, await currentToken()));
  if (response.status === 403) {
    handlers?.onForbidden?.();
    return response;
  }
  if (response.status !== 401 || !handlers) {
    return response;
  }
  const token = await refreshOnce();
  if (!token) {
    handlers.onUnauthorized();
    return response;
  }
  return fetch(url, withToken(init, token));
}

/** Текст ошибки из ответа платформы ({"detail": "..."}) или null. */
export async function readPlatformError(response: Response): Promise<string | null> {
  try {
    const body = (await response.clone().json()) as { detail?: unknown };
    if (typeof body.detail === "string") {
      return body.detail;
    }
    if (body.detail && typeof body.detail === "object" && "message" in body.detail) {
      const message = (body.detail as { message?: unknown }).message;
      return typeof message === "string" ? message : null;
    }
  } catch {
    return null;
  }
  return null;
}

/** Статусы, причину которых объясняет сама платформа: вход, тариф, лимит, очередь, сбой данных. */
const PLATFORM_STATUSES = new Set([401, 403, 429, 502, 503, 504]);

/**
 * Текст ошибки для пользователя по прочитанному телу ответа: для статусов платформы —
 * её объяснение (например, «Доступно в тарифе «Про»»), для остальных — `fallback`.
 */
export function platformErrorText(status: number, body: string, fallback: string): string {
  if (!PLATFORM_STATUSES.has(status)) {
    return fallback;
  }
  try {
    const detail = (JSON.parse(body) as { detail?: unknown }).detail;
    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }
  } catch {
    // не JSON — например, ответ шлюза
  }
  return fallback;
}
