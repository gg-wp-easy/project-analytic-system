import type { AppErrorPageText } from "./app-error.types";

export const APP_NOT_FOUND_TEXT: AppErrorPageText = {
  title: { ru: "404", en: "404" },
  description: { ru: "Страница не найдена", en: "Page not found" },
  action: { ru: "Вернуться на главную", en: "Back to dashboard" },
};

export const APP_ROUTE_ERROR_TEXT: AppErrorPageText & {
  detailsLabel: AppErrorPageText["title"];
  unknownError: AppErrorPageText["title"];
} = {
  title: { ru: "Произошла ошибка", en: "Something went wrong" },
  description: {
    ru: "Во время загрузки страницы произошла непредвиденная ошибка.",
    en: "An unexpected error occurred while loading this page.",
  },
  action: { ru: "Перейти на главную", en: "Go to dashboard" },
  detailsLabel: { ru: "Детали", en: "Details" },
  unknownError: { ru: "Неизвестная ошибка", en: "Unknown error" },
};
