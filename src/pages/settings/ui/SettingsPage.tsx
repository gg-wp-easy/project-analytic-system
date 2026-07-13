import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  DownloadCloud,
  Eye,
  EyeOff,
  FileText,
  FolderOpen,
  Globe2,
  KeyRound,
  Moon,
  Palette,
  RefreshCw,
  Sun,
  Trash2,
} from "lucide-react";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import {
  createTBankInstrumentsApi,
  normalizeTBankToken,
} from "../../../shared/api/tbank";
import { PageHero, SectionCard } from "../../../shared/ui/analysis-shell";
import type { DesktopLogApi, LogInfo, StatusState, UpdateStatusPayload } from "../model";
import { getDesktopApi, getStatusClassName, readStoredToken, writeStoredToken } from "../lib";

export function SettingsPage() {
  const { locale, setLocale, theme, setTheme, t } = useAppSettings();
  const [token, setToken] = useState(() => readStoredToken());
  const [isVisible, setIsVisible] = useState(false);
  const [isCheckingToken, setIsCheckingToken] = useState(false);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [isInstallingUpdate, setIsInstallingUpdate] = useState(false);
  const [isOpeningLogs, setIsOpeningLogs] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<StatusState>(null);
  const [updateStatus, setUpdateStatus] = useState<StatusState>(null);
  const [logStatus, setLogStatus] = useState<StatusState>(null);
  const [updateState, setUpdateState] = useState<UpdateStatusPayload | null>(null);
  const [logInfo, setLogInfo] = useState<LogInfo | null>(null);

  const desktopApi = getDesktopApi();
  const isDesktop = Boolean(desktopApi?.isDesktop);
  const canInstallUpdates = Boolean(desktopApi?.installUpdate);
  const trimmedToken = normalizeTBankToken(token);
  const hasToken = trimmedToken.length > 0;

  const tokenPreview = useMemo(() => {
    if (!trimmedToken) {
      return "-";
    }

    if (trimmedToken.length <= 12) {
      return `${trimmedToken.slice(0, 4)}...`;
    }

    return `${trimmedToken.slice(0, 6)}...${trimmedToken.slice(-4)}`;
  }, [trimmedToken]);

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

  useEffect(() => {
    const api = getDesktopApi();
    if (!api?.getLogInfo) {
      return;
    }

    void api.getLogInfo().then(setLogInfo).catch((error) => {
      setLogStatus({
        tone: "error",
        message: error instanceof Error ? error.message : t({ ru: "Не удалось получить путь к логам.", en: "Failed to get log path." }),
      });
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
        ru: "Токен сохранён локально. Следующие запросы к T-Bank API будут использовать его автоматически.",
        en: "Token saved locally. Future T-Bank API requests will use it automatically.",
      }),
    });
  };

  const handleClearToken = () => {
    writeStoredToken("");
    setToken("");
    setTokenStatus({
      tone: "info",
      message: t({
        ru: "Токен удалён из локального хранилища.",
        en: "Token removed from local storage.",
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
          ru: `Доступ проверен: API вернул ${shares.length} инструментов акций.`,
          en: `Access checked: API returned ${shares.length} share instruments.`,
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
          ru: "Проверка обновлений доступна только в Electron-сборке.",
          en: "Update checks are available only in the Electron build.",
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
          message: result.message || t({ ru: "Автообновления недоступны для этой сборки.", en: "Auto-update is unavailable for this build." }),
        });
      } else if (result?.status === "not-available") {
        setUpdateStatus({
          tone: "info",
          message: result.message || t({ ru: "Обновлений пока нет.", en: "No updates are available." }),
        });
      } else if (result?.status === "available") {
        setUpdateStatus({
          tone: "success",
          message: result.message || t({ ru: "Обновление найдено, загрузка началась.", en: "Update found, download started." }),
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

  const handleOpenLogs = async () => {
    const api = getDesktopApi();
    if (!api?.openLogsDirectory) {
      setLogStatus({
        tone: "info",
        message: t({
          ru: "Папка логов доступна только в Electron-сборке. В браузере используйте DevTools Console.",
          en: "The logs folder is available only in the Electron build. In the browser, use DevTools Console.",
        }),
      });
      return;
    }

    setIsOpeningLogs(true);
    setLogStatus(null);

    try {
      const result = await api.openLogsDirectory();
      setLogInfo({
        logsDirectory: result.logsDirectory,
        logFilePath: result.logFilePath,
      });
      setLogStatus({
        tone: result.status === "ok" ? "success" : "error",
        message:
          result.status === "ok"
            ? t({ ru: "Папка логов открыта.", en: "Logs folder opened." })
            : result.message || t({ ru: "Не удалось открыть папку логов.", en: "Failed to open logs folder." }),
      });
    } catch (error) {
      setLogStatus({
        tone: "error",
        message: error instanceof Error ? error.message : t({ ru: "Не удалось открыть папку логов.", en: "Failed to open logs folder." }),
      });
    } finally {
      setIsOpeningLogs(false);
    }
  };

  const handleWriteTestLog = (level: keyof DesktopLogApi) => {
    const api = getDesktopApi();
    const writer = api?.log?.[level];
    if (!writer) {
      console[level === "debug" ? "debug" : level]("[settings] test log from settings page");
      setLogStatus({
        tone: "info",
        message: t({
          ru: "Тестовая запись отправлена в console.",
          en: "Test entry was sent to console.",
        }),
      });
      return;
    }

    writer("[settings] test log from settings page", { level, ts: new Date().toISOString() });
    setLogStatus({
      tone: "success",
      message: t({
        ru: "Тестовая запись отправлена в лог приложения.",
        en: "Test entry was sent to the application log.",
      }),
    });
  };

  return (
    <div className="space-y-6">
      <PageHero
        icon={KeyRound}
        title={t({ ru: "Настройки", en: "Settings" })}
        description={t({
          ru: "Токен T-Bank API, язык, тема, обновления и логи приложения собраны в одном месте.",
          en: "T-Bank API token, language, theme, updates, and app logs live in one place.",
        })}
        accent="slate"
        aside={
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.18em] text-white/60">
              {t({ ru: "Состояние", en: "Status" })}
            </div>
            <div className="text-lg font-semibold">
              {hasToken ? t({ ru: "Токен задан", en: "Token set" }) : t({ ru: "Токен не задан", en: "No token" })}
            </div>
            <div className="text-sm text-white/80">
              {isDesktop ? t({ ru: "Desktop режим", en: "Desktop mode" }) : t({ ru: "Browser режим", en: "Browser mode" })}
            </div>
          </div>
        }
      />

      <SectionCard
        title={t({ ru: "Внешний вид", en: "Appearance" })}
        description={t({
          ru: "Настройки языка и темы теперь находятся здесь, чтобы шапка оставалась только для навигации.",
          en: "Language and theme settings are here now, keeping the header focused on navigation.",
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
          ru: "Токен сохраняется только в localStorage этого приложения. После сохранения страницы фундаментала, облигаций и опционов смогут выполнять запросы без консоли браузера.",
          en: "The token is saved only in this app's localStorage. After saving, fundamentals, bonds, and options pages can make requests without the browser console.",
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

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {[
              { label: t({ ru: "Статус", en: "Status" }), value: hasToken ? t({ ru: "Заполнен", en: "Filled" }) : t({ ru: "Пусто", en: "Empty" }) },
              { label: t({ ru: "Превью", en: "Preview" }), value: tokenPreview },
              { label: t({ ru: "Длина", en: "Length" }), value: trimmedToken.length },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  {item.label}
                </div>
                <div className="mt-2 font-mono text-base font-semibold text-slate-900 dark:text-slate-100">
                  {item.value}
                </div>
              </div>
            ))}
          </div>

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
              ? "Не публикуйте токен и не коммитьте его в репозиторий. Он хранится локально в браузере или Electron-профиле текущего приложения."
              : "Do not publish the token or commit it to the repository. It is stored locally in the browser or current Electron app profile."}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title={t({ ru: "Обновления", en: "Updates" })}
        description={t({
          ru: "Проверка и установка обновлений перенесены из шапки в настройки.",
          en: "Update checks and installation moved from the header into settings.",
        })}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                {t({ ru: "Режим", en: "Mode" })}
              </div>
              <div className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">
                {canInstallUpdates ? t({ ru: "Доступно", en: "Available" }) : t({ ru: "Недоступно", en: "Unavailable" })}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                {t({ ru: "Статус", en: "Status" })}
              </div>
              <div className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">
                {updateState?.status ?? t({ ru: "Ожидание", en: "Idle" })}
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

      <SectionCard
        title={t({ ru: "Логи", en: "Logs" })}
        description={t({
          ru: "Логи renderer-процесса пишутся в файл Electron-сборки. В браузере доступна только консоль разработчика.",
          en: "Renderer logs are written to the Electron app log file. In the browser, only DevTools Console is available.",
        })}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                <FolderOpen className="h-4 w-4" />
                {t({ ru: "Папка логов", en: "Logs directory" })}
              </div>
              <div className="break-all font-mono text-xs leading-6 text-slate-600 dark:text-slate-300">
                {logInfo?.logsDirectory || t({ ru: "Недоступно в браузере", en: "Unavailable in browser" })}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                <FileText className="h-4 w-4" />
                {t({ ru: "Файл", en: "File" })}
              </div>
              <div className="break-all font-mono text-xs leading-6 text-slate-600 dark:text-slate-300">
                {logInfo?.logFilePath || "app.log"}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleOpenLogs} disabled={isOpeningLogs} className="ui-secondary-button">
              {isOpeningLogs ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />}
              {t({ ru: "Открыть папку логов", en: "Open logs folder" })}
            </button>
            <button type="button" onClick={() => handleWriteTestLog("info")} className="ui-secondary-button">
              <FileText className="h-4 w-4" />
              {t({ ru: "Тест info", en: "Test info" })}
            </button>
            <button type="button" onClick={() => handleWriteTestLog("warn")} className="ui-secondary-button">
              <FileText className="h-4 w-4" />
              {t({ ru: "Тест warn", en: "Test warn" })}
            </button>
            <button type="button" onClick={() => handleWriteTestLog("error")} className="ui-secondary-button">
              <FileText className="h-4 w-4" />
              {t({ ru: "Тест error", en: "Test error" })}
            </button>
          </div>

          {logStatus ? (
            <div className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${getStatusClassName(logStatus)}`}>
              {logStatus.message}
            </div>
          ) : null}
        </div>
      </SectionCard>
    </div>
  );
}
