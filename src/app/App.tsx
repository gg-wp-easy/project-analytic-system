import { RouterProvider } from 'react-router';
import { router } from './routes';
import { AppSettingsProvider } from "./context/AppSettingsContext";
import { FundamentalsProvider } from "./context/FundamentalsContext";

export default function App() {
  return (
    <AppSettingsProvider>
      <FundamentalsProvider>
        <RouterProvider router={router} />
      </FundamentalsProvider>
    </AppSettingsProvider>
  );
}
