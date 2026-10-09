export const SESSION_STORAGE_KEY = "nk-analytics.session.v1";
/** Личный токен T-Bank прежних версий: данные теперь идут через платформу, токен удаляем. */
export const LEGACY_TBANK_TOKEN_STORAGE_KEY = "tbank_api_token";

/** Desktop-приложение входит в тариф «Про». */
export const DESKTOP_PLANS: ReadonlyArray<string> = ["pro"];

export const PLAN_TITLES: Record<string, { ru: string; en: string }> = {
  free: { ru: "Бесплатный", en: "Free" },
  plus: { ru: "Плюс", en: "Plus" },
  pro: { ru: "Про", en: "Pro" },
};
