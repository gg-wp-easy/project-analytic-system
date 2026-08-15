import { RouterProvider } from "react-router-dom";
import { router } from './routes';
import { AppSettingsProvider, useAppSettings } from "./context/AppSettingsContext";
import { FundamentalsProvider } from "../entities/fundamentals";
import { OptionsProvider } from "../entities/options";
import { PageLoadingState } from "../shared/ui/loading-state";

function RouteLoadingFallback() {
  const { t } = useAppSettings();

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageLoadingState
        title={t("Открываем раздел", "Opening section")}
        subtitle={t("Загружаем только необходимые компоненты страницы.", "Loading only the components required by this page.")}
        accentClassName="text-primary"
      />
    </main>
  );
}

export default function App() {
  return (
    <AppSettingsProvider>
      <FundamentalsProvider>
        <OptionsProvider>
          <RouterProvider router={router} fallbackElement={<RouteLoadingFallback />} />
        </OptionsProvider>
      </FundamentalsProvider>
    </AppSettingsProvider>
  );
}
