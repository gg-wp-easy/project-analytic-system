import type { InlineTranslation } from "./app-settings.types";

export type RouteErrorShape = {
  status?: number;
  statusText?: string;
  message?: string;
};

export type AppErrorPageText = {
  title: InlineTranslation;
  description: InlineTranslation;
  action: InlineTranslation;
};
