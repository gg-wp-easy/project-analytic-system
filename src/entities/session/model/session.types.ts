export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  plan: string;
};

export type SessionTokens = {
  access_token: string;
  refresh_token: string;
};

export type StoredSession = {
  user: SessionUser;
  accessToken: string;
  refreshToken: string;
};

/** loading — проверяем сохранённую сессию при запуске; offline — сервер недоступен. */
export type SessionStatus = "loading" | "anonymous" | "authenticated" | "offline";

export type SessionContextValue = {
  status: SessionStatus;
  user: SessionUser | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Перечитать профиль (например, после смены тарифа). */
  reload: () => Promise<void>;
};
