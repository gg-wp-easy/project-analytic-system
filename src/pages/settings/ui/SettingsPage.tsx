import { useEffect, useState } from "react";
import {
  DownloadCloud,
  Globe2,
  KeyRound,
  LogOut,
  Moon,
  Palette,
  RefreshCw,
  Sun,
  UserRound,
} from "lucide-react";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import { PLAN_TITLES, useSession } from "../../../entities/session";
import { PageHero, SectionCard } from "../../../shared/ui/analysis-shell";
import type { StatusState, UpdateStatusPayload } from "../model";
import { getDesktopApi, getStatusClassName } from "../lib";

export function SettingsPage() {
  const { locale, setLocale, theme, setTheme, t } = useAppSettings();
  const { user, logout } = useSession();
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [isInstallingUpdate, setIsInstallingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<StatusState>(null);
  const [updateState, setUpdateState] = useState<UpdateStatusPayload | null>(null);

  const desktopApi = getDesktopApi();
  const isDesktop = Boolean(desktopApi?.isDesktop);
  const planTitle = user ? PLAN_TITLES[user.plan] : undefined;

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
          ru: "Аккаунт, язык, тема и обновления приложения.",
          en: "Account, language, theme, and app updates.",
        })}
        accent="slate"
        aside={
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-white/60">
              {t({ ru: "Тариф", en: "Plan" })}
            </div>
            <div className="text-lg font-semibold">{planTitle ? t(planTitle) : user?.plan}</div>
            <div className="truncate text-sm text-slate-600 dark:text-white/80">{user?.email}</div>
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
        title={t({ ru: "Аккаунт", en: "Account" })}
        description={t({
          ru: "Аккаунт NK-Tech Finance. Расчёты и рыночные данные T-Invest приходят с сервера — личный токен T-Bank не нужен.",
          en: "Your NK-Tech Finance account. Calculations and T-Invest market data come from the server, so no personal T-Bank token is needed.",
        })}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <UserRound className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                {user?.name || user?.email}
              </div>
              <div className="truncate text-sm text-slate-500 dark:text-slate-400">
                {user?.name ? `${user.email} · ` : ""}
                {t({ ru: "тариф", en: "plan" })} {planTitle ? t(planTitle) : user?.plan}
              </div>
            </div>
          </div>
          <button type="button" onClick={() => void logout()} className="ui-secondary-button justify-center">
            <LogOut className="h-4 w-4" />
            {t({ ru: "Выйти", en: "Sign out" })}
          </button>
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
