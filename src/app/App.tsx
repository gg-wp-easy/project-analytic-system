import { RouterProvider } from "react-router-dom";
import { router } from './routes';
import { AppSettingsProvider } from "./context/AppSettingsContext";
import { FundamentalsProvider } from "../entities/fundamentals";

export default function App() {
  return (
    <AppSettingsProvider>
      <FundamentalsProvider>
        <RouterProvider router={router} />
      </FundamentalsProvider>
    </AppSettingsProvider>
  );
}

