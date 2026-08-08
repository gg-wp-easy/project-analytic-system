import { useEffect, useState } from "react";
import {
  CheckCircle2,
  DownloadCloud,
  Eye,
  EyeOff,
  Globe2,
  KeyRound,
  Moon,
  Palette,
  RefreshCw,
  Sun,
  Trash2,
} from "lucide-react";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import { createTBankInstrumentsApi, normalizeTBankToken } from "../../../shared/api/tbank";
import { PageHero, SectionCard } from "../../../shared/ui/analysis-shell";
import type { StatusState, UpdateStatusPayload } from "../model";
import { getDesktopApi, getStatusClassName, readStoredToken, writeStoredToken } from "../lib";

export function SettingsPage() {
  const { locale, setLocale, theme, setTheme, t } = useAppSettings();
  const [token, setToken] = useState(() => readStoredToken());
  const [isVisible, setIsVisible] = useState(false);
  const [isCheckingToken, setIsCheckingToken] = useState(false);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [isInstallingUpdate, setIsInstallingUpdate] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<StatusState>(null);
  const [updateStatus, setUpdateStatus] = useState<StatusState>(null);
  const [updateState, setUpdateState] = useState<UpdateStatusPayload | null>(null);

  const desktopApi = getDesktopApi();
  const isDesktop = Boolean(desktopApi?.isDesktop);
  const trimmedToken = normalizeTBankToken(token);
  const hasToken = trimmedToken.length > 0;

  useEffect(() => {
    const api = getDesktopApi();
    if (!api?.onUpdateStatus) {
      return undefined;
    }

    return api.onUpdateStatus((payload) => {
      if (payload.status === "not-available") {
        setUpdateState(null);
        setUpdateStatus({
          tone: "info",
          message: t({ ru: "Обновлений пока нет.", en: "No updates are available." }),
        });
        return;
      }

      if (payload.status === "error") {
        setUpdateState(null);
        setUpdateStatus({
          tone: "error",
          message: payload.message || t({ ru: "Не удалось проверить обновления.", en: "Failed to check for updates." }),
        });
        return;
      }

      if (payload.status === "available" || payload.status === "downloading" || payload.status === "downloaded") {
        setUpdateState(payload);
      }
    });
  }, [t]);

  const updateButtonLabel =
    updateState?.status === "downloaded"
      ? t({ ru: "Установить обновление", en: "Install update" })
      : updateState?.status === "downloading"
        ? t({
            ru: `Загрузка${typeof updateState.progress === "number" ? ` ${updateState.progress}%` : ""}`,
            en: `Downloading${typeof updateState.progress === "number" ? ` ${updateState.progress}%` : ""}`,
          })
        : t({ ru: "Проверить обновления", en: "Check updates" });

  const handleSaveToken = () => {
    writeStoredToken(token);
    setToken(trimmedToken);
    setTokenStatus({
      tone: "success",
      message: t({
        ru: "Токен сохранён. Доступ к рыночным данным настроен.",
        en: "Token saved. Market data access is ready.",
      }),
    });
  };

  const handleClearToken = () => {
    writeStoredToken("");
    setToken("");
    setTokenStatus({
      tone: "info",
      message: t({
        ru: "Токен удалён.",
        en: "Token removed.",
      }),
    });
  };

  const handleCheckToken = async () => {
    if (!hasToken) {
      setTokenStatus({
        tone: "error",
        message: t({ ru: "Сначала вставьте токен.", en: "Paste a token first." }),
      });
      return;
    }

    setIsCheckingToken(true);
    setTokenStatus(null);

    try {
      const api = createTBankInstrumentsApi(trimmedToken);
      const shares = await api.fetchShares();
      setTokenStatus({
        tone: "success",
        message: t({
          ru: `Доступ подтверждён. Найдено акций: ${shares.length}.`,
          en: `Access confirmed. Shares found: ${shares.length}.`,
        }),
      });
    } catch (error) {
      setTokenStatus({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : t({ ru: "Не удалось проверить токен.", en: "Failed to check the token." }),
      });
    } finally {
      setIsCheckingToken(false);
    }
  };

  const handleCheckUpdates = async () => {
    const api = getDesktopApi();
    if (!api?.checkForUpdates) {
      setUpdateStatus({
        tone: "info",
        message: t({
          ru: "Обновления недоступны в этой версии приложения.",
          en: "Updates are unavailable in this version of the app.",
        }),
      });
      return;
    }

    setIsCheckingUpdates(true);
    setUpdateStatus(null);

    try {
      const result = await api.checkForUpdates();
      if (result?.status === "disabled") {
        setUpdateStatus({
          tone: "info",
          message: t({ ru: "Обновления недоступны в этой версии приложения.", en: "Updates are unavailable in this version of the app." }),
        });
      } else if (result?.status === "not-available") {
        setUpdateStatus({
          tone: "info",
          message: t({ ru: "Установлена актуальная версия.", en: "The app is up to date." }),
        });
      } else if (result?.status === "available") {
        setUpdateStatus({
          tone: "success",
          message: t({ ru: "Обновление найдено, загрузка началась.", en: "Update found, download started." }),
        });
      }
    } catch (error) {
      setUpdateStatus({
        tone: "error",
        message: error instanceof Error ? error.message : t({ ru: "Не удалось проверить обновления.", en: "Failed to check for updates." }),
      });
    } finally {
      setIsCheckingUpdates(false);
    }
  };

  const handleInstallUpdate = async () => {
    const api = getDesktopApi();
    if (!api?.installUpdate) {
      return;
    }

    if (updateState?.status !== "downloaded") {
      setUpdateStatus({
        tone: "info",
        message: t({
          ru: "Обновление ещё не готово к установке.",
          en: "The update is not ready to install yet.",
        }),
      });
      return;
    }

    setIsInstallingUpdate(true);
    try {
      const result = await api.installUpdate();
      if (result?.status === "disabled" || result?.status === "error") {
        setUpdateStatus({
          tone: "error",
          message: result.message || t({ ru: "Обновление недоступно.", en: "Update is unavailable." }),
        });
      }
    } catch (error) {
      api.log?.error?.("Failed to install update", error);
      setUpdateStatus({
        tone: "error",
        message: error instanceof Error ? error.message : t({ ru: "Не удалось установить обновление.", en: "Failed to install update." }),
      });
    } finally {
      setIsInstallingUpdate(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHero
        icon={KeyRound}
        title={t({ ru: "Настройки", en: "Settings" })}
        description={t({
          ru: "Язык, тема, доступ к рыночным данным и обновления приложения.",
          en: "Language, theme, market data access, and app updates.",
        })}
        accent="slate"
        aside={
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-white/60">
              {t({ ru: "Состояние", en: "Status" })}
            </div>
            <div className="text-lg font-semibold">
              {hasToken ? t({ ru: "Токен задан", en: "Token set" }) : t({ ru: "Токен не задан", en: "No token" })}
            </div>
            <div className="text-sm text-slate-600 dark:text-white/80">
              {hasToken ? t({ ru: "Рыночные данные доступны", en: "Market data available" }) : t({ ru: "Нужна настройка доступа", en: "Access setup required" })}
            </div>
          </div>
        }
      />

      <SectionCard
        title={t({ ru: "Внешний вид", en: "Appearance" })}
        description={t({
          ru: "Выберите язык интерфейса и цветовую тему.",
          en: "Choose the interface language and color theme.",
        })}
      >
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Globe2 className="h-4 w-4" />
              {t({ ru: "Язык", en: "Language" })}
            </div>
            <div className="flex flex-wrap gap-2">
              {([
                { value: "ru", label: "Русский" },
                { value: "en", label: "English" },
              ] as const).map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setLocale(item.value)}
                  className={
                    locale === item.value
                      ? "inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-950"
                      : "inline-flex items-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:bg-slate-800"
                  }
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Palette className="h-4 w-4" />
              {t({ ru: "Тема", en: "Theme" })}
            </div>
            <div className="flex flex-wrap gap-2">
              {([
                { value: "light", label: t({ ru: "Светлая", en: "Light" }), icon: Sun },
                { value: "dark", label: t({ ru: "Тёмная", en: "Dark" }), icon: Moon },
              ] as const).map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setTheme(item.value)}
                    className={
                      theme === item.value
                        ? "inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-950"
                        : "inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:bg-slate-800"
                    }
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title={t({ ru: "Доступ к рыночным данным", en: "Market Data Access" })}
        description={t({
          ru: "Токен хранится только на этом устройстве и используется для загрузки данных T-Bank Invest.",
          en: "The token stays on this device and is used to load T-Bank Invest data.",
        })}
      >
        <div className="space-y-5">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              {t({ ru: "Токен", en: "Token" })}
            </span>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type={isVisible ? "text" : "password"}
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder={t({
                  ru: "Вставьте токен T-Bank Invest API",
                  en: "Paste your T-Bank Invest API token",
                })}
                spellCheck={false}
                autoComplete="off"
                className="ui-input min-h-11 flex-1 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setIsVisible((current) => !current)}
                className="ui-secondary-button justify-center sm:w-36"
              >
                {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {isVisible ? t({ ru: "Скрыть", en: "Hide" }) : t({ ru: "Показать", en: "Show" })}
              </button>
            </div>
          </label>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleSaveToken} disabled={!hasToken} className="ui-primary-button">
              <CheckCircle2 className="h-4 w-4" />
              {t({ ru: "Сохранить токен", en: "Save token" })}
            </button>
            <button type="button" onClick={handleCheckToken} disabled={!hasToken || isCheckingToken} className="ui-secondary-button">
              {isCheckingToken ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {t({ ru: "Проверить доступ", en: "Check access" })}
            </button>
            <button type="button" onClick={handleClearToken} disabled={!token && !readStoredToken()} className="ui-secondary-button">
              <Trash2 className="h-4 w-4" />
              {t({ ru: "Удалить", en: "Remove" })}
            </button>
          </div>

          {tokenStatus ? (
            <div className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${getStatusClassName(tokenStatus)}`}>
              {tokenStatus.message}
            </div>
          ) : null}

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
            {locale === "ru"
              ? "Никому не передавайте токен. Удалить его с устройства можно кнопкой выше."
              : "Do not share the token. You can remove it from this device using the button above."}
          </div>
        </div>
      </SectionCard>

      {isDesktop ? (
        <SectionCard
          title={t({ ru: "Обновления", en: "Updates" })}
          description={t({
            ru: "Проверьте наличие новой версии и установите её, когда загрузка завершится.",
            en: "Check for a new version and install it when the download is complete.",
          })}
        >
          <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                {t({ ru: "Статус", en: "Status" })}
              </div>
              <div className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">
                {updateState?.status === "available"
                  ? t({ ru: "Обновление найдено", en: "Update found" })
                  : updateState?.status === "downloading"
                    ? t({ ru: "Загрузка", en: "Downloading" })
                    : updateState?.status === "downloaded"
                      ? t({ ru: "Готово к установке", en: "Ready to install" })
                      : t({ ru: "Обновлений нет", en: "Up to date" })}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                {t({ ru: "Версия", en: "Version" })}
              </div>
              <div className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">
                {updateState?.version || "-"}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleCheckUpdates} disabled={isCheckingUpdates || updateState?.status === "downloading"} className="ui-secondary-button">
              {isCheckingUpdates || updateState?.status === "downloading" ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {updateButtonLabel}
            </button>
            <button type="button" onClick={handleInstallUpdate} disabled={isInstallingUpdate || updateState?.status !== "downloaded"} className="ui-primary-button">
              <DownloadCloud className="h-4 w-4" />
              {isInstallingUpdate ? t({ ru: "Установка...", en: "Installing..." }) : t({ ru: "Установить", en: "Install" })}
            </button>
          </div>

          {updateStatus ? (
            <div className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${getStatusClassName(updateStatus)}`}>
              {updateStatus.message}
            </div>
          ) : null}
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
