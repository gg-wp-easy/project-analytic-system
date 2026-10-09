import { useState, type FormEvent } from "react";
import { LogIn, RefreshCw, UserPlus } from "lucide-react";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import { useSession } from "../../../entities/session";
import { AuthScreen } from "./AuthScreen";

type Mode = "login" | "register";

const MIN_PASSWORD = 8;

export function LoginPage() {
  const { t } = useAppSettings();
  const { login, register } = useSession();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (mode === "register" && password.length < MIN_PASSWORD) {
      setError(t({ ru: `Пароль — не короче ${MIN_PASSWORD} символов.`, en: `Password must be at least ${MIN_PASSWORD} characters.` }));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : t({ ru: "Не удалось войти.", en: "Sign-in failed." }));
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  return (
    <AuthScreen>
      <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
        {mode === "login" ? t({ ru: "Вход", en: "Sign in" }) : t({ ru: "Регистрация", en: "Sign up" })}
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
        {t({
          ru: "Аккаунт NK-Tech Finance — тот же, что в учёте инвестиций и на сайте. Приложение входит в тариф «Про».",
          en: "Your NK-Tech Finance account, the same as in the investment tracker and on the site. The app is part of the Pro plan.",
        })}
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        {mode === "register" ? (
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              {t({ ru: "Имя (необязательно)", en: "Name (optional)" })}
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              maxLength={120}
              className="ui-input min-h-11 w-full"
            />
          </label>
        ) : null}
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Email
          </span>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            className="ui-input min-h-11 w-full"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            {t({ ru: "Пароль", en: "Password" })}
          </span>
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            maxLength={128}
            className="ui-input min-h-11 w-full"
          />
        </label>

        {error ? (
          <div
            role="alert"
            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100"
          >
            {error}
          </div>
        ) : null}

        <button type="submit" disabled={busy} className="ui-primary-button w-full justify-center">
          {busy ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : mode === "login" ? (
            <LogIn className="h-4 w-4" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          {mode === "login" ? t({ ru: "Войти", en: "Sign in" }) : t({ ru: "Создать аккаунт", en: "Create account" })}
        </button>
      </form>

      <div className="mt-5 text-center text-sm text-slate-600 dark:text-slate-300">
        {mode === "login" ? (
          <button type="button" onClick={() => switchMode("register")} className="font-semibold text-primary hover:underline">
            {t({ ru: "Нет аккаунта? Зарегистрироваться", en: "No account? Sign up" })}
          </button>
        ) : (
          <button type="button" onClick={() => switchMode("login")} className="font-semibold text-primary hover:underline">
            {t({ ru: "Уже есть аккаунт? Войти", en: "Already have an account? Sign in" })}
          </button>
        )}
      </div>
    </AuthScreen>
  );
}
