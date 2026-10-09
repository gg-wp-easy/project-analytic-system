import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { configurePlatformAuth } from "../../../shared/api/platform";
import {
  loginRequest,
  logoutRequest,
  meRequest,
  refreshRequest,
  registerRequest,
  SessionApiError,
} from "../api/session.api";
import { loadStoredSession, saveStoredSession } from "../lib/session-storage.helpers";
import type {
  SessionContextValue,
  SessionStatus,
  SessionTokens,
  SessionUser,
  StoredSession,
} from "./session.types";

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Аккаунт NK-Tech Finance: вход через сервис auth платформы. Refresh-токен хранится
 * на устройстве, access-токен обновляется сам (shared/api/platform).
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const sessionRef = useRef<StoredSession | null>(loadStoredSession());
  const [user, setUser] = useState<SessionUser | null>(sessionRef.current?.user ?? null);
  const [status, setStatus] = useState<SessionStatus>(sessionRef.current ? "loading" : "anonymous");

  const store = useCallback((next: StoredSession | null) => {
    sessionRef.current = next;
    saveStoredSession(next);
    setUser(next?.user ?? null);
    setStatus(next ? "authenticated" : "anonymous");
  }, []);

  const start = useCallback(
    (user: SessionUser, tokens: SessionTokens) =>
      store({ user, accessToken: tokens.access_token, refreshToken: tokens.refresh_token }),
    [store],
  );

  const reload = useCallback(async () => {
    if (!sessionRef.current) {
      return;
    }
    try {
      const me = await meRequest();
      if (sessionRef.current) {
        store({ ...sessionRef.current, user: me });
      }
    } catch (error) {
      if (error instanceof SessionApiError && error.status === 401) {
        store(null);
      } else {
        // сервер недоступен: при запуске показываем повтор, в работе — оставляем сессию
        setStatus((current) => (current === "authenticated" ? current : "offline"));
      }
    }
  }, [store]);

  useEffect(() => {
    configurePlatformAuth({
      getAccessToken: () => sessionRef.current?.accessToken || null,
      refresh: async () => {
        const current = sessionRef.current;
        if (!current) {
          return null;
        }
        try {
          const tokens = await refreshRequest(current.refreshToken);
          const next = { ...current, accessToken: tokens.access_token, refreshToken: tokens.refresh_token };
          sessionRef.current = next;
          saveStoredSession(next);
          return tokens.access_token;
        } catch (error) {
          if (error instanceof SessionApiError && error.status === 401) {
            return null; // сессия отозвана или истекла — нужен вход
          }
          throw error; // нет сети: запрос завершится ошибкой, сессия остаётся
        }
      },
      onUnauthorized: () => store(null),
      onForbidden: () => {
        void reload();
      },
    });
    return () => configurePlatformAuth(null);
  }, [store, reload]);

  useEffect(() => {
    if (sessionRef.current) {
      void reload();
    }
  }, [reload]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { user, tokens } = await loginRequest(email.trim(), password);
      start(user, tokens);
    },
    [start],
  );

  const register = useCallback(
    async (email: string, password: string, name?: string) => {
      const { user, tokens } = await registerRequest(email.trim(), password, name);
      start(user, tokens);
    },
    [start],
  );

  const logout = useCallback(async () => {
    const current = sessionRef.current;
    store(null);
    if (current) {
      await logoutRequest(current.refreshToken);
    }
  }, [store]);

  const value = useMemo<SessionContextValue>(
    () => ({ status, user, login, register, logout, reload }),
    [status, user, login, register, logout, reload],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used inside SessionProvider");
  }
  return ctx;
}
