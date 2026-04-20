import { RouterProvider } from "react-router-dom";
import { router } from './routes';
import { AppSettingsProvider } from "./context/AppSettingsContext";
import { FundamentalsProvider } from "../entities/fundamentals";
import { OptionsProvider } from "../entities/options";

export default function App() {
  return (
    <AppSettingsProvider>
      <FundamentalsProvider>
        <OptionsProvider>
          <RouterProvider router={router} />
        </OptionsProvider>
      </FundamentalsProvider>
    </AppSettingsProvider>
  );
}

