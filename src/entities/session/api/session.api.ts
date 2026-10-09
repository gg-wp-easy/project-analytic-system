import { platformFetch, platformUrl, readPlatformError } from "../../../shared/api/platform";
import type { SessionTokens, SessionUser } from "../model/session.types";

export class SessionApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "SessionApiError";
    this.status = status;
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(platformUrl(path), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new SessionApiError(0, "Нет соединения с сервером NK-Tech Finance.");
  }
  if (!response.ok) {
    const detail = await readPlatformError(response);
    throw new SessionApiError(response.status, detail ?? `Ошибка входа (${response.status}).`);
  }
  return (await response.json()) as T;
}

export function loginRequest(email: string, password: string) {
  return post<{ user: SessionUser; tokens: SessionTokens }>("/auth/login", { email, password });
}

export function registerRequest(email: string, password: string, name?: string) {
  return post<{ user: SessionUser; tokens: SessionTokens }>("/auth/register", {
    email,
    password,
    name: name?.trim() || null,
  });
}

export function refreshRequest(refreshToken: string) {
  return post<SessionTokens>("/auth/refresh", { refresh_token: refreshToken });
}

export async function logoutRequest(refreshToken: string): Promise<void> {
  try {
    await fetch(platformUrl("/auth/logout"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  } catch {
    // без сети сессия всё равно забывается на этом устройстве
  }
}

export async function meRequest(): Promise<SessionUser> {
  let response: Response;
  try {
    response = await platformFetch(platformUrl("/auth/me"));
  } catch {
    throw new SessionApiError(0, "Нет соединения с сервером NK-Tech Finance.");
  }
  if (!response.ok) {
    throw new SessionApiError(response.status, (await readPlatformError(response)) ?? "Ошибка профиля");
  }
  return (await response.json()) as SessionUser;
}
