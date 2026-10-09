import { LEGACY_TBANK_TOKEN_STORAGE_KEY, SESSION_STORAGE_KEY } from "../model/session.consts";
import type { StoredSession } from "../model/session.types";

export function loadStoredSession(): StoredSession | null {
  try {
    window.localStorage.removeItem(LEGACY_TBANK_TOKEN_STORAGE_KEY);
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (!parsed.refreshToken || !parsed.user?.id) {
      return null;
    }
    return {
      user: parsed.user,
      accessToken: parsed.accessToken ?? "",
      refreshToken: parsed.refreshToken,
    };
  } catch {
    return null;
  }
}

export function saveStoredSession(session: StoredSession | null): void {
  try {
    if (session) {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {
    // хранилище недоступно — сессия живёт до закрытия приложения
  }
}
