import type { ReactNode } from "react";
import { DESKTOP_PLANS, useSession } from "../../entities/session";
import { LoginPage, OfflinePage, PlanRequiredPage } from "../../pages/login";
import { PageLoadingState } from "../../shared/ui/loading-state";
import { useAppSettings } from "../context/AppSettingsContext";

/** Приложение — после входа и только для тарифа «Про»: расчёты и данные идут с сервера. */
export function SessionGate({ children }: { children: ReactNode }) {
  const { status, user } = useSession();
  const { t } = useAppSettings();

  if (status === "loading") {
    return (
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <PageLoadingState
          title={t({ ru: "Проверяем вход", en: "Checking sign-in" })}
          subtitle={t({ ru: "Связываемся с сервером NK-Tech Finance.", en: "Contacting the NK-Tech Finance server." })}
          accentClassName="text-primary"
        />
      </main>
    );
  }
  if (status === "offline") {
    return <OfflinePage />;
  }
  if (status === "anonymous" || !user) {
    return <LoginPage />;
  }
  if (!DESKTOP_PLANS.includes(user.plan)) {
    return <PlanRequiredPage />;
  }
  return <>{children}</>;
}
